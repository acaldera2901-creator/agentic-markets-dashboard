"""
Per-provider API quota enforcement.
Tracks daily/monthly usage in memory (cache) + persists to Supabase source_quota_log.
Failures to persist are non-fatal — the in-memory cache is always authoritative.
"""
from __future__ import annotations
import logging
from datetime import date, datetime, timezone
from typing import Any

import httpx
from config.settings import settings

logger = logging.getLogger("quota_tracker")

DEFAULT_LIMITS: dict[str, dict[str, int]] = {
    "api_football":        {"daily": 100},
    # Paid plan: 100K credits/month (verified via x-requests-remaining 2026-06-06).
    # Daily guard 3200 ≈ 99K/month worst case; the tracker resets per-day, so
    # "daily" is the enforced limit and "monthly" documents the plan ceiling.
    "odds_api":            {"daily": 3200, "monthly": 100_000},
    "football_data_org":   {"daily": 5000},
    "openweathermap":      {"daily": 1000},
    "tennis_rapidapi":     {"daily": 100},
    "openligadb":          {"daily": 99999},
    "football_data_co_uk": {"daily": 99999},
}


class QuotaTracker:
    def __init__(
        self,
        limits: dict[str, dict[str, int]] | None = None,
        supabase_url: str | None = None,
        supabase_key: str | None = None,
    ) -> None:
        self._limits = limits or DEFAULT_LIMITS
        self._url = supabase_url or settings.SUPABASE_URL
        self._key = supabase_key or settings.SUPABASE_SERVICE_ROLE_KEY
        # cache: provider → {used: int, limit: int, date: str}
        self._cache: dict[str, dict[str, Any]] = {}

    def can_call(self, provider: str) -> bool:
        """Return True if provider has quota remaining.

        #TENNIS-ODDS-BLACKOUT fix (2026-07-15): enforce BOTH the daily and the
        monthly cap. Prima si applicava solo il daily (``daily or monthly``),
        quindi il tetto mensile 100k di The Odds API era config morto: 3200/gg ×
        31 = 99.200 senza riserva, e gli snapshot calcio hanno esaurito il mensile
        prima del reset → blackout quote tennis. Ora un provider con ``monthly``
        è bloccato appena il consumo mese-corrente (calendario) raggiunge il cap,
        anche se il daily ha ancora margine. Il daily resta la guardia anti-burst.
        NB: il cap mensile è calendar-month (conservativo); se il ciclo di billing
        del provider è disallineato serve la data di reset per allinearlo esatto.
        """
        if provider not in self._limits:
            return True
        entry = self._cache.get(provider)
        if entry is None:
            return True
        today = str(date.today())
        this_month = today[:7]
        limit_cfg = self._limits[provider]
        daily_cap = limit_cfg.get("daily")
        monthly_cap = limit_cfg.get("monthly")
        # reset del contatore giornaliero al cambio giorno (come prima)
        if entry.get("date") not in (None, today):
            entry["used"] = 0
            entry["date"] = today
        # reset del contatore mensile al cambio mese
        if entry.get("month") not in (None, this_month):
            entry["month_used"] = 0
            entry["month"] = this_month
        daily_ok = daily_cap is None or entry.get("used", 0) < daily_cap
        monthly_ok = monthly_cap is None or entry.get("month_used", 0) < monthly_cap
        return daily_ok and monthly_ok

    async def increment(self, provider: str, count: int = 1) -> None:
        """Increment usage counter and persist to Supabase (best effort).

        ``count`` lets credit-priced providers (The Odds API: markets × regions
        per call) track real credits instead of call counts (#ODDS-1). Aggiorna
        SIA il contatore giornaliero SIA quello mensile (#TENNIS-ODDS-BLACKOUT).
        """
        if provider not in self._limits:
            return
        today = str(date.today())
        this_month = today[:7]
        limit_cfg = self._limits[provider]
        limit = limit_cfg.get("daily") or limit_cfg.get("monthly") or 99999
        n = max(1, int(count))
        entry = self._cache.get(provider)
        if entry is None:
            entry = {"used": 0, "limit": limit, "date": today, "month_used": 0, "month": this_month}
            self._cache[provider] = entry
        # reset giornaliero / mensile su rollover
        if entry.get("date") not in (None, today):
            entry["used"] = 0
        if entry.get("month") not in (None, this_month):
            entry["month_used"] = 0
        entry["limit"] = limit
        entry["date"] = today
        entry["month"] = this_month
        entry["used"] = entry.get("used", 0) + n
        entry["month_used"] = entry.get("month_used", 0) + n
        await self._persist(provider, entry["used"], limit)

    def known_providers(self) -> list[str]:
        """Return the providers this tracker enforces a limit for."""
        return list(self._limits.keys())

    async def load(self, provider: str) -> None:
        """Load current usage from Supabase into cache.

        #TENNIS-ODDS-BLACKOUT: oltre alla riga di OGGI (contatore giornaliero),
        somma le righe del MESE corrente per seed del contatore mensile — così un
        restart del daemon non azzera il consumo mensile riaprendo il budget.
        """
        if not self._url or not self._key:
            return
        today = str(date.today())
        this_month = today[:7]
        month_start = f"{this_month}-01"
        limit_cfg = self._limits.get(provider, {})
        limit = limit_cfg.get("daily") or limit_cfg.get("monthly") or 99999
        try:
            async with httpx.AsyncClient(timeout=5.0) as c:
                resp = await c.get(
                    f"{self._url.rstrip('/')}/rest/v1/source_quota_log",
                    params={
                        "provider": f"eq.{provider}",
                        "date": f"gte.{month_start}",
                        "select": "date,requests_made",
                    },
                    headers=self._headers(),
                )
                if resp.status_code == 200:
                    rows = resp.json() or []
                    month_used = sum(int(r.get("requests_made", 0) or 0) for r in rows)
                    today_used = next(
                        (int(r.get("requests_made", 0) or 0) for r in rows if r.get("date") == today), 0
                    )
                    if rows:
                        self._cache[provider] = {
                            "used": today_used,
                            "limit": limit,
                            "date": today,
                            "month_used": month_used,
                            "month": this_month,
                        }
        except Exception as exc:
            logger.debug("quota load error (non-fatal): %s", exc)

    async def _persist(self, provider: str, used: int, limit: int) -> None:
        if not self._url or not self._key:
            return
        today = str(date.today())
        payload = {
            "provider": provider,
            "date": today,
            "requests_made": used,
            "requests_limit": limit,
            "last_request_at": datetime.now(timezone.utc).isoformat(),
        }
        try:
            async with httpx.AsyncClient(timeout=5.0) as c:
                await c.post(
                    f"{self._url.rstrip('/')}/rest/v1/source_quota_log",
                    json=payload,
                    headers={**self._headers(), "Prefer": "resolution=merge-duplicates"},
                )
        except Exception as exc:
            logger.debug("quota persist error (non-fatal): %s", exc)

    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self._key,
            "Authorization": f"Bearer {self._key}",
            "Content-Type": "application/json",
        }

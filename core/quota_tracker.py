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
        """Return True if provider has quota remaining."""
        if provider not in self._limits:
            return True
        entry = self._cache.get(provider)
        if entry is None:
            return True
        return entry["used"] < entry["limit"]

    async def increment(self, provider: str, count: int = 1) -> None:
        """Increment usage counter and persist to Supabase (best effort).

        ``count`` lets credit-priced providers (The Odds API: markets × regions
        per call) track real credits instead of call counts (#ODDS-1).
        """
        if provider not in self._limits:
            return
        today = str(date.today())
        limit_cfg = self._limits[provider]
        limit = limit_cfg.get("daily") or limit_cfg.get("monthly") or 99999
        entry = self._cache.get(provider)
        if entry is None:
            # first call for this provider — initialize from zero
            self._cache[provider] = {"used": 0, "limit": limit, "date": today}
        elif entry.get("date") not in (None, today):
            # date exists and is a past day — reset counter
            self._cache[provider] = {"used": 0, "limit": limit, "date": today}
        else:
            # entry exists (date is today or unset) — keep existing used, update metadata
            self._cache[provider]["limit"] = limit
            self._cache[provider]["date"] = today
        self._cache[provider]["used"] += max(1, int(count))
        await self._persist(provider, self._cache[provider]["used"], limit)

    async def load(self, provider: str) -> None:
        """Load current usage from Supabase into cache."""
        if not self._url or not self._key:
            return
        today = str(date.today())
        try:
            async with httpx.AsyncClient(timeout=5.0) as c:
                resp = await c.get(
                    f"{self._url.rstrip('/')}/rest/v1/source_quota_log",
                    params={"provider": f"eq.{provider}", "date": f"eq.{today}"},
                    headers=self._headers(),
                )
                if resp.status_code == 200:
                    rows = resp.json()
                    if rows:
                        row = rows[0]
                        limit_cfg = self._limits.get(provider, {})
                        limit = limit_cfg.get("daily") or limit_cfg.get("monthly") or 99999
                        self._cache[provider] = {
                            "used": row.get("requests_made", 0),
                            "limit": limit,
                            "date": today,
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

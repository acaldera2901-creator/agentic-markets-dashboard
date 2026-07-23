"""#ODDS-BURN-OPT / #ODDS-QUOTA-GUARD — reserve-guard condiviso per The Odds API.

Mirror Python di lib/odds-quota.ts. La fonte di verità è l'header
`x-requests-remaining` di ogni risposta (riflette il consumo REALE dell'account,
Python + TS insieme → niente doppio conteggio). Sotto una riserva il consumer si
ferma, così NON si arriva mai a 0 (resta margine per gli altri consumer).

Stato condiviso su Supabase `source_quota_log`, provider `odds_api_remaining`
(la stessa riga che il guard TS legge/scrive): TS e Python vedono lo stesso
remaining reale. Best-effort: su errore fail-open (non blocca).
"""
from __future__ import annotations
import logging
from datetime import date, datetime, timezone

import httpx
from config.settings import settings

logger = logging.getLogger("odds_reserve")

# Crediti tenuti da parte per gli altri consumer fino al reset del ciclo.
ODDS_RESERVE = 8000
PLAN_LIMIT = 100_000
_PROVIDER = "odds_api_remaining"

# Minimo remaining osservato in questo processo. None = ignoto → fail-open.
_remaining_seen: int | None = None


def _headers() -> dict[str, str]:
    key = settings.SUPABASE_SERVICE_ROLE_KEY
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}


async def seed_remaining() -> None:
    """Semina dal valore persistito (fresco < 3h). Stantìo → resta None → ri-sonda."""
    global _remaining_seen
    url = settings.SUPABASE_URL
    if not url or not settings.SUPABASE_SERVICE_ROLE_KEY:
        return
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            resp = await c.get(
                f"{url.rstrip('/')}/rest/v1/source_quota_log",
                params={
                    "provider": f"eq.{_PROVIDER}",
                    "select": "requests_made,requests_limit,last_request_at",
                    "order": "last_request_at.desc",
                    "limit": "1",
                },
                headers=_headers(),
            )
            if resp.status_code == 200 and (rows := resp.json()):
                r = rows[0]
                ts = datetime.fromisoformat(str(r["last_request_at"]).replace("Z", "+00:00"))
                age_h = (datetime.now(timezone.utc) - ts).total_seconds() / 3600.0
                if age_h < 3:  # ci fidiamo solo se recente (recovery post-ricarica)
                    used = int(r.get("requests_made", 0) or 0)
                    limit = int(r.get("requests_limit", 0) or PLAN_LIMIT)
                    _remaining_seen = max(0, limit - used)
    except Exception as exc:
        logger.debug("seed_remaining error (non-fatal): %s", exc)


def budget_ok() -> bool:
    """True se possiamo ancora chiamare /odds (sopra la riserva o remaining ignoto)."""
    return _remaining_seen is None or _remaining_seen > ODDS_RESERVE


def observe(headers) -> None:
    """Aggiorna il minimo remaining dall'header x-requests-remaining di una risposta."""
    global _remaining_seen
    try:
        raw = headers.get("x-requests-remaining")
        if raw is None:
            return
        n = int(float(raw))
    except (TypeError, ValueError):
        return
    _remaining_seen = n if _remaining_seen is None else min(_remaining_seen, n)
    # #ODDS-BURN-OPT alerting: segnala prima di restare a secco (non silenzioso).
    if n <= ODDS_RESERVE:
        logger.warning("The Odds API sotto riserva: remaining=%s (reserve=%s)", n, ODDS_RESERVE)


async def persist() -> None:
    """Persiste l'ultimo remaining osservato sulla riga condivisa (upsert provider+date)."""
    if _remaining_seen is None:
        return
    url = settings.SUPABASE_URL
    if not url or not settings.SUPABASE_SERVICE_ROLE_KEY:
        return
    used = max(0, PLAN_LIMIT - _remaining_seen)
    payload = {
        "provider": _PROVIDER,
        "date": str(date.today()),
        "requests_made": used,
        "requests_limit": PLAN_LIMIT,
        "last_request_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            await c.post(
                f"{url.rstrip('/')}/rest/v1/source_quota_log",
                json=payload,
                headers={**_headers(), "Prefer": "resolution=merge-duplicates"},
            )
    except Exception as exc:
        logger.debug("persist remaining error (non-fatal): %s", exc)


def _reset_for_test() -> None:
    global _remaining_seen
    _remaining_seen = None

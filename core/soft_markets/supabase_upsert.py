"""
Supabase upsert for soft_predictions table.
Mirrors the exact REST pattern from core/supabase_client.py.
"""
import logging

import httpx
from config.settings import settings

logger = logging.getLogger("soft_markets.upsert")


def _rest_base() -> str | None:
    url = settings.SUPABASE_URL.rstrip("/") if settings.SUPABASE_URL else ""
    if not url or not settings.SUPABASE_SERVICE_ROLE_KEY:
        return None
    return f"{url}/rest/v1"


def _headers() -> dict:
    return {
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }


async def upsert_soft_predictions(rows: list[dict]) -> int:
    """
    Upsert rows into soft_predictions, conflict key (match_key, market).
    Returns the number of rows posted; fail-soft on non-2xx (logs and returns 0).
    """
    base = _rest_base()
    if not base:
        logger.warning("upsert_soft_predictions: Supabase not configured, skipping")
        return 0
    if not rows:
        return 0

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{base}/soft_predictions?on_conflict=match_key,market",
                json=rows,
                headers=_headers(),
            )
            if resp.status_code in (200, 201, 204):
                return len(rows)
            logger.warning(
                "upsert_soft_predictions failed: %s %s",
                resp.status_code,
                resp.text[:300],
            )
            return 0
    except Exception as exc:
        logger.warning("upsert_soft_predictions error (non-fatal): %s", exc)
        return 0

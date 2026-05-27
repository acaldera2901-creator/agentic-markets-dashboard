"""
Supabase REST client for agent heartbeats.
Uses httpx (already in requirements) — no extra dependency.
Writes are fire-and-forget: failures are logged but never crash the agent.
"""
import logging
from datetime import datetime, timezone
import httpx
from config.settings import settings

logger = logging.getLogger("supabase_client")

_REST_BASE: str | None = None


def _rest_base() -> str | None:
    """Return the Supabase REST endpoint, or None if not configured."""
    global _REST_BASE
    if _REST_BASE is not None:
        return _REST_BASE
    url = settings.SUPABASE_URL.rstrip("/") if settings.SUPABASE_URL else ""
    if not url or not settings.SUPABASE_SERVICE_ROLE_KEY:
        return None
    _REST_BASE = f"{url}/rest/v1"
    return _REST_BASE


async def upsert_heartbeat(agent_name: str, status_detail: str | None = None) -> None:
    """
    Upsert a row in agent_heartbeats using Supabase PostgREST.
    Safe to call from any async context; swallows all exceptions.
    """
    base = _rest_base()
    if not base:
        return

    headers = {
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    payload = {
        "agent_name": agent_name,
        "last_seen": datetime.now(timezone.utc).isoformat(),
        "status_detail": status_detail,
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                f"{base}/agent_heartbeats",
                json=payload,
                headers=headers,
            )
            if resp.status_code not in (200, 201, 204):
                logger.warning(
                    "supabase heartbeat failed: %s %s", resp.status_code, resp.text[:200]
                )
    except Exception as exc:
        logger.debug("supabase heartbeat error (non-fatal): %s", exc)

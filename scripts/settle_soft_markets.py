"""
Settle soft-market predictions once results are available.

Usage:
    python -m scripts.settle_soft_markets

Reads soft_predictions rows where:
  - kickoff < now()
  - actual IS NULL
  - external_fixture_id IS NOT NULL

For each distinct external_fixture_id, fetches fixture statistics from
api-football and writes actual totals (corners / cards / fouls) + settled_at.
Fail-soft per fixture — one failure never blocks the rest.
"""
import asyncio
import logging
from datetime import datetime, timezone

import httpx

from config.settings import settings
from core.soft_markets.supabase_upsert import _rest_base, _headers

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("settle_soft_markets")

_DIRECT = "https://v3.football.api-sports.io"


def _af_hdr() -> dict:
    return {"x-apisports-key": settings.API_FOOTBALL_DIRECT_KEY}


def _sb_headers() -> dict:
    return {
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }


async def fetch_unsettled() -> list[dict]:
    """Read soft_predictions rows that need settlement."""
    base = _rest_base()
    if not base:
        logger.warning("Supabase not configured")
        return []
    now_iso = datetime.now(timezone.utc).isoformat()
    params = {
        "select": "id,match_key,market,external_fixture_id",
        "kickoff": f"lt.{now_iso}",
        "actual": "is.null",
        "external_fixture_id": "not.is.null",
        "order": "kickoff.asc",
        "limit": "500",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{base}/soft_predictions",
                params=params,
                headers=_sb_headers(),
            )
            if resp.status_code != 200:
                logger.warning(
                    "unsettled fetch failed: %s %s", resp.status_code, resp.text[:200]
                )
                return []
            return resp.json() or []
    except Exception as exc:
        logger.warning("unsettled fetch error: %s", exc)
        return []


def _stat(team_stats: list[dict], *names: str) -> int:
    """Sum statistics matching any of the given name substrings (case-insensitive)."""
    total = 0
    for st in team_stats:
        ty = (st.get("type") or "").lower()
        if any(n in ty for n in names):
            v = st.get("value")
            total += int(v) if isinstance(v, (int, float)) else 0
    return total


async def fetch_actuals(fixture_id: int) -> dict[str, int] | None:
    """
    Fetch fixture statistics and return {market: actual_total} or None on failure.
    corners = both teams' Corner Kicks summed.
    cards   = both teams' Yellow + Red summed.
    fouls   = both teams' Fouls summed.
    """
    async with httpx.AsyncClient(timeout=15.0) as c:
        r = await c.get(
            f"{_DIRECT}/fixtures/statistics",
            headers=_af_hdr(),
            params={"fixture": fixture_id},
        )
        if r.status_code != 200:
            logger.warning("stats fetch failed fixture=%s: %s", fixture_id, r.status_code)
            return None
        response = r.json().get("response", [])
        if not response:
            logger.info("no stats yet for fixture=%s", fixture_id)
            return None

    totals: dict[str, int] = {}
    for market, names in {
        "corners": ("corner",),
        "cards": ("yellow", "red"),
        "fouls": ("foul",),
    }.items():
        total = 0
        for team_block in response:
            stats = team_block.get("statistics", [])
            if market == "cards":
                total += _stat(stats, "yellow") + _stat(stats, "red")
            else:
                total += _stat(stats, *names)
        totals[market] = total

    return totals


async def settle_row(row_id: str, actual: int, settled_at: str) -> bool:
    """PATCH one soft_predictions row with actual + settled_at."""
    base = _rest_base()
    if not base:
        return False
    payload = {"actual": actual, "settled_at": settled_at}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.patch(
                f"{base}/soft_predictions",
                params={"id": f"eq.{row_id}"},
                json=payload,
                headers=_sb_headers(),
            )
            if resp.status_code in (200, 204):
                return True
            logger.warning(
                "settle PATCH failed id=%s: %s %s",
                row_id, resp.status_code, resp.text[:200],
            )
            return False
    except Exception as exc:
        logger.warning("settle PATCH error id=%s: %s", row_id, exc)
        return False


async def main() -> None:
    unsettled = await fetch_unsettled()
    if not unsettled:
        logger.info("No unsettled soft_predictions rows found")
        return

    logger.info("Found %d unsettled rows", len(unsettled))

    # Group by fixture_id to batch API calls
    by_fixture: dict[int, list[dict]] = {}
    for row in unsettled:
        fid = row.get("external_fixture_id")
        if fid is None:
            continue
        by_fixture.setdefault(int(fid), []).append(row)

    settled_count = 0
    failed_count = 0
    settled_at = datetime.now(timezone.utc).isoformat()

    for fixture_id, rows in by_fixture.items():
        try:
            actuals = await fetch_actuals(fixture_id)
            if actuals is None:
                logger.info("skipping fixture=%s (no stats available)", fixture_id)
                continue

            for row in rows:
                market = row["market"]
                actual = actuals.get(market)
                if actual is None:
                    logger.warning("no actual for market=%s fixture=%s", market, fixture_id)
                    continue
                ok = await settle_row(str(row["id"]), actual, settled_at)
                if ok:
                    settled_count += 1
                else:
                    failed_count += 1

        except Exception as exc:
            logger.warning("settle error fixture=%s (skipped): %s", fixture_id, exc)
            failed_count += len(rows)

        await asyncio.sleep(0.2)

    logger.info(
        "Settlement done: %d settled, %d failed", settled_count, failed_count
    )


if __name__ == "__main__":
    asyncio.run(main())

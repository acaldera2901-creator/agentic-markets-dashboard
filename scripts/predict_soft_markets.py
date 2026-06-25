"""
Predict soft markets (corners / cards / fouls) for upcoming fixtures.

Usage:
    python -m scripts.predict_soft_markets [--dry-run]

For each of the 10 configured club leagues, fetches the next 15 fixtures from
api-football (direct host), computes team-rate soft-market predictions via
core/soft_markets, and upserts them into Supabase (soft_predictions).

--dry-run: prints per-league summary + 3 sample rows; does NOT write to DB.
"""
import asyncio
import logging
import sys
from datetime import datetime, timedelta, timezone

import httpx

from config.settings import settings
from core.soft_markets.team_rates import build_rates
from core.soft_markets.writer import build_rows
from core.soft_markets.supabase_upsert import upsert_soft_predictions

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("predict_soft_markets")

_DIRECT = "https://v3.football.api-sports.io"

LEAGUES = {
    39: "PL",
    135: "SA",
    140: "PD",
    78: "BL1",
    61: "FL1",
    103: "ELI",
    113: "ALL",
    244: "VEI",
    357: "LOI",
    169: "CSL",
}


def _hdr() -> dict:
    return {"x-apisports-key": settings.API_FOOTBALL_DIRECT_KEY}


async def fetch_upcoming(league_id: int, n: int = 15) -> list[dict]:
    """Return up to n upcoming fixtures from api-football for one league."""
    async with httpx.AsyncClient(timeout=15.0) as c:
        r = await c.get(
            f"{_DIRECT}/fixtures",
            headers=_hdr(),
            params={"league": league_id, "next": n},
        )
        if r.status_code != 200:
            logger.warning("fixtures fetch failed league=%s: %s", league_id, r.status_code)
            return []
        return r.json().get("response", [])


async def main() -> None:
    dry_run = "--dry-run" in sys.argv
    if dry_run:
        logger.info("DRY-RUN mode — no writes to Supabase")

    now = datetime.now(timezone.utc)
    window_end = now + timedelta(days=10)
    all_sample_rows: list[dict] = []

    for league_id, league_code in LEAGUES.items():
        fixtures = await fetch_upcoming(league_id)
        n_fixtures = len(fixtures)
        n_predicted = 0
        n_skip_warmup = 0
        league_rows: list[dict] = []

        for fixture in fixtures:
            # Filter to within the next 10 days
            date_str: str = fixture["fixture"]["date"]
            try:
                kickoff_dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            except ValueError:
                continue
            if kickoff_dt > window_end:
                continue

            fixture_id: int = fixture["fixture"]["id"]
            home_id: int = fixture["teams"]["home"]["id"]
            away_id: int = fixture["teams"]["away"]["id"]
            home_name: str = fixture["teams"]["home"]["name"]
            away_name: str = fixture["teams"]["away"]["name"]
            kickoff_iso: str = date_str

            rates = await build_rates(home_id, away_id, kickoff_iso)
            if rates is None:
                logger.info(
                    "[%s] skip warmup: %s vs %s (%s)",
                    league_code, home_name, away_name, kickoff_iso[:10],
                )
                n_skip_warmup += 1
                await asyncio.sleep(0.2)
                continue

            rows = build_rows(home_name, away_name, kickoff_iso, league_code, rates)
            for row in rows:
                row["external_fixture_id"] = fixture_id

            league_rows.extend(rows)
            n_predicted += 1
            await asyncio.sleep(0.2)

        logger.info(
            "[%s] %d fixtures, %d predicted, %d skip-warmup",
            league_code, n_fixtures, n_predicted, n_skip_warmup,
        )

        if dry_run:
            all_sample_rows.extend(league_rows[:3])
        else:
            if league_rows:
                written = await upsert_soft_predictions(league_rows)
                logger.info("[%s] upserted %d rows", league_code, written)

    if dry_run:
        print("\n=== DRY-RUN SAMPLE ROWS (up to 3 per league) ===")
        for row in all_sample_rows[:30]:
            print(row)
        print(f"\nTotal sample rows collected: {len(all_sample_rows)}")


if __name__ == "__main__":
    asyncio.run(main())

"""
Bootstrap Elo Surface ratings from Jeff Sackmann's historical ATP/WTA data.

Downloads last 4 years of ATP + WTA match results from GitHub,
replays all matches chronologically, saves ratings to Neon DB.

Usage:
    cd ~/Desktop/sistema-andrea/agentic-markets
    source venv/bin/activate
    python scripts/bootstrap_elo.py
"""
import asyncio
import csv
import io
import logging
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("bootstrap_elo")

# ── Data sources ──────────────────────────────────────────────────────────────

BASE_ATP = "https://raw.githubusercontent.com/JeffSackmann/tennis_atp/master/atp_matches_{year}.csv"
BASE_WTA = "https://raw.githubusercontent.com/JeffSackmann/tennis_wta/master/wta_matches_{year}.csv"

YEARS = [2022, 2023, 2024, 2025]

# Surface mapping: Sackmann → our model
SURFACE_MAP = {
    "Clay": "clay",
    "Grass": "grass",
    "Hard": "hard",
    "Carpet": "hard",  # treat carpet as hard (obsolete surface)
}

# ── Download helper ───────────────────────────────────────────────────────────

def fetch_csv(url: str) -> list[dict]:
    try:
        log.info(f"Downloading {url}")
        req = urllib.request.Request(url, headers={"User-Agent": "agentic-markets-bootstrap/1.0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            content = r.read().decode("utf-8", errors="replace")
        reader = csv.DictReader(io.StringIO(content))
        rows = list(reader)
        log.info(f"  → {len(rows)} matches")
        return rows
    except Exception as e:
        log.warning(f"  ✗ Failed: {e}")
        return []

# ── Main bootstrap ────────────────────────────────────────────────────────────

async def run():
    # Late imports so we run from the project root with venv active
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from models.elo_surface import EloSurfaceModel
    from core.db import AsyncSessionLocal, EloRating, init_db

    await init_db()
    elo = EloSurfaceModel()

    # Collect all rows first, then sort chronologically
    all_rows: list[tuple[str, dict]] = []   # (tour, row)

    for year in YEARS:
        for tour, tmpl in [("ATP", BASE_ATP), ("WTA", BASE_WTA)]:
            rows = fetch_csv(tmpl.format(year=year))
            for row in rows:
                all_rows.append((tour, row))

    log.info(f"\nTotal rows fetched: {len(all_rows)}")

    # Sort by tourney_date (YYYYMMDD string)
    all_rows.sort(key=lambda x: x[1].get("tourney_date", "0"))
    log.info("Sorted chronologically — replaying matches...")

    processed = 0
    skipped = 0

    for tour, row in all_rows:
        winner = (row.get("winner_name") or "").strip()
        loser  = (row.get("loser_name")  or "").strip()
        raw_surf = (row.get("surface") or "Hard").strip()
        surface = SURFACE_MAP.get(raw_surf, "hard")

        if not winner or not loser:
            skipped += 1
            continue

        # Use slightly higher K for older matches (warm-up period)
        date_str = row.get("tourney_date", "20220101")
        try:
            match_year = int(date_str[:4])
        except Exception:
            match_year = 2022
        k = 48 if match_year <= 2022 else 32   # higher K for older data = faster calibration

        elo.update(winner=winner, loser=loser, surface=surface, k_factor=k)
        processed += 1

    log.info(f"Processed: {processed} matches  |  Skipped: {skipped}")
    log.info(f"Players with ratings: {len(elo.ratings)}")

    # Print top 20 by overall rating
    ranked = sorted(elo.ratings.items(), key=lambda x: x[1]["overall"], reverse=True)[:20]
    log.info("\n── TOP 20 OVERALL ──────────────────────────────────────")
    for i, (name, r) in enumerate(ranked, 1):
        log.info(
            f"  {i:>2}. {name:<30} "
            f"overall={r['overall']:>7.1f}  "
            f"clay={r['clay']:>7.1f}  grass={r['grass']:>7.1f}  hard={r['hard']:>7.1f}  "
            f"({r['matches']} matches)"
        )

    # Save to DB
    log.info(f"\nSaving {len(elo.ratings)} ratings to Neon DB...")
    async with AsyncSessionLocal() as session:
        count = 0
        for player, r in elo.ratings.items():
            rating = EloRating(
                player=player,
                overall=round(r["overall"], 2),
                clay=round(r["clay"], 2),
                grass=round(r["grass"], 2),
                hard=round(r["hard"], 2),
                clay_matches=r.get("clay_matches", 0),
                grass_matches=r.get("grass_matches", 0),
                hard_matches=r.get("hard_matches", 0),
                matches=r.get("matches", 0),
            )
            await session.merge(rating)
            count += 1
            if count % 500 == 0:
                log.info(f"  ... {count} saved")

        await session.commit()

    log.info(f"✓ {count} ratings saved to DB")

    # Load back to verify
    async with AsyncSessionLocal() as session:
        from sqlalchemy import func, select
        result = await session.execute(select(func.count()).select_from(EloRating))
        total = result.scalar()
    log.info(f"✓ DB verification: {total} rows in elo_ratings table")

    # Quick sanity check: predict Alcaraz vs Sinner on clay
    known = ["Carlos Alcaraz", "Jannik Sinner", "Novak Djokovic", "Rafael Nadal", "Iga Swiatek"]
    log.info("\n── SANITY CHECK — predicted win probabilities ──────────────")
    for p1 in known:
        for p2 in known:
            if p1 >= p2:
                continue
            pred = elo.predict(p1, p2, "clay")
            log.info(
                f"  {p1:<25} vs {p2:<25}  clay:  "
                f"p1={pred['p1']:.0%}  p2={pred['p2']:.0%}  "
                f"(Elo {pred['r1_effective']:.0f} vs {pred['r2_effective']:.0f})"
            )

    log.info("\n✅ Bootstrap complete — Elo ratings ready")
    log.info("   Start the system with:  python run.py")


if __name__ == "__main__":
    asyncio.run(run())

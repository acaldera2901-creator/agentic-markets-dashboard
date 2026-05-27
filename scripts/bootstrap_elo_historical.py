"""
Bootstrap Elo ratings from Jeff Sackmann's ATP/WTA historical match data.
Source: github.com/JeffSackmann/tennis_atp  &  tennis_wta

Downloads CSVs for YEARS, processes chronologically, saves ratings to DB.
Safe to re-run: upserts via session.merge().
"""
import asyncio
import csv
import io
import sys
import os
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.db import AsyncSessionLocal, init_db
from models.elo_surface import EloSurfaceModel

YEARS = [2022, 2023, 2024, 2025]

SOURCES = [
    ("ATP", "https://raw.githubusercontent.com/JeffSackmann/tennis_atp/master/atp_matches_{year}.csv"),
    ("WTA", "https://raw.githubusercontent.com/JeffSackmann/tennis_wta/master/wta_matches_{year}.csv"),
]

# K-factor by tournament level (higher = more weight on recent elite results)
K_BY_LEVEL = {
    "G": 48,   # Grand Slam
    "M": 40,   # Masters 1000 / WTA 1000
    "F": 36,   # Tour Finals
    "A": 32,   # ATP 500/250, WTA 500/250
    "D": 28,   # Davis Cup
    "C": 24,   # Challenger / 125k
}


def normalize_name(full_name: str) -> str:
    """
    'Novak Djokovic' → 'Djokovic N.'
    'Alex De Minaur' → 'De Minaur A.'
    Matches Betfair runnerName format for most players.
    """
    parts = full_name.strip().split()
    if len(parts) < 2:
        return full_name
    first = parts[0]
    last = " ".join(parts[1:])
    return f"{last} {first[0].upper()}."


def normalize_surface(surface: str) -> str:
    s = surface.lower().strip()
    if s in ("clay", "grass", "hard"):
        return s
    return "hard"  # Carpet, Indoors → hard


def parse_csv(content: str) -> list[tuple[str, str, str, int]]:
    """Return list of (winner, loser, surface, k_factor) tuples."""
    reader = csv.DictReader(io.StringIO(content))
    matches = []
    for row in reader:
        winner = row.get("winner_name", "").strip()
        loser = row.get("loser_name", "").strip()
        surface = row.get("surface", "").strip()
        score = row.get("score", "").upper()
        level = row.get("tourney_level", "A").strip()

        if not winner or not loser or not surface:
            continue
        if any(tag in score for tag in ("W/O", "RET", "DEF", "BYE", "ABD")):
            continue

        k = K_BY_LEVEL.get(level, 32)
        matches.append((
            normalize_name(winner),
            normalize_name(loser),
            normalize_surface(surface),
            k,
        ))
    return matches


async def main():
    await init_db()
    elo = EloSurfaceModel()

    total = 0
    by_tour: dict[str, int] = {}

    # Process in chronological order (years × tours)
    for year in YEARS:
        for tour, url_tpl in SOURCES:
            url = url_tpl.format(year=year)
            label = f"{tour} {year}"
            print(f"  Fetching {label}...", end=" ", flush=True)
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=20) as resp:
                    content = resp.read().decode("utf-8")
                matches = parse_csv(content)
                for winner, loser, surface, k in matches:
                    elo.update(winner, loser, surface, k_factor=k)
                total += len(matches)
                by_tour[label] = len(matches)
                print(f"{len(matches)} matches")
            except urllib.error.HTTPError as e:
                print(f"HTTP {e.code} — skipped")
            except Exception as e:
                print(f"ERROR: {e}")

    print(f"\nTotal matches: {total}")
    print(f"Players rated: {len(elo.ratings)}")

    print("\nSaving to DB...", end=" ", flush=True)
    async with AsyncSessionLocal() as session:
        await elo.save_to_db_async(session)
    print("done")

    # Top 15 by overall Elo
    top = sorted(
        [(p, r) for p, r in elo.ratings.items() if r.get("matches", 0) >= 20],
        key=lambda x: x[1]["overall"],
        reverse=True,
    )[:15]
    print("\nTop 15 (min 20 matches):")
    for player, r in top:
        print(
            f"  {player:<28} overall={r['overall']:.0f}  "
            f"clay={r['clay']:.0f}  grass={r['grass']:.0f}  hard={r['hard']:.0f}  "
            f"(n={r['matches']})"
        )


if __name__ == "__main__":
    asyncio.run(main())

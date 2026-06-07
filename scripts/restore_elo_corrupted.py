"""One-shot restore of elo_ratings rows corrupted by the duplicate-settlement bug
(#ELO-FIX-1, 2026-06-07).

Replays the EXACT bootstrap_elo.py logic in-memory (Sackmann ATP/WTA 2022-2025,
full player names, K=48 pre-2022 else 32, chronological) to recompute the
canonical ratings, then UPDATEs ONLY the corrupted rows
(elo_ratings.updated_at >= '2026-05-30') to those values. Clean rows
(the 2026-05-29 bootstrap batch) are never touched.

Orphans — corrupted players absent from the 2022-2025 Sackmann seed (real but
newer/lower-tier players the settlement first saw live) — are RESET to the model
default (1500 across the board, 0 matches): exactly the state
EloSurfaceModel._get() would create for an unseen player. They are referenced by
tennis_predictions, so resetting (not deleting) keeps the row stable and avoids
recreation churn on the next settlement load.

Dry-run by default: prints recomputed values + anchors, applies nothing.
Pass --apply to write.
"""
from __future__ import annotations

import argparse
import asyncio
import csv
import io
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from models.elo_surface import EloSurfaceModel  # noqa: E402

BASE_ATP = "https://raw.githubusercontent.com/JeffSackmann/tennis_atp/master/atp_matches_{year}.csv"
BASE_WTA = "https://raw.githubusercontent.com/JeffSackmann/tennis_wta/master/wta_matches_{year}.csv"
YEARS = [2022, 2023, 2024, 2025]
SURFACE_MAP = {"Clay": "clay", "Grass": "grass", "Hard": "hard", "Carpet": "hard"}
CORRUPT_CUTOFF = "2026-05-30"


def fetch_csv(url: str) -> list[dict]:
    req = urllib.request.Request(url, headers={"User-Agent": "agentic-markets-bootstrap/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        content = r.read().decode("utf-8", errors="replace")
    return list(csv.DictReader(io.StringIO(content)))


def build_reference_model() -> EloSurfaceModel:
    elo = EloSurfaceModel()
    all_rows: list[tuple[str, dict]] = []
    for year in YEARS:
        for tour, tmpl in [("ATP", BASE_ATP), ("WTA", BASE_WTA)]:
            try:
                for row in fetch_csv(tmpl.format(year=year)):
                    all_rows.append((tour, row))
            except Exception as e:
                print(f"  WARN fetch {tour} {year}: {e}")
    all_rows.sort(key=lambda x: x[1].get("tourney_date", "0"))
    for _tour, row in all_rows:
        winner = (row.get("winner_name") or "").strip()
        loser = (row.get("loser_name") or "").strip()
        if not winner or not loser:
            continue
        surface = SURFACE_MAP.get((row.get("surface") or "Hard").strip(), "hard")
        date_str = row.get("tourney_date", "20220101")
        try:
            match_year = int(date_str[:4])
        except Exception:
            match_year = 2022
        k = 48 if match_year <= 2022 else 32
        elo.update(winner=winner, loser=loser, surface=surface, k_factor=k)
    return elo


async def main(apply: bool) -> None:
    from sqlalchemy import select, text
    from core.db import AsyncSessionLocal, EloRating

    print("Building reference model from Sackmann data...")
    elo = build_reference_model()
    print(f"Reference players: {len(elo.ratings)}")

    # Anchor verification — must reproduce the 2026-05-29 seed.
    for name, expect in (("Carlos Alcaraz", 2412), ("Jannik Sinner", 2409)):
        if name in elo.ratings:
            got = round(elo.ratings[name]["overall"])
            ok = "OK" if abs(got - expect) <= 1 else "MISMATCH"
            print(f"  anchor {name}: got {got} expect ~{expect} -> {ok}")
        else:
            print(f"  anchor {name}: MISSING from reference")

    async with AsyncSessionLocal() as session:
        rows = (
            await session.execute(
                select(EloRating).where(
                    text("updated_at >= cast(:c as timestamptz)").bindparams(c=CORRUPT_CUTOFF)
                )
            )
        ).scalars().all()

    corrupted = [r for r in rows]
    print(f"\nCorrupted rows to process: {len(corrupted)}")

    DEFAULT = {"overall": 1500.0, "clay": 1500.0, "grass": 1500.0, "hard": 1500.0,
               "clay_matches": 0, "grass_matches": 0, "hard_matches": 0, "matches": 0}

    updates: list[dict] = []
    orphans: list[str] = []
    for r in corrupted:
        ref = elo.ratings.get(r.player)
        if ref is None:
            orphans.append(r.player)
            updates.append(
                {
                    "player": r.player,
                    **{k: DEFAULT[k] for k in
                       ("overall", "clay", "grass", "hard", "clay_matches",
                        "grass_matches", "hard_matches", "matches")},
                    "cur_overall": round(r.overall),
                    "cur_matches": r.matches,
                }
            )
            continue
        updates.append(
            {
                "player": r.player,
                "overall": round(ref["overall"], 2),
                "clay": round(ref["clay"], 2),
                "grass": round(ref["grass"], 2),
                "hard": round(ref["hard"], 2),
                "clay_matches": ref.get("clay_matches", 0),
                "grass_matches": ref.get("grass_matches", 0),
                "hard_matches": ref.get("hard_matches", 0),
                "matches": ref.get("matches", 0),
                "cur_overall": round(r.overall),
                "cur_matches": r.matches,
            }
        )

    print(f"\n{'player':<24}{'old_ov':>8}{'new_ov':>8}{'old_n':>8}{'new_n':>8}")
    for u in sorted(updates, key=lambda x: x["cur_matches"], reverse=True):
        print(f"{u['player']:<24}{u['cur_overall']:>8}{round(u['overall']):>8}{u['cur_matches']:>8}{u['matches']:>8}")

    print(f"\nOrphans reset to default (NOT in reference seed, kept at 1500): {len(orphans)}")
    for o in orphans:
        print(f"  ORPHAN->default: {o}")

    if not apply:
        print("\n[DRY-RUN] nothing written. Re-run with --apply.")
        return

    async with AsyncSessionLocal() as session:
        for u in updates:
            await session.execute(
                text(
                    "UPDATE elo_ratings SET overall=:overall, clay=:clay, grass=:grass, hard=:hard, "
                    "clay_matches=:clay_matches, grass_matches=:grass_matches, hard_matches=:hard_matches, "
                    "matches=:matches, updated_at=now() WHERE player=:player"
                ).bindparams(
                    overall=u["overall"], clay=u["clay"], grass=u["grass"], hard=u["hard"],
                    clay_matches=u["clay_matches"], grass_matches=u["grass_matches"],
                    hard_matches=u["hard_matches"], matches=u["matches"], player=u["player"],
                )
            )
        await session.commit()
    print(f"\n[APPLIED] updated {len(updates)} rows ({len(orphans)} reset to default)")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()
    asyncio.run(main(a.apply))

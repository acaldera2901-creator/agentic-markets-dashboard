"""
One-shot backfill: rebuild explanation + enrichment for existing World Cup paper
rows in unified_predictions.

Reads each WC row, recomputes the national Poisson probabilities (for lambdas +
match counts) from the national history CSV, reads squad/injury info from
wc_squads / wc_squad_players, builds the match-specific explanation and
Deep-Analysis enrichment, and UPDATEs the row in place.

Honesty: only real numbers. Travel/timezone need a host city that the stored
rows don't carry -> left null (fail-soft). Squad injuries come straight from the
DB. Idempotent: safe to re-run (it overwrites explanation + enrichment).

Usage:  .venv/bin/python -m scripts.backfill_wc_enrichment [--dry-run]
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys

import asyncpg

from config.settings import settings
from core.world_cup_history import canonical_team_name, load_national_history
from core.world_cup_probability import national_match_probabilities
from core.world_cup_explanation import build_wc_enrichment, build_wc_explanation


def _pick_and_conf(p_home: float, p_draw: float, p_away: float) -> tuple[str, int]:
    probs = {"HOME": p_home, "DRAW": p_draw, "AWAY": p_away}
    pick = max(probs, key=probs.get)
    return pick, round(probs[pick] * 100)


async def _squad_injuries(conn: asyncpg.Connection, canonical: str) -> tuple[list[str], bool]:
    """(injured player names, squad revealed?) for a canonical team name."""
    squad = await conn.fetchrow(
        "SELECT id FROM wc_squads WHERE team_canonical = $1 ORDER BY updated_at DESC LIMIT 1",
        canonical,
    )
    if not squad:
        return [], False
    players = await conn.fetch(
        "SELECT player_name FROM wc_squad_players WHERE squad_id = $1 AND is_injured = TRUE",
        squad["id"],
    )
    return [r["player_name"] for r in players], True


async def main(dry_run: bool) -> int:
    dsn = settings.DATABASE_URL
    if not dsn:
        print("DATABASE_URL not set", file=sys.stderr)
        return 1
    # asyncpg wants a plain postgres DSN, not the SQLAlchemy dialect form.
    dsn = dsn.replace("postgresql+asyncpg://", "postgresql://", 1)

    history = load_national_history()
    conn = await asyncpg.connect(dsn)
    try:
        rows = await conn.fetch(
            """
            SELECT id, home_team, away_team, world_cup_stage, group_name, notes
            FROM unified_predictions
            WHERE competition = 'World Cup'
            ORDER BY starts_at
            """
        )
        print(f"WC rows: {len(rows)}")
        updated = 0
        skipped = 0
        for r in rows:
            home, away = r["home_team"], r["away_team"]
            ch, ca = canonical_team_name(home), canonical_team_name(away)
            probs = national_match_probabilities(history, ch, ca)
            if not probs:
                # Fall back to stored notes probs (no lambdas available) so the
                # row still gets a specific-ish explanation rather than the
                # generic boilerplate. Form will degrade to null if no history.
                try:
                    notes = json.loads(r["notes"] or "{}")
                except (TypeError, ValueError):
                    notes = {}
                if not notes.get("p_home"):
                    print(f"  SKIP {home} vs {away}: no probabilities")
                    skipped += 1
                    continue
                probs = {
                    "p_team_a": notes["p_home"], "p_draw": notes["p_draw"],
                    "p_team_b": notes["p_away"], "lambda_a": None, "lambda_b": None,
                    "team_a_matches": None, "team_b_matches": None,
                    "model": "wc-poisson-rates-v1",
                }

            inj_home, rev_home = await _squad_injuries(conn, ch)
            inj_away, rev_away = await _squad_injuries(conn, ca)

            enrichment = build_wc_enrichment(
                home_team=home, away_team=away,
                canonical_home=ch, canonical_away=ca,
                history=history, probs=probs,
                venue=None,  # host city not stored on these rows -> travel/tz null
                squad={
                    "injuries_home": inj_home, "injuries_away": inj_away,
                    "revealed_home": rev_home, "revealed_away": rev_away,
                },
                group=(r["group_name"] or None),
            )
            pick, conf = _pick_and_conf(probs["p_team_a"], probs["p_draw"], probs["p_team_b"])
            explanation = build_wc_explanation(
                home_team=home, away_team=away,
                enrichment=enrichment, probs=probs, pick=pick, confidence=conf,
            )

            if dry_run:
                print(f"  [{pick} {conf}%] {home} vs {away}")
                print(f"    {explanation}")
                updated += 1
                continue

            await conn.execute(
                "UPDATE unified_predictions SET explanation = $1, enrichment = $2, "
                "updated_at = NOW() WHERE id = $3",
                explanation, json.dumps(enrichment), r["id"],
            )
            updated += 1
        print(f"{'would update' if dry_run else 'updated'}: {updated} | skipped: {skipped}")
        return 0
    finally:
        await conn.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    raise SystemExit(asyncio.run(main(args.dry_run)))

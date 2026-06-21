"""Backfill one-shot dei PROFILI giocatore (aggregati stagionali) su Supabase.

[GATED] Una run reale SCRIVE sul Supabase condiviso. Eseguire SOLO dopo APPROVE umano.
Il backfill delle stat per-partita (player_match_stats) usa
core.player_data_sync.backfill_recent_match_stats, che richiede una lista di
fixture e viene cablato separatamente (follow-up) — questo runner copre i profili.

Uso:
  python -m scripts.backfill_player_stats --season 2025 --dry-run   # NON scrive: stampa lo scope
  python -m scripts.backfill_player_stats --season 2025            # SCRIVE (richiede APPROVE)
"""
import argparse
import asyncio
from datetime import date

from core.player_data_tier import LEAGUE_DATA_TIER
from core.player_data_sync import sync_player_profiles


async def _run(season: int) -> dict:
    today = date.today().isoformat()
    return await sync_player_profiles(season=season, today_iso=today, xg_lookup=None)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", type=int, required=True)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if args.dry_run:
        leagues = ", ".join(sorted(LEAGUE_DATA_TIER))
        print(f"DRY-RUN: nessuna scrittura. Backfill profili season={args.season} "
              f"per {len(LEAGUE_DATA_TIER)} leghe: {leagues}")
        return

    summary = asyncio.run(_run(args.season))
    print(f"summary: {summary}")


if __name__ == "__main__":
    main()

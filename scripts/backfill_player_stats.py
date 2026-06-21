"""Backfill one-shot dei profili giocatore (2 stagioni) + stat recenti.

[GATED] Scrive sul Supabase condiviso. Eseguire SOLO dopo APPROVE umano.
Uso:
  python -m scripts.backfill_player_stats --season 2025 --dry-run
"""
import argparse
import asyncio
from datetime import date

from core.player_data_sync import sync_player_profiles


async def _run(season: int) -> dict:
    today = date.today().isoformat()
    return await sync_player_profiles(season=season, today_iso=today, xg_lookup=None)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", type=int, required=True)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    summary = asyncio.run(_run(args.season))
    print(("DRY-RUN " if args.dry_run else "") + f"summary: {summary}")


if __name__ == "__main__":
    main()

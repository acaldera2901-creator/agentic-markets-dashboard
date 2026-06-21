"""Backfill profili giocatore da ESPN (fonte gratuita, copre WC + club leagues).

[SCRIVE player_profiles] — usa --dry-run per verificare senza scrivere
(il dry-run colpisce solo ESPN, non serve nemmeno il DB).

Uso:
  python -m scripts.backfill_player_stats_espn --dry-run
  python -m scripts.backfill_player_stats_espn --days-back 35
"""
import argparse
import asyncio
import json
from datetime import date, timezone, datetime

from core.espn_player_backfill import backfill_espn

# Competizioni in stagione ora. ESPN league key da espn_soccer_client.ESPN_LEAGUE_CODES.
DEFAULT_COMPETITIONS = [
    {"our_league": "WC", "espn_league": "fifa.world", "season": 2026},
]


async def _run(days_back: int, dry_run: bool) -> dict:
    today = datetime.now(timezone.utc).date().isoformat()
    return await backfill_espn(DEFAULT_COMPETITIONS, today_iso=today,
                               days_back=days_back, dry_run=dry_run)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--days-back", type=int, default=35)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    out = asyncio.run(_run(args.days_back, args.dry_run))
    print(("DRY-RUN " if args.dry_run else "") + json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()

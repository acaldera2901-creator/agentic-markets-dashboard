# scripts/backfill_wc_squads.py
"""
One-shot WC squad capture (Track A).

Captures the CURRENT 48 rosters into wc_squads/wc_squad_players and writes the
first wc_squad_snapshots rows, without waiting for the collector deploy. Run it
once right after applying db/migrations/003_wc_squads.sql (APPROVE msg_mq1ek03x:
Andrea-side runs this), then the DataCollector hook keeps it current:

    python -m scripts.backfill_wc_squads

Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the environment.
Exit code: 0 = synced, 1 = skipped (missing env / ESPN unavailable).
"""
import asyncio

from core.wc_squad_sync import sync_rosters


async def main() -> int:
    summary = await sync_rosters()
    if summary["skipped"]:
        print("SKIPPED: SUPABASE env missing or ESPN unavailable — nothing written.")
        return 1
    print(
        f"WC squad backfill: teams_seen={summary['teams_seen']} "
        f"teams_synced={summary['teams_synced']} "
        f"snapshots_written={summary['snapshots_written']}"
    )
    for err in summary["errors"]:
        print(f"  error: {err}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

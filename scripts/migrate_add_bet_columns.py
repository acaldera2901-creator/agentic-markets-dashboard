"""
Migration: add home_team, away_team, kickoff, league, matchday_id columns to bets table.
Run once on existing databases before upgrading to the new version.

Usage:
    python scripts/migrate_add_bet_columns.py
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from config.settings import settings

COLUMNS = [
    ("home_team",   "VARCHAR"),
    ("away_team",   "VARCHAR"),
    ("kickoff",     "VARCHAR"),
    ("league",      "VARCHAR"),
    ("matchday_id", "VARCHAR"),
]


async def migrate():
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async with engine.begin() as conn:
        for col_name, col_type in COLUMNS:
            try:
                await conn.execute(
                    text(f"ALTER TABLE bets ADD COLUMN IF NOT EXISTS {col_name} {col_type}")
                )
                print(f"  ✓ bets.{col_name} ({col_type})")
            except Exception as e:
                print(f"  ✗ bets.{col_name}: {e}")
    await engine.dispose()
    print("\nMigration complete.")


if __name__ == "__main__":
    asyncio.run(migrate())

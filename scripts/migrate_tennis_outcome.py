"""
Migration: add outcome, winner, settled_at to tennis_predictions table.
Safe to run multiple times (uses IF NOT EXISTS pattern via exception handling).
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from core.db import engine


COLUMNS = [
    ("outcome", "VARCHAR"),
    ("winner", "VARCHAR"),
    ("settled_at", "TIMESTAMP"),
]


async def migrate():
    async with engine.begin() as conn:
        for col_name, col_type in COLUMNS:
            try:
                await conn.execute(
                    text(f"ALTER TABLE tennis_predictions ADD COLUMN {col_name} {col_type}")
                )
                print(f"  ✅ Added column: {col_name} ({col_type})")
            except Exception as e:
                if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                    print(f"  ⏭  Column already exists: {col_name}")
                else:
                    print(f"  ❌ Error adding {col_name}: {e}")
    print("\nMigration complete.")


if __name__ == "__main__":
    asyncio.run(migrate())

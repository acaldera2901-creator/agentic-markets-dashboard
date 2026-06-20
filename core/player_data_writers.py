"""Scrittura idempotente dei dati giocatore su Supabase (PATCH-then-POST)."""
from __future__ import annotations
import logging
from dataclasses import asdict

import httpx

from core.supabase_client import _rest_base, _service_headers
from core.player_models import PlayerProfile, PlayerMatchStat, PlayerLineupEntry

logger = logging.getLogger(__name__)


async def _upsert(table: str, rows: list[dict], match_params) -> int:
    base = _rest_base()
    if not base:
        return 0
    headers = _service_headers()
    written = 0
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            for row in rows:
                try:
                    q = match_params(row)
                    resp = await client.patch(
                        f"{base}/{table}?{q}",
                        json=row,
                        headers={**headers, "Prefer": "return=representation"},
                    )
                    if resp.status_code == 200 and resp.json():
                        written += 1
                        continue
                    if resp.status_code not in (200, 404):
                        logger.warning("%s PATCH failed: %s", table, resp.status_code)
                        continue
                    resp = await client.post(f"{base}/{table}", json=row, headers=headers)
                    if resp.status_code in (200, 201, 204):
                        written += 1
                except Exception as exc:
                    logger.warning("%s row skipped: %s", table, exc)
    except Exception as exc:
        logger.warning("%s client error: %s", table, exc)
    return written


async def upsert_player_profiles(profiles: list[PlayerProfile]) -> int:
    return await _upsert(
        "player_profiles",
        [asdict(p) for p in profiles],
        lambda r: f"player_id=eq.{r['player_id']}",
    )


async def upsert_player_match_stats(rows: list[PlayerMatchStat]) -> int:
    return await _upsert(
        "player_match_stats",
        [asdict(r) for r in rows],
        lambda r: f"player_id=eq.{r['player_id']}&fixture_id=eq.{r['fixture_id']}",
    )


async def upsert_player_lineups(rows: list[PlayerLineupEntry]) -> int:
    return await _upsert(
        "player_lineups",
        [asdict(r) for r in rows],
        lambda r: f"player_id=eq.{r['player_id']}&fixture_id=eq.{r['fixture_id']}",
    )

# core/wc_squad_sync.py
"""
WC squad persistence (Track A — docs/superpowers/specs/2026-06-05-world-cup-wing-design.md).

Persists the ESPN squad rosters that otherwise live only in the 6h in-process
cache: current state in wc_squads/wc_squad_players, append-only reveal history
in wc_squad_snapshots — a snapshot is written ONLY when a team's roster hash
changes (squad announcement, cut, injury flip). That history is the data the
convocazioni analysis layer is built on; it cannot be reconstructed later.

Fail-soft like core/supabase_client.py: provider/Supabase errors are logged
and reported in the returned summary — sync_rosters() never raises into the
collector cycle.
"""
from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone

import httpx

from core.espn_soccer_client import get_team_squad, get_world_cup_teams
from core.supabase_client import _rest_base, _service_headers
from core.world_cup_history import canonical_team_name

logger = logging.getLogger("wc_squad_sync")

SOURCE = "espn"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def roster_hash(players: list[dict]) -> str:
    """Order-insensitive sha256 over (name, position, injured) per player."""
    canon = sorted(
        [p.get("name") or "", p.get("position") or "", bool(p.get("injured"))]
        for p in players
    )
    return hashlib.sha256(json.dumps(canon).encode()).hexdigest()


def diff_rosters(prev: list[dict] | None, new: list[dict]) -> dict | None:
    """Reveal diff vs the previous roster; None on first capture (no diff)."""
    if prev is None:
        return None
    prev_by_name = {p.get("name"): p for p in prev if p.get("name")}
    new_by_name = {p.get("name"): p for p in new if p.get("name")}
    return {
        "added": sorted(n for n in new_by_name if n not in prev_by_name),
        "removed": sorted(n for n in prev_by_name if n not in new_by_name),
        "injury_changes": sorted(
            n
            for n in new_by_name
            if n in prev_by_name
            and bool(new_by_name[n].get("injured"))
            != bool(prev_by_name[n].get("injured"))
        ),
    }


def _player_rows(squad_id: str, players: list[dict]) -> list[dict]:
    """Bulk rows with IDENTICAL keys and explicit None for missing values —
    non-uniform keys make PostgREST silently reject the whole bulk insert
    (P1/P3 lesson, 2026-06-05)."""
    return [
        {
            "squad_id": squad_id,
            "player_name": p["name"],
            "position": p.get("position"),
            "is_injured": bool(p.get("injured")),
            "shirt_number": p.get("shirt_number"),
            "club_team": p.get("club_team"),
            "age": p.get("age"),
            "updated_at": _now(),
        }
        for p in players
        if p.get("name")
    ]

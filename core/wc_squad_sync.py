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
    # Scope is INTENTIONALLY membership+injury only: shirt_number/club/age
    # (future enrichment) must NOT trigger reveal snapshots.
    canon = sorted(
        [p.get("name") or "", p.get("position") or "", bool(p.get("injured"))]
        for p in players
    )
    return hashlib.sha256(json.dumps(canon).encode()).hexdigest()


def diff_rosters(prev: list[dict] | None, new: list[dict]) -> dict | None:
    """Reveal diff vs the previous roster; None on first capture (no diff).

    Keyed on (name, position): two players sharing a displayName (possible
    across 48 international squads) must not silently collapse — roster_hash
    covers ALL players, so a collapsed diff would write a snapshot whose diff
    does not explain its own hash change.
    """
    if prev is None:
        return None

    def _by_key(roster: list[dict]) -> dict:
        out = {}
        for p in roster:
            if p.get("name"):
                out[(p["name"], p.get("position") or "")] = p
        if len(out) != sum(1 for p in roster if p.get("name")):
            logger.debug("duplicate (name, position) entries collapsed in roster diff")
        return out

    prev_by_key = _by_key(prev)
    new_by_key = _by_key(new)
    return {
        "added": sorted({k[0] for k in new_by_key.keys() - prev_by_key.keys()}),
        "removed": sorted({k[0] for k in prev_by_key.keys() - new_by_key.keys()}),
        "injury_changes": sorted({
            k[0]
            for k in new_by_key.keys() & prev_by_key.keys()
            if bool(new_by_key[k].get("injured")) != bool(prev_by_key[k].get("injured"))
        }),
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

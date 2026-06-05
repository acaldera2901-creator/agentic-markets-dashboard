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
    (P1/P3 lesson, 2026-06-05). Deduped by player_name: the table has
    UNIQUE(squad_id, player_name) and a 409 rejects the WHOLE batch; the
    full (duplicate-preserving) roster lives in the snapshot JSONB."""
    seen: set[str] = set()
    rows: list[dict] = []
    for p in players:
        name = p.get("name")
        if not name:
            continue
        if name in seen:
            logger.warning("duplicate player_name %r dropped from wc_squad_players bulk", name)
            continue
        seen.add(name)
        rows.append({
            "squad_id": squad_id,
            "player_name": name,
            "position": p.get("position"),
            "is_injured": bool(p.get("injured")),
            "shirt_number": p.get("shirt_number"),
            "club_team": p.get("club_team"),
            "age": p.get("age"),
            "updated_at": _now(),
        })
    return rows


async def _latest_snapshot(client, base, headers, team_canonical) -> dict | None:
    """Latest snapshot row ({roster, roster_hash}) for one team, or None."""
    resp = await client.get(
        f"{base}/wc_squad_snapshots",
        params={
            "select": "roster,roster_hash",
            "team_canonical": f"eq.{team_canonical}",
            "source": f"eq.{SOURCE}",
            "order": "captured_at.desc",
            "limit": "1",
        },
        headers=headers,
    )
    if resp.status_code != 200:
        return None
    rows = resp.json() or []
    return rows[0] if rows else None


async def _write_team(client, base, headers, *, team_canonical, team_id, squad, new_hash) -> bool:
    """Upsert current state + append the reveal snapshot for ONE changed team.

    roster_hash is committed LAST (separate PATCH): it is the change-detection
    key, so it must only land after players + snapshot succeeded — a partial
    failure leaves the stored hash stale and the next cycle retries
    (self-healing). Returns True only when the full write committed.
    """
    players = squad["players"]

    # 1) upsert wc_squads WITHOUT roster_hash (committed last) -> squad_id
    resp = await client.post(
        f"{base}/wc_squads",
        params={"on_conflict": "team_canonical,source"},
        json={
            "team_canonical": team_canonical,
            "team_id_espn": str(team_id),
            "squad_size": squad.get("squad_size"),
            "injured_count": squad.get("injured"),
            "source": SOURCE,
            "updated_at": _now(),
        },
        headers={**headers, "Prefer": "resolution=merge-duplicates,return=representation"},
    )
    if resp.status_code not in (200, 201):
        logger.warning("wc_squads upsert failed for %s: %s %s",
                       team_canonical, resp.status_code, str(resp.json())[:200])
        return False
    rows = resp.json() or []
    if not rows or not rows[0].get("id"):
        logger.warning("wc_squads upsert returned no id for %s", team_canonical)
        return False
    squad_id = rows[0]["id"]

    # 2) diff vs the last snapshot BEFORE appending the new one
    prev = await _latest_snapshot(client, base, headers, team_canonical)
    diff = diff_rosters(prev.get("roster") if prev else None, players)

    # 3) replace current players (delete + uniform deduped bulk insert).
    #    A failure here aborts BEFORE the snapshot/hash commit -> retried.
    await client.delete(
        f"{base}/wc_squad_players",
        params={"squad_id": f"eq.{squad_id}"},
        headers=headers,
    )
    rows_payload = _player_rows(squad_id, players)
    if rows_payload:
        resp = await client.post(
            f"{base}/wc_squad_players", json=rows_payload, headers=headers
        )
        if resp.status_code not in (200, 201, 204):
            logger.warning("wc_squad_players insert failed for %s: %s",
                           team_canonical, resp.status_code)
            return False

    # 4) append-only reveal snapshot — skipped when the latest snapshot already
    #    carries this hash (a previous attempt failed after this step)
    if not prev or prev.get("roster_hash") != new_hash:
        resp = await client.post(
            f"{base}/wc_squad_snapshots",
            json={
                "team_canonical": team_canonical,
                "source": SOURCE,
                "roster_hash": new_hash,
                "roster": players,
                "diff": diff,
                "captured_at": _now(),
            },
            headers=headers,
        )
        if resp.status_code not in (200, 201, 204):
            logger.warning("wc_squad_snapshots insert failed for %s: %s",
                           team_canonical, resp.status_code)
            return False

    # 5) commit the hash — the write is now complete
    resp = await client.patch(
        f"{base}/wc_squads",
        params={"id": f"eq.{squad_id}"},
        json={"roster_hash": new_hash, "updated_at": _now()},
        headers=headers,
    )
    if resp.status_code not in (200, 204):
        logger.warning("wc_squads hash commit failed for %s: %s",
                       team_canonical, resp.status_code)
        return False
    return True


async def sync_rosters() -> dict:
    """Sync every cached WC roster to Supabase. Returns a summary dict;
    NEVER raises (fail-soft contract with the collector cycle)."""
    summary = {
        "teams_seen": 0,
        "teams_synced": 0,
        "snapshots_written": 0,
        "errors": [],
        "skipped": False,
    }
    base = _rest_base()
    if not base:
        summary["skipped"] = True
        return summary
    headers = _service_headers()

    try:
        teams = await get_world_cup_teams()
    except Exception as exc:
        summary["errors"].append(f"teams:{exc}")
        return summary
    if not teams:
        summary["skipped"] = True
        return summary

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # current hashes in ONE round trip (<=48 rows)
            current: dict[str, dict] = {}
            resp = await client.get(
                f"{base}/wc_squads",
                params={"select": "id,team_canonical,roster_hash", "source": f"eq.{SOURCE}"},
                headers=headers,
            )
            if resp.status_code == 200:
                current = {r["team_canonical"]: r for r in resp.json() or []}
            else:
                summary["errors"].append(f"wc_squads_get:{resp.status_code}")

            for team in teams:
                try:
                    squad = await get_team_squad(team["id"])
                    if not squad or not squad.get("players"):
                        continue
                    summary["teams_seen"] += 1
                    team_canonical = canonical_team_name(squad.get("team") or team["name"])
                    new_hash = roster_hash(squad["players"])
                    prev = current.get(team_canonical)
                    if prev and prev.get("roster_hash") == new_hash:
                        continue  # unchanged — zero writes
                    if await _write_team(
                        client, base, headers,
                        team_canonical=team_canonical,
                        team_id=team["id"], squad=squad, new_hash=new_hash,
                    ):
                        summary["teams_synced"] += 1
                        summary["snapshots_written"] += 1
                    else:
                        summary["errors"].append(f"{team_canonical}:write_failed")
                except Exception as exc:  # one team must not sink the sweep
                    summary["errors"].append(f"{team.get('name')}:{exc}")
    except Exception as exc:
        summary["errors"].append(f"client:{exc}")

    if summary["snapshots_written"]:
        logger.info(
            "WC squad sync: %d/%d teams changed -> snapshots written",
            summary["snapshots_written"], summary["teams_seen"],
        )
    return summary

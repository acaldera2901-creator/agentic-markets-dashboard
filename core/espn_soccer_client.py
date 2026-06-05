"""
ESPN Soccer Client — free, no API key (same site API family as espn_tennis_client).

World Cup 2026 squad/lineup provider (P4-A, decision Andrea 2026-06-05: ESPN):
  - get_world_cup_teams()  -> the 48 qualified teams (id, name)
  - get_team_squad(id)     -> roster athletes with the ESPN `injuries` flag
  - get_squad_coverage()   -> {team_name: {squad_size, injured, fetched_at}} for
                              every WC team, cached in-process for SQUAD_TTL.

Squad data feeds the `squad_news` readiness gate: the gate is true only while
coverage is fresh and broad enough (see agents/data_collector.py). Match-day
starting lineups appear in the ESPN summary endpoint ~1h before kickoff; squads
(extended rosters + injury flags) are available before that — they are the
pre-tournament signal this provider is for.
"""
from __future__ import annotations

import logging
import time
from typing import Any

import httpx

logger = logging.getLogger("espn_soccer_client")

_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world"
_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; AgenticMarkets/1.0)"}

SQUAD_TTL = 6 * 3600  # squads/injuries change slowly; 6h keeps us at ~200 req/day

# In-process cache: {"teams": (ts, list), "squad:<id>": (ts, dict)}
_cache: dict[str, tuple[float, Any]] = {}


def _cached(key: str) -> Any | None:
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < SQUAD_TTL:
        return hit[1]
    return None


def _store(key: str, value: Any) -> Any:
    _cache[key] = (time.time(), value)
    return value


async def get_world_cup_teams() -> list[dict]:
    """Return the qualified WC teams as [{id, name}]. Cached."""
    cached = _cached("teams")
    if cached is not None:
        return cached
    try:
        async with httpx.AsyncClient(timeout=12.0) as c:
            resp = await c.get(f"{_BASE}/teams", headers=_HEADERS)
            if resp.status_code != 200:
                logger.warning("ESPN soccer teams: %s", resp.status_code)
                return []
            data = resp.json()
    except Exception as exc:
        logger.debug("ESPN soccer teams error (non-fatal): %s", exc)
        return []

    teams: list[dict] = []
    for sport in data.get("sports", []):
        for league in sport.get("leagues", []):
            for entry in league.get("teams", []):
                team = entry.get("team", {})
                if team.get("id") and team.get("displayName"):
                    teams.append({"id": str(team["id"]), "name": team["displayName"]})
    return _store("teams", teams)


async def get_team_squad(team_id: str) -> dict | None:
    """Return {team, squad_size, injured, players[:40]} for one team. Cached."""
    key = f"squad:{team_id}"
    cached = _cached(key)
    if cached is not None:
        return cached
    try:
        async with httpx.AsyncClient(timeout=12.0) as c:
            resp = await c.get(f"{_BASE}/teams/{team_id}/roster", headers=_HEADERS)
            if resp.status_code != 200:
                logger.debug("ESPN soccer roster %s: %s", team_id, resp.status_code)
                return None
            data = resp.json()
    except Exception as exc:
        logger.debug("ESPN soccer roster %s error (non-fatal): %s", team_id, exc)
        return None

    athletes = data.get("athletes", [])
    if not athletes:
        return None
    squad = {
        "team": data.get("team", {}).get("displayName", ""),
        "squad_size": len(athletes),
        "injured": sum(1 for a in athletes if a.get("injuries")),
        "players": [
            {
                "name": a.get("displayName"),
                "position": (a.get("position") or {}).get("abbreviation"),
                "injured": bool(a.get("injuries")),
            }
            for a in athletes[:40]
        ],
    }
    return _store(key, squad)


async def get_squad_coverage() -> dict[str, dict]:
    """
    Fetch squads for every qualified WC team (cache-aware: after the first
    cycle this is free until the TTL expires). Returns {team_name: summary}
    with summary = {squad_size, injured, fetched_at}.
    """
    teams = await get_world_cup_teams()
    coverage: dict[str, dict] = {}
    for team in teams:
        squad = await get_team_squad(team["id"])
        if squad and squad["squad_size"] > 0:
            coverage[team["name"]] = {
                "squad_size": squad["squad_size"],
                "injured": squad["injured"],
            }
    logger.info("ESPN soccer: squad coverage %d/%d WC teams", len(coverage), len(teams))
    return coverage


async def get_match_lineups(event_id: str) -> dict | None:
    """
    Starting lineups for one WC match (ESPN summary endpoint). Empty rosters
    before ~1h to kickoff — callers must treat None/empty as 'not published yet'.
    """
    try:
        async with httpx.AsyncClient(timeout=12.0) as c:
            resp = await c.get(f"{_BASE}/summary", params={"event": event_id}, headers=_HEADERS)
            if resp.status_code != 200:
                return None
            data = resp.json()
    except Exception as exc:
        logger.debug("ESPN soccer summary %s error (non-fatal): %s", event_id, exc)
        return None

    out: dict[str, Any] = {}
    for side in data.get("rosters", []):
        entries = side.get("roster", [])
        if not entries:
            continue
        out[side.get("homeAway", "?")] = {
            "team": (side.get("team") or {}).get("displayName"),
            "starters": [
                (e.get("athlete") or {}).get("displayName")
                for e in entries
                if e.get("starter")
            ],
        }
    return out or None

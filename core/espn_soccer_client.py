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
_SOCCER_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer"
_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; AgenticMarkets/1.0)"}

# Our league codes -> ESPN league slugs (fixtures fallback, decision Andrea
# 2026-06-05: free ESPN instead of paying the API-Football quota).
ESPN_LEAGUE_CODES: dict[str, str] = {
    "PL": "eng.1",
    "SA": "ita.1",
    "PD": "esp.1",
    "BL1": "ger.1",
    "FL1": "fra.1",
    "CL": "uefa.champions",
    "EL": "uefa.europa",
    "ECL": "uefa.europa.conf",
    "WC": "fifa.world",
}

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


# Last full-coverage snapshot: a single throttled burst (ESPN rate-limits
# 48 back-to-back roster calls) must not flap the squad_news gate — squads
# don't change hourly, so a <24h-old good snapshot is still honest data.
_last_good_coverage: tuple[float, dict[str, dict]] | None = None
_COVERAGE_GRACE = 24 * 3600
_ROSTER_SPACING_S = 0.25  # be polite: ~12s per full sweep, once per 6h TTL


async def get_squad_coverage() -> dict[str, dict]:
    """
    Fetch squads for every qualified WC team (cache-aware: after the first
    cycle this is free until the TTL expires). Returns {team_name: summary}
    with summary = {squad_size, injured}.
    """
    import asyncio
    global _last_good_coverage

    teams = await get_world_cup_teams()
    coverage: dict[str, dict] = {}
    for team in teams:
        cached = _cached(f"squad:{team['id']}") is not None
        squad = await get_team_squad(team["id"])
        if squad and squad["squad_size"] > 0:
            coverage[team["name"]] = {
                "squad_size": squad["squad_size"],
                "injured": squad["injured"],
            }
        if not cached:
            await asyncio.sleep(_ROSTER_SPACING_S)

    if teams and len(coverage) >= max(1, int(0.8 * len(teams))):
        _last_good_coverage = (time.time(), coverage)
        logger.info("ESPN soccer: squad coverage %d/%d WC teams", len(coverage), len(teams))
        return coverage

    # Degraded burst (throttling/outage): fall back to the last good snapshot
    # within the grace window instead of flapping the gate.
    if _last_good_coverage and time.time() - _last_good_coverage[0] < _COVERAGE_GRACE:
        age_min = int((time.time() - _last_good_coverage[0]) / 60)
        logger.warning(
            "ESPN soccer: degraded squad burst (%d/%d) — serving last good coverage (%d teams, %dmin old)",
            len(coverage), len(teams), len(_last_good_coverage[1]), age_min,
        )
        return _last_good_coverage[1]

    logger.warning("ESPN soccer: squad coverage degraded %d/%d, no good snapshot to fall back on", len(coverage), len(teams))
    return coverage


async def get_league_fixtures(league_code: str, days_ahead: int = 14) -> list[dict]:
    """
    Upcoming fixtures for one league from the ESPN scoreboard, normalized to
    the API-Football shape ({fixture:{id,date}, teams:{home/away:{name}}}) so
    the collector is format-agnostic — same trick as football_data_org_client.

    Fixture ids are prefixed "espn:" on purpose: they must never be mistaken
    for API-Football fixture ids (settlement falls back to the team-name
    lookup for them, which is the correct path).
    """
    slug = ESPN_LEAGUE_CODES.get(league_code)
    if not slug:
        return []
    from datetime import datetime, timedelta, timezone

    today = datetime.now(timezone.utc).date()
    date_range = f"{today.strftime('%Y%m%d')}-{(today + timedelta(days=days_ahead)).strftime('%Y%m%d')}"
    try:
        async with httpx.AsyncClient(timeout=12.0) as c:
            resp = await c.get(
                f"{_SOCCER_BASE}/{slug}/scoreboard",
                params={"dates": date_range},
                headers=_HEADERS,
            )
            if resp.status_code != 200:
                logger.warning("ESPN soccer scoreboard %s: %s", league_code, resp.status_code)
                return []
            data = resp.json()
    except Exception as exc:
        logger.debug("ESPN soccer scoreboard %s error (non-fatal): %s", league_code, exc)
        return []

    fixtures: list[dict] = []
    for ev in data.get("events", []):
        state = (((ev.get("status") or {}).get("type")) or {}).get("state")
        if state != "pre":
            continue  # only future matches are fixtures
        comps = (ev.get("competitions") or [{}])[0].get("competitors", [])
        home = next((c for c in comps if c.get("homeAway") == "home"), None)
        away = next((c for c in comps if c.get("homeAway") == "away"), None)
        if not home or not away:
            continue
        fixtures.append({
            "fixture": {"id": f"espn:{ev.get('id')}", "date": ev.get("date")},
            "teams": {
                "home": {"name": (home.get("team") or {}).get("displayName", "")},
                "away": {"name": (away.get("team") or {}).get("displayName", "")},
            },
            "score": {"fulltime": {"home": None, "away": None}},
        })
    if fixtures:
        logger.info("ESPN soccer %s: %d upcoming fixtures", league_code, len(fixtures))
    return fixtures


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

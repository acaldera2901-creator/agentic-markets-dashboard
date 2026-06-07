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
    # International friendlies (national teams) — pre-WC dry-run of the
    # national model. ESPN-only competition: no fdorg/API-Football coverage.
    "FRIENDLY": "fifa.friendly",
}

SQUAD_TTL = 6 * 3600  # squads/injuries change slowly; 6h keeps us at ~200 req/day

# In-process cache: {"teams": (ts, list), "squad:<id>": (ts, dict)}
_cache: dict[str, tuple[float, Any]] = {}


def _cached(key: str) -> Any | None:
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < SQUAD_TTL:
        return hit[1]
    return None


def _cached_for(key: str, ttl: float) -> Any | None:
    """Like _cached but with a per-key TTL — lineups go stale in minutes, not hours."""
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < ttl:
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
        competition = (ev.get("competitions") or [{}])[0]
        comps = competition.get("competitors", [])
        home = next((c for c in comps if c.get("homeAway") == "home"), None)
        away = next((c for c in comps if c.get("homeAway") == "away"), None)
        if not home or not away:
            continue
        entry = {
            "fixture": {"id": f"espn:{ev.get('id')}", "date": ev.get("date")},
            "teams": {
                "home": {"name": (home.get("team") or {}).get("displayName", "")},
                "away": {"name": (away.get("team") or {}).get("displayName", "")},
            },
            "score": {"fulltime": {"home": None, "away": None}},
        }
        # Venue + stage feed the WC venue_context gate: ESPN carries stadium and
        # city per event, and the stage slug per season. Keep the nested shape
        # _venue_text expects (fixture.venue.{name,city}).
        venue = competition.get("venue") or {}
        venue_name = venue.get("fullName")
        venue_city = (venue.get("address") or {}).get("city")
        if venue_name or venue_city:
            entry["fixture"]["venue"] = {
                **({"name": venue_name} if venue_name else {}),
                **({"city": venue_city} if venue_city else {}),
            }
        stage_slug = ((ev.get("season") or {}).get("slug") or "").replace("-", " ")
        if stage_slug:
            entry["round"] = stage_slug.title()
        fixtures.append(entry)
    if fixtures:
        logger.info("ESPN soccer %s: %d upcoming fixtures", league_code, len(fixtures))
    return fixtures


# ─── WC venue lookup (for fixtures from providers without venue data) ─────────
#
# football-data.org WC matches carry group/stage but venue=None; ESPN has the
# stadium + city for every WC fixture. This map lets the collector enrich
# venue-less WC fixtures by normalized team pair. TTL-cached: one scoreboard
# call covers the whole tournament slate.


def _venue_pair_key(home: str, away: str) -> tuple[str, str]:
    from core.world_cup_context import normalize_team
    return (normalize_team(home), normalize_team(away))


async def get_wc_venue_map(days_ahead: int = 45) -> dict[tuple[str, str], dict]:
    """Map (home_key, away_key) → {venue, city, round} for upcoming WC matches.

    Both team orders are keyed: provider home/away may disagree with ESPN's.
    """
    cached = _cached("wc_venue_map")
    if cached is not None:
        return cached

    from datetime import datetime, timedelta, timezone
    today = datetime.now(timezone.utc).date()
    date_range = f"{today.strftime('%Y%m%d')}-{(today + timedelta(days=days_ahead)).strftime('%Y%m%d')}"
    out: dict[tuple[str, str], dict] = {}
    try:
        async with httpx.AsyncClient(timeout=12.0) as c:
            resp = await c.get(
                f"{_SOCCER_BASE}/fifa.world/scoreboard",
                params={"dates": date_range},
                headers=_HEADERS,
            )
            if resp.status_code != 200:
                logger.warning("ESPN WC venue map: %s", resp.status_code)
                return out
            data = resp.json()
    except Exception as exc:
        logger.debug("ESPN WC venue map error (non-fatal): %s", exc)
        return out

    for ev in data.get("events", []):
        competition = (ev.get("competitions") or [{}])[0]
        comps = competition.get("competitors", [])
        home = next((c for c in comps if c.get("homeAway") == "home"), None)
        away = next((c for c in comps if c.get("homeAway") == "away"), None)
        if not home or not away:
            continue
        venue = competition.get("venue") or {}
        info = {
            "venue": venue.get("fullName"),
            "city": (venue.get("address") or {}).get("city"),
            "round": ((ev.get("season") or {}).get("slug") or "").replace("-", " ").title() or None,
        }
        if not (info["venue"] or info["city"]):
            continue
        h = (home.get("team") or {}).get("displayName", "")
        a = (away.get("team") or {}).get("displayName", "")
        if h and a:
            out[_venue_pair_key(h, a)] = info
            out[_venue_pair_key(a, h)] = info
    if out:
        logger.info("ESPN WC venue map: %d matchups with venue", len(out) // 2)
    return _store("wc_venue_map", out)


async def get_wc_lineup_map(within_minutes: int = 120) -> dict[tuple[str, str], dict]:
    """Confirmed starting XIs for WC matches kicking off within ``within_minutes``.

    #LINEUP-1-ESPN (APPROVE Andrea 2026-06-07): today's WC scoreboard → for
    imminent events, fetch summary rosters via get_match_lineups (built for
    Track A, never wired until now). Returns {(home_key, away_key): {home,
    away, event_id}} with both team orders keyed — same matching contract as
    get_wc_venue_map. Lineups appear ~1h before kickoff: an empty map earlier
    is normal, callers treat missing keys as 'not published yet'. Cached 5 min
    (the collector cycles at 60s pre-match; without a short TTL this would
    hammer ESPN, with the global 6h TTL it would freeze the empty map).
    """
    cached = _cached_for("wc_lineup_map", 300)
    if cached is not None:
        return cached

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    out: dict[tuple[str, str], dict] = {}
    try:
        async with httpx.AsyncClient(timeout=12.0) as c:
            resp = await c.get(
                f"{_BASE}/scoreboard",
                params={"dates": now.strftime("%Y%m%d")},
                headers=_HEADERS,
            )
            if resp.status_code != 200:
                return out
            data = resp.json()
    except Exception as exc:
        logger.debug("ESPN WC lineup map error (non-fatal): %s", exc)
        return out

    for ev in data.get("events", []):
        try:
            kickoff = datetime.fromisoformat(str(ev.get("date", "")).replace("Z", "+00:00"))
        except ValueError:
            continue
        # Window: 2h before kickoff until ~2.5h after — in-play keeps the
        # confirmed XI available for late recomputes of the same fixture.
        delta_min = (kickoff - now).total_seconds() / 60
        if delta_min > within_minutes or delta_min < -150:
            continue
        competition = (ev.get("competitions") or [{}])[0]
        comps = competition.get("competitors", [])
        home = next((c for c in comps if c.get("homeAway") == "home"), None)
        away = next((c for c in comps if c.get("homeAway") == "away"), None)
        if not home or not away:
            continue
        lineups = await get_match_lineups(str(ev.get("id", "")))
        if not lineups:
            continue
        h = (home.get("team") or {}).get("displayName", "")
        a = (away.get("team") or {}).get("displayName", "")
        if not (h and a):
            continue
        info = {
            "home": lineups.get("home"),
            "away": lineups.get("away"),
            "event_id": str(ev.get("id", "")),
        }
        if not (info["home"] or info["away"]):
            continue
        out[_venue_pair_key(h, a)] = info
        out[_venue_pair_key(a, h)] = info

    if out:
        logger.info("ESPN WC lineups: %d matchup(s) with confirmed XI", len(out) // 2)
    return _store("wc_lineup_map", out)


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


def parse_summary_result(data: dict) -> dict | None:
    """Final score out of an ESPN summary payload, or None if not finished.

    Same return contract as football_api_client.get_fixture_result:
    {home_goals, away_goals, status, home_team, away_team}. Fail-closed on
    anything missing — settlement must never guess a score.
    """
    competition = ((data.get("header") or {}).get("competitions") or [{}])[0]
    status_type = (competition.get("status") or {}).get("type") or {}
    if not status_type.get("completed"):
        return None
    home = away = None
    for comp in competition.get("competitors", []):
        if comp.get("homeAway") == "home":
            home = comp
        elif comp.get("homeAway") == "away":
            away = comp
    if not home or not away:
        return None
    try:
        return {
            "home_goals": int(home["score"]),
            "away_goals": int(away["score"]),
            "status": str(status_type.get("name") or "FT"),
            "home_team": (home.get("team") or {}).get("displayName", ""),
            "away_team": (away.get("team") or {}).get("displayName", ""),
        }
    except (KeyError, TypeError, ValueError):
        return None


# ESPN terminal statuses that will never yield a settleable final score: the
# match stopped and won't resume in a form we can settle. Void, never guess
# (#PAPER-SETTLE-1, APPROVE Andrea 2026-06-07).
ESPN_ABANDONED_STATUSES = {
    "STATUS_ABANDONED",
    "STATUS_CANCELED",
    "STATUS_POSTPONED",
    "STATUS_SUSPENDED",
    "STATUS_FORFEIT",
}


async def get_match_disposition(league_code: str, event_id: str) -> str | None:
    """'final' | 'abandoned' | 'pending' for an ESPN event, or None on error.

    Lets settlement void matches ESPN will never complete (Suspended/Abandoned/
    Postponed/Canceled/Forfeit) instead of leaving them on the board forever.
    Same fail-soft contract as get_match_result: None on any fetch/parse error.
    """
    slug = ESPN_LEAGUE_CODES.get((league_code or "").upper())
    if not slug or not event_id:
        return None
    try:
        async with httpx.AsyncClient(timeout=12.0) as c:
            resp = await c.get(
                f"{_SOCCER_BASE}/{slug}/summary",
                params={"event": event_id},
                headers=_HEADERS,
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
    except Exception as exc:
        logger.debug("ESPN disposition %s/%s error (non-fatal): %s", league_code, event_id, exc)
        return None
    competition = ((data.get("header") or {}).get("competitions") or [{}])[0]
    status_type = (competition.get("status") or {}).get("type") or {}
    if status_type.get("completed"):
        return "final"
    if str(status_type.get("name") or "") in ESPN_ABANDONED_STATUSES:
        return "abandoned"
    return "pending"


async def get_match_result(league_code: str, event_id: str) -> dict | None:
    """Final result for one ESPN event ("espn:"-prefixed unified rows).

    The only settlement source for ESPN-only competitions (e.g. FRIENDLY,
    which neither API-Football quota nor football-data.org cover). None while
    the match is not completed — the settlement agent retries next cycle.
    """
    slug = ESPN_LEAGUE_CODES.get((league_code or "").upper())
    if not slug or not event_id:
        return None
    try:
        async with httpx.AsyncClient(timeout=12.0) as c:
            resp = await c.get(
                f"{_SOCCER_BASE}/{slug}/summary",
                params={"event": event_id},
                headers=_HEADERS,
            )
            if resp.status_code != 200:
                logger.debug("ESPN result %s/%s: %s", league_code, event_id, resp.status_code)
                return None
            data = resp.json()
    except Exception as exc:
        logger.debug("ESPN result %s/%s error (non-fatal): %s", league_code, event_id, exc)
        return None
    return parse_summary_result(data)

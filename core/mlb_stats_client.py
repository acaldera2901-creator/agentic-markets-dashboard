"""
MLB Stats API client (#NEWSPORTS Gate 1/2, lab am-lab/nuovi-sport 2026-07-04/05).

Official free API (statsapi.mlb.com) — schedule with probable pitchers,
standings, and the season-to-date pitching lines that feed the FIP duel signal
in the why. The FIP math replicates the lab's validated `mlb_v2.mjs` exactly
(t13: FIP beats ERA, Brier 0.24439; audit B2: traded pitchers = per-team splits,
use the totals split without .team).

All fetches are async httpx, timeout 15s, fail-soft to None/{} — the calling
agent skips the game rather than crash (lab audit M7).
"""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger("mlb_stats_client")

BASE_URL = "https://statsapi.mlb.com/api/v1"

# League-average fallbacks when the league pitching call fails (lab constants).
DEFAULT_LG_FIP = {"corePerOut": 0.03, "const": 3.1}
K_OUTS = 90  # regression toward league (fake outs) — lab t13


async def _get_json(url: str, params: Dict[str, Any] | None = None) -> Optional[dict]:
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, params=params)
        if resp.status_code != 200:
            logger.warning(f"mlb-stats HTTP {resp.status_code} on {url}")
            return None
        return resp.json()
    except httpx.HTTPError as e:
        logger.warning(f"mlb-stats network error on {url}: {e}")
        return None


def ip_to_outs(ip: Any) -> int:
    """MLB 'inningsPitched' is a decimal-ish string: '123.2' = 123 IP + 2 outs."""
    whole, _, frac = str(ip or "0").partition(".")
    try:
        return (int(whole) if whole else 0) * 3 + (int(frac) if frac else 0)
    except ValueError:
        return 0


def fip_core(stat: Dict[str, Any]) -> int:
    """FIP numerator core: 13*HR + 3*(BB+HBP) - 2*K (lab t13)."""
    return (
        13 * (stat.get("homeRuns") or 0)
        + 3 * ((stat.get("baseOnBalls") or 0) + (stat.get("hitByPitch") or 0))
        - 2 * (stat.get("strikeOuts") or 0)
    )


async def get_schedule(date_iso: str) -> list[dict]:
    """Regular-season games for a date, with probable pitchers hydrated."""
    data = await _get_json(
        f"{BASE_URL}/schedule",
        {"sportId": 1, "date": date_iso, "hydrate": "probablePitcher"},
    )
    if not data:
        return []
    games = (data.get("dates") or [{}])[0].get("games") or []
    return [g for g in games if g.get("gameType") == "R"]


async def get_standings(season: int) -> Dict[int, dict]:
    """teamId -> {wins, losses, runsScored, runsAllowed} (regular season)."""
    data = await _get_json(
        f"{BASE_URL}/standings",
        {"leagueId": "103,104", "season": season, "standingsTypes": "regularSeason"},
    )
    recs: Dict[int, dict] = {}
    for rec in (data or {}).get("records") or []:
        for t in rec.get("teamRecords") or []:
            recs[t["team"]["id"]] = {
                "wins": t.get("wins", 0),
                "losses": t.get("losses", 0),
                "runsScored": t.get("runsScored", 0),
                "runsAllowed": t.get("runsAllowed", 0),
            }
    return recs


# Previous-season priors change once a year → cache in-process, no TTL games.
_prev_cache: dict[int, dict] = {}


async def get_prev_season(season: int) -> dict:
    """{winpct: {teamId: wp}, lgFip: {corePerOut, const}} for season-1.

    winpct feeds the pythagorean prior; lgFip anchors the FIP regression.
    Fail-soft: on API failure returns neutral priors (wp 0.5, lab constants).
    """
    if season in _prev_cache:
        return _prev_cache[season]
    prev = season - 1
    winpct: Dict[int, float] = {}
    st = await _get_json(
        f"{BASE_URL}/standings",
        {"leagueId": "103,104", "season": prev, "standingsTypes": "regularSeason"},
    )
    for rec in (st or {}).get("records") or []:
        for t in rec.get("teamRecords") or []:
            g = (t.get("wins") or 0) + (t.get("losses") or 0)
            if g:
                winpct[t["team"]["id"]] = t["wins"] / g
    lg_fip = dict(DEFAULT_LG_FIP)
    ts = await _get_json(
        f"{BASE_URL}/teams/stats",
        {"season": prev, "group": "pitching", "stats": "season", "sportId": 1},
    )
    splits = ((ts or {}).get("stats") or [{}])[0].get("splits") or []
    er = outs = core = 0
    for s in splits:
        stat = s.get("stat") or {}
        er += stat.get("earnedRuns") or 0
        outs += ip_to_outs(stat.get("inningsPitched"))
        core += fip_core(stat)
    if outs > 10_000:
        lg_fip = {
            "corePerOut": core / outs,
            "const": 27 * er / outs - 3 * core / outs,
        }
    data = {"winpct": winpct, "lgFip": lg_fip}
    if winpct:  # cache only a real answer, never the neutral fallback
        _prev_cache[season] = data
    return data


async def get_pitcher_fip(pitcher_id: Optional[int], season: int, lg_fip: dict) -> dict:
    """{fip, outs} season-to-date, regressed toward league with K_OUTS fake outs.

    No pitcher / no line -> league value with outs=0 (the agent flags it).
    Traded pitchers (audit B2): the totals split has no .team — prefer it.
    """
    lg_val = 3 * lg_fip["corePerOut"] + lg_fip["const"]
    if not pitcher_id:
        return {"fip": lg_val, "outs": 0}
    data = await _get_json(
        f"{BASE_URL}/people/{pitcher_id}/stats",
        {"stats": "season", "group": "pitching", "season": season},
    )
    splits = ((data or {}).get("stats") or [{}])[0].get("splits") or []
    if not splits:
        return {"fip": lg_val, "outs": 0}
    totals = next((s for s in splits if not s.get("team")), None)
    use = [totals] if totals else splits
    outs = core = 0
    for s in use:
        stat = s.get("stat") or {}
        outs += ip_to_outs(stat.get("inningsPitched"))
        core += fip_core(stat)
    core_po = (core + lg_fip["corePerOut"] * K_OUTS) / (outs + K_OUTS)
    return {"fip": 3 * core_po + lg_fip["const"], "outs": outs}


# TTL-cached score lookup for settlement/verification helpers.
_sched_cache: dict[str, tuple[float, list]] = {}
_SCHED_TTL = 10 * 60


async def get_final_result(game_pk: int, date_iso: str) -> Optional[dict]:
    """{'home_goals': int, 'away_goals': int} when the game is Final, else None.

    Shares the shape of odds_api_client.get_score_by_teams_date so the unified
    settlement can use either source.
    """
    now = time.monotonic()
    cached = _sched_cache.get(date_iso)
    if cached and now - cached[0] < _SCHED_TTL:
        games = cached[1]
    else:
        data = await _get_json(f"{BASE_URL}/schedule", {"sportId": 1, "date": date_iso})
        games = (data or {}).get("dates") or []
        games = (games[0].get("games") or []) if games else []
        _sched_cache[date_iso] = (now, games)
    g = next((x for x in games if x.get("gamePk") == game_pk), None)
    if not g or (g.get("status") or {}).get("abstractGameState") != "Final":
        return None
    teams = g.get("teams") or {}
    hs = (teams.get("home") or {}).get("score")
    as_ = (teams.get("away") or {}).get("score")
    if hs is None or as_ is None:
        return None
    return {"home_goals": int(hs), "away_goals": int(as_)}

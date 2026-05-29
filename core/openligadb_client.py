# core/openligadb_client.py
"""
OpenLigaDB — free German football data, no API key required.
Covers Bundesliga (bl1), 2. Bundesliga (bl2).
Docs: https://api.openligadb.de/
"""
from __future__ import annotations
import httpx
import logging
from typing import List, Dict

logger = logging.getLogger("openligadb_client")
BASE = "https://api.openligadb.de"
LEAGUE_MAP = {"BL1": "bl1", "BL2": "bl2"}


async def get_upcoming_fixtures(league_code: str, season: int) -> List[Dict]:
    """
    Return upcoming fixtures for Bundesliga leagues.
    Each dict: {match_id, home_team, away_team, kickoff, league, provider}.
    """
    slug = LEAGUE_MAP.get(league_code)
    if not slug:
        return []
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            resp = await c.get(f"{BASE}/getmatchdata/{slug}/{season}")
            if resp.status_code != 200:
                return []
            matches = resp.json()
    except Exception as exc:
        logger.debug("openligadb error: %s", exc)
        return []

    results = []
    for m in matches:
        if m.get("matchIsFinished"):
            continue
        team1 = m.get("team1", {}).get("teamName", "")
        team2 = m.get("team2", {}).get("teamName", "")
        kickoff = m.get("matchDateTimeUTC", "")
        mid = f"openligadb:{league_code}:{m.get('matchID', '')}"
        if team1 and team2 and kickoff:
            results.append({
                "match_id": mid, "home_team": team1, "away_team": team2,
                "kickoff": kickoff, "league": league_code, "provider": "openligadb",
            })
    return results


async def get_table(league_code: str, season: int) -> List[Dict]:
    """
    Return current league table.
    Each dict: {team_name, position, points, goals_for, goals_against, matches_played}.
    """
    slug = LEAGUE_MAP.get(league_code)
    if not slug:
        return []
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            resp = await c.get(f"{BASE}/getbltable/{slug}/{season}")
            if resp.status_code != 200:
                return []
            table = resp.json()
    except Exception as exc:
        logger.debug("openligadb table error: %s", exc)
        return []

    return [
        {
            "team_name": row.get("teamName", ""),
            "position": i + 1,
            "points": row.get("points", 0),
            "goals_for": row.get("goals", 0),
            "goals_against": row.get("opponentGoals", 0),
            "matches_played": row.get("matches", 0),
        }
        for i, row in enumerate(table)
    ]

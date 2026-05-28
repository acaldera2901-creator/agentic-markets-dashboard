import httpx
from typing import List, Dict
from config.settings import settings

_DIRECT_BASE = "https://v3.football.api-sports.io"
_RAPID_BASE  = "https://api-football-v1.p.rapidapi.com/v3"


def _is_rapidapi_key(key: str) -> bool:
    return len(key) > 30 and any(c.islower() for c in key) and any(c.isdigit() for c in key)


def _base_url() -> str:
    return _RAPID_BASE if _is_rapidapi_key(settings.API_FOOTBALL_KEY) else _DIRECT_BASE


def _headers() -> dict:
    key = settings.API_FOOTBALL_KEY
    if _is_rapidapi_key(key):
        return {"x-rapidapi-key": key, "x-rapidapi-host": "api-football-v1.p.rapidapi.com"}
    return {"x-apisports-key": key}


async def get_fixtures(league_id: int, season: int) -> List[Dict]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{_base_url()}/fixtures",
            headers=_headers(),
            params={"league": league_id, "season": season, "next": 10},
            timeout=15.0,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("errors"):
            return []
        return data.get("response", [])

async def get_lineups(fixture_id: int) -> List[Dict]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{_base_url()}/fixtures/lineups",
            headers=_headers(),
            params={"fixture": fixture_id},
            timeout=15.0,
        )
        resp.raise_for_status()
        return resp.json().get("response", [])

async def get_historical_results(league_id: int, season: int) -> List[Dict]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{_base_url()}/fixtures",
            headers=_headers(),
            params={"league": league_id, "season": season, "status": "FT", "last": 50},
            timeout=15.0,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("errors"):
            return []
        return data.get("response", [])

LEAGUE_IDS = {
    "PL": 39, "SA": 135, "PD": 140, "BL1": 78,
    "FL1": 61, "CL": 2, "EL": 3, "ECL": 848,
    # API-FOOTBALL / API-SPORTS uses league id 1 for FIFA World Cup.
    # Keep this in monitor-only until diagnostics confirm 2026 coverage.
    "WC": 1,
}


async def get_fixture_result(fixture_id: int) -> dict | None:
    """
    Fetch a single fixture by ID and return its result dict, or None if not finished.
    Returns: {home_goals, away_goals, status, home_team, away_team}
    """
    if not settings.API_FOOTBALL_KEY:
        return None
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{_base_url()}/fixtures",
            headers=_headers(),
            params={"id": fixture_id},
            timeout=15.0,
        )
        resp.raise_for_status()
        data = resp.json().get("response", [])
    if not data:
        return None
    f = data[0]
    status = f.get("fixture", {}).get("status", {}).get("short", "")
    if status not in ("FT", "AET", "PEN"):
        return None
    score = f.get("score", {}).get("fulltime", {})
    home_goals = score.get("home")
    away_goals = score.get("away")
    if home_goals is None or away_goals is None:
        return None
    return {
        "home_goals": int(home_goals),
        "away_goals": int(away_goals),
        "status": status,
        "home_team": f.get("teams", {}).get("home", {}).get("name", ""),
        "away_team": f.get("teams", {}).get("away", {}).get("name", ""),
    }

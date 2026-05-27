import httpx
from typing import List, Dict, Any
from config.settings import settings

BASE_URL = "https://api.balldontlie.io/v1"


def _headers() -> dict:
    return {"Authorization": settings.BALLDONTLIE_API_KEY}


async def get_epl_teams() -> List[Dict]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{BASE_URL}/epl/teams", headers=_headers(), timeout=10.0)
        if resp.status_code == 200:
            return resp.json().get("data", [])
        return []


async def get_epl_standings() -> List[Dict]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{BASE_URL}/epl/standings", headers=_headers(), timeout=10.0)
        if resp.status_code == 200:
            return resp.json().get("data", [])
        return []


async def get_epl_games(team_id: int | None = None) -> List[Dict]:
    params = {}
    if team_id:
        params["team_ids[]"] = team_id
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{BASE_URL}/epl/games", headers=_headers(), params=params, timeout=10.0)
        if resp.status_code == 200:
            return resp.json().get("data", [])
        return []


async def get_serie_a_standings() -> List[Dict]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{BASE_URL}/serie_a/standings", headers=_headers(), timeout=10.0)
        if resp.status_code == 200:
            return resp.json().get("data", [])
        return []


async def get_champions_league_standings() -> List[Dict]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{BASE_URL}/champions_league/standings", headers=_headers(), timeout=10.0)
        if resp.status_code == 200:
            return resp.json().get("data", [])
        return []


async def get_team_form(league: str, team_id: int, last_n: int = 5) -> List[Dict]:
    endpoint_map = {
        "PL": "epl", "SA": "serie_a", "PD": "la_liga",
        "BL1": "bundesliga", "FL1": "ligue_1", "CL": "champions_league",
    }
    league_path = endpoint_map.get(league, "epl")
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BASE_URL}/{league_path}/games",
            headers=_headers(),
            params={"team_ids[]": team_id, "per_page": last_n},
            timeout=10.0,
        )
        if resp.status_code == 200:
            return resp.json().get("data", [])
        return []

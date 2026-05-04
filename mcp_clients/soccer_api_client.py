import httpx
from typing import List, Dict
from config.settings import settings

RAPIDAPI_HOST = "api-football-v1.p.rapidapi.com"
BASE_URL = f"https://{RAPIDAPI_HOST}"


def _headers() -> dict:
    return {
        "x-rapidapi-host": RAPIDAPI_HOST,
        "x-rapidapi-key": settings.RAPIDAPI_KEY,
    }


async def get_team_statistics(league_id: int, season: int, team_id: int) -> Dict:
    if not settings.RAPIDAPI_KEY:
        return {}
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BASE_URL}/teams/statistics",
            headers=_headers(),
            params={"league": league_id, "season": season, "team": team_id},
            timeout=15.0,
        )
        if resp.status_code == 200:
            return resp.json().get("response", {})
        return {}


async def get_head_to_head(home_id: int, away_id: int, last: int = 10) -> List[Dict]:
    if not settings.RAPIDAPI_KEY:
        return []
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BASE_URL}/fixtures/headtohead",
            headers=_headers(),
            params={"h2h": f"{home_id}-{away_id}", "last": last},
            timeout=15.0,
        )
        if resp.status_code == 200:
            return resp.json().get("response", [])
        return []


async def get_player_injuries(fixture_id: int) -> List[Dict]:
    if not settings.RAPIDAPI_KEY:
        return []
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BASE_URL}/injuries",
            headers=_headers(),
            params={"fixture": fixture_id},
            timeout=15.0,
        )
        if resp.status_code == 200:
            return resp.json().get("response", [])
        return []

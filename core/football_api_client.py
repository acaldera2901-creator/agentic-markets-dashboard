import httpx
from typing import List, Dict
from config.settings import settings

BASE_URL = "https://v3.football.api-sports.io"

async def get_fixtures(league_id: int, season: int) -> List[Dict]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BASE_URL}/fixtures",
            headers={"x-apisports-key": settings.API_FOOTBALL_KEY},
            params={"league": league_id, "season": season, "next": 10},
            timeout=15.0,
        )
        resp.raise_for_status()
        return resp.json().get("response", [])

async def get_lineups(fixture_id: int) -> List[Dict]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BASE_URL}/fixtures/lineups",
            headers={"x-apisports-key": settings.API_FOOTBALL_KEY},
            params={"fixture": fixture_id},
            timeout=15.0,
        )
        resp.raise_for_status()
        return resp.json().get("response", [])

async def get_historical_results(league_id: int, season: int) -> List[Dict]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BASE_URL}/fixtures",
            headers={"x-apisports-key": settings.API_FOOTBALL_KEY},
            params={"league": league_id, "season": season, "status": "FT", "last": 50},
            timeout=15.0,
        )
        resp.raise_for_status()
        return resp.json().get("response", [])

LEAGUE_IDS = {
    "PL": 39, "SA": 135, "PD": 140, "BL1": 78,
    "FL1": 61, "CL": 2, "EL": 3, "ECL": 848,
}

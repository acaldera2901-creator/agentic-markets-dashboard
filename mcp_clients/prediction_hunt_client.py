import httpx
from typing import List, Dict
from config.settings import settings

BASE_URL = "https://api.predictionhunt.com/v1"


async def get_arbitrage_opportunities(sport: str = "soccer") -> List[Dict]:
    if not settings.PREDICTION_HUNT_API_KEY:
        return []
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BASE_URL}/arbitrage",
            headers={"X-API-Key": settings.PREDICTION_HUNT_API_KEY},
            params={"sport": sport, "min_profit": "0.01"},
            timeout=15.0,
        )
        if resp.status_code == 200:
            return resp.json().get("opportunities", [])
        return []


async def get_ev_opportunities(sport: str = "soccer") -> List[Dict]:
    if not settings.PREDICTION_HUNT_API_KEY:
        return []
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BASE_URL}/ev",
            headers={"X-API-Key": settings.PREDICTION_HUNT_API_KEY},
            params={"sport": sport},
            timeout=15.0,
        )
        if resp.status_code == 200:
            return resp.json().get("opportunities", [])
        return []


async def get_cross_platform_prices(event_id: str) -> Dict:
    if not settings.PREDICTION_HUNT_API_KEY:
        return {}
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BASE_URL}/prices/{event_id}",
            headers={"X-API-Key": settings.PREDICTION_HUNT_API_KEY},
            timeout=15.0,
        )
        if resp.status_code == 200:
            return resp.json()
        return {}

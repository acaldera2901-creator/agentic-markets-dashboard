import httpx
from typing import List, Dict
from config.settings import settings

BASE_URL = "https://api.the-odds-api.com/v4"

SPORT_KEYS = {
    "PL": "soccer_epl",
    "SA": "soccer_italy_serie_a",
    "PD": "soccer_spain_la_liga",
    "BL1": "soccer_germany_bundesliga",
    "FL1": "soccer_france_ligue_one",
    "CL": "soccer_uefa_champs_league",
    "EL": "soccer_uefa_europa_league",
    "ECL": "soccer_uefa_europa_conference_league",
}

async def get_odds(league: str) -> List[Dict]:
    sport_key = SPORT_KEYS.get(league)
    if not sport_key:
        return []
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BASE_URL}/sports/{sport_key}/odds",
            params={
                "apiKey": settings.ODDS_API_KEY,
                "regions": "eu,uk",
                "markets": "h2h",
                "oddsFormat": "decimal",
                "bookmakers": "betfair,pinnacle,bet365",
            },
            timeout=15.0,
        )
        if resp.status_code == 200:
            return resp.json()
        return []

def implied_probability(odds: float) -> float:
    return 1.0 / odds if odds > 0 else 0.0

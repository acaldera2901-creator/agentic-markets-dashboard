import httpx
from typing import List, Dict, Any

CLOB_BASE = "https://clob.polymarket.com"
GAMMA_BASE = "https://gamma-api.polymarket.com"


async def search_football_markets(query: str = "soccer") -> List[Dict]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GAMMA_BASE}/markets",
            params={"q": query, "active": "true", "closed": "false", "limit": 50},
            timeout=15.0,
        )
        if resp.status_code == 200:
            markets = resp.json()
            return [m for m in markets if _is_football_related(m)]
        return []


async def get_market_orderbook(condition_id: str) -> Dict:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{CLOB_BASE}/book",
            params={"token_id": condition_id},
            timeout=10.0,
        )
        if resp.status_code == 200:
            return resp.json()
        return {}


async def get_market_price(condition_id: str) -> float:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{CLOB_BASE}/midpoint",
            params={"token_id": condition_id},
            timeout=10.0,
        )
        if resp.status_code == 200:
            data = resp.json()
            return float(data.get("mid", 0))
        return 0.0


async def get_active_markets(limit: int = 100) -> List[Dict]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GAMMA_BASE}/markets",
            params={"active": "true", "closed": "false", "limit": limit},
            timeout=15.0,
        )
        if resp.status_code == 200:
            return resp.json()
        return []


def _is_football_related(market: Dict) -> bool:
    keywords = [
        "soccer", "football", "UEFA", "FIFA", "Champions League",
        "Premier League", "Serie A", "La Liga", "Bundesliga",
        "World Cup", "Euro", "goal", "match",
    ]
    question = market.get("question", "").lower()
    description = market.get("description", "").lower()
    return any(kw.lower() in question or kw.lower() in description for kw in keywords)


async def find_arbitrage_vs_model(model_prob: float, market_prob: float) -> Dict:
    edge = model_prob - market_prob
    return {
        "model_probability": model_prob,
        "market_implied": market_prob,
        "edge": edge,
        "has_value": edge > 0.03,
    }

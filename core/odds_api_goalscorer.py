"""Client The Odds API per le quote anytime-goalscorer. Fail-soft."""
from __future__ import annotations
import httpx
from config.settings import settings

_BASE = "https://api.the-odds-api.com/v4"
_MARKET = "player_goal_scorer_anytime"


async def get_events(sport_key: str) -> list[dict]:
    """Lista eventi (NON consuma quota). Fail-soft -> []."""
    if not settings.ODDS_API_KEY:
        return []
    try:
        async with httpx.AsyncClient(timeout=20.0) as c:
            r = await c.get(f"{_BASE}/sports/{sport_key}/events",
                            params={"apiKey": settings.ODDS_API_KEY})
            if r.status_code != 200:
                return []
            data = r.json()
            return data if isinstance(data, list) else []
    except Exception:
        return []


async def get_event_goalscorer_odds(sport_key: str, event_id: str, region: str = "us") -> dict:
    """Quote anytime-goalscorer per un evento (1 credit con dati). Fail-soft -> {}."""
    if not settings.ODDS_API_KEY:
        return {}
    try:
        async with httpx.AsyncClient(timeout=25.0) as c:
            r = await c.get(
                f"{_BASE}/sports/{sport_key}/events/{event_id}/odds",
                params={"apiKey": settings.ODDS_API_KEY, "regions": region,
                        "markets": _MARKET, "oddsFormat": "decimal"},
            )
            if r.status_code != 200:
                return {}
            data = r.json()
            return data if isinstance(data, dict) else {}
    except Exception:
        return {}

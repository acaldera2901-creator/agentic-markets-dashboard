import httpx
import re
from typing import List, Dict, Optional
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
    # Provider key must be probed before live use. If The Odds API changes the key,
    # diagnostics will show odds_markets=0 and keep World Cup in monitor_only.
    "WC": "soccer_fifa_world_cup",
}

_SUFFIXES = re.compile(r"\b(FC|CF|SC|AC|AS|SV|1\. ?FC|VfB|VfL|TSG|RB|SS|US|SSC|AFC)\b", re.IGNORECASE)


def normalize_name(name: str) -> str:
    """Strip common club suffixes so 'Arsenal FC' matches 'Arsenal'."""
    return _SUFFIXES.sub("", name).strip().lower()


def _best_odds(event: dict) -> Optional[dict]:
    """Extract best (lowest margin) h2h odds across all bookmakers."""
    best: dict = {}
    best_margin = float("inf")
    home = event.get("home_team", "")
    away = event.get("away_team", "")
    for bm in event.get("bookmakers", []):
        for mkt in bm.get("markets", []):
            if mkt.get("key") != "h2h":
                continue
            outcomes = {o["name"]: o["price"] for o in mkt.get("outcomes", [])}
            p_home = outcomes.get(home, 0)
            p_draw = outcomes.get("Draw", 0)
            p_away = outcomes.get(away, 0)
            if not (p_home and p_draw and p_away):
                continue
            margin = 1 / p_home + 1 / p_draw + 1 / p_away - 1
            if margin < best_margin:
                best_margin = margin
                best = {
                    "home_team": home,
                    "away_team": away,
                    "home_team_normalized": normalize_name(home),
                    "away_team_normalized": normalize_name(away),
                    "odds_home": p_home,
                    "odds_draw": p_draw,
                    "odds_away": p_away,
                    "bookmaker": bm.get("key", ""),
                    "margin": round(margin, 4),
                }
    return best or None


async def get_odds(league: str) -> List[Dict]:
    """Return list of normalized odds dicts; empty list if key missing or API error."""
    if not settings.ODDS_API_KEY:
        return []
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
            },
            timeout=15.0,
        )
    if resp.status_code != 200:
        return []
    return [o for event in resp.json() if (o := _best_odds(event))]


def implied_probability(odds: float) -> float:
    return 1.0 / odds if odds > 0 else 0.0

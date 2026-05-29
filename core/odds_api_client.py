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


async def get_all_bookmaker_odds(league_code: str) -> List[Dict]:
    """Fetch odds from ALL bookmakers. Returns [{match_id, home_team, away_team, bookmaker, odds_home, odds_draw, odds_away, overround}]."""
    sport_key = SPORT_KEYS.get(league_code)
    if not sport_key or not settings.ODDS_API_KEY:
        return []
    try:
        async with httpx.AsyncClient(timeout=15.0) as c:
            resp = await c.get(
                f"{BASE_URL}/sports/{sport_key}/odds",
                params={
                    "apiKey": settings.ODDS_API_KEY,
                    "regions": "eu,uk",
                    "markets": "h2h,spreads",
                    "oddsFormat": "decimal",
                    "dateFormat": "iso",
                },
            )
            if resp.status_code != 200:
                return []
            events = resp.json()
    except Exception:
        return []

    rows = []
    for ev in events:
        match_id = f"{league_code}:{ev.get('id', '')}"
        home = ev.get("home_team", "")
        away = ev.get("away_team", "")
        for bm in ev.get("bookmakers", []):
            bm_name = bm.get("key", "")
            for market in bm.get("markets", []):
                if market.get("key") == "h2h":
                    outcomes = {o["name"]: o["price"] for o in market.get("outcomes", [])}
                    oh = outcomes.get(home, 0.0)
                    od = outcomes.get("Draw", 0.0)
                    oa = outcomes.get(away, 0.0)
                    if oh and od and oa:
                        overround = round((1/oh + 1/od + 1/oa) - 1, 4)
                        rows.append({
                            "match_id": match_id, "home_team": home, "away_team": away,
                            "bookmaker": bm_name, "source": "odds_api", "market": "h2h",
                            "odds_home": oh, "odds_draw": od, "odds_away": oa,
                            "overround": overround,
                        })
                elif market.get("key") == "spreads":
                    for outcome in market.get("outcomes", []):
                        is_home_team = outcome["name"] == home
                        rows.append({
                            "match_id": match_id, "home_team": home, "away_team": away,
                            "bookmaker": bm_name, "source": "odds_api", "market": "ah",
                            "ah_line": outcome.get("point", 0.0),
                            "ah_home": outcome["price"] if is_home_team else None,
                            "ah_away": outcome["price"] if not is_home_team else None,
                        })
    return rows


async def snapshot_odds_to_supabase(rows: List[Dict]) -> None:
    """Write multi-bookmaker odds rows to odds_snapshots table."""
    if not rows or not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        return
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            await c.post(
                f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/odds_snapshots",
                json=rows,
                headers={
                    "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
                    "Content-Type": "application/json",
                },
            )
    except Exception as exc:
        import logging
        logging.getLogger("odds_api_client").debug("snapshot write failed (non-fatal): %s", exc)

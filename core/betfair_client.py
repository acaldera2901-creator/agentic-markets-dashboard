"""
Betfair Exchange client.

Italian accounts use identitysso.betfair.it for authentication.
The Exchange REST API is on api.betfair.com for all regions.

App Key setup (one-time, 2 minutes):
  1. Log in at betfair.it → Conto → Impostazioni API (or via developer.betfair.com)
  2. Create a "DELAY" type application → copy the key
  3. Set BETFAIR_APP_KEY in .env
"""
import requests
import logging
from config.settings import settings

logger = logging.getLogger(__name__)

_session_token: str | None = None

BETTING_ENDPOINT = "https://api.betfair.com/exchange/betting/rest/v1.0"


def _login() -> str:
    """Authenticate with the Italian Betfair identity SSO and return session token."""
    resp = requests.post(
        "https://identitysso.betfair.it/api/login",
        data={
            "username": settings.BETFAIR_USERNAME,
            "password": settings.BETFAIR_PASSWORD,
        },
        headers={
            "X-Application": settings.BETFAIR_APP_KEY,
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
        },
        timeout=15,
    )
    resp.raise_for_status()
    body = resp.json()
    if body.get("status") != "SUCCESS":
        raise RuntimeError(f"Betfair login failed: {body.get('error')}")
    return body["token"]


def _headers() -> dict:
    global _session_token
    if not _session_token:
        _session_token = _login()
    return {
        "X-Authentication": _session_token,
        "X-Application": settings.BETFAIR_APP_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def _call(endpoint: str, payload: dict) -> dict:
    global _session_token
    headers = _headers()
    resp = requests.post(
        f"{BETTING_ENDPOINT}/{endpoint}/",
        headers=headers,
        json=payload,
        timeout=15,
    )
    # Re-auth once on 401
    if resp.status_code == 401:
        _session_token = _login()
        headers = _headers()
        resp = requests.post(
            f"{BETTING_ENDPOINT}/{endpoint}/",
            headers=headers,
            json=payload,
            timeout=15,
        )
    resp.raise_for_status()
    return resp.json()


def is_configured() -> bool:
    return bool(
        settings.BETFAIR_USERNAME
        and settings.BETFAIR_PASSWORD
        and settings.BETFAIR_APP_KEY
        and settings.BETFAIR_APP_KEY != "betfair"
    )


COMPETITION_IDS = {
    "SA": "81",    # Serie A Italy
    "PL": "10932", # Premier League
    "PD": "117",   # La Liga
    "BL1": "59",   # Bundesliga
    "FL1": "60",   # Ligue 1
    "CL": "228",   # Champions League
}


def list_markets(league_code: str = "SA", days_ahead: int = 14) -> list[dict]:
    """Return upcoming MATCH_ODDS markets for a given league."""
    competition_id = COMPETITION_IDS.get(league_code, "81")
    return _call("listMarketCatalogue", {
        "filter": {
            "eventTypeIds": ["1"],
            "competitionIds": [competition_id],
            "marketTypeCodes": ["MATCH_ODDS"],
        },
        "marketProjection": ["COMPETITION", "EVENT", "MARKET_START_TIME", "RUNNER_DESCRIPTION"],
        "sort": "FIRST_TO_START",
        "maxResults": "50",
    })


def list_serie_a_markets() -> list[dict]:
    """Return upcoming Serie A MATCH_ODDS markets from Betfair Exchange."""
    return list_markets("SA")


def _norm(name: str) -> str:
    """Normalize team name for fuzzy matching."""
    import re
    return re.sub(r"\b(FC|AC|AS|SS|US|SSC|AFC|SC|SV|CF|1\. FC)\b", "", name, flags=re.I).strip().lower()


def find_market(home_team: str, away_team: str, league_code: str = "SA") -> dict | None:
    """Find Betfair market and runner IDs for a match. Returns None if not found."""
    try:
        markets = list_markets(league_code)
        home_n = _norm(home_team)
        away_n = _norm(away_team)
        for market in markets:
            runners = market.get("runners", [])
            names = [_norm(r["runnerName"]) for r in runners]
            if any(home_n in n or n in home_n for n in names) and any(away_n in n or n in away_n for n in names):
                runner_map: dict = {}
                for r in runners:
                    rn = _norm(r["runnerName"])
                    if home_n in rn or rn in home_n:
                        runner_map["home"] = r["selectionId"]
                    elif away_n in rn or rn in away_n:
                        runner_map["away"] = r["selectionId"]
                    else:
                        runner_map["draw"] = r["selectionId"]
                return {
                    "market_id": market["marketId"],
                    "runner_map": runner_map,
                    "event_name": market.get("event", {}).get("name", ""),
                    "start_time": market.get("marketStartTime", ""),
                }
    except Exception as e:
        logger.warning(f"find_market error: {e}")
    return None


def get_market_odds(market_id: str) -> dict:
    """Return best available odds for a given market."""
    return _call("listMarketBook", {
        "marketIds": [market_id],
        "priceProjection": {
            "priceData": ["EX_BEST_OFFERS"],
            "exBestOffersOverrides": {"bestPricesDepth": 3},
        },
    })


def place_bet(market_id: str, selection_id: int, odds: float, stake: float) -> dict:
    """Place a BACK bet. Only called when PAPER_TRADING=False and app key is valid."""
    result = _call("placeOrders", {
        "marketId": market_id,
        "instructions": [{
            "selectionId": str(selection_id),
            "handicap": "0",
            "side": "BACK",
            "orderType": "LIMIT",
            "limitOrder": {
                "size": str(round(stake, 2)),
                "price": str(round(odds, 2)),
                "persistenceType": "LAPSE",
            },
        }],
    })
    return result


def cash_out(market_id: str, selection_id: int, current_odds: float, original_stake: float) -> dict:
    lay_stake = round(original_stake * 0.95, 2)
    return _call("placeOrders", {
        "marketId": market_id,
        "instructions": [{
            "selectionId": str(selection_id),
            "handicap": "0",
            "side": "LAY",
            "orderType": "LIMIT",
            "limitOrder": {
                "size": str(lay_stake),
                "price": str(round(current_odds, 2)),
                "persistenceType": "LAPSE",
            },
        }],
    })

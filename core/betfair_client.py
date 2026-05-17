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
ACCOUNT_ENDPOINT = "https://api.betfair.com/exchange/account/rest/v1.0"


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


_SESSION_ERROR_CODES = {"NO_SESSION", "INVALID_SESSION_INFORMATION", "DSC-0015", "DSC-0018"}


def _is_session_error(resp: requests.Response) -> bool:
    """Return True if a non-401 response body signals a stale Betfair session."""
    try:
        body = resp.text
        return any(code in body for code in _SESSION_ERROR_CODES)
    except Exception:
        return False


def _call(endpoint: str, payload: dict) -> dict:
    global _session_token
    headers = _headers()
    resp = requests.post(
        f"{BETTING_ENDPOINT}/{endpoint}/",
        headers=headers,
        json=payload,
        timeout=15,
    )
    # Re-auth once on 401 or on 400/403 that carries a session error code
    if resp.status_code == 401 or (resp.status_code in (400, 403) and _is_session_error(resp)):
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


def _account_call(endpoint: str, payload: dict | None = None) -> dict:
    global _session_token
    headers = _headers()
    resp = requests.post(
        f"{ACCOUNT_ENDPOINT}/{endpoint}/",
        headers=headers,
        json=payload or {},
        timeout=15,
    )
    if resp.status_code == 401:
        _session_token = _login()
        headers = _headers()
        resp = requests.post(
            f"{ACCOUNT_ENDPOINT}/{endpoint}/",
            headers=headers,
            json=payload or {},
            timeout=15,
        )
    resp.raise_for_status()
    return resp.json()


def get_account_funds() -> dict:
    """Return Betfair account funds. Never log credentials or session tokens."""
    return _account_call("getAccountFunds", {})


def list_current_orders(bet_ids: list[str] | None = None) -> dict:
    payload: dict = {}
    if bet_ids:
        payload["betIds"] = bet_ids
    return _call("listCurrentOrders", payload)


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


def get_best_back_price(market_id: str, selection_id: int) -> float | None:
    """Return the current best available BACK price for one runner."""
    book = get_market_odds(market_id)
    if not book:
        return None
    for runner in book[0].get("runners", []):
        if int(runner.get("selectionId", 0)) != int(selection_id):
            continue
        backs = runner.get("ex", {}).get("availableToBack", [])
        if not backs:
            return None
        return float(backs[0]["price"])
    return None


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


def get_all_odds_for_league(league_code: str) -> list[dict]:
    """
    Fetch Betfair best-back prices for all upcoming matches in a league.
    Returns a list in the same normalized format as odds_api_client.get_odds().
    """
    if not is_configured():
        return []
    try:
        markets = list_markets(league_code, days_ahead=14)
        market_ids = [m["marketId"] for m in markets]
        if not market_ids:
            return []
        # Fetch all books in one call
        all_books = _call("listMarketBook", {
            "marketIds": market_ids,
            "priceProjection": {
                "priceData": ["EX_BEST_OFFERS"],
                "exBestOffersOverrides": {"bestPricesDepth": 1},
            },
        })
        # Index books by market_id
        book_by_id = {b["marketId"]: b for b in all_books}
        results = []
        for market in markets:
            mid = market["marketId"]
            book = book_by_id.get(mid)
            if not book:
                continue
            runners_info = {r["selectionId"]: r["runnerName"] for r in market.get("runners", [])}
            prices: dict[int, float] = {}
            for runner in book.get("runners", []):
                sel_id = runner.get("selectionId")
                backs = runner.get("ex", {}).get("availableToBack", [])
                if backs:
                    prices[sel_id] = backs[0]["price"]
            # Identify home/draw/away by runner name (Draw is always "The Draw" on Betfair)
            oh = od = oa = 0.0
            home_name = away_name = ""
            for sel_id, name in runners_info.items():
                p = prices.get(sel_id, 0)
                if "draw" in name.lower() or name == "The Draw":
                    od = p
                elif not home_name:
                    home_name = name
                    oh = p
                else:
                    away_name = name
                    oa = p
            if not (oh and od and oa):
                continue
            margin = round(1 / oh + 1 / od + 1 / oa - 1, 4)
            results.append({
                "home_team": home_name,
                "away_team": away_name,
                "home_team_normalized": _norm(home_name),
                "away_team_normalized": _norm(away_name),
                "odds_home": oh,
                "odds_draw": od,
                "odds_away": oa,
                "bookmaker": "betfair_exchange",
                "margin": margin,
            })
        return results
    except Exception as e:
        logger.warning(f"get_all_odds_for_league {league_code} error: {e}")
        return []


def get_match_odds_for_pipeline(home_team: str, away_team: str, league_code: str) -> dict | None:
    """
    Fetch Betfair best-back prices for a match and return in the same normalized format
    as odds_api_client.get_odds() — i.e. {odds_home, odds_draw, odds_away, bookmaker, margin}.
    Returns None if market not found or Betfair not configured.
    """
    if not is_configured():
        return None
    try:
        market_info = find_market(home_team, away_team, league_code)
        if not market_info:
            return None
        runner_map = market_info["runner_map"]
        book = get_market_odds(market_info["market_id"])
        if not book:
            return None
        # Index prices by selectionId
        prices: dict[int, float] = {}
        for runner in book[0].get("runners", []):
            sel_id = runner.get("selectionId")
            backs = runner.get("ex", {}).get("availableToBack", [])
            if backs:
                prices[sel_id] = backs[0]["price"]
        oh = prices.get(runner_map.get("home"), 0)
        od = prices.get(runner_map.get("draw"), 0)
        oa = prices.get(runner_map.get("away"), 0)
        if not (oh and od and oa):
            return None
        margin = round(1 / oh + 1 / od + 1 / oa - 1, 4)
        return {
            "home_team": home_team,
            "away_team": away_team,
            "home_team_normalized": _norm(home_team),
            "away_team_normalized": _norm(away_team),
            "odds_home": oh,
            "odds_draw": od,
            "odds_away": oa,
            "bookmaker": "betfair_exchange",
            "margin": margin,
        }
    except Exception as e:
        logger.warning(f"get_match_odds_for_pipeline error: {e}")
        return None


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

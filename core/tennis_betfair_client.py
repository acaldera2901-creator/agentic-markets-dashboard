"""
Betfair client for tennis markets.
Reuses the session/auth layer from betfair_client.py.
Tennis eventTypeId on Betfair Exchange: "2"
"""
import logging
from core.betfair_client import _call, is_configured, _norm

logger = logging.getLogger(__name__)


def list_tennis_markets(days_ahead: int = 2) -> list[dict]:
    """
    Return upcoming tennis MATCH_ODDS markets from Betfair Exchange.
    Uses eventTypeIds=["2"] (Tennis).
    """
    from datetime import datetime, timedelta, timezone
    now = datetime.now(timezone.utc)
    end = now + timedelta(days=days_ahead)
    return _call("listMarketCatalogue", {
        "filter": {
            "eventTypeIds": ["2"],
            "marketTypeCodes": ["MATCH_ODDS"],
            "marketStartTime": {
                "from": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "to": end.strftime("%Y-%m-%dT%H:%M:%SZ"),
            },
        },
        "marketProjection": ["COMPETITION", "EVENT", "MARKET_START_TIME", "RUNNER_DESCRIPTION"],
        "sort": "FIRST_TO_START",
        "maxResults": "100",
    })


def get_tennis_odds(market_ids: list[str]) -> list[dict]:
    """Fetch best-back prices for a list of tennis market IDs."""
    if not market_ids:
        return []
    return _call("listMarketBook", {
        "marketIds": market_ids,
        "priceProjection": {
            "priceData": ["EX_BEST_OFFERS"],
            "exBestOffersOverrides": {"bestPricesDepth": 1},
        },
    })


def get_tennis_market_books_raw(market_ids: list[str]) -> list[dict]:
    """Fetch market books (runner statuses only) for given market IDs."""
    if not market_ids:
        return []
    return _call("listMarketBook", {
        "marketIds": market_ids,
        "priceProjection": {"priceData": []},
    })


def get_tennis_catalogue_by_ids(market_ids: list[str]) -> list[dict]:
    """Fetch market catalogue with runner names for given market IDs."""
    if not market_ids:
        return []
    return _call("listMarketCatalogue", {
        "filter": {"marketIds": market_ids},
        "marketProjection": ["RUNNER_DESCRIPTION"],
        "maxResults": str(len(market_ids)),
    })


def get_settled_results(market_ids: list[str]) -> dict[str, str | None]:
    """
    For each market_id return "P1", "P2", or None.
    P1/P2 = runner position (0-indexed) in the market book — matches the
    player1/player2 order stored in TennisPrediction.
    Returns None for markets not yet CLOSED.
    """
    if not market_ids:
        return {}
    books = get_tennis_market_books_raw(market_ids)
    results: dict[str, str | None] = {}
    for book in books:
        mid = book.get("marketId", "")
        if book.get("status") != "CLOSED":
            results[mid] = None
            continue
        winner_pos = None
        for i, runner in enumerate(book.get("runners", [])):
            if runner.get("status") == "WINNER":
                winner_pos = i
                break
        if winner_pos == 0:
            results[mid] = "P1"
        elif winner_pos == 1:
            results[mid] = "P2"
        else:
            results[mid] = None
    return results


def get_all_tennis_markets() -> list[dict]:
    """
    Fetch all upcoming tennis MATCH_ODDS markets with best-back prices.
    Returns list of dicts with player1, player2, odds_p1, odds_p2, market_id, event_name.
    Returns [] if Betfair not configured.
    """
    if not is_configured():
        logger.warning("Betfair not configured — returning empty tennis markets")
        return []

    try:
        markets = list_tennis_markets()
        if not markets:
            return []

        market_ids = [m["marketId"] for m in markets]
        books = get_tennis_odds(market_ids)
        book_by_id = {b["marketId"]: b for b in books}

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

            # Tennis: exactly 2 runners (player1, player2 — no draw)
            runner_list = list(runners_info.items())
            if len(runner_list) < 2:
                continue

            sel_p1, name_p1 = runner_list[0]
            sel_p2, name_p2 = runner_list[1]

            odds_p1 = prices.get(sel_p1, 0.0)
            odds_p2 = prices.get(sel_p2, 0.0)
            if not (odds_p1 and odds_p2):
                continue

            results.append({
                "market_id": mid,
                "event_name": market.get("event", {}).get("name", ""),
                "competition": market.get("competition", {}).get("name", ""),
                "start_time": market.get("marketStartTime", ""),
                "player1": name_p1,
                "player2": name_p2,
                "selection_id_p1": sel_p1,
                "selection_id_p2": sel_p2,
                "odds_p1": odds_p1,
                "odds_p2": odds_p2,
                "margin": round(1 / odds_p1 + 1 / odds_p2 - 1, 4),
            })

        return results

    except Exception as e:
        logger.error(f"get_all_tennis_markets error: {e}")
        return []

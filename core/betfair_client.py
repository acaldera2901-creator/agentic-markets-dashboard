import betfairlightweight
from config.settings import settings

_client = None


def get_betfair():
    global _client
    if _client is None:
        _client = betfairlightweight.APIClient(
            username=settings.BETFAIR_USERNAME,
            password=settings.BETFAIR_PASSWORD,
            app_key=settings.BETFAIR_APP_KEY,
        )
        _client.login()
    return _client


def place_bet(market_id: str, selection_id: int, odds: float, stake: float) -> dict:
    client = get_betfair()
    instructions = [{
        "selectionId": selection_id,
        "handicap": "0",
        "side": "BACK",
        "orderType": "LIMIT",
        "limitOrder": {
            "size": str(round(stake, 2)),
            "price": str(odds),
            "persistenceType": "LAPSE",
        }
    }]
    result = client.betting.place_orders(market_id=market_id, instructions=instructions)
    if hasattr(result, 'serialize'):
        return result.serialize()
    return {"status": "ok"}


def cash_out(market_id: str, selection_id: int, current_odds: float, original_stake: float) -> dict:
    client = get_betfair()
    lay_stake = original_stake * 0.95
    instructions = [{
        "selectionId": selection_id,
        "handicap": "0",
        "side": "LAY",
        "orderType": "LIMIT",
        "limitOrder": {
            "size": str(round(lay_stake, 2)),
            "price": str(current_odds),
            "persistenceType": "LAPSE",
        }
    }]
    result = client.betting.place_orders(market_id=market_id, instructions=instructions)
    if hasattr(result, 'serialize'):
        return result.serialize()
    return {"status": "ok"}

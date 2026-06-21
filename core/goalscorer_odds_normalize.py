"""Parser puro delle quote anytime-goalscorer The Odds API."""
from __future__ import annotations
from dataclasses import dataclass

_MARKET_SRC = "player_goal_scorer_anytime"
_MARKET_OUT = "anytime_goalscorer"


@dataclass(frozen=True)
class PlayerOddRow:
    match_id: str
    sport_key: str
    event_id: str
    player_id: str | None
    player_name: str
    market: str
    bookmaker: str
    region: str
    price: float
    implied_prob: float


def parse_event_odds(event_json: dict, match_id: str, sport_key: str, region: str = "us") -> list[PlayerOddRow]:
    out: list[PlayerOddRow] = []
    event_id = event_json.get("id", "")
    for book in event_json.get("bookmakers") or []:
        bk = book.get("key", "")
        for market in book.get("markets") or []:
            if market.get("key") != _MARKET_SRC:
                continue
            for o in market.get("outcomes") or []:
                if o.get("name") != "Yes":
                    continue
                name = (o.get("description") or "").strip()
                price = o.get("price")
                if not name or not isinstance(price, (int, float)) or price <= 1.0:
                    continue
                out.append(PlayerOddRow(
                    match_id=match_id, sport_key=sport_key, event_id=event_id,
                    player_id=None, player_name=name, market=_MARKET_OUT,
                    bookmaker=bk, region=region, price=float(price),
                    implied_prob=1.0 / float(price),
                ))
    return out

# core/tennis_oddspapi_client.py
import os
import logging
from typing import Any
import httpx

logger = logging.getLogger(__name__)

BASE_URL = "https://api.oddspapi.io/v4"
SPORT_ID = 12  # tennis
MATCH_WINNER_MARKET = "121"      # confirmed from real sample
OUTCOME_P1, OUTCOME_P2 = "121", "122"  # canonical outcomes: "121"=participant1, "122"=participant2
ANCHOR_ORDER = ("pinnacle",)  # then any book with a sane 2-way (exchange artefacts rejected)
OVERROUND_MIN, OVERROUND_MAX = 0.90, 1.30  # valid range for a 2-way match-winner market
_UA = {"User-Agent": "betredge/1.0"}  # urllib default → 403; fix with explicit UA


def _key() -> str | None:
    return os.environ.get("ODDSPAPI_KEY") or None


def _price(outcome: dict | None) -> float | None:
    try:
        return float(outcome["players"]["0"]["price"])
    except (TypeError, KeyError, ValueError):
        return None


def parse_oddspapi_match_odds(payload: dict[str, Any]) -> dict[str, Any] | None:
    """Extract 2-way match-winner (market "121"), anchored on Pinnacle. Pure, fail-soft.

    Schema (confirmed): bookmakerOdds[book]['markets']['121']['outcomes']['121'|'122']['players']['0']['price'].
    outcome '121'=participant1, '122'=participant2 (canonical, same across books).
    """
    bk = (payload or {}).get("bookmakerOdds") or {}
    if not bk:
        return None
    order = [b for b in ANCHOR_ORDER if b in bk] + [b for b in bk if b not in ANCHOR_ORDER]
    for book in order:
        m = ((bk.get(book) or {}).get("markets") or {}).get(MATCH_WINNER_MARKET)
        if not m:
            continue
        outcomes = m.get("outcomes") or {}
        p1 = _price(outcomes.get(OUTCOME_P1))
        p2 = _price(outcomes.get(OUTCOME_P2))
        if p1 and p2 and p1 > 1.0 and p2 > 1.0:
            overround = 1 / p1 + 1 / p2
            if not (OVERROUND_MIN <= overround <= OVERROUND_MAX):
                continue  # reject exchange artefacts (e.g. 1.03/1.03 → overround ~1.94)
            return {"odds_p1": p1, "odds_p2": p2, "bookmaker": book}
    return None


async def get_oddspapi_fixtures(date_from: str, date_to: str) -> list[dict[str, Any]]:
    key = _key()
    if not key:
        return []
    try:
        async with httpx.AsyncClient(timeout=15.0, headers=_UA) as client:
            resp = await client.get(
                f"{BASE_URL}/fixtures",
                params={"apiKey": key, "sportId": SPORT_ID, "from": date_from, "to": date_to, "hasOdds": "true"},
            )
        if resp.status_code != 200:
            logger.warning("oddspapi fixtures HTTP %s", resp.status_code)
            return []
        data = resp.json()
        items = data if isinstance(data, list) else data.get("data", [])
        out = []
        for f in items:
            out.append({
                "fixtureId": f.get("fixtureId"),
                "player1": f.get("participant1Name"),
                "player2": f.get("participant2Name"),
                "scheduled_at": f.get("startTime"),
                "tournament": f.get("tournamentName"),
                "category": f.get("categoryName"),
            })
        return out
    except Exception as exc:
        logger.warning("oddspapi fixtures failed (non-fatal): %s", exc)
        return []


async def get_oddspapi_match_odds(fixture_id: str) -> dict[str, Any] | None:
    key = _key()
    if not key or not fixture_id:
        return None
    try:
        async with httpx.AsyncClient(timeout=15.0, headers=_UA) as client:
            resp = await client.get(f"{BASE_URL}/odds", params={"apiKey": key, "fixtureId": fixture_id})
        if resp.status_code != 200:
            return None
        return parse_oddspapi_match_odds(resp.json())
    except Exception as exc:
        logger.warning("oddspapi odds failed (non-fatal): %s", exc)
        return None


async def get_oddspapi_tennis_odds(wanted_keys: set[str]) -> list[dict[str, Any]]:
    """For our known matches (wanted_keys = _pair_key values), fetch odds from OddsPapi.

    Returns rows in the shape of parse_tennis_odds_events (usable by merge_tennis_odds).
    """
    from datetime import datetime, timezone, timedelta
    from core.tennis_odds_api_client import _pair_key
    if not wanted_keys or not _key():
        return []
    now = datetime.now(timezone.utc)
    dfrom = now.date().isoformat()
    dto = (now + timedelta(days=2)).date().isoformat()
    fixtures = await get_oddspapi_fixtures(dfrom, dto)
    rows: list[dict[str, Any]] = []
    for f in fixtures:
        k = _pair_key(f.get("player1"), f.get("player2"), f.get("scheduled_at"))
        if not k or k not in wanted_keys:
            continue
        odds = await get_oddspapi_match_odds(f["fixtureId"])
        if not odds:
            continue
        rows.append({
            "odds_event_id": f["fixtureId"],
            "player1": f["player1"],
            "player2": f["player2"],
            "scheduled_at": f["scheduled_at"],
            "odds_p1": odds["odds_p1"],
            "odds_p2": odds["odds_p2"],
            "bookmaker": odds["bookmaker"],
            "anchor_source": "pinnacle" if odds["bookmaker"] == "pinnacle" else "best_margin",
        })
    return rows

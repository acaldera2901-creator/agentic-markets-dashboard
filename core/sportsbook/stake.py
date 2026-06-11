"""Stake (stake.it) odds client (#SPORTSBOOK-SCRAPER-1).

stake.it = operatore ADM, sportsbook fornito da **Altenar**. Le quote vengono dal
feed widget Altenar, che è **pubblico** (raggiungibile via httpx senza login —
solo saldo/scommesse richiede auth). Resta il nodo legale ADM (scraping di un
concessionario italiano), accettato come interim fino ai contratti.

Endpoint: GetUpcoming (prematch) per sportId. Modello relazionale:
  events[]{competitorIds:[home,away], startDate, sportId, name, marketIds}
  markets[]{id, typeId, oddIds}   odds[]{id, price, competitorId, name}
Match result: market typeId 1 = 1x2 calcio (home=competitorIds[0], draw=name 'X',
away=competitorIds[1]); typeId 186 = match-winner tennis (2 vie per competitorId).
NOTA: GetUpcoming è una vista 'highlights' (no totals); i totals stanno nel feed
full-markets (follow-up). La quota in price è decimale.
"""
import logging
from datetime import datetime

import httpx

from core.sportsbook.common import OddsEvent

logger = logging.getLogger("StakeClient")

_BASE = ("https://sb2frontend-1-altenar2.biahosted.com/api/widget/GetUpcoming"
         "?culture=it-IT&timezoneOffset=0&integration=stake.it&deviceType=1"
         "&numFormat=en-GB&countryCode=IT&eventCount=50")
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    "Accept": "application/json",
    "Origin": "https://www.stake.it",
    "Referer": "https://www.stake.it/",
}
_SPORT = {66: "soccer", 68: "tennis"}
_MARKET_1X2 = 1
_MARKET_WINNER = 186


def _unix(iso: str | None) -> int | None:
    if not iso:
        return None
    try:
        return int(datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp())
    except (ValueError, TypeError):
        return None


def parse_response(payload: dict, sport: str) -> list[OddsEvent]:
    markets = {m["id"]: m for m in payload.get("markets", [])}
    odds = {o["id"]: o for o in payload.get("odds", [])}
    names = {c["id"]: c.get("name", "") for c in payload.get("competitors", [])}
    out: list[OddsEvent] = []
    for ev in payload.get("events", []):
        cids = ev.get("competitorIds") or []
        if len(cids) < 2:
            continue
        home_id, away_id = cids[0], cids[1]
        want = _MARKET_1X2 if sport == "soccer" else _MARKET_WINNER
        oh = od = oa = None
        for mid in ev.get("marketIds", []):
            m = markets.get(mid)
            if not m or m.get("typeId") != want:
                continue
            for oid in m.get("oddIds", []):
                o = odds.get(oid)
                if not o:
                    continue
                cid, price = o.get("competitorId"), o.get("price")
                if cid == home_id:
                    oh = price
                elif cid == away_id:
                    oa = price
                elif (o.get("name") or "").strip().upper() == "X":
                    od = price
            break
        if oh is None and oa is None:
            continue
        out.append(OddsEvent(
            source="stake", sport=sport,
            competitors=[names.get(home_id, ""), names.get(away_id, "")],
            scheduled=_unix(ev.get("startDate")),
            odds_home=oh, odds_draw=od, odds_away=oa,
            event_id=str(ev.get("id")),
        ))
    return out


async def fetch_events() -> list[OddsEvent]:
    """Fetch prematch Altenar (calcio+tennis) + parse. Ritorna [] su errore (mai solleva)."""
    out: list[OddsEvent] = []
    try:
        async with httpx.AsyncClient(timeout=20.0, headers=_HEADERS) as c:
            for sid, sport in _SPORT.items():
                resp = await c.get(f"{_BASE}&sportId={sid}")
                if resp.status_code != 200:
                    logger.warning("stake %s HTTP %s", sport, resp.status_code)
                    continue
                out.extend(parse_response(resp.json(), sport))
    except Exception as exc:
        logger.warning("stake fetch error: %s", exc)
    return out

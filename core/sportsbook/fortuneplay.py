"""FortunePlay odds client (#FORTUNEPLAY-ODDS-1).

fortuneplay.com = sportsbook white-label su **BetConstruct** (ID `bc:*`, stats
FeedConstruct, infra betspace.tech). rooster.bet gira sulla STESSA piattaforma e
stesso endpoint → questo adapter copre entrambi i brand. È il PRIMO book
*autorizzato* (deal di partnership), a differenza di Stake/Roobet (interim).

Endpoint (REST pubblico, no login, paginato):
  GET https://www.fortuneplay.com/_sb_api/api/v2/matches
      ?bettable=true&match_status=0&match_status=1&sport_type=regular
      &sort_by=bets_count:desc&limit=50&page=N
  -> { "data": [ match ], "pagination": {total,page,limit,last_page} }

Modello match (verificato 2026-06-19):
  match{ id, urn_id, start_time(ISO Z), status(0=prematch,1=live),
         competitors{home{name}, away{name}},
         tournament{sport{key}},                      # 'soccer' | 'tennis' | ...
         main_market{ outcomes:[{name, odds}] },       # 1X2 / match-winner
         secondary_market{ specifier, outcomes:[{name, odds}] } }  # U/O Goal
Mercati (parse PER POSIZIONE, non per nome: il `name` è localizzato —
'1'/'Pareggio'/'2' in IT, 'USA'/'Draw'/'Australia' in EN — quindi inaffidabile):
  - main_market: ordine fisso [home, draw, away]. 3 vie = calcio 1X2;
    2 vie = match-winner (tennis, draw=None). odds = INTERO ÷ 1000 (1600 -> 1.60).
  - secondary_market: U/O -> riconosciuto da 'hcp=L' nello specifier + 2 outcomes
    in ordine [over, under]; line dallo specifier. Altrimenti ignorato.
NOTA: MVP = solo 1X2 + U/O (le colonne che odds_snapshots già ha). Gli 800+
mercati soft (cartellini/corner/props) sono follow-up #FORTUNEPLAY-SOFT-MARKETS-2
(richiedono estensione schema).
"""
import logging
from datetime import datetime

import httpx

from core.sportsbook.common import OddsEvent

logger = logging.getLogger("FortunePlayClient")

_BASE = "https://www.fortuneplay.com/_sb_api/api/v2/matches"
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    "Accept": "application/json",
    "Origin": "https://www.fortuneplay.com",
    "Referer": "https://www.fortuneplay.com/it/sports",
}
_SPORTS = {"soccer", "tennis"}   # solo gli sport che il nostro modello tratta
_PAGE_LIMIT = 50
_MAX_PAGES = 20                  # cap (≤1000 match): mai martellare il partner


def _odds(raw) -> float | None:
    """Quota BetConstruct (intero ×1000) -> decimale. 1600 -> 1.60."""
    try:
        v = float(raw) / 1000.0
        return v if v > 1.0 else None
    except (TypeError, ValueError):
        return None


def _unix(iso: str | None) -> int | None:
    if not iso:
        return None
    try:
        return int(datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp())
    except (ValueError, TypeError):
        return None


def _parse_match_result(market: dict | None) -> tuple[float | None, float | None, float | None]:
    """main_market -> (home, draw, away) PER POSIZIONE. Ordine fisso [home, draw,
    away] (3 vie = 1X2) o [home, away] (2 vie = match-winner, draw=None)."""
    outcomes = (market or {}).get("outcomes") or []
    if len(outcomes) >= 3:
        return (_odds(outcomes[0].get("odds")), _odds(outcomes[1].get("odds")),
                _odds(outcomes[2].get("odds")))
    if len(outcomes) == 2:
        return _odds(outcomes[0].get("odds")), None, _odds(outcomes[1].get("odds"))
    return None, None, None


def _parse_totals(market: dict | None) -> tuple[float | None, float | None, float | None]:
    """secondary_market U/O -> (line, over, under). Riconosciuto SOLO se lo
    specifier contiene 'hcp=L' e ci sono 2 outcomes in ordine [over, under].
    Ritorna (None,None,None) altrimenti."""
    market = market or {}
    outcomes = market.get("outcomes") or []
    spec = market.get("specifier") or ""
    if len(outcomes) != 2 or "hcp=" not in spec:
        return None, None, None
    line = None
    for part in spec.split("|"):
        if part.startswith("hcp="):
            try:
                line = float(part.split("=", 1)[1])
            except ValueError:
                return None, None, None
            break
    return line, _odds(outcomes[0].get("odds")), _odds(outcomes[1].get("odds"))


def parse_response(payload: dict) -> list[OddsEvent]:
    """Estrae OddsEvent (calcio+tennis, 1X2/match-winner + U/O) da una pagina."""
    out: list[OddsEvent] = []
    for m in payload.get("data", []):
        sport = ((m.get("tournament") or {}).get("sport") or {}).get("key")
        if sport not in _SPORTS:
            continue
        comp = m.get("competitors") or {}
        home = (comp.get("home") or {}).get("name", "")
        away = (comp.get("away") or {}).get("name", "")
        if not home or not away:
            continue
        oh, od, oa = _parse_match_result(m.get("main_market"))
        if oh is None and oa is None:
            continue
        line, over, under = _parse_totals(m.get("secondary_market"))
        out.append(OddsEvent(
            source="fortuneplay", sport=sport, competitors=[home, away],
            scheduled=_unix(m.get("start_time")),
            odds_home=oh, odds_draw=od, odds_away=oa,
            total_line=line, total_over=over, total_under=under,
            event_id=str(m.get("urn_id") or m.get("id")),
        ))
    return out


async def fetch_events() -> list[OddsEvent]:
    """Fetch prematch+live (calcio+tennis), paginato. Ritorna [] su errore (mai solleva)."""
    out: list[OddsEvent] = []
    params = [
        ("bettable", "true"),
        ("match_status", "0"), ("match_status", "1"),   # prematch + live
        ("sport_type", "regular"),
        ("sort_by", "bets_count:desc"),
        ("limit", str(_PAGE_LIMIT)),
    ]
    try:
        async with httpx.AsyncClient(timeout=20.0, headers=_HEADERS) as c:
            page = 1
            while page <= _MAX_PAGES:
                resp = await c.get(_BASE, params=params + [("page", str(page))])
                if resp.status_code != 200:
                    logger.warning("fortuneplay page %d HTTP %s", page, resp.status_code)
                    break
                payload = resp.json()
                out.extend(parse_response(payload))
                last = ((payload.get("pagination") or {}).get("last_page")) or page
                if page >= last:
                    break
                page += 1
    except Exception as exc:
        logger.warning("fortuneplay fetch error: %s", exc)
    return out

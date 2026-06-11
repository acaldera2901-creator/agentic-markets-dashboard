"""Roobet odds client (#SPORTSBOOK-SCRAPER-1).

Roobet usa il widget BetBy; le quote vengono dal feed BetBy/sptpub.com (il
dominio roobet.com è TLS-fingerprint-bloccato per i client non-browser, ma il
feed provider NO — raggiungibile via httpx con header Origin/Referer di roobet).

Protocollo (verificato 2026-06-11):
  1. GET /api/v4/prematch/brand/{BRAND}/en/0  -> envelope JSON con i puntatori
     versione: top_events_versions[], rest_events_versions[].
  2. GET /api/v4/prematch/brand/{BRAND}/en/{version}  -> snapshot gzip ~100KB:
     { sports, categories, tournaments, events:{ id: {desc, markets, state} } }.
     events[id].markets = { market_id: { specifier: { outcome_id: {"k": quota} } } }

Mapping mercati/outcome (Betradar UOF, confermato su dati reali):
  - sport: '1'=Soccer, '5'=Tennis
  - market '1'  = 1X2:        outcome 1=home, 2=draw, 3=away
  - market '186'= match-winner (tennis, 2 vie): outcome 4=competitor1, 5=competitor2
  - market '18' = totals (calcio, goals), '189' = totals (tennis, games):
                  specifier 'total=L', outcome 12=over, 13=under
NOTA: la corrispondenza outcome-id->lato (home/away, p1/p2, over/under) segue la
convenzione UOF; va riconfermata contro un risultato settlato prima di usarla
per il P&L (la quota in sé è certa, l'etichetta del lato no).
"""
import logging

import httpx

from core.sportsbook.common import OddsEvent

logger = logging.getLogger("RoobetClient")

BRAND = "2186449803775455232"
_API = f"https://api-g-c7818b61-607.sptpub.com/api/v4/prematch/brand/{BRAND}/en"
_HEADERS = {
    "Origin": "https://roobet.com",
    "Referer": "https://roobet.com/",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    "Accept": "application/json",
}

_SPORT_ID = {"1": "soccer", "5": "tennis"}
_MARKET_1X2 = "1"
_MARKET_WINNER = "186"
_TOTALS = {"18", "189"}


def _k(node: dict, outcome: str) -> float | None:
    try:
        return float(node[outcome]["k"])
    except (KeyError, TypeError, ValueError):
        return None


def _parse_totals(market: dict) -> tuple[float | None, float | None, float | None]:
    """Linea totals 'principale': quella con over/under più vicini a 1.90-2.00
    (la più bilanciata = la linea di mercato). Ritorna (line, over, under)."""
    best = (None, None, None)
    best_gap = 1e9
    for spec, outcomes in market.items():
        if not spec.startswith("total="):
            continue
        try:
            line = float(spec.split("=", 1)[1])
        except ValueError:
            continue
        over, under = _k(outcomes, "12"), _k(outcomes, "13")
        if over is None or under is None:
            continue
        gap = abs(over - under)
        if gap < best_gap:
            best_gap, best = gap, (line, over, under)
    return best


def parse_snapshot(snapshot: dict) -> list[OddsEvent]:
    """Estrae OddsEvent (calcio+tennis, match result + totals) dallo snapshot BetBy."""
    out: list[OddsEvent] = []
    for eid, ev in (snapshot.get("events") or {}).items():
        desc = ev.get("desc") or {}
        sport = _SPORT_ID.get(str(desc.get("sport")))
        if not sport:
            continue
        comps = [c.get("name", "") for c in desc.get("competitors", [])]
        if len(comps) < 2:
            continue
        markets = ev.get("markets") or {}
        oh = od = oa = None
        if sport == "soccer" and _MARKET_1X2 in markets:
            m = markets[_MARKET_1X2].get("", {})
            oh, od, oa = _k(m, "1"), _k(m, "2"), _k(m, "3")
        elif sport == "tennis" and _MARKET_WINNER in markets:
            m = markets[_MARKET_WINNER].get("", {})
            oh, oa = _k(m, "4"), _k(m, "5")
        line = over = under = None
        for mk in _TOTALS:
            if mk in markets:
                line, over, under = _parse_totals(markets[mk])
                break
        out.append(OddsEvent(
            source="roobet", sport=sport, competitors=comps[:2],
            scheduled=desc.get("scheduled"),
            odds_home=oh, odds_draw=od, odds_away=oa,
            total_line=line, total_over=over, total_under=under,
            event_id=str(eid),
        ))
    return out


async def fetch_events() -> list[OddsEvent]:
    """Fetch live dello snapshot prematch + parse. Ritorna [] su errore (mai solleva)."""
    try:
        async with httpx.AsyncClient(timeout=20.0, headers=_HEADERS) as c:
            env = (await c.get(f"{_API}/0")).json()
            versions = (env.get("rest_events_versions") or []) + (env.get("top_events_versions") or [])
            events: list[OddsEvent] = []
            seen: set[str] = set()
            for v in versions:
                snap = (await c.get(f"{_API}/{v}")).json()
                for ev in parse_snapshot(snap):
                    if ev.event_id not in seen:
                        seen.add(ev.event_id)
                        events.append(ev)
            return events
    except Exception as exc:
        logger.warning("roobet fetch error: %s", exc)
        return []

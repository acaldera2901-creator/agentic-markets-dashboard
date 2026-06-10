"""
Matchbook Exchange client.

Authentication: POST /bpapi/rest/security/session  → session-token header/body
Edge API:       https://api.matchbook.com/edge/rest  (markets, bets)

Sports: tennis=9, football=15
Session lives ~6 hours — re-auth on 401.
"""
import requests
import logging
from config.settings import settings

logger = logging.getLogger(__name__)

_session_token: str | None = None

AUTH_URL = "https://api.matchbook.com/bpapi/rest/security/session"
EDGE_URL = "https://api.matchbook.com/edge/rest"

SPORT_TENNIS = 9
SPORT_FOOTBALL = 15


def _login() -> str:
    resp = requests.post(
        AUTH_URL,
        json={"username": settings.MATCHBOOK_USERNAME, "password": settings.MATCHBOOK_PASSWORD},
        headers={"Accept": "application/json", "Content-Type": "application/json"},
        timeout=15,
    )
    resp.raise_for_status()
    body = resp.json()
    token = body.get("session-token") or resp.headers.get("session-token", "")
    if not token:
        raise RuntimeError(f"Matchbook login failed — no session-token in response: {body}")
    return token


def _headers() -> dict:
    global _session_token
    if not _session_token:
        _session_token = _login()
    return {
        "session-token": _session_token,
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def _get(path: str, params: dict | None = None) -> dict:
    global _session_token
    resp = requests.get(f"{EDGE_URL}{path}", headers=_headers(), params=params or {}, timeout=15)
    if resp.status_code == 401:
        _session_token = _login()
        resp = requests.get(f"{EDGE_URL}{path}", headers=_headers(), params=params or {}, timeout=15)
    resp.raise_for_status()
    return resp.json()


def _post(path: str, payload: dict) -> dict:
    global _session_token
    resp = requests.post(f"{EDGE_URL}{path}", headers=_headers(), json=payload, timeout=15)
    if resp.status_code == 401:
        _session_token = _login()
        resp = requests.post(f"{EDGE_URL}{path}", headers=_headers(), json=payload, timeout=15)
    resp.raise_for_status()
    return resp.json()


def is_configured() -> bool:
    return bool(
        settings.MATCHBOOK_USERNAME
        and settings.MATCHBOOK_PASSWORD
        and settings.MATCHBOOK_USERNAME != "matchbook"
    )


def get_account_balance() -> dict:
    """Return Matchbook account balance info."""
    resp = requests.get(
        "https://api.matchbook.com/bpapi/rest/account",
        headers=_headers(),
        timeout=15,
    )
    if resp.status_code == 401:
        global _session_token
        _session_token = _login()
        resp = requests.get(
            "https://api.matchbook.com/bpapi/rest/account",
            headers=_headers(),
            timeout=15,
        )
    resp.raise_for_status()
    return resp.json()


def _best_back(runner: dict) -> float:
    """Return best available back price for a runner, or 0.0."""
    for price in runner.get("prices", []):
        if price.get("side") == "back" and price.get("odds", 0) > 1.0:
            return float(price["odds"])
    return 0.0


def get_tennis_markets() -> list[dict]:
    """
    Return upcoming tennis match markets from Matchbook.
    Returns upcoming tennis match markets from Matchbook.
    match_id prefixed "mb_" so tennis_trader routes to Matchbook execution.
    """
    if not is_configured():
        return []
    try:
        data = _get("/events", {
            "sport-ids": SPORT_TENNIS,
            "status": "open",
            "include": "markets,runners,prices",
            "price-mode": "expanded",
            "per-page": 50,
            "page": 1,
        })
        results = []
        for event in data.get("events", []):
            event_name = event.get("name", "")
            competition = event.get("category-descriptions", [{}])
            comp_name = competition[-1].get("name", "") if competition else ""

            for market in event.get("markets", []):
                runners = market.get("runners", [])
                # Tennis markets have exactly 2 runners (no draw)
                live_runners = [r for r in runners if r.get("status") == "open"]
                if len(live_runners) < 2:
                    continue

                r1, r2 = live_runners[0], live_runners[1]
                odds_p1 = _best_back(r1)
                odds_p2 = _best_back(r2)
                if not (odds_p1 and odds_p2):
                    continue

                results.append({
                    "market_id": f"mb_{market['id']}",
                    "event_name": event_name,
                    "competition": comp_name,
                    "start_time": event.get("start", ""),
                    "player1": r1.get("name", ""),
                    "player2": r2.get("name", ""),
                    "selection_id_p1": r1["id"],
                    "selection_id_p2": r2["id"],
                    "odds_p1": odds_p1,
                    "odds_p2": odds_p2,
                    "margin": round(1 / odds_p1 + 1 / odds_p2 - 1, 4),
                    "exchange": "matchbook",
                })
        return results
    except Exception as e:
        logger.error(f"get_tennis_markets error: {e}")
        return []


def get_football_markets() -> list[dict]:
    """
    Return upcoming football 1X2 markets from Matchbook.
    Returns upcoming football 1X2 markets from Matchbook.
    """
    if not is_configured():
        return []
    try:
        data = _get("/events", {
            "sport-ids": SPORT_FOOTBALL,
            "status": "open",
            "include": "markets,runners,prices",
            "price-mode": "expanded",
            "per-page": 100,
            "page": 1,
        })
        import re
        def _norm(n):
            return re.sub(r"\b(FC|AC|AS|SS|US|SSC|AFC|SC|SV|CF|1\. FC)\b", "", n, flags=re.I).strip().lower()

        results = []
        for event in data.get("events", []):
            # Event name is "Home vs Away" — use it to assign sides instead of
            # trusting runner order, and to reject markets whose runners aren't
            # the two event teams (e.g. Half Time Result reuses the team names).
            event_name = event.get("name", "")
            ev_sides = re.split(r"\s+vs\.?\s+|\s+v\s+", event_name, maxsplit=1, flags=re.I)
            if len(ev_sides) != 2:
                continue
            ev_home_norm, ev_away_norm = _norm(ev_sides[0]), _norm(ev_sides[1])

            for market in event.get("markets", []):
                # Only the full-time 1X2 market — skip Half Time Result and any
                # other market that happens to carry the same team-named runners.
                mkt_name = str(market.get("name", "")).strip().lower()
                if mkt_name not in ("match odds", "moneyline", "money line", "1x2"):
                    continue

                runners = [r for r in market.get("runners", []) if r.get("status") == "open"]
                if len(runners) < 3:
                    continue

                oh = od = oa = 0.0
                home_name = away_name = ""
                for r in runners:
                    name = r.get("name", "")
                    odds = _best_back(r)
                    if "draw" in name.lower():
                        od = odds
                    elif _norm(name) == ev_home_norm:
                        home_name = name
                        oh = odds
                    elif _norm(name) == ev_away_norm:
                        away_name = name
                        oa = odds

                if not (oh and od and oa):
                    continue

                results.append({
                    "home_team": home_name,
                    "away_team": away_name,
                    "home_team_normalized": _norm(home_name),
                    "away_team_normalized": _norm(away_name),
                    "odds_home": oh,
                    "odds_draw": od,
                    "odds_away": oa,
                    "bookmaker": "matchbook",
                    "margin": round(1 / oh + 1 / od + 1 / oa - 1, 4),
                })
        return results
    except Exception as e:
        logger.error(f"get_football_markets error: {e}")
        return []


def place_bet(runner_id: int, odds: float, stake: float, side: str = "back") -> dict:
    """
    Place a BACK bet on Matchbook.
    Returns the bet dict from the API response, or raises on failure.
    """
    result = _post("/bets", {
        "bets": [{
            "runner-id": int(runner_id),
            "stake": round(float(stake), 2),
            "odds": round(float(odds), 2),
            "side": side,
            "keep-in-play": False,
        }]
    })
    bets = result.get("bets", [])
    return bets[0] if bets else result


def get_current_bets(status: str = "open") -> list[dict]:
    """Return current open/matched bets from Matchbook."""
    try:
        data = _get("/bets", {"status": status, "per-page": 50})
        return data.get("bets", [])
    except Exception as e:
        logger.warning(f"get_current_bets error: {e}")
        return []

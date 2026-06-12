import httpx
from typing import List, Dict
from config.settings import settings

_DIRECT_BASE = "https://v3.football.api-sports.io"
_RAPID_BASE  = "https://api-football-v1.p.rapidapi.com/v3"


def _is_rapidapi_key(key: str) -> bool:
    return len(key) > 30 and any(c.islower() for c in key) and any(c.isdigit() for c in key)


def _base_url() -> str:
    return _RAPID_BASE if _is_rapidapi_key(settings.API_FOOTBALL_KEY) else _DIRECT_BASE


def _headers() -> dict:
    key = settings.API_FOOTBALL_KEY
    if _is_rapidapi_key(key):
        return {"x-rapidapi-key": key, "x-rapidapi-host": "api-football-v1.p.rapidapi.com"}
    return {"x-apisports-key": key}


async def get_fixtures(league_id: int, season: int) -> List[Dict]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{_base_url()}/fixtures",
            headers=_headers(),
            params={"league": league_id, "season": season, "next": 10},
            timeout=15.0,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("errors"):
            return []
        return data.get("response", [])

async def get_lineups(fixture_id: int) -> List[Dict]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{_base_url()}/fixtures/lineups",
            headers=_headers(),
            params={"fixture": fixture_id},
            timeout=15.0,
        )
        resp.raise_for_status()
        return resp.json().get("response", [])

async def get_historical_results(league_id: int, season: int) -> List[Dict]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{_base_url()}/fixtures",
            headers=_headers(),
            params={"league": league_id, "season": season, "status": "FT", "last": 50},
            timeout=15.0,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("errors"):
            return []
        return data.get("response", [])

LEAGUE_IDS = {
    "PL": 39, "SA": 135, "PD": 140, "BL1": 78,
    "FL1": 61, "CL": 2, "EL": 3, "ECL": 848,
    # API-FOOTBALL / API-SPORTS uses league id 1 for FIFA World Cup.
    # Keep this in monitor-only until diagnostics confirm 2026 coverage.
    "WC": 1,
    # Summer-calendar leagues (#SUMMER-LEAGUES-1, APPROVE Andrea 2026-06-12).
    # Fixtures are ESPN-first (provider chain): these ids only matter for the
    # API-Football LAST-RESORT fallback, whose key is currently dead (403).
    "ELI": 103,   # Norway Eliteserien
    "ALL": 113,   # Sweden Allsvenskan
    "VEI": 244,   # Finland Veikkausliiga
    "LOI": 357,   # League of Ireland Premier Division
    "CSL": 169,   # China Super League
}


async def get_fixture_result(fixture_id: int) -> dict | None:
    """
    Fetch a single fixture by ID and return its result dict, or None if not finished.
    Returns: {home_goals, away_goals, status, home_team, away_team}
    """
    if not settings.API_FOOTBALL_KEY:
        return None
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{_base_url()}/fixtures",
            headers=_headers(),
            params={"id": fixture_id},
            timeout=15.0,
        )
        resp.raise_for_status()
        data = resp.json().get("response", [])
    if not data:
        return None
    f = data[0]
    status = f.get("fixture", {}).get("status", {}).get("short", "")
    if status not in ("FT", "AET", "PEN"):
        return None
    score = f.get("score", {}).get("fulltime", {})
    home_goals = score.get("home")
    away_goals = score.get("away")
    if home_goals is None or away_goals is None:
        return None
    return {
        "home_goals": int(home_goals),
        "away_goals": int(away_goals),
        "status": status,
        "home_team": f.get("teams", {}).get("home", {}).get("name", ""),
        "away_team": f.get("teams", {}).get("away", {}).get("name", ""),
    }


_DIRECT_HOST = "https://v3.football.api-sports.io"


def _norm_team(name: str) -> str:
    return " ".join((name or "").strip().lower().split())


async def get_fixture_result_by_teams_date(
    home_team: str, away_team: str, kickoff_date: str
) -> dict | None:
    """Result lookup by team names + date on the api-sports DIRECT host.

    ESPN-independent fallback for FRIENDLY rows whose ESPN-by-id summary fails
    or wrongly reports the match canceled (observed in prod 2026-06-09:
    Oman 4-2 Kuwait was played but ESPN's fifa.friendly feed flagged it
    canceled, so the row was voided). Uses ``API_FOOTBALL_DIRECT_KEY`` and the
    direct host because the ``/fixtures?date`` lookup is unavailable on the
    RapidAPI key.

    Matches by normalized team names in EITHER orientation and only returns a
    FINAL fixture (FT/AET/PEN) — never a guess. The returned score is
    normalized to the caller's home/away orientation. None when the key is
    absent, the date is outside the plan window, or no FINAL match is found
    (caller then falls through to the abandoned-void path).
    """
    key = settings.API_FOOTBALL_DIRECT_KEY
    if not key or not home_team or not away_team or not kickoff_date:
        return None
    date_str = str(kickoff_date)[:10]
    want_home, want_away = _norm_team(home_team), _norm_team(away_team)
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{_DIRECT_HOST}/fixtures",
                headers={"x-apisports-key": key},
                params={"date": date_str},
                timeout=15.0,
            )
            if resp.status_code != 200:
                return None
            data = resp.json().get("response", [])
    except Exception:
        return None
    for f in data:
        status = f.get("fixture", {}).get("status", {}).get("short", "")
        if status not in _FINAL_STATUSES:
            continue
        teams = f.get("teams", {})
        api_home = _norm_team((teams.get("home") or {}).get("name", ""))
        api_away = _norm_team((teams.get("away") or {}).get("name", ""))
        score = f.get("score", {}).get("fulltime", {})
        gh, ga = score.get("home"), score.get("away")
        if gh is None or ga is None:
            continue
        if api_home == want_home and api_away == want_away:
            return {"home_goals": int(gh), "away_goals": int(ga), "status": status,
                    "home_team": home_team, "away_team": away_team}
        # Reversed orientation: flip the score back to OUR home/away.
        if api_home == want_away and api_away == want_home:
            return {"home_goals": int(ga), "away_goals": int(gh), "status": status,
                    "home_team": home_team, "away_team": away_team}
    return None


# API-Football "short" status codes that mean the fixture will never produce a
# settleable score (canceled / abandoned / postponed / walkover / awarded).
# Used by ResultSettlementAgent to void bets on matches that never complete
# (#17), instead of leaving them pending forever.
_ABANDONED_STATUSES = frozenset({"CANC", "ABD", "PST", "WO", "AWD", "SUSP", "INT"})
_FINAL_STATUSES = frozenset({"FT", "AET", "PEN"})


async def get_fixture_disposition(fixture_id: int) -> str | None:
    """Return 'final' | 'abandoned' | 'pending' for a fixture, or None on error.

    'abandoned' covers any status from which no final score will ever arrive
    (canceled, postponed, walkover, awarded, interrupted/suspended). Lets the
    settlement agent void the corresponding bet rather than poll it forever.
    """
    if not settings.API_FOOTBALL_KEY:
        return None
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{_base_url()}/fixtures",
                headers=_headers(),
                params={"id": fixture_id},
                timeout=15.0,
            )
            if resp.status_code != 200:
                return None
            data = resp.json().get("response", [])
    except Exception:
        return None
    if not data:
        return None
    status = data[0].get("fixture", {}).get("status", {}).get("short", "")
    if status in _FINAL_STATUSES:
        return "final"
    if status in _ABANDONED_STATUSES:
        return "abandoned"
    return "pending"


async def get_standings(league_id: int, season: int) -> List[Dict]:
    """Return league table rows for the given league+season."""
    if not settings.API_FOOTBALL_KEY:
        return []
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            resp = await c.get(
                f"{_base_url()}/standings",
                params={"league": league_id, "season": season},
                headers=_headers(),
            )
            if resp.status_code != 200:
                return []
            data = resp.json()
            standings = data.get("response", [])
            if not standings:
                return []
            return standings[0].get("league", {}).get("standings", [[]])[0]
    except Exception:
        return []


async def get_team_form(team_id: int, league_id: int, season: int, last_n: int = 10) -> Dict:
    """Return form data: {form: 'WWDLW', ppg: float, xg_avg: float, matches: int}"""
    if not settings.API_FOOTBALL_KEY:
        return {}
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            resp = await c.get(
                f"{_base_url()}/fixtures",
                params={"team": team_id, "league": league_id, "season": season,
                        "last": last_n, "status": "FT"},
                headers=_headers(),
            )
            if resp.status_code != 200:
                return {}
            fixtures = resp.json().get("response", [])
    except Exception:
        return {}

    results = []
    for f in fixtures:
        goals = f.get("goals", {})
        teams = f.get("teams", {})
        is_home = teams.get("home", {}).get("id") == team_id
        scored = goals.get("home") if is_home else goals.get("away")
        conceded = goals.get("away") if is_home else goals.get("home")
        if scored is None or conceded is None:
            continue
        won = scored > conceded
        drawn = scored == conceded
        results.append({"w": won, "d": drawn, "scored": scored, "conceded": conceded})

    if not results:
        return {}

    form_str = "".join("W" if r["w"] else ("D" if r["d"] else "L") for r in results[-5:])
    points = sum(3 if r["w"] else (1 if r["d"] else 0) for r in results)
    ppg = round(points / len(results), 3)
    avg_scored = round(sum(r["scored"] for r in results) / len(results), 3)
    return {"form": form_str, "ppg": ppg, "xg_avg": avg_scored, "matches": len(results)}


async def get_h2h(team1_id: int, team2_id: int, last_n: int = 10) -> Dict:
    """Return H2H record: {team1_wins, draws, team2_wins, total}"""
    if not settings.API_FOOTBALL_KEY:
        return {}
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            resp = await c.get(
                f"{_base_url()}/fixtures/headtohead",
                params={"h2h": f"{team1_id}-{team2_id}", "last": last_n, "status": "FT"},
                headers=_headers(),
            )
            if resp.status_code != 200:
                return {}
            fixtures = resp.json().get("response", [])
    except Exception:
        return {}

    t1_wins = draws = t2_wins = 0
    for f in fixtures:
        teams = f.get("teams", {})
        goals = f.get("goals", {})
        home_id = teams.get("home", {}).get("id")
        gh, ga = goals.get("home", 0) or 0, goals.get("away", 0) or 0
        if gh == ga:
            draws += 1
        elif gh > ga:
            if home_id == team1_id:
                t1_wins += 1
            else:
                t2_wins += 1
        else:
            if home_id == team1_id:
                t2_wins += 1
            else:
                t1_wins += 1
    return {"team1_wins": t1_wins, "draws": draws, "team2_wins": t2_wins, "total": len(fixtures)}


async def get_injuries(fixture_id: int) -> Dict:
    """Return injury lists: {home: [...], away: [...]}"""
    if not settings.API_FOOTBALL_KEY:
        return {"home": [], "away": []}
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            resp = await c.get(
                f"{_base_url()}/injuries",
                params={"fixture": fixture_id},
                headers=_headers(),
            )
            if resp.status_code != 200:
                return {"home": [], "away": []}
            injuries = resp.json().get("response", [])
    except Exception:
        return {"home": [], "away": []}

    home_inj, away_inj = [], []
    for inj in injuries:
        player = inj.get("player", {})
        entry = {"name": player.get("name"), "reason": inj.get("reason", "")}
        side = inj.get("team", {}).get("side", "")
        if side == "home":
            home_inj.append(entry)
        else:
            away_inj.append(entry)
    return {"home": home_inj, "away": away_inj}

"""
Client for football-data.org v4 API (free tier).
Free competitions: PL, SA, PD, BL1, FL1, CL, EL, DED, PPL, BSA, EC, WC.
Rate limit: 10 req/min on free tier — always sleep 6s between calls.

Normalizes responses to the same dict shape used by football_api_client.py
so data_collector and model agents need no format changes.
"""
import asyncio
import time
import httpx
from datetime import datetime, timedelta, timezone
from typing import List, Dict

BASE_URL = "https://api.football-data.org/v4"

# competition codes supported by the free tier (subset of all codes)
FREE_TIER_CODES = frozenset({"PL", "SA", "PD", "BL1", "FL1", "CL", "EL", "DED", "PPL", "BSA", "WC"})

# Global rate limiter: max 8 requests/min (conservative below the 10/min limit)
# Shared across DataCollector, ModelAgent, or any other caller
_rate_lock = asyncio.Lock()
_last_request_times: list[float] = []
_MAX_REQUESTS_PER_MIN = 8


async def _rate_limited_request() -> None:
    """Block until sending another request is within the rate limit."""
    while True:
        async with _rate_lock:
            now = time.monotonic()
            cutoff = now - 60.0
            while _last_request_times and _last_request_times[0] < cutoff:
                _last_request_times.pop(0)
            if len(_last_request_times) < _MAX_REQUESTS_PER_MIN:
                _last_request_times.append(time.monotonic())
                return
            wait = 60.0 - (now - _last_request_times[0]) + 0.5
        # Release lock before sleeping so other waiters can also check
        if wait > 0:
            await asyncio.sleep(wait)


def _headers(api_key: str) -> dict:
    return {"X-Auth-Token": api_key}


def _normalize(m: dict) -> dict:
    """Return a dict in API-Football shape so callers are format-agnostic."""
    ft = m.get("score", {}).get("fullTime", {})
    normalized = {
        "fixture": {
            "id": m["id"],
            "date": m["utcDate"],
        },
        "teams": {
            "home": {"name": m["homeTeam"]["name"]},
            "away": {"name": m["awayTeam"]["name"]},
        },
        "score": {
            "fulltime": {
                "home": ft.get("home"),
                "away": ft.get("away"),
            }
        },
    }
    # Stage/group/matchday feed the WC context (infer_stage reads the fixture
    # "round" text): "GROUP_STAGE GROUP_A" → "group stage group a" matches both
    # the stage keyword and the group-letter regex. Dropping these here was
    # what kept the venue_context gate red (missing_stage on every WC row).
    round_parts = [
        str(m.get("stage") or "").replace("_", " "),
        str(m.get("group") or "").replace("_", " "),
    ]
    matchday = m.get("matchday")
    if matchday:
        round_parts.append(f"Matchday {matchday}")
    round_text = " ".join(p for p in round_parts if p).strip()
    if round_text:
        normalized["round"] = round_text
    # football-data.org rarely fills venue (None for WC as of 2026-06), but
    # pass it through when present so the context builder can read it.
    venue = m.get("venue")
    if venue:
        normalized["fixture"]["venue"] = {"name": str(venue)}
    return normalized


async def get_fixtures(competition_code: str, api_key: str, days_ahead: int = 14) -> List[Dict]:
    if competition_code not in FREE_TIER_CODES:
        return []
    await _rate_limited_request()
    today = datetime.now(timezone.utc).date()
    date_to = today + timedelta(days=days_ahead)
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BASE_URL}/competitions/{competition_code}/matches",
            headers=_headers(api_key),
            params={
                "status": "SCHEDULED,TIMED",
                "dateFrom": today.isoformat(),
                "dateTo": date_to.isoformat(),
            },
            timeout=15.0,
        )
    if resp.status_code == 429:
        await asyncio.sleep(60)
        return []
    if resp.status_code != 200:
        return []
    return [_normalize(m) for m in resp.json().get("matches", [])]


async def get_match_result(
    competition_code: str,
    api_key: str,
    home_team: str,
    away_team: str,
    kickoff_date: str,
) -> dict | None:
    """
    Look up a finished match result by team names and date.
    Searches ±3 days around kickoff_date. Returns {home_goals, away_goals} or None.
    Used as fallback in ResultSettlementAgent when RapidAPI is unavailable.
    """
    if competition_code not in FREE_TIER_CODES or not api_key:
        return None

    import unicodedata
    from difflib import SequenceMatcher

    def _norm(s: str) -> str:
        return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower().strip()

    def _sim(a: str, b: str) -> float:
        return SequenceMatcher(None, _norm(a), _norm(b)).ratio()

    try:
        base_dt = datetime.fromisoformat(kickoff_date.replace("Z", "+00:00")).date()
    except Exception:
        return None

    date_from = (base_dt - timedelta(days=1)).isoformat()
    date_to = (base_dt + timedelta(days=2)).isoformat()

    await _rate_limited_request()
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BASE_URL}/competitions/{competition_code}/matches",
            headers=_headers(api_key),
            params={"status": "FINISHED", "dateFrom": date_from, "dateTo": date_to},
            timeout=15.0,
        )
    if resp.status_code != 200:
        return None

    for m in resp.json().get("matches", []):
        h = m.get("homeTeam", {}).get("name", "")
        a = m.get("awayTeam", {}).get("name", "")
        if _sim(h, home_team) >= 0.6 and _sim(a, away_team) >= 0.6:
            ft = m.get("score", {}).get("fullTime", {})
            hg = ft.get("home")
            ag = ft.get("away")
            if hg is not None and ag is not None:
                return {"home_goals": int(hg), "away_goals": int(ag)}
    return None


async def get_standings(competition_code: str, api_key: str) -> List[Dict]:
    """Return standings table for a competition. Returns [] if not in free tier."""
    if competition_code not in FREE_TIER_CODES:
        return []
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            resp = await c.get(
                f"https://api.football-data.org/v4/competitions/{competition_code}/standings",
                headers={"X-Auth-Token": api_key},
            )
            if resp.status_code != 200:
                return []
            data = resp.json()
            standings = data.get("standings", [])
            for s in standings:
                if s.get("type") == "TOTAL":
                    return s.get("table", [])
            return []
    except Exception:
        return []


async def get_historical_results(competition_code: str, api_key: str, days_back: int = 365) -> List[Dict]:
    if competition_code not in FREE_TIER_CODES:
        return []
    await _rate_limited_request()
    today = datetime.now(timezone.utc).date()
    date_from = today - timedelta(days=days_back)
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BASE_URL}/competitions/{competition_code}/matches",
            headers=_headers(api_key),
            params={
                "status": "FINISHED",
                "dateFrom": date_from.isoformat(),
                "dateTo": today.isoformat(),
            },
            timeout=15.0,
        )
    if resp.status_code == 429:
        await asyncio.sleep(60)
        return []
    if resp.status_code != 200:
        return []
    return [_normalize(m) for m in resp.json().get("matches", [])]

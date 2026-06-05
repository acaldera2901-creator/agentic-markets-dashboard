"""
ESPN Tennis Client — free, no API key.

Fixtures: per-day scoreboard API (atp+wta, today+tomorrow) — lists SCHEDULED
matches with real athlete names, so the board is forward-looking instead of
emptying every evening (root cause of the 2026-06-05 empty Best Bets:
the old header endpoint only carried live/completed matches in its notes).

Settlement: header endpoint, whose notes field puts the winner first by
construction ("A bt B") — see get_completed_results().
"""
from __future__ import annotations
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from core.tennis_names import clean_player_name, canonical_player_key

logger = logging.getLogger("espn_tennis_client")

_URL = "https://site.web.api.espn.com/apis/v2/scoreboard/header?sport=tennis"
_SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/tennis/{league}/scoreboard"
_SCOREBOARD_LEAGUES = ("atp", "wta")
# A fixture is servable from 2h before "now-window" up to 48h ahead: the same
# trading window the dashboard applies (scheduled_at > NOW()-2h), plus tomorrow.
_PAST_GRACE = timedelta(hours=2)
_FUTURE_HORIZON = timedelta(hours=48)
_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; AgenticMarkets/1.0)"}
_DOUBLES_SEP = re.compile(r"\s*&\s*")
_NOTE_SPLIT = re.compile(
    r"^(?P<p1>.+?)\s+(?P<verb>bt|def\.?|defeated|leads)\s+(?P<p2>.+?)(?:\s+\d|$)",
    re.IGNORECASE,
)


def _parse_notes(note_text: str, comp_type: str) -> dict | None:
    """Parse 'Player A bt Player B 6-4 6-3' or 'Player A leads Player B 7-6'."""
    # Doubles not supported (two players per side)
    if "Doubles" in comp_type:
        return None

    text = " ".join(note_text.split())
    match = _NOTE_SPLIT.match(text)
    if not match:
        return None

    status = "live" if match.group("verb").lower() == "leads" else "completed"
    p1 = clean_player_name(match.group("p1"))
    p2 = clean_player_name(match.group("p2"))
    if not p1 or not p2:
        return None

    surface = "clay"  # ESPN only gives Roland Garros at the moment — always clay
    gender = "W" if "Women" in comp_type else "M"

    return {"player1": p1, "player2": p2, "surface": surface,
            "gender": gender, "match_status": status}


_CLAY_KEYWORDS = (
    "roland", "french", "clay", "terra", "monte-carlo", "rome", "madrid",
    "barcelona", "hamburg", "gstaad", "bastad", "umag", "kitzbuhel",
    "puglie", "makarska",
)
_GRASS_KEYWORDS = (
    "wimbledon", "grass", "queen", "hsbc", "halle", "eastbourne",
    "nottingham", "birmingham", "boss open", "libema", "hertogenbosch",
    "mallorca", "berlin", "bad homburg",
)

_ACCENT_MAP = str.maketrans("àáâãäéèêëíìîïóòôõöúùûüç", "aaaaaeeeeiiiiooooouuuuc")


def infer_surface(tournament: str) -> str:
    """Surface from tournament name. Mirrors TennisModelAgent._infer_surface
    but extended with the June grass swing; defaults to hard.
    Accents are folded so 'Libéma Open' matches 'libema'."""
    t = tournament.lower().translate(_ACCENT_MAP)
    if any(kw in t for kw in _CLAY_KEYWORDS):
        return "clay"
    if any(kw in t for kw in _GRASS_KEYWORDS):
        return "grass"
    return "hard"


def _parse_iso_date(raw: str) -> datetime | None:
    """ESPN dates come as '2026-06-06T13:00Z' — normalize and parse."""
    if not raw:
        return None
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return None


def _competition_to_fixture(
    comp: dict, tournament: str, now: datetime
) -> dict | None:
    """Map one scoreboard competition (a single match) to a fixture dict.

    Fail-closed: anything without two named singles athletes, a parseable
    date inside the trading window, or a non-completed status returns None.
    """
    state = ((comp.get("status") or {}).get("type") or {}).get("state", "")
    # "post" = completed: emitting it poisons the pipeline with past events.
    # Only "pre" (scheduled) and "in" (live, still tradeable in the 12h window).
    if state not in ("pre", "in"):
        return None

    scheduled = _parse_iso_date(comp.get("date") or comp.get("startDate") or "")
    if scheduled is None:
        return None
    if scheduled < now - _PAST_GRACE or scheduled > now + _FUTURE_HORIZON:
        return None

    competitors = comp.get("competitors") or []
    if len(competitors) != 2:
        return None
    names = []
    for side in competitors:
        athlete = side.get("athlete") or {}
        name = clean_player_name(athlete.get("displayName") or "")
        if not name:
            return None  # doubles teams have no single athlete name
        names.append(name)

    # Canonical (alphabetical) player order makes player1/player2 and the
    # match_id deterministic; the odds merge re-aligns prices by canonical
    # player key, so order carries no meaning here.
    p1, p2 = names
    if canonical_player_key(p1) > canonical_player_key(p2):
        p1, p2 = p2, p1

    comp_id = comp.get("id", "")
    if not comp_id:
        return None
    match_key = f"{canonical_player_key(p1)}:{canonical_player_key(p2)}".replace(" ", "-")

    round_info = comp.get("round")
    if isinstance(round_info, dict):
        round_name = round_info.get("displayName") or ""
    elif round_info:
        round_name = f"Round {round_info}"
    else:
        round_name = ""

    return {
        "match_id": f"tennis:espn:{comp_id}:{match_key}",
        "player1": p1,
        "player2": p2,
        "tournament": tournament,
        "surface": infer_surface(tournament),
        "round": round_name,
        "scheduled_at": scheduled.isoformat(),
        "provider": "espn",
    }


def _parse_scoreboard(data: dict, now: datetime, seen: set[str], out: list[dict]) -> None:
    """Extract singles fixtures from one day-scoreboard payload into `out`."""
    for ev in data.get("events", []):
        tournament = ev.get("name", ev.get("shortName", "Unknown"))
        # Grand Slams nest matches under groupings; smaller events may carry
        # competitions directly on the event.
        groupings = ev.get("groupings") or []
        if groupings:
            for g in groupings:
                gname = (g.get("grouping") or {}).get("displayName", "")
                if "Singles" not in gname:
                    continue
                for comp in g.get("competitions") or []:
                    fixture = _competition_to_fixture(comp, tournament, now)
                    if fixture and fixture["match_id"] not in seen:
                        seen.add(fixture["match_id"])
                        out.append(fixture)
        else:
            for comp in ev.get("competitions") or []:
                comp_type = (comp.get("type") or {}).get("text", "")
                if comp_type and "Singles" not in comp_type:
                    continue
                fixture = _competition_to_fixture(comp, tournament, now)
                if fixture and fixture["match_id"] not in seen:
                    seen.add(fixture["match_id"])
                    out.append(fixture)


async def get_fixtures() -> list[dict]:
    """
    Forward-looking tennis fixtures from the ESPN per-day scoreboard
    (atp + wta feeds, today + tomorrow UTC). Scheduled ("pre") and live
    ("in") singles matches only; completed matches are never emitted.
    Returns canonical fixture dicts compatible with tennis_fixtures.
    """
    now = datetime.now(timezone.utc)
    dates = [now.strftime("%Y%m%d"), (now + timedelta(days=1)).strftime("%Y%m%d")]

    seen: set[str] = set()
    results: list[dict] = []
    try:
        async with httpx.AsyncClient(timeout=12.0) as c:
            for league in _SCOREBOARD_LEAGUES:
                for day in dates:
                    try:
                        resp = await c.get(
                            _SCOREBOARD_URL.format(league=league),
                            params={"dates": day},
                            headers=_HEADERS,
                        )
                        if resp.status_code != 200:
                            logger.warning("ESPN tennis %s/%s: %s", league, day, resp.status_code)
                            continue
                        _parse_scoreboard(resp.json(), now, seen, results)
                    except Exception as exc:
                        logger.warning("ESPN tennis %s/%s error (non-fatal): %s", league, day, exc)
    except Exception as exc:
        logger.warning("ESPN tennis error (non-fatal): %s", exc)
        return []

    logger.info("ESPN tennis: found %d singles fixtures (today+tomorrow)", len(results))
    return results


async def get_completed_results() -> list[dict]:
    """
    Completed singles results from the same scoreboard feed.

    The notes field puts the WINNER first by construction ("A bt B 6-4 6-3"),
    so parsed player1 of a completed match IS the winner — exactly the bias
    that makes completed rows unusable as fixtures makes them perfect for
    settlement. Returns [{winner_key, loser_key, winner_name, loser_name,
    tournament}] with canonical player keys for matching.
    """
    try:
        async with httpx.AsyncClient(timeout=12.0) as c:
            resp = await c.get(_URL, headers=_HEADERS)
            if resp.status_code != 200:
                logger.warning("ESPN tennis results: %s", resp.status_code)
                return []
            data = resp.json()
    except Exception as exc:
        logger.debug("ESPN tennis results error (non-fatal): %s", exc)
        return []

    sports = data.get("sports", [])
    if not sports:
        return []

    out: list[dict] = []
    for league in sports[0].get("leagues", []):
        for ev in league.get("events", []):
            comp_type = ev.get("competitionType", {}).get("text", "")
            if "Singles" not in comp_type:
                continue
            notes = ev.get("notes", [])
            note_text = notes[0].get("text", "") if notes else ""
            if not note_text:
                continue
            parsed = _parse_notes(note_text, comp_type)
            if not parsed or parsed["match_status"] != "completed":
                continue
            winner, loser = parsed["player1"], parsed["player2"]
            out.append({
                "winner_key": canonical_player_key(winner),
                "loser_key": canonical_player_key(loser),
                "winner_name": winner,
                "loser_name": loser,
                "tournament": ev.get("name", ev.get("shortName", "")),
            })

    logger.info("ESPN tennis: found %d completed results", len(out))
    return out

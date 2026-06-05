"""
ESPN Tennis Client — free, no API key.
Parses the ESPN scoreboard header to extract Roland Garros / tournament match data.
Works for live and recently-completed matches (player names in notes field).
Fallback used when paid tennis APIs are unavailable.
"""
from __future__ import annotations
import logging
import re
from typing import Any

import httpx
from core.tennis_names import clean_player_name, canonical_player_key

logger = logging.getLogger("espn_tennis_client")

_URL = "https://site.web.api.espn.com/apis/v2/scoreboard/header?sport=tennis"
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


async def get_fixtures() -> list[dict]:
    """
    Return available tennis fixtures from ESPN scoreboard (today's matches).
    Returns canonical fixture dicts compatible with tennis_fixtures Supabase table.
    """
    try:
        async with httpx.AsyncClient(timeout=12.0) as c:
            resp = await c.get(_URL, headers=_HEADERS)
            if resp.status_code != 200:
                logger.warning("ESPN tennis: %s", resp.status_code)
                return []
            data = resp.json()
    except Exception as exc:
        logger.debug("ESPN tennis error (non-fatal): %s", exc)
        return []

    sports = data.get("sports", [])
    if not sports:
        return []

    results: list[dict] = []
    for league in sports[0].get("leagues", []):
        tournament_name = None
        for ev in league.get("events", []):
            comp_type = ev.get("competitionType", {}).get("text", "")
            if "Singles" not in comp_type:
                continue
            notes = ev.get("notes", [])
            note_text = notes[0].get("text", "") if notes else ""
            if not note_text:
                continue

            parsed = _parse_notes(note_text, comp_type)
            if not parsed:
                continue

            # Completed matches are not fixtures: emitting them poisons the
            # pipeline with past events AND with a systematic winner-as-player1
            # bias ("A bt B" puts the winner first by construction).
            if parsed["match_status"] == "completed":
                continue

            # Live matches come as "leader leads trailer" — same ordering bias.
            # Canonical (alphabetical) player order makes player1/player2 and
            # the match_id deterministic; the odds merge already re-aligns
            # prices by canonical player key, so order carries no meaning here.
            p1, p2 = parsed["player1"], parsed["player2"]
            if canonical_player_key(p1) > canonical_player_key(p2):
                p1, p2 = p2, p1
            parsed["player1"], parsed["player2"] = p1, p2

            match_date = str(ev.get("date", ""))[:10]
            event_id = ev.get("competitionId", ev.get("id", ""))
            match_key = f"{canonical_player_key(parsed['player1'])}:{canonical_player_key(parsed['player2'])}".replace(" ", "-")
            match_id = f"tennis:espn:{event_id}:{match_key}"
            tournament = ev.get("name", ev.get("shortName", "Unknown"))
            round_num = ev.get("round", 0)
            round_name = f"Round {round_num}" if round_num else ""

            results.append({
                "match_id": match_id,
                "player1": parsed["player1"],
                "player2": parsed["player2"],
                "tournament": tournament,
                "surface": parsed["surface"],
                "round": round_name,
                "scheduled_at": ev.get("date", ""),
                "provider": "espn",
            })

    logger.info("ESPN tennis: found %d singles matches", len(results))
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

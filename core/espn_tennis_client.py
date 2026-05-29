"""
ESPN Tennis Client — free, no API key.
Parses the ESPN scoreboard header to extract Roland Garros / tournament match data.
Works for live and recently-completed matches (player names in notes field).
Fallback used when paid tennis APIs are unavailable.
"""
from __future__ import annotations
import logging
import re
from datetime import datetime, timezone
from typing import Any

import httpx

logger = logging.getLogger("espn_tennis_client")

_URL = "https://site.web.api.espn.com/apis/v2/scoreboard/header?sport=tennis"
_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; AgenticMarkets/1.0)"}
_SEEDING = re.compile(r"\(\d+\)\s*")
_NATION = re.compile(r"\([A-Z]{2,3}\)")
_DOUBLES_SEP = re.compile(r"\s*&\s*")


def _clean_name(raw: str) -> str:
    name = _SEEDING.sub("", raw)
    name = _NATION.sub("", name)
    return name.strip()


def _parse_notes(note_text: str, comp_type: str) -> dict | None:
    """Parse 'Player A bt Player B 6-4 6-3' or 'Player A leads Player B 7-6'."""
    # Doubles not supported (two players per side)
    if "Doubles" in comp_type:
        return None

    text = note_text
    status = "completed"
    sep = None

    if " bt " in text:
        sep = " bt "
        status = "completed"
    elif " leads " in text:
        sep = " leads "
        status = "live"
    else:
        return None

    parts = text.split(sep, 1)
    if len(parts) != 2:
        return None

    p1_raw = parts[0].strip()
    # Score starts with digits/whitespace
    p2_and_score = parts[1].strip()
    p2_raw = re.split(r"\s+\d[-\d()\s]*$", p2_and_score)[0].strip()
    # Fallback: split on first digit block
    if not p2_raw:
        p2_raw = re.split(r"\s+\d", p2_and_score)[0].strip()

    p1 = _clean_name(p1_raw)
    p2 = _clean_name(p2_raw)
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

            match_date = str(ev.get("date", ""))[:10]
            event_id = ev.get("competitionId", ev.get("id", ""))
            match_id = f"tennis:espn:{event_id}:{parsed['player1'].replace(' ','-')}"
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
                "espn_status": parsed["match_status"],
            })

    logger.info("ESPN tennis: found %d singles matches", len(results))
    return results

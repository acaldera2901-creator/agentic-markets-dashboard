# tests/test_espn_tennis_client.py
"""Regression tests for the ESPN scoreboard parser (P2 hardening, 2026-06-05):
completed matches must never be emitted as fixtures, and live matches must not
carry the leader-as-player1 ordering bias."""
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core.espn_tennis_client import _parse_notes, get_fixtures


def _scoreboard(events: list[dict]) -> dict:
    return {"sports": [{"leagues": [{"events": events}]}]}


def _event(note: str, event_id: str = "401999", date: str = "2026-06-08T13:00Z") -> dict:
    return {
        "id": event_id,
        "competitionId": event_id,
        "competitionType": {"text": "Men's Singles"},
        "notes": [{"text": note}],
        "date": date,
        "name": "Roland Garros",
        "round": 4,
    }


def _mock_response(payload: dict) -> MagicMock:
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = payload
    return resp


async def _fixtures_for(events: list[dict]) -> list[dict]:
    client = MagicMock()
    client.get = AsyncMock(return_value=_mock_response(_scoreboard(events)))
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=client)
    cm.__aexit__ = AsyncMock(return_value=False)
    with patch("core.espn_tennis_client.httpx.AsyncClient", return_value=cm):
        return await get_fixtures()


def test_parse_notes_flags_completed_and_live():
    done = _parse_notes("Carlos Alcaraz bt Jannik Sinner 6-4 6-3", "Men's Singles")
    live = _parse_notes("Jannik Sinner leads Carlos Alcaraz 7-6", "Men's Singles")
    assert done["match_status"] == "completed"
    assert live["match_status"] == "live"


async def test_completed_matches_are_not_emitted_as_fixtures():
    rows = await _fixtures_for([_event("Carlos Alcaraz bt Jannik Sinner 6-4 6-3")])
    assert rows == []


async def test_live_match_players_are_canonically_ordered():
    # "Sinner leads Alcaraz" — without the fix player1 would be the leader.
    rows = await _fixtures_for([_event("Jannik Sinner leads Carlos Alcaraz 7-6")])
    assert len(rows) == 1
    p1, p2 = rows[0]["player1"], rows[0]["player2"]
    assert (p1, p2) == ("Carlos Alcaraz", "Jannik Sinner")

    # Same match reported with the other leader must produce the same ordering
    # (and therefore the same match_id) — order carries no information.
    rows2 = await _fixtures_for([_event("Carlos Alcaraz leads Jannik Sinner 6-4")])
    assert (rows2[0]["player1"], rows2[0]["player2"]) == (p1, p2)
    assert rows2[0]["match_id"] == rows[0]["match_id"]

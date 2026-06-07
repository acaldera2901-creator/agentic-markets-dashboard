# tests/test_wc_lineups.py — #LINEUP-1-ESPN (confirmed XIs, display-only).
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import core.espn_soccer_client as espn
from agents.model import _format_confirmed_xi


def _scoreboard_event(event_id: str, kickoff: datetime, home: str, away: str) -> dict:
    return {
        "id": event_id,
        "date": kickoff.strftime("%Y-%m-%dT%H:%MZ"),
        "competitions": [{
            "competitors": [
                {"homeAway": "home", "team": {"displayName": home}},
                {"homeAway": "away", "team": {"displayName": away}},
            ],
        }],
    }


def _client_returning(payload: dict):
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = payload
    client = MagicMock()
    client.get = AsyncMock(return_value=resp)
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=client)
    cm.__aexit__ = AsyncMock(return_value=False)
    return cm


@pytest.fixture(autouse=True)
def _clear_cache():
    espn._cache.pop("wc_lineup_map", None)
    yield
    espn._cache.pop("wc_lineup_map", None)


async def test_lineup_map_returns_imminent_match_with_starters():
    now = datetime.now(timezone.utc)
    scoreboard = {"events": [_scoreboard_event("760415", now + timedelta(minutes=50), "Mexico", "South Africa")]}
    lineups = {"home": {"team": "Mexico", "starters": ["A", "B"]},
               "away": {"team": "South Africa", "starters": ["C"]}}
    with patch.object(espn, "get_match_lineups", new=AsyncMock(return_value=lineups)):
        with patch("core.espn_soccer_client.httpx.AsyncClient", return_value=_client_returning(scoreboard)):
            out = await espn.get_wc_lineup_map()
    key = espn._venue_pair_key("Mexico", "South Africa")
    assert key in out
    assert out[key]["home"]["starters"] == ["A", "B"]
    # both team orders keyed (provider home/away may disagree with ESPN)
    assert espn._venue_pair_key("South Africa", "Mexico") in out


async def test_lineup_map_skips_far_kickoffs_without_summary_calls():
    now = datetime.now(timezone.utc)
    scoreboard = {"events": [_scoreboard_event("760415", now + timedelta(hours=20), "Mexico", "South Africa")]}
    summary_mock = AsyncMock(return_value={"home": {"starters": ["X"]}})
    with patch.object(espn, "get_match_lineups", new=summary_mock):
        with patch("core.espn_soccer_client.httpx.AsyncClient", return_value=_client_returning(scoreboard)):
            out = await espn.get_wc_lineup_map()
    assert out == {}
    summary_mock.assert_not_awaited()  # no wasted summary calls outside the window


async def test_lineup_map_empty_when_rosters_not_published():
    now = datetime.now(timezone.utc)
    scoreboard = {"events": [_scoreboard_event("760415", now + timedelta(minutes=30), "Mexico", "South Africa")]}
    with patch.object(espn, "get_match_lineups", new=AsyncMock(return_value=None)):
        with patch("core.espn_soccer_client.httpx.AsyncClient", return_value=_client_returning(scoreboard)):
            out = await espn.get_wc_lineup_map()
    assert out == {}  # fail-closed: nothing fabricated before ESPN publishes


def test_format_confirmed_xi_compact_and_fail_closed():
    out = _format_confirmed_xi(
        "Mexico", "South Africa",
        {"home": {"starters": ["Ochoa", "Alvarez", "Gallardo", "Montes"]}, "away": {"starters": []}},
    )
    assert out == "XI confermati — Mexico: Ochoa, Alvarez, Gallardo, +1"
    assert _format_confirmed_xi("A", "B", {}) is None

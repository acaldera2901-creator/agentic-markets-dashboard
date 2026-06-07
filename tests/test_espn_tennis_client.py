# tests/test_espn_tennis_client.py
"""Regression tests for the ESPN tennis client.

P2 hardening (2026-06-05): completed matches must never be emitted as
fixtures, and players must be canonically ordered (no leader/winner-first
bias). Forward-looking rewrite (2026-06-05, PROPOSAL #016): fixtures come
from the per-day scoreboard (atp+wta, today+tomorrow) so SCHEDULED matches
populate the board — the old header endpoint only saw live/completed
matches, which emptied Best Bets every evening.
"""
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core.espn_tennis_client import _parse_notes, get_fixtures, infer_surface


def _iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%MZ")


def _competition(
    p1: str,
    p2: str,
    *,
    comp_id: str = "176001",
    state: str = "pre",
    date: str | None = None,
) -> dict:
    if date is None:
        date = _iso(datetime.now(timezone.utc) + timedelta(hours=6))
    return {
        "id": comp_id,
        "date": date,
        "status": {"type": {"state": state}},
        "round": 4,
        "competitors": [
            {"athlete": {"displayName": p1}},
            {"athlete": {"displayName": p2}},
        ],
    }


def _scoreboard(
    competitions: list[dict],
    *,
    tournament: str = "Roland Garros",
    grouping: str = "Men's Singles",
) -> dict:
    return {
        "events": [
            {
                "name": tournament,
                "groupings": [
                    {
                        "grouping": {"displayName": grouping},
                        "competitions": competitions,
                    }
                ],
            }
        ]
    }


def _mock_response(payload: dict) -> MagicMock:
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = payload
    return resp


async def _fixtures_for(payload: dict) -> list[dict]:
    """Run get_fixtures with every scoreboard call (atp/wta × today/tomorrow)
    returning the same payload — dedup by match_id must collapse them."""
    client = MagicMock()
    client.get = AsyncMock(return_value=_mock_response(payload))
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=client)
    cm.__aexit__ = AsyncMock(return_value=False)
    with patch("core.espn_tennis_client.httpx.AsyncClient", return_value=cm):
        return await get_fixtures()


def test_parse_notes_flags_completed_and_live():
    # _parse_notes still backs get_completed_results (settlement path).
    done = _parse_notes("Carlos Alcaraz bt Jannik Sinner 6-4 6-3", "Men's Singles")
    live = _parse_notes("Jannik Sinner leads Carlos Alcaraz 7-6", "Men's Singles")
    assert done["match_status"] == "completed"
    assert live["match_status"] == "live"


def test_parse_notes_surface_follows_tournament():
    # #TENNIS-1: surface was hardcoded 'clay' — grass-season settlement would
    # have updated the wrong surface-specific Elo.
    rg = _parse_notes("Carlos Alcaraz bt Jannik Sinner 6-4 6-3", "Men's Singles", "Roland Garros")
    wim = _parse_notes("Carlos Alcaraz bt Jannik Sinner 6-4 6-3", "Men's Singles", "Wimbledon")
    queens = _parse_notes("Carlos Alcaraz bt Jannik Sinner 6-4 6-3", "Men's Singles", "HSBC Championships, Queen's Club")
    assert rg["surface"] == "clay"
    assert wim["surface"] == "grass"
    assert queens["surface"] == "grass"


async def test_scheduled_match_is_emitted_with_canonical_order():
    rows = await _fixtures_for(
        _scoreboard([_competition("Jannik Sinner", "Carlos Alcaraz")])
    )
    assert len(rows) == 1
    row = rows[0]
    # Canonical (alphabetical) order regardless of feed order.
    assert (row["player1"], row["player2"]) == ("Carlos Alcaraz", "Jannik Sinner")
    assert row["match_id"].startswith("tennis:espn:176001:")
    assert row["provider"] == "espn"
    assert row["surface"] == "clay"  # Roland Garros


async def test_completed_matches_are_not_emitted_as_fixtures():
    rows = await _fixtures_for(
        _scoreboard([_competition("Carlos Alcaraz", "Jannik Sinner", state="post")])
    )
    assert rows == []


async def test_live_match_is_emitted_and_order_is_stable():
    a = await _fixtures_for(
        _scoreboard([_competition("Jannik Sinner", "Carlos Alcaraz", state="in")])
    )
    b = await _fixtures_for(
        _scoreboard([_competition("Carlos Alcaraz", "Jannik Sinner", state="in")])
    )
    assert len(a) == len(b) == 1
    assert a[0]["match_id"] == b[0]["match_id"]
    assert (a[0]["player1"], a[0]["player2"]) == (b[0]["player1"], b[0]["player2"])


async def test_doubles_groupings_are_skipped():
    rows = await _fixtures_for(
        _scoreboard(
            [_competition("Player One", "Player Two")],
            grouping="Men's Doubles",
        )
    )
    assert rows == []


async def test_unnamed_competitors_are_skipped():
    comp = _competition("X", "Y")
    comp["competitors"] = [{"athlete": {}}, {"athlete": {"displayName": "Solo"}}]
    rows = await _fixtures_for(_scoreboard([comp]))
    assert rows == []


async def test_matches_outside_the_window_are_skipped():
    now = datetime.now(timezone.utc)
    old = _competition(
        "Old One", "Old Two", comp_id="100", date=_iso(now - timedelta(days=5))
    )
    far = _competition(
        "Far One", "Far Two", comp_id="200", date=_iso(now + timedelta(days=10))
    )
    ok = _competition("Carlos Alcaraz", "Jannik Sinner", comp_id="300")
    rows = await _fixtures_for(_scoreboard([old, far, ok]))
    assert [r["match_id"].split(":")[2] for r in rows] == ["300"]


async def test_duplicate_competitions_across_feeds_are_deduped():
    # _fixtures_for returns the same payload for all 4 scoreboard calls:
    # without dedup the same match would appear 4 times.
    rows = await _fixtures_for(
        _scoreboard([_competition("Carlos Alcaraz", "Jannik Sinner")])
    )
    assert len(rows) == 1


def test_infer_surface_covers_clay_grass_hard():
    assert infer_surface("Roland Garros") == "clay"
    assert infer_surface("Boss Open") == "grass"
    assert infer_surface("Libema Open") == "grass"
    assert infer_surface("US Open") == "hard"

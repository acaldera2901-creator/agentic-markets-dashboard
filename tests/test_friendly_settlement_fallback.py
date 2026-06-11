"""Regression for the FRIENDLY settlement void bug (prod, 2026-06-09).

International friendlies that were actually PLAYED were being voided in the
public track record. Root cause: when ESPN's `fifa.friendly` summary-by-id
fails or wrongly reports the match canceled, `_fetch_unified_result` returned
None immediately for FRIENDLY rows ("no other provider covers friendlies"),
so the match was never looked up on an ESPN-independent provider and then
voided as abandoned.

Fix: an ESPN-independent fallback that looks the result up by team names +
date on api-football (direct host). Played friendlies settle won/lost with the
real score; genuinely canceled/abandoned ones (no FINAL fixture found) stay
void.
"""
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

import agents.result_settlement as rs
import core.football_api_client as fac


@pytest.fixture
def agent():
    # Avoid BaseAgent / SelfLearningEngine side effects at construction.
    a = rs.ResultSettlementAgent.__new__(rs.ResultSettlementAgent)
    import logging
    a.logger = logging.getLogger("test_friendly_fallback")
    return a


def _friendly_row(home, away, ext="espn:401873743", date="2026-06-09"):
    return {
        "id": "row-1",
        "external_event_id": ext,
        "sport": "football",
        "league": "FRIENDLY",
        "competition": "International Friendly",
        "home_team": home,
        "away_team": away,
        "market": "1X2",
        "pick": "home",
        "starts_at": f"{date}T15:00:00+00:00",
        "world_cup_stage": None,
    }


# ── (a) played friendly: ESPN-by-id misses, fallback finds the real score ──
@pytest.mark.asyncio
async def test_played_friendly_settles_via_team_date_fallback(agent, monkeypatch):
    # ESPN summary-by-id returns nothing (the failure mode that triggered the bug).
    async def fake_espn_result(league, event_id):
        return None

    async def fake_by_teams_date(home_team, away_team, kickoff_date):
        assert kickoff_date.startswith("2026-06-09")
        return {
            "home_goals": 4,
            "away_goals": 2,
            "status": "FT",
            "home_team": "Oman",
            "away_team": "Kuwait",
        }

    monkeypatch.setattr(rs, "espn_get_match_result", fake_espn_result)
    monkeypatch.setattr(rs, "get_fixture_result_by_teams_date", fake_by_teams_date)

    result = await agent._fetch_unified_result(_friendly_row("Oman", "Kuwait"))

    assert result is not None
    assert (result["home_goals"], result["away_goals"]) == (4, 2)
    # pick=home, 4-2 -> won
    assert rs._outcome("home", result["home_goals"], result["away_goals"]) == "won"


# ── (b) genuinely canceled friendly: no FINAL anywhere -> None -> stays void ──
@pytest.mark.asyncio
async def test_canceled_friendly_returns_none_and_stays_void(agent, monkeypatch):
    async def fake_espn_result(league, event_id):
        return None  # ESPN has no completed result

    async def fake_by_teams_date(home_team, away_team, kickoff_date):
        return None  # api-football has no FINAL fixture (canceled / not played)

    monkeypatch.setattr(rs, "espn_get_match_result", fake_espn_result)
    monkeypatch.setattr(rs, "get_fixture_result_by_teams_date", fake_by_teams_date)

    result = await agent._fetch_unified_result(
        _friendly_row("Austria", "Guatemala", ext="espn:401869744", date="2026-06-11")
    )

    assert result is None  # -> _should_void_abandoned decides, void preserved


# ── (c) WC/club path is untouched: ESPN-by-id still settles directly ──
@pytest.mark.asyncio
async def test_wc_path_unchanged_settles_from_espn_by_id(agent, monkeypatch):
    espn_calls = {"n": 0}
    fallback_calls = {"n": 0}

    async def fake_espn_result(league, event_id):
        espn_calls["n"] += 1
        return {
            "home_goals": 2,
            "away_goals": 1,
            "status": "FT",
            "home_team": "Brazil",
            "away_team": "Argentina",
        }

    async def fake_by_teams_date(home_team, away_team, kickoff_date):
        fallback_calls["n"] += 1
        return None

    monkeypatch.setattr(rs, "espn_get_match_result", fake_espn_result)
    monkeypatch.setattr(rs, "get_fixture_result_by_teams_date", fake_by_teams_date)

    row = _friendly_row("Brazil", "Argentina", ext="espn:999")
    row["league"] = "WC"
    row["competition"] = "FIFA World Cup"

    result = await agent._fetch_unified_result(row)

    assert result is not None and result["home_goals"] == 2
    assert espn_calls["n"] == 1
    # WC settled straight from ESPN; the friendly fallback must not fire.
    assert fallback_calls["n"] == 0


# ── client: by-teams-date matches both orientations and requires FINAL ──
@pytest.mark.asyncio
async def test_client_by_teams_date_matches_and_requires_final(monkeypatch):
    payload = {
        "response": [
            {  # the friendly we want, teams reversed vs our row
                "fixture": {"id": 1, "status": {"short": "FT"}},
                "teams": {"home": {"name": "Kuwait"}, "away": {"name": "Oman"}},
                "score": {"fulltime": {"home": 2, "away": 4}},
            },
            {  # noise
                "fixture": {"id": 2, "status": {"short": "FT"}},
                "teams": {"home": {"name": "Brazil"}, "away": {"name": "Chile"}},
                "score": {"fulltime": {"home": 1, "away": 0}},
            },
        ]
    }

    class FakeResp:
        status_code = 200

        def json(self):
            return payload

        def raise_for_status(self):
            pass

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, *a, **k):
            return FakeResp()

    monkeypatch.setattr(fac.settings, "API_FOOTBALL_DIRECT_KEY", "test-key")
    monkeypatch.setattr(fac.httpx, "AsyncClient", FakeClient)

    res = await fac.get_fixture_result_by_teams_date("Oman", "Kuwait", "2026-06-09T15:00:00+00:00")
    assert res is not None
    # Score is normalized to OUR row orientation (home=Oman): Oman 4, Kuwait 2.
    assert (res["home_goals"], res["away_goals"]) == (4, 2)


@pytest.mark.asyncio
async def test_client_by_teams_date_no_final_returns_none(monkeypatch):
    payload = {
        "response": [
            {  # our match but CANCELED -> never settleable
                "fixture": {"id": 1, "status": {"short": "CANC"}},
                "teams": {"home": {"name": "Austria"}, "away": {"name": "Guatemala"}},
                "score": {"fulltime": {"home": None, "away": None}},
            }
        ]
    }

    class FakeResp:
        status_code = 200

        def json(self):
            return payload

        def raise_for_status(self):
            pass

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, *a, **k):
            return FakeResp()

    monkeypatch.setattr(fac.settings, "API_FOOTBALL_DIRECT_KEY", "test-key")
    monkeypatch.setattr(fac.httpx, "AsyncClient", FakeClient)

    res = await fac.get_fixture_result_by_teams_date(
        "Austria", "Guatemala", "2026-06-11T15:00:00+00:00"
    )
    assert res is None


@pytest.mark.asyncio
async def test_client_by_teams_date_noop_without_key(monkeypatch):
    monkeypatch.setattr(fac.settings, "API_FOOTBALL_DIRECT_KEY", "")
    res = await fac.get_fixture_result_by_teams_date("Oman", "Kuwait", "2026-06-09")
    assert res is None

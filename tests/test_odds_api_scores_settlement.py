"""The Odds API /scores as a settlement result source (#ODDS-SCORES-1).

api-football's RapidAPI host is dead (403); the team+date friendly fallback runs
on a fragile Free key (100/day). The Odds API is the paid, active plan we already
use for odds — its /scores endpoint covers every competition we have odds for and
is the robust result source for unified settlement.

These tests pin:
  (a) a completed match found via /scores settles won/lost on the real score;
  (b) a match not in /scores (or not completed) -> None -> stays void;
  (c) reversed team orientation -> score flipped back to OUR home/away;
  (d) no regression: ESPN-by-id still wins for ESPN/WC rows, the /scores lookup
      only fires as a fallback and friendlies are untouched (no Odds API key).
"""
from datetime import datetime, timezone

import pytest

import agents.result_settlement as rs
import core.odds_api_client as oac


# ──────────────────────────────────────────────────────────────────────────
# Client: get_score_by_teams_date
# ──────────────────────────────────────────────────────────────────────────

def _scores_payload():
    return [
        {  # the match we want
            "id": "ev1",
            "home_team": "Vila Nova",
            "away_team": "Botafogo",
            "commence_time": "2026-06-08T23:00:00Z",
            "completed": True,
            "scores": [
                {"name": "Vila Nova", "score": "1"},
                {"name": "Botafogo", "score": "0"},
            ],
        },
        {  # not completed yet -> must be ignored
            "id": "ev2",
            "home_team": "Coritiba",
            "away_team": "Goias",
            "commence_time": "2026-06-09T23:00:00Z",
            "completed": False,
            "scores": None,
        },
    ]


def _patch_scores(monkeypatch, payload, status=200, capture=None):
    class FakeResp:
        status_code = status

        def json(self):
            return payload

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, url, **k):
            if capture is not None:
                capture.append((url, k))
            return FakeResp()

    monkeypatch.setattr(oac.settings, "ODDS_API_KEY", "test-key")
    monkeypatch.setattr(oac.httpx, "AsyncClient", FakeClient)


@pytest.mark.asyncio
async def test_score_by_teams_date_found_completed(monkeypatch):
    _patch_scores(monkeypatch, _scores_payload())
    res = await oac.get_score_by_teams_date(
        "soccer_brazil_serie_b", "Vila Nova", "Botafogo", "2026-06-08T23:00:00Z"
    )
    assert res == {"home_goals": 1, "away_goals": 0}


@pytest.mark.asyncio
async def test_score_by_teams_date_reversed_orientation_flips(monkeypatch):
    # Caller asks with Botafogo as home, but the feed lists Vila Nova as home.
    _patch_scores(monkeypatch, _scores_payload())
    res = await oac.get_score_by_teams_date(
        "soccer_brazil_serie_b", "Botafogo", "Vila Nova", "2026-06-08T23:00:00Z"
    )
    # Feed had Vila Nova 1 - Botafogo 0; flipped to caller's home=Botafogo.
    assert res == {"home_goals": 0, "away_goals": 1}


@pytest.mark.asyncio
async def test_score_by_teams_date_not_completed_returns_none(monkeypatch):
    _patch_scores(monkeypatch, _scores_payload())
    res = await oac.get_score_by_teams_date(
        "soccer_brazil_serie_b", "Coritiba", "Goias", "2026-06-09T23:00:00Z"
    )
    assert res is None  # completed=False -> no settleable score -> stays void


@pytest.mark.asyncio
async def test_score_by_teams_date_wrong_date_returns_none(monkeypatch):
    # A rematch of the same pair on a different day must NOT settle this row.
    _patch_scores(monkeypatch, _scores_payload())
    res = await oac.get_score_by_teams_date(
        "soccer_brazil_serie_b", "Vila Nova", "Botafogo", "2026-06-01T23:00:00Z"
    )
    assert res is None


@pytest.mark.asyncio
async def test_score_by_teams_date_no_key_noop(monkeypatch):
    monkeypatch.setattr(oac.settings, "ODDS_API_KEY", "")
    res = await oac.get_score_by_teams_date(
        "soccer_brazil_serie_b", "Vila Nova", "Botafogo", "2026-06-08T23:00:00Z"
    )
    assert res is None


@pytest.mark.asyncio
async def test_score_by_teams_date_caches_per_sport(monkeypatch):
    # One /scores call per sport must cover every event in the window — the
    # quota-aware contract. A passed-in cache dict is reused, not re-fetched.
    calls = []
    _patch_scores(monkeypatch, _scores_payload(), capture=calls)
    cache: dict = {}
    await oac.get_score_by_teams_date(
        "soccer_brazil_serie_b", "Vila Nova", "Botafogo",
        "2026-06-08T23:00:00Z", _cache=cache,
    )
    await oac.get_score_by_teams_date(
        "soccer_brazil_serie_b", "Coritiba", "Goias",
        "2026-06-09T23:00:00Z", _cache=cache,
    )
    assert len(calls) == 1  # second lookup served from cache


# ──────────────────────────────────────────────────────────────────────────
# Settlement wiring: _fetch_unified_result uses /scores as a fallback
# ──────────────────────────────────────────────────────────────────────────

@pytest.fixture
def agent():
    a = rs.ResultSettlementAgent.__new__(rs.ResultSettlementAgent)
    import logging
    a.logger = logging.getLogger("test_odds_scores_settlement")
    a._scores_cache = {}
    return a


def _row(home, away, league="PD", ext="espn:401900001", date="2026-06-08"):
    return {
        "id": "row-x",
        "external_event_id": ext,
        "sport": "football",
        "league": league,
        "competition": "La Liga",
        "home_team": home,
        "away_team": away,
        "market": "1X2",
        "pick": "home",
        "starts_at": f"{date}T23:00:00+00:00",
        "world_cup_stage": None,
    }


@pytest.mark.asyncio
async def test_odds_scores_settles_when_espn_and_apifootball_miss(agent, monkeypatch):
    # ESPN-by-id misses, api-football dead -> /scores provides the real score.
    async def fake_espn(league, event_id):
        return None

    async def fake_apifootball(fixture_id):
        return None

    async def fake_fdorg(**k):
        return None

    captured = {}

    async def fake_scores(sport_key, home, away, kickoff_date, _cache=None):
        captured["args"] = (sport_key, home, away)
        return {"home_goals": 1, "away_goals": 0}

    monkeypatch.setattr(rs, "espn_get_match_result", fake_espn)
    monkeypatch.setattr(rs, "get_fixture_result", fake_apifootball)
    monkeypatch.setattr(rs, "fdorg_get_match_result", fake_fdorg)
    monkeypatch.setattr(rs, "odds_get_score_by_teams_date", fake_scores)

    res = await agent._fetch_unified_result(_row("Barcelona", "Real Madrid"))
    assert res == {"home_goals": 1, "away_goals": 0}
    # mapped PD -> soccer_spain_la_liga
    assert captured["args"][0] == "soccer_spain_la_liga"
    assert rs._outcome("home", res["home_goals"], res["away_goals"]) == "won"


@pytest.mark.asyncio
async def test_odds_scores_none_keeps_void(agent, monkeypatch):
    async def fake_espn(league, event_id):
        return None

    async def fake_apifootball(fixture_id):
        return None

    async def fake_fdorg(**k):
        return None

    async def fake_scores(sport_key, home, away, kickoff_date, _cache=None):
        return None  # canceled / not in window / not completed

    monkeypatch.setattr(rs, "espn_get_match_result", fake_espn)
    monkeypatch.setattr(rs, "get_fixture_result", fake_apifootball)
    monkeypatch.setattr(rs, "fdorg_get_match_result", fake_fdorg)
    monkeypatch.setattr(rs, "odds_get_score_by_teams_date", fake_scores)

    res = await agent._fetch_unified_result(_row("Austria", "Guatemala", league="PD"))
    assert res is None  # -> _should_void_abandoned, void preserved


@pytest.mark.asyncio
async def test_espn_by_id_still_wins_no_odds_call(agent, monkeypatch):
    # Regression: ESPN/WC rows settle from ESPN by id; /scores must NOT fire.
    odds_calls = {"n": 0}

    async def fake_espn(league, event_id):
        return {"home_goals": 2, "away_goals": 1, "status": "FT"}

    async def fake_scores(sport_key, home, away, kickoff_date, _cache=None):
        odds_calls["n"] += 1
        return None

    monkeypatch.setattr(rs, "espn_get_match_result", fake_espn)
    monkeypatch.setattr(rs, "odds_get_score_by_teams_date", fake_scores)

    row = _row("Brazil", "Argentina", league="WC", ext="espn:999")
    res = await agent._fetch_unified_result(row)
    assert res["home_goals"] == 2
    assert odds_calls["n"] == 0


@pytest.mark.asyncio
async def test_friendly_untouched_by_odds_scores(agent, monkeypatch):
    # FRIENDLY has no Odds API key -> the /scores branch must not be reached;
    # the existing team+date fallback owns friendlies.
    odds_calls = {"n": 0}

    async def fake_espn(league, event_id):
        return None

    async def fake_by_teams_date(home_team, away_team, kickoff_date):
        return {"home_goals": 4, "away_goals": 2, "status": "FT"}

    async def fake_scores(sport_key, home, away, kickoff_date, _cache=None):
        odds_calls["n"] += 1
        return None

    monkeypatch.setattr(rs, "espn_get_match_result", fake_espn)
    monkeypatch.setattr(rs, "get_fixture_result_by_teams_date", fake_by_teams_date)
    monkeypatch.setattr(rs, "odds_get_score_by_teams_date", fake_scores)

    row = _row("Oman", "Kuwait", league="FRIENDLY", ext="espn:401873743", date="2026-06-09")
    res = await agent._fetch_unified_result(row)
    assert (res["home_goals"], res["away_goals"]) == (4, 2)
    assert odds_calls["n"] == 0  # FRIENDLY has no Odds API key -> /scores skipped

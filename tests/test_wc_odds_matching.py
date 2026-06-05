"""World Cup odds matching + quota guard tests (focus 2026-06-11 readiness).

Pins: (1) national-team name variants match odds via the canonical alias layer,
(2) The Odds API quota is never burned on out-of-season sport keys.
"""
import pytest

from agents.data_collector import DataCollectorAgent
from core.world_cup_history import canonical_team_name
import core.odds_api_client as odds_client
import core.tennis_odds_api_client as tennis_odds


# ─── Alias layer ──────────────────────────────────────────────────────────────

@pytest.mark.parametrize("variant,expected", [
    ("Korea Republic", "South Korea"),
    ("USA", "United States"),
    ("Türkiye", "Turkey"),
    ("Czechia", "Czech Republic"),
    ("Holland", "Netherlands"),
    ("KSA", "Saudi Arabia"),
    ("Bosnia-Herzegovina", "Bosnia and Herzegovina"),
    ("Côte d'Ivoire", "Ivory Coast"),
])
def test_canonical_team_name_variants(variant, expected):
    assert canonical_team_name(variant) == expected


# ─── Canonical odds matching in _build_event (WC only) ────────────────────────

def _wc_fixture(home: str, away: str) -> dict:
    return {
        "teams": {"home": {"name": home}, "away": {"name": away}},
        "fixture": {
            "id": 12345,
            "date": "2026-06-12T18:00:00+00:00",
            "venue": {"city": "Houston"},
        },
    }


def _odds_entry(home: str, away: str) -> dict:
    return {
        "home_team": home,
        "away_team": away,
        "home_team_normalized": odds_client.normalize_name(home),
        "away_team_normalized": odds_client.normalize_name(away),
        "odds_home": 2.1, "odds_draw": 3.3, "odds_away": 3.6,
        "bookmaker": "pinnacle", "margin": 0.04,
    }


def _odds_map(*pairs: tuple[str, str]) -> dict:
    out = {}
    for home, away in pairs:
        entry = _odds_entry(home, away)
        out[f"{entry['home_team_normalized']}|{entry['away_team_normalized']}"] = entry
    return out


def test_wc_event_matches_odds_with_provider_variant_names():
    agent = DataCollectorAgent()
    # Fixture feed says "South Korea"; the bookmaker feed says "Korea Republic".
    fixture = _wc_fixture("South Korea", "Czech Republic")
    odds_map = _odds_map(("Korea Republic", "Czechia"))
    event = agent._build_event(fixture, odds_map, "WC")
    assert event is not None
    assert event["odds"], "canonical fallback must match Korea Republic|Czechia"
    assert event["odds"]["bookmaker"] == "pinnacle"


def test_wc_event_without_odds_still_published():
    agent = DataCollectorAgent()
    fixture = _wc_fixture("Brazil", "Morocco")
    event = agent._build_event(fixture, {}, "WC")
    assert event is not None
    assert event["odds"] == {}


# ─── Quota guard: active sport keys ───────────────────────────────────────────

async def test_get_odds_skips_out_of_season_league(monkeypatch):
    monkeypatch.setattr(odds_client.settings, "ODDS_API_KEY", "test-key")

    async def fake_active():
        return frozenset({"soccer_fifa_world_cup"})  # EPL out of season

    monkeypatch.setattr(odds_client, "get_active_sport_keys", fake_active)

    called = False

    class NoHTTP:
        def __init__(self, *a, **k):
            nonlocal called
            called = True
        async def __aenter__(self):
            raise AssertionError("HTTP must not be called for inactive keys")
        async def __aexit__(self, *a):
            return False

    monkeypatch.setattr(odds_client.httpx, "AsyncClient", NoHTTP)
    assert await odds_client.get_odds("PL") == []
    assert called is False


async def test_tennis_odds_polls_only_active_keys(monkeypatch):
    monkeypatch.setattr(tennis_odds.settings, "ODDS_API_KEY", "test-key")

    async def fake_active():
        return frozenset({"tennis_atp_wimbledon"})

    monkeypatch.setattr(odds_client, "get_active_sport_keys", fake_active)

    requested: list[str] = []

    class FakeResponse:
        status_code = 200
        def json(self):
            return []

    class FakeClient:
        def __init__(self, *a, **k): ...
        async def __aenter__(self):
            return self
        async def __aexit__(self, *a):
            return False
        async def get(self, url, params=None):
            requested.append(url)
            return FakeResponse()

    monkeypatch.setattr(tennis_odds.httpx, "AsyncClient", FakeClient)
    await tennis_odds.get_tennis_odds()
    assert len(requested) == 1, f"only the active key must be polled, got {requested}"
    assert "tennis_atp_wimbledon" in requested[0]


async def test_active_keys_failure_fails_open(monkeypatch):
    """If the free /sports listing fails, behave as before (query all)."""
    monkeypatch.setattr(odds_client.settings, "ODDS_API_KEY", "test-key")

    async def fake_active():
        return None

    monkeypatch.setattr(odds_client, "get_active_sport_keys", fake_active)

    requested: list[str] = []

    class FakeResponse:
        status_code = 200
        def json(self):
            return []

    class FakeClient:
        def __init__(self, *a, **k): ...
        async def __aenter__(self):
            return self
        async def __aexit__(self, *a):
            return False
        async def get(self, url, params=None):
            requested.append(url)
            return FakeResponse()

    monkeypatch.setattr(tennis_odds.httpx, "AsyncClient", FakeClient)
    await tennis_odds.get_tennis_odds(("tennis_atp_wimbledon", "tennis_wta_us_open"))
    assert len(requested) == 2

import pytest
from context.context_service import ContextService

LEAGUE_MATCHES = (
    [{"home_goals": 2, "away_goals": 1, "home_xg": 1.8, "away_xg": 0.9,
      "home_odds": 1.80, "away_odds": 4.50, "draw_odds": 3.60,
      "result": "home", "total_goals": 3, "both_scored": True} for _ in range(40)]
    + [{"home_goals": 0, "away_goals": 2, "home_xg": 0.7, "away_xg": 2.1,
        "home_odds": 2.10, "away_odds": 3.20, "draw_odds": 3.40,
        "result": "away", "total_goals": 2, "both_scored": True} for _ in range(20)]
    + [{"home_goals": 1, "away_goals": 1, "home_xg": 1.2, "away_xg": 1.3,
        "home_odds": 2.50, "away_odds": 2.60, "draw_odds": 3.20,
        "result": "draw", "total_goals": 2, "both_scored": True} for _ in range(15)]
)


@pytest.fixture
def service():
    svc = ContextService()
    svc.load_league_history("PL", "Premier League", LEAGUE_MATCHES)
    return svc


def test_enrich_adds_match_type(service):
    data = {"home_team": "Arsenal", "away_team": "Chelsea", "league": "PL"}
    result = service.enrich(data)
    assert "match_type" in result
    assert result["match_type"] in (
        "DERBY_NATIONAL", "STANDARD", "SHORT_REST", "TITLE_DECIDER",
        "RELEGATION_BATTLE", "DEAD_RUBBER", "ROTATION_EXPECTED",
        "EUROPEAN_HANGOVER", "NEUTRAL_VENUE", "CUP_SPILLOVER"
    )


def test_enrich_adds_league_tier(service):
    data = {"home_team": "Arsenal", "away_team": "Chelsea", "league": "PL"}
    result = service.enrich(data)
    assert "league_tier" in result
    assert result["league_tier"] == 1


def test_enrich_adds_adjusted_stake(service):
    data = {
        "home_team": "AC Milan", "away_team": "Inter Milan",
        "league": "PL", "stake": 100.0, "confidence": 0.70,
    }
    result = service.enrich(data)
    assert "adjusted_stake" in result
    assert result["adjusted_stake"] <= 100.0


def test_enrich_adds_odds_anomaly(service):
    data = {
        "home_team": "Arsenal", "away_team": "Chelsea",
        "league": "PL", "home_odds": 5.50,
    }
    result = service.enrich(data)
    assert "odds_anomaly" in result
    assert result["odds_anomaly"] is True


def test_enrich_no_anomaly_for_normal_odds(service):
    data = {
        "home_team": "Arsenal", "away_team": "Chelsea",
        "league": "PL", "home_odds": 1.85,
    }
    result = service.enrich(data)
    assert result.get("odds_anomaly") is False


def test_enrich_adds_data_completeness(service):
    data = {
        "home_team": "Arsenal", "away_team": "Chelsea", "league": "PL",
        "match_id": "123", "kickoff": "2026-05-10T15:00:00Z",
        "edge": 0.04, "odds": 2.1, "selection": "home",
        "confidence": 0.65, "p_home": 0.55, "p_draw": 0.25, "p_away": 0.20,
    }
    result = service.enrich(data)
    assert "data_completeness" in result
    assert 0 <= float(result["data_completeness"]) <= 1


def test_unknown_league_graceful_fallback(service):
    data = {"home_team": "TeamA", "away_team": "TeamB", "league": "UNKNOWN"}
    result = service.enrich(data)
    assert result["league_tier"] is None
    assert result["match_type"] == "STANDARD"

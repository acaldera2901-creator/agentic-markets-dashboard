import pytest
from context.match_type import MatchTypeClassifier, MatchType, _is_derby, _normalize


classifier = MatchTypeClassifier()


# ---------------------------------------------------------------------------
# Unit tests — _normalize and _is_derby
# ---------------------------------------------------------------------------

def test_normalize_strips_accents():
    assert _normalize("München") == "munchen"
    assert _normalize("Saint-Étienne") == "saint-etienne"


def test_derby_milan_inter():
    assert _is_derby("AC Milan", "Inter Milan")


def test_derby_roma_lazio():
    assert _is_derby("AS Roma", "SS Lazio")


def test_derby_man_city_man_utd():
    assert _is_derby("Manchester United", "Manchester City")


def test_derby_not_triggered_for_unrelated():
    assert not _is_derby("Atalanta", "Juventus")


def test_derby_munich_nuremberg_normalized():
    # "Munich" and "Nuremberg" should hit the known entry
    assert _is_derby("Bayern München", "1. FC Nürnberg")


# ---------------------------------------------------------------------------
# classify() — happy paths
# ---------------------------------------------------------------------------

def test_neutral_venue():
    data = {"home_team": "Real Madrid", "away_team": "Liverpool", "is_neutral": True}
    assert classifier.classify(data) == MatchType.NEUTRAL_VENUE


def test_cup_spillover():
    data = {"home_team": "Arsenal", "away_team": "Burnley", "is_cup": True}
    assert classifier.classify(data) == MatchType.CUP_SPILLOVER


def test_derby_detection():
    data = {"home_team": "Juventus", "away_team": "Torino FC"}
    assert classifier.classify(data) == MatchType.DERBY_NATIONAL


def test_short_rest_home():
    data = {"home_team": "Napoli", "away_team": "Fiorentina", "home_days_since_last": 3}
    assert classifier.classify(data) == MatchType.SHORT_REST


def test_short_rest_away():
    data = {"home_team": "Napoli", "away_team": "Fiorentina", "away_days_since_last": 2}
    assert classifier.classify(data) == MatchType.SHORT_REST


def test_rotation_expected():
    data = {
        "home_team": "Liverpool", "away_team": "Villarreal",
        "is_second_leg": True, "home_aggregate_diff": 3,
    }
    assert classifier.classify(data) == MatchType.ROTATION_EXPECTED


def test_european_hangover_home():
    data = {"home_team": "PSG", "away_team": "Lyon", "home_european_midweek": True}
    assert classifier.classify(data) == MatchType.EUROPEAN_HANGOVER


def test_title_decider():
    data = {
        "home_team": "Arsenal", "away_team": "Liverpool",
        "home_position": 1, "away_position": 2,
        "points_gap": 2, "season_week": 35, "total_weeks": 38,
    }
    assert classifier.classify(data) == MatchType.TITLE_DECIDER


def test_relegation_battle():
    data = {
        "home_team": "Frosinone", "away_team": "Salernitana",
        "home_position": 18, "away_position": 19, "total_teams": 20,
    }
    assert classifier.classify(data) == MatchType.RELEGATION_BATTLE


def test_dead_rubber_confirmed_positions():
    data = {
        "home_team": "Southampton", "away_team": "Burnley",
        "home_position_confirmed": True, "away_position_confirmed": True,
    }
    assert classifier.classify(data) == MatchType.DEAD_RUBBER


def test_dead_rubber_eliminated():
    data = {"home_team": "Dortmund", "away_team": "Leverkusen", "home_eliminated": True}
    assert classifier.classify(data) == MatchType.DEAD_RUBBER


def test_standard_fallback():
    data = {"home_team": "Bologna", "away_team": "Empoli"}
    assert classifier.classify(data) == MatchType.STANDARD


# ---------------------------------------------------------------------------
# Priority: neutral > cup > derby > rest > ...
# ---------------------------------------------------------------------------

def test_neutral_overrides_derby():
    # A derby played at neutral venue → NEUTRAL_VENUE wins
    data = {"home_team": "AC Milan", "away_team": "Inter Milan", "is_neutral": True}
    assert classifier.classify(data) == MatchType.NEUTRAL_VENUE


def test_cup_overrides_derby():
    data = {"home_team": "AS Roma", "away_team": "SS Lazio", "is_cup": True}
    assert classifier.classify(data) == MatchType.CUP_SPILLOVER


def test_title_not_triggered_early_season():
    data = {
        "home_team": "Arsenal", "away_team": "Liverpool",
        "home_position": 1, "away_position": 2,
        "points_gap": 1, "season_week": 5, "total_weeks": 38,  # too early
    }
    # Not a title decider: < 70% season elapsed
    assert classifier.classify(data) != MatchType.TITLE_DECIDER


def test_relegation_not_triggered_mid_table():
    data = {
        "home_team": "Udinese", "away_team": "Sassuolo",
        "home_position": 12, "away_position": 14, "total_teams": 20,
    }
    assert classifier.classify(data) != MatchType.RELEGATION_BATTLE

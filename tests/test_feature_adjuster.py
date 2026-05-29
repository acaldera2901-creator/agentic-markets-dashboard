# tests/test_feature_adjuster.py
import pytest
from models.feature_adjuster import FeatureAdjuster, EnrichedFixture, AdjustedProbabilities


def _base_probs():
    return {"p_home": 0.45, "p_draw": 0.28, "p_away": 0.27}


def _fixture(**kwargs) -> EnrichedFixture:
    defaults = {
        "home_ppg": 1.8, "away_ppg": 1.5,
        "home_xg_avg": 1.6, "away_xg_avg": 1.2,
        "home_xg_luck": 0.0, "away_xg_luck": 0.0,
        "home_motivation": 0.8, "away_motivation": 0.7,
        "h2h_home_wins": 3, "h2h_draws": 2, "h2h_away_wins": 1, "h2h_matches": 6,
        "temperature_c": 15.0, "wind_kmh": 10.0, "precipitation_pct": 0.0,
        "home_injuries_json": [], "away_injuries_json": [],
    }
    defaults.update(kwargs)
    return EnrichedFixture(**defaults)


def test_probabilities_always_sum_to_one():
    adj = FeatureAdjuster()
    result = adj.adjust(_base_probs(), _fixture(home_ppg=2.8, away_ppg=0.6, wind_kmh=50.0))
    assert abs(result.p_home + result.p_draw + result.p_away - 1.0) < 0.0001


def test_strong_home_form_boosts_home():
    adj = FeatureAdjuster()
    result = adj.adjust(_base_probs(), _fixture(home_ppg=2.5, away_ppg=0.8))
    assert result.p_home > 0.45
    assert "form" in result.adjustments_applied


def test_equal_form_no_form_adjustment():
    adj = FeatureAdjuster()
    result = adj.adjust(_base_probs(), _fixture(home_ppg=1.5, away_ppg=1.5))
    assert "form" not in result.adjustments_applied


def test_high_wind_adds_weather_flag():
    adj = FeatureAdjuster()
    result = adj.adjust(_base_probs(), _fixture(wind_kmh=55.0))
    assert "weather" in result.adjustments_applied


def test_low_wind_no_weather_flag():
    adj = FeatureAdjuster()
    result = adj.adjust(_base_probs(), _fixture(wind_kmh=20.0))
    assert "weather" not in result.adjustments_applied


def test_low_motivation_reduces_confidence_weight():
    adj = FeatureAdjuster()
    result = adj.adjust(_base_probs(), _fixture(home_motivation=0.15, away_motivation=0.15))
    assert result.confidence_weight < 1.0
    assert "motivation" in result.adjustments_applied


def test_h2h_dominance_boosts_dominant_side():
    adj = FeatureAdjuster()
    result = adj.adjust(_base_probs(), _fixture(h2h_home_wins=8, h2h_draws=1, h2h_away_wins=1, h2h_matches=10))
    assert result.p_home > 0.45
    assert "h2h" in result.adjustments_applied


def test_h2h_insufficient_sample_no_adjustment():
    adj = FeatureAdjuster()
    result = adj.adjust(_base_probs(), _fixture(h2h_home_wins=3, h2h_draws=0, h2h_away_wins=0, h2h_matches=3))
    assert "h2h" not in result.adjustments_applied


def test_injury_asymmetry_benefits_uninjured_side():
    adj = FeatureAdjuster()
    # Away team has 4 injuries, home has 0
    result = adj.adjust(_base_probs(), _fixture(
        home_injuries_json=[],
        away_injuries_json=[{"name": "P1"}, {"name": "P2"}, {"name": "P3"}, {"name": "P4"}],
    ))
    assert result.p_home >= 0.45
    assert "injury" in result.adjustments_applied


def test_confidence_weight_in_range():
    adj = FeatureAdjuster()
    result = adj.adjust(_base_probs(), _fixture(wind_kmh=80.0, home_motivation=0.1, away_motivation=0.1))
    assert 0.5 <= result.confidence_weight <= 1.0

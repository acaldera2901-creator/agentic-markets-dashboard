import pytest
from models.dixon_coles import DixonColesModel

SAMPLE_MATCHES = [
    {"home_team": "Arsenal", "away_team": "Chelsea", "home_goals": 2, "away_goals": 1},
    {"home_team": "Chelsea", "away_team": "Arsenal", "home_goals": 1, "away_goals": 1},
    {"home_team": "Arsenal", "away_team": "Liverpool", "home_goals": 3, "away_goals": 0},
    {"home_team": "Liverpool", "away_team": "Chelsea", "home_goals": 2, "away_goals": 2},
    {"home_team": "Chelsea", "away_team": "Liverpool", "home_goals": 0, "away_goals": 1},
    {"home_team": "Liverpool", "away_team": "Arsenal", "home_goals": 1, "away_goals": 2},
]

def test_model_fits_without_error():
    model = DixonColesModel()
    model.fit(SAMPLE_MATCHES)
    assert model.fitted is True

def test_predict_returns_valid_probabilities():
    model = DixonColesModel()
    model.fit(SAMPLE_MATCHES)
    p_home, p_draw, p_away = model.predict("Arsenal", "Chelsea")
    assert abs(p_home + p_draw + p_away - 1.0) < 0.001
    assert 0 < p_home < 1
    assert 0 < p_draw < 1
    assert 0 < p_away < 1

def test_predict_raises_if_not_fitted():
    model = DixonColesModel()
    with pytest.raises(ValueError, match="not fitted"):
        model.predict("Arsenal", "Chelsea")

def test_predict_raises_for_unknown_team():
    model = DixonColesModel()
    model.fit(SAMPLE_MATCHES)
    with pytest.raises(KeyError):
        model.predict("Arsenal", "Unknown FC")

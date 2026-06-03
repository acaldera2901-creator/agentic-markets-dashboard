"""Tests for Dixon-Coles time-decay weighting."""
from datetime import date

from models.dixon_coles import DixonColesModel, decay_weights


def test_decay_weights_basic():
    d0 = date(2024, 1, 1)
    dates = [date(2023, 7, 5), date(2023, 11, 2), d0]  # oldest .. newest
    w = decay_weights(dates, half_life_days=180.0)
    # newest match (anchor) has weight 1.0
    assert abs(w[-1] - 1.0) < 1e-9
    # monotonic: older = smaller weight
    assert w[0] < w[1] < w[2]
    assert all(0.0 < x <= 1.0 for x in w)


def test_decay_weight_half_life_is_one_half():
    anchor = date(2024, 1, 1)
    older = date(2023, 7, 5)  # 180 days before
    w = decay_weights([older, anchor], half_life_days=180.0)
    assert abs((anchor - older).days - 180) <= 1
    assert abs(w[0] - 0.5) < 0.02  # ~0.5 at one half-life


def test_decay_weights_disabled_returns_ones():
    dates = [date(2023, 1, 1), date(2024, 1, 1)]
    assert decay_weights(dates, half_life_days=0.0) == [1.0, 1.0]


def test_decay_weights_handles_missing_dates():
    w = decay_weights([None, date(2024, 1, 1), None], half_life_days=90.0)
    assert w[0] == 1.0 and w[2] == 1.0  # unknown -> no down-weighting
    assert abs(w[1] - 1.0) < 1e-9       # anchor


def _toy_matches() -> list[dict]:
    # A beats B heavily long ago; recently B beats A. Decay should lean toward recent.
    old, recent = "2023-01-15", "2024-05-01"
    return (
        [{"home_team": "A", "away_team": "B", "home_goals": 4, "away_goals": 0, "date": old}] * 6
        + [{"home_team": "B", "away_team": "A", "home_goals": 3, "away_goals": 0, "date": recent}] * 6
        # filler so both teams have varied opponents and the optimiser is well-posed
        + [{"home_team": "A", "away_team": "C", "home_goals": 1, "away_goals": 1, "date": old}] * 3
        + [{"home_team": "C", "away_team": "B", "home_goals": 1, "away_goals": 1, "date": recent}] * 3
    )


def test_time_decay_shifts_prediction_toward_recent_form():
    matches = _toy_matches()

    flat = DixonColesModel()
    flat.fit(matches, half_life_days=0.0)
    decayed = DixonColesModel()
    decayed.fit(matches, half_life_days=120.0)

    # Predict B (home) vs A: recent form favours B strongly.
    p_flat = flat.predict("B", "A")
    p_decayed = decayed.predict("B", "A")
    # decayed model should give B (home win) at least as much probability as flat
    assert p_decayed[0] >= p_flat[0]
    assert abs(sum(p_decayed) - 1.0) < 1e-6


def test_fit_without_decay_is_backward_compatible():
    matches = _toy_matches()
    m = DixonColesModel()
    m.fit(matches)  # default half_life_days=0.0
    assert m.fitted
    p = m.predict("A", "B")
    assert abs(sum(p) - 1.0) < 1e-6

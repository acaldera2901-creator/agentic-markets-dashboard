"""Tests for Poisson v2 model and isotonic calibration."""
import numpy as np

from models.calibration import IsotonicCalibrator
from models.poisson import PoissonModel


def _league(home_bias=2.0, away_bias=1.0, date_str="2024-01-01") -> list[dict]:
    """Synthetic round-robin: 'Strong' scores a lot, 'Weak' concedes a lot."""
    teams = ["Strong", "Mid", "Weak"]
    out = []
    goals = {"Strong": 3, "Mid": 1, "Weak": 0}
    for h in teams:
        for a in teams:
            if h == a:
                continue
            out.append({
                "home_team": h, "away_team": a,
                "home_goals": goals[h] + 1, "away_goals": goals[a],
                "date": date_str,
            })
    return out * 4


def test_predict_sums_to_one_and_favours_strong():
    m = PoissonModel().fit(_league())
    p = m.predict("Strong", "Weak")
    assert p is not None
    assert abs(sum(p) - 1.0) < 1e-9
    assert p[0] > p[2]  # strong home > weak away


def test_unknown_team_returns_none():
    m = PoissonModel().fit(_league())
    assert m.predict("Strong", "Ghost") is None


def test_tau_negative_rho_inflates_draw_vs_independent():
    matches = _league()
    indep = PoissonModel(rho=0.0).fit(matches)
    dc = PoissonModel(rho=-0.15).fit(matches)
    # same lambdas, only tau differs -> draw probability should rise with rho<0
    p_indep = indep.predict("Mid", "Mid") if False else indep.predict("Strong", "Mid")
    p_dc = dc.predict("Strong", "Mid")
    assert p_dc[1] >= p_indep[1]


def test_time_decay_changes_strengths():
    old = _league(date_str="2023-01-01")
    recent = [
        {"home_team": "Weak", "away_team": "Strong", "home_goals": 5, "away_goals": 0, "date": "2024-06-01"}
    ] * 6
    matches = old + recent
    flat = PoissonModel(half_life_days=0.0).fit(matches)
    decayed = PoissonModel(half_life_days=60.0).fit(matches)
    # Weak just thrashed Strong recently; decayed model must rate Weak (home) higher
    assert decayed.predict("Weak", "Strong")[0] > flat.predict("Weak", "Strong")[0]


def test_unfitted_returns_none():
    assert PoissonModel().predict("A", "B") is None
    assert PoissonModel().fit([]).fitted is False


# ── calibration ───────────────────────────────────────────────────────────────
def test_isotonic_calibration_fixes_overconfidence():
    rng = np.random.default_rng(0)
    n = 2000
    # true home prob 0.5, but model is overconfident (says 0.8 for home)
    outcomes = rng.choice([0, 1, 2], size=n, p=[0.5, 0.25, 0.25])
    probs = np.tile([0.8, 0.1, 0.1], (n, 1))
    cal = IsotonicCalibrator().fit(probs, outcomes)
    out = cal.transform_one((0.8, 0.1, 0.1))
    assert abs(sum(out) - 1.0) < 1e-9
    # calibrated home prob should move toward the true 0.5, away from 0.8
    assert out[0] < 0.8
    assert abs(out[0] - 0.5) < abs(0.8 - 0.5)


def test_calibrator_passthrough_when_unfitted():
    cal = IsotonicCalibrator()
    assert cal.transform_one((0.6, 0.3, 0.1)) == (0.6, 0.3, 0.1)


def test_calibrator_rejects_bad_shape():
    import pytest
    with pytest.raises(ValueError):
        IsotonicCalibrator().fit([[0.5, 0.5]], [0])

"""Smoke tests for XGModel (fit/predict/update) on real Understat data."""
from core.understat_data import load
from models.xg_model import XGModel


def _one_league_subset(n: int = 400):
    ms = [m for m in load() if m.league == "PL"]
    ms.sort(key=lambda m: m.date)
    return ms[:n]


def test_fit_predict_sums_to_one():
    ms = _one_league_subset()
    model = XGModel().fit(ms)
    assert model.fitted
    # predict a fixture between two teams seen in training
    home, away = ms[-1].home_team, ms[-2].home_team
    p = model.predict(home, away)
    assert p is not None
    assert abs(sum(p) - 1.0) < 1e-6
    assert all(0.0 <= x <= 1.0 for x in p)


def test_unfitted_returns_none():
    assert XGModel().predict("A", "B") is None


def test_update_advances_state_without_error():
    ms = _one_league_subset()
    model = XGModel().fit(ms[:300])
    before = len(model._train)
    model.update(ms[300])
    assert len(model._train) == before + 1
    # still predicts fine after an update
    p = model.predict(ms[0].home_team, ms[1].home_team)
    assert p is not None and abs(sum(p) - 1.0) < 1e-6

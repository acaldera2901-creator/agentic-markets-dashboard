"""Unit tests for models/conformal.py"""
import pytest
from models.conformal import (
    ConformalCalibrator,
    LeagueConformalStore,
    calibrate_from_history,
    get_interval,
    interval_width,
)


class TestConformalCalibrator:
    def _make_calibrator(self, alpha: float = 0.10):
        cal = ConformalCalibrator(alpha=alpha)
        # Calibrate with synthetic data: model predicts 0.5 for all
        probs = [0.5] * 50
        labels = [1] * 25 + [0] * 25
        cal.calibrate(probs, labels)
        return cal

    def test_interval_contains_point(self):
        cal = self._make_calibrator()
        for p in [0.1, 0.3, 0.5, 0.7, 0.9]:
            lo, hi = cal.predict_interval(p)
            assert lo <= p <= hi

    def test_interval_within_bounds(self):
        cal = self._make_calibrator()
        for p in [0.0, 0.5, 1.0]:
            lo, hi = cal.predict_interval(p)
            assert 0.0 <= lo <= 1.0
            assert 0.0 <= hi <= 1.0
            assert lo <= hi

    def test_uncalibrated_fallback(self):
        cal = ConformalCalibrator()
        lo, hi = cal.predict_interval(0.5)
        assert lo < 0.5 < hi

    def test_is_calibrated_flag(self):
        cal = ConformalCalibrator()
        assert not cal.is_calibrated
        cal.calibrate([0.5, 0.4, 0.6, 0.7], [1, 0, 1, 0])  # min 4 samples required
        assert cal.is_calibrated

    def test_insufficient_data_no_crash(self):
        cal = ConformalCalibrator()
        cal.calibrate([0.5], [1])  # < 4 samples → skip
        assert not cal.is_calibrated

    def test_width_is_positive(self):
        cal = self._make_calibrator()
        w = cal.width(0.5)
        assert w > 0

    def test_alpha_affects_width(self):
        # Lower alpha → wider intervals
        cal_tight = ConformalCalibrator(alpha=0.05)
        cal_wide = ConformalCalibrator(alpha=0.20)
        probs = [0.5] * 50
        labels = [1] * 25 + [0] * 25
        cal_tight.calibrate(probs, labels)
        cal_wide.calibrate(probs, labels)
        assert cal_tight.width(0.5) >= cal_wide.width(0.5)


class TestLeagueConformalStore:
    def test_get_or_create(self):
        store = LeagueConformalStore()
        cal1 = store.get_or_create("SA")
        cal2 = store.get_or_create("SA")
        assert cal1 is cal2

    def test_different_leagues_different_calibrators(self):
        store = LeagueConformalStore()
        assert store.get_or_create("SA") is not store.get_or_create("PL")

    def test_uncalibrated_fallback_interval(self):
        store = LeagueConformalStore()
        lo, hi = store.predict_interval("UNKNOWN_LEAGUE", 0.5)
        assert 0 <= lo < 0.5 < hi <= 1.0


class TestCalibrateFromHistory:
    def _make_history(self, n: int = 60) -> list[dict]:
        results = []
        for i in range(n):
            hg, ag = (2, 1) if i % 3 == 0 else (0, 0) if i % 3 == 1 else (0, 1)
            results.append({
                "p_home": 0.50 + (i % 3) * 0.05,
                "p_draw": 0.25,
                "p_away": 0.25 - (i % 3) * 0.05,
                "home_goals": hg,
                "away_goals": ag,
            })
        return results

    def test_calibrate_and_predict(self):
        calibrate_from_history("TEST_LEAGUE", self._make_history())
        lo, hi = get_interval("TEST_LEAGUE", 0.55)
        assert lo < 0.55 < hi
        assert 0 <= lo
        assert hi <= 1.0

    def test_interval_width_positive(self):
        calibrate_from_history("TEST_LEAGUE_2", self._make_history())
        w = interval_width("TEST_LEAGUE_2", 0.50)
        assert w > 0

    def test_bad_data_no_crash(self):
        bad = [{"missing": "keys"}, {"p_home": "not_a_float"}]
        calibrate_from_history("BAD_LEAGUE", bad)
        # Should not raise, just skip

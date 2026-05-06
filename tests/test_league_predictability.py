import pytest
from context.league_predictability import LeaguePredictabilityTracker


def _make_predictions(n_correct: int, n_total: int, avg_clv: float = 0.02) -> list[dict]:
    preds = []
    for i in range(n_total):
        correct = i < n_correct
        preds.append({
            "predicted": "home",
            "actual": "home" if correct else "away",
            "is_value_bet": True,
            "clv": avg_clv,
            "roi": 0.05 if correct else -1.0,
            "p_predicted": 0.55,
        })
    return preds


def test_hit_rate_computed():
    tracker = LeaguePredictabilityTracker()
    tracker.update("PL", _make_predictions(60, 100))
    metrics = tracker.get_metrics("PL")
    assert abs(metrics["hit_rate"] - 0.60) < 0.01


def test_confidence_level_high():
    tracker = LeaguePredictabilityTracker()
    tracker.update("PL", _make_predictions(65, 150, avg_clv=0.03))
    metrics = tracker.get_metrics("PL")
    assert metrics["confidence_level"] in ("HIGH", "MEDIUM")


def test_confidence_level_insufficient_data():
    tracker = LeaguePredictabilityTracker()
    tracker.update("PL", _make_predictions(5, 8))
    metrics = tracker.get_metrics("PL")
    assert metrics["confidence_level"] == "INSUFFICIENT_DATA"


def test_bet_filter_activated_on_low_hit_rate():
    tracker = LeaguePredictabilityTracker()
    tracker.update("PL", _make_predictions(48, 120))
    metrics = tracker.get_metrics("PL")
    assert metrics["bet_filter_active"] is True


def test_bet_filter_not_activated_on_good_performance():
    tracker = LeaguePredictabilityTracker()
    tracker.update("PL", _make_predictions(55, 100))
    metrics = tracker.get_metrics("PL")
    assert metrics["bet_filter_active"] is False


def test_brier_score_between_0_and_1():
    tracker = LeaguePredictabilityTracker()
    tracker.update("SA", _make_predictions(50, 100))
    metrics = tracker.get_metrics("SA")
    assert 0.0 <= metrics["brier_score"] <= 1.0


def test_unknown_league_returns_insufficient():
    tracker = LeaguePredictabilityTracker()
    metrics = tracker.get_metrics("UNKNOWN")
    assert metrics["confidence_level"] == "INSUFFICIENT_DATA"
    assert metrics["bet_filter_active"] is False


def test_negative_clv_triggers_suspension_flag():
    tracker = LeaguePredictabilityTracker()
    preds = _make_predictions(25, 60, avg_clv=-0.03)
    tracker.update("BL1", preds)
    metrics = tracker.get_metrics("BL1")
    assert metrics.get("suspend_recommended") is True

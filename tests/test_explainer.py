"""
Unit tests for learning.explainer.PredictionExplainer
Run: pytest tests/test_explainer.py -v
"""
import pytest
import numpy as np
from learning.explainer import PredictionExplainer, ExplanationResult


@pytest.fixture
def explainer():
    return PredictionExplainer(top_n_features=5)


def _shap_values():
    return {
        "xg_advantage": 0.18,
        "odds_movement": 0.12,
        "pi_rating_delta": 0.08,
        "form_home": 0.05,
        "form_away": -0.04,
        "lineup_delta": 0.03,
        "motivation_home": 0.02,
        "weather_impact": -0.01,
    }


def _prediction():
    return {
        "match_id": "m-001",
        "p_home": 0.58,
        "p_draw": 0.24,
        "p_away": 0.18,
        "selection": "home",
        "shap_values": _shap_values(),
        "base_probability": 0.45,
    }


# ── ExplanationResult structure ───────────────────────────────────────────────

class TestExplanationResultStructure:
    def test_explain_returns_explanation_result(self, explainer):
        result = explainer.explain(_prediction())
        assert isinstance(result, ExplanationResult)

    def test_result_has_match_id(self, explainer):
        result = explainer.explain(_prediction())
        assert result.match_id == "m-001"

    def test_result_has_top_features(self, explainer):
        result = explainer.explain(_prediction())
        assert hasattr(result, "top_features")
        assert isinstance(result.top_features, list)

    def test_result_has_narrative(self, explainer):
        result = explainer.explain(_prediction())
        assert hasattr(result, "narrative")
        assert isinstance(result.narrative, str)
        assert len(result.narrative) > 0

    def test_result_has_confidence_breakdown(self, explainer):
        result = explainer.explain(_prediction())
        assert hasattr(result, "confidence_breakdown")
        assert isinstance(result.confidence_breakdown, dict)

    def test_result_has_shap_sum(self, explainer):
        result = explainer.explain(_prediction())
        assert hasattr(result, "shap_sum")

    def test_result_has_base_probability(self, explainer):
        result = explainer.explain(_prediction())
        assert hasattr(result, "base_probability")


# ── Top features ──────────────────────────────────────────────────────────────

class TestTopFeatures:
    def test_top_features_limited_to_top_n(self, explainer):
        result = explainer.explain(_prediction())
        assert len(result.top_features) <= explainer.top_n_features

    def test_top_features_sorted_by_abs_value(self, explainer):
        result = explainer.explain(_prediction())
        magnitudes = [abs(f["shap_value"]) for f in result.top_features]
        assert magnitudes == sorted(magnitudes, reverse=True)

    def test_top_features_contain_feature_name(self, explainer):
        result = explainer.explain(_prediction())
        for f in result.top_features:
            assert "feature_name" in f

    def test_top_features_contain_shap_value(self, explainer):
        result = explainer.explain(_prediction())
        for f in result.top_features:
            assert "shap_value" in f

    def test_top_features_contain_direction(self, explainer):
        result = explainer.explain(_prediction())
        for f in result.top_features:
            assert "direction" in f
            assert f["direction"] in ("positive", "negative")

    def test_positive_shap_direction(self, explainer):
        result = explainer.explain(_prediction())
        pos = [f for f in result.top_features if f["shap_value"] > 0]
        for f in pos:
            assert f["direction"] == "positive"

    def test_negative_shap_direction(self, explainer):
        result = explainer.explain(_prediction())
        neg = [f for f in result.top_features if f["shap_value"] < 0]
        for f in neg:
            assert f["direction"] == "negative"

    def test_xg_advantage_is_top_feature(self, explainer):
        result = explainer.explain(_prediction())
        names = [f["feature_name"] for f in result.top_features]
        assert "xg_advantage" in names


# ── Narrative generation ──────────────────────────────────────────────────────

class TestNarrativeGeneration:
    def test_narrative_mentions_top_feature(self, explainer):
        result = explainer.explain(_prediction())
        top_name = result.top_features[0]["feature_name"]
        assert top_name in result.narrative

    def test_narrative_non_empty_with_no_shap(self, explainer):
        pred = {**_prediction(), "shap_values": {}}
        result = explainer.explain(pred)
        assert len(result.narrative) > 0

    def test_narrative_mentions_selection(self, explainer):
        result = explainer.explain(_prediction())
        assert "home" in result.narrative.lower()


# ── Confidence breakdown ──────────────────────────────────────────────────────

class TestConfidenceBreakdown:
    def test_breakdown_has_base(self, explainer):
        result = explainer.explain(_prediction())
        assert "base" in result.confidence_breakdown

    def test_breakdown_has_shap_contribution(self, explainer):
        result = explainer.explain(_prediction())
        assert "shap_contribution" in result.confidence_breakdown

    def test_breakdown_base_matches_prediction(self, explainer):
        result = explainer.explain(_prediction())
        assert result.confidence_breakdown["base"] == pytest.approx(0.45)

    def test_shap_sum_close_to_prediction_minus_base(self, explainer):
        pred = _prediction()
        result = explainer.explain(pred)
        expected_sum = sum(_shap_values().values())
        assert result.shap_sum == pytest.approx(expected_sum, abs=1e-9)


# ── Edge cases ────────────────────────────────────────────────────────────────

class TestEdgeCases:
    def test_fewer_features_than_top_n(self, explainer):
        pred = {**_prediction(), "shap_values": {"xg_advantage": 0.10}}
        result = explainer.explain(pred)
        assert len(result.top_features) == 1

    def test_all_zero_shap_values(self, explainer):
        pred = {**_prediction(), "shap_values": {"f1": 0.0, "f2": 0.0}}
        result = explainer.explain(pred)
        assert isinstance(result, ExplanationResult)

    def test_missing_base_probability_defaults_to_zero(self, explainer):
        pred = {k: v for k, v in _prediction().items() if k != "base_probability"}
        result = explainer.explain(pred)
        assert result.base_probability == pytest.approx(0.0)

    def test_missing_shap_values_returns_empty_top_features(self, explainer):
        pred = {k: v for k, v in _prediction().items() if k != "shap_values"}
        result = explainer.explain(pred)
        assert result.top_features == []


# ── to_dict ───────────────────────────────────────────────────────────────────

class TestToDict:
    def test_to_dict_returns_dict(self, explainer):
        result = explainer.explain(_prediction())
        d = result.to_dict()
        assert isinstance(d, dict)

    def test_to_dict_has_required_keys(self, explainer):
        result = explainer.explain(_prediction())
        d = result.to_dict()
        for key in ("match_id", "top_features", "narrative", "shap_sum", "base_probability"):
            assert key in d

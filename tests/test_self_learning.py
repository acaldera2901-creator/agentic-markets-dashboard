"""
Unit tests for learning.self_learning.SelfLearningEngine
Run: pytest tests/test_self_learning.py -v
"""
import datetime
import pytest
from learning.self_learning import (
    SelfLearningEngine,
    FeatureMemory,
    ErrorPattern,
    CorrectionProposal,
    CorrectionStatus,
)


@pytest.fixture
def engine():
    return SelfLearningEngine(
        min_errors_for_auto_correction=3,
        max_auto_weight_change=0.10,
        max_auto_threshold_change=0.01,
        correction_review_required_above=0.15,
    )


def _make_prediction(p_home=0.55, selection="home", shap=None):
    return {
        "match_id": "m-001",
        "league": "PL",
        "match_type": "STANDARD",
        "season_phase": "MID",
        "p_home": p_home,
        "p_draw": 0.25,
        "p_away": 0.20,
        "selection": selection,
        "confidence": p_home,
        "shap_values": shap or {"xg_advantage": 0.15, "odds_movement": 0.08, "lineup_delta": 0.02},
    }


def _make_result(outcome="home"):
    return {"match_id": "m-001", "outcome": outcome, "league": "PL"}


# ── process_completed_match ───────────────────────────────────────────────────

class TestProcessCompletedMatch:
    def test_process_returns_dict(self, engine):
        result = engine.process_completed_match(
            prediction=_make_prediction(), actual_result=_make_result("home")
        )
        assert isinstance(result, dict)

    def test_correct_prediction_low_error(self, engine):
        result = engine.process_completed_match(
            prediction=_make_prediction(p_home=0.70, selection="home"),
            actual_result=_make_result("home"),
        )
        assert result["prediction_error"] < 0.50

    def test_wrong_prediction_high_error(self, engine):
        result = engine.process_completed_match(
            prediction=_make_prediction(p_home=0.80, selection="home"),
            actual_result=_make_result("away"),
        )
        assert result["prediction_error"] > 0.50

    def test_result_has_feature_errors(self, engine):
        result = engine.process_completed_match(
            prediction=_make_prediction(),
            actual_result=_make_result("away"),
        )
        assert "feature_errors" in result

    def test_result_has_match_id(self, engine):
        result = engine.process_completed_match(
            prediction=_make_prediction(),
            actual_result=_make_result(),
        )
        assert result["match_id"] == "m-001"


# ── FeatureMemory ─────────────────────────────────────────────────────────────

class TestFeatureMemory:
    def test_feature_memory_updated_after_processing(self, engine):
        engine.process_completed_match(
            prediction=_make_prediction(),
            actual_result=_make_result("away"),
        )
        mem = engine.get_feature_memory("xg_advantage")
        assert mem is not None

    def test_feature_memory_has_required_fields(self, engine):
        engine.process_completed_match(
            prediction=_make_prediction(),
            actual_result=_make_result("away"),
        )
        mem = engine.get_feature_memory("xg_advantage")
        assert isinstance(mem, FeatureMemory)
        assert hasattr(mem, "rolling_shap_accuracy")
        assert hasattr(mem, "error_contribution")
        assert hasattr(mem, "trend")
        assert hasattr(mem, "last_100_accuracy")
        assert hasattr(mem, "recommended_weight_adjustment")

    def test_feature_memory_accumulates_across_matches(self, engine):
        for i in range(5):
            engine.process_completed_match(
                prediction=_make_prediction(match_id=f"m-{i:03d}"),
                actual_result=_make_result("away"),
            )
        mem = engine.get_feature_memory("xg_advantage")
        assert mem is not None

    def test_all_feature_memories_retrievable(self, engine):
        engine.process_completed_match(
            prediction=_make_prediction(),
            actual_result=_make_result("away"),
        )
        memories = engine.get_all_feature_memories()
        assert isinstance(memories, dict)
        assert len(memories) > 0


# ── Error pattern detection ───────────────────────────────────────────────────

class TestErrorPatternDetection:
    def test_derby_overconfidence_pattern_detected(self, engine):
        derby_pred = {**_make_prediction(p_home=0.80), "match_type": "DERBY_NATIONAL"}
        for _ in range(3):
            engine.process_completed_match(
                prediction=derby_pred,
                actual_result=_make_result("away"),
            )
        patterns = engine.get_detected_patterns()
        names = [p.name for p in patterns]
        assert "derby_overconfidence" in names

    def test_pattern_not_detected_below_threshold(self, engine):
        derby_pred = {**_make_prediction(p_home=0.80), "match_type": "DERBY_NATIONAL"}
        engine.process_completed_match(
            prediction=derby_pred,
            actual_result=_make_result("away"),
        )
        patterns = engine.get_detected_patterns()
        names = [p.name for p in patterns]
        assert "derby_overconfidence" not in names

    def test_pattern_has_required_fields(self, engine):
        derby_pred = {**_make_prediction(p_home=0.80), "match_type": "DERBY_NATIONAL"}
        for _ in range(3):
            engine.process_completed_match(
                prediction=derby_pred,
                actual_result=_make_result("away"),
            )
        patterns = engine.get_detected_patterns()
        p = next(p for p in patterns if p.name == "derby_overconfidence")
        assert hasattr(p, "occurrences")
        assert hasattr(p, "auto_correction")
        assert hasattr(p, "requires_approval")


# ── Correction proposals ──────────────────────────────────────────────────────

class TestCorrectionProposals:
    def test_proposals_returned_after_pattern_detection(self, engine):
        derby_pred = {**_make_prediction(p_home=0.80), "match_type": "DERBY_NATIONAL"}
        for _ in range(3):
            engine.process_completed_match(
                prediction=derby_pred,
                actual_result=_make_result("away"),
            )
        proposals = engine.get_pending_proposals()
        assert len(proposals) > 0

    def test_proposal_has_required_fields(self, engine):
        derby_pred = {**_make_prediction(p_home=0.80), "match_type": "DERBY_NATIONAL"}
        for _ in range(3):
            engine.process_completed_match(
                prediction=derby_pred,
                actual_result=_make_result("away"),
            )
        proposals = engine.get_pending_proposals()
        p = proposals[0]
        assert isinstance(p, CorrectionProposal)
        assert hasattr(p, "proposal_id")
        assert hasattr(p, "pattern_name")
        assert hasattr(p, "correction_description")
        assert hasattr(p, "previous_value")
        assert hasattr(p, "proposed_value")
        assert hasattr(p, "status")
        assert hasattr(p, "requires_approval")
        assert hasattr(p, "created_at")

    def test_small_correction_does_not_require_approval(self, engine):
        derby_pred = {**_make_prediction(p_home=0.80), "match_type": "DERBY_NATIONAL"}
        for _ in range(3):
            engine.process_completed_match(
                prediction=derby_pred,
                actual_result=_make_result("away"),
            )
        proposals = engine.get_pending_proposals()
        auto_proposals = [p for p in proposals if not p.requires_approval]
        # Small weight changes don't need review
        for p in auto_proposals:
            delta = abs(p.proposed_value - p.previous_value)
            assert delta <= engine.correction_review_required_above


# ── Approve / rollback ────────────────────────────────────────────────────────

class TestApproveRollback:
    def _setup_proposal(self, engine):
        derby_pred = {**_make_prediction(p_home=0.80), "match_type": "DERBY_NATIONAL"}
        for _ in range(3):
            engine.process_completed_match(prediction=derby_pred, actual_result=_make_result("away"))
        proposals = engine.get_pending_proposals()
        assert len(proposals) > 0
        return proposals[0]

    def test_approve_changes_status(self, engine):
        p = self._setup_proposal(engine)
        engine.approve(p.proposal_id)
        updated = engine.get_proposal(p.proposal_id)
        assert updated.status == CorrectionStatus.APPROVED

    def test_rollback_changes_status(self, engine):
        p = self._setup_proposal(engine)
        engine.approve(p.proposal_id)
        engine.rollback(p.proposal_id)
        updated = engine.get_proposal(p.proposal_id)
        assert updated.status == CorrectionStatus.ROLLED_BACK

    def test_rollback_without_approve_raises(self, engine):
        p = self._setup_proposal(engine)
        with pytest.raises(ValueError):
            engine.rollback(p.proposal_id)

    def test_unknown_proposal_id_raises(self, engine):
        with pytest.raises(KeyError):
            engine.approve("nonexistent-id")

    def test_approved_proposal_not_in_pending(self, engine):
        p = self._setup_proposal(engine)
        engine.approve(p.proposal_id)
        pending = engine.get_pending_proposals()
        ids = [x.proposal_id for x in pending]
        assert p.proposal_id not in ids


# ── Reasoning log ─────────────────────────────────────────────────────────────

class TestReasoningLog:
    def test_log_reasoning_stores_steps(self, engine):
        steps = [
            {"step": 1, "feature_used": "xg_home", "conclusion": "xG advantage", "confidence": 0.7},
            {"step": 2, "feature_used": "odds_movement", "conclusion": "sharp signal", "confidence": 0.8},
        ]
        engine.log_prediction_reasoning("m-001", steps)
        logs = engine.get_reasoning_log("m-001")
        assert len(logs) == 2

    def test_log_reasoning_retrieves_by_match_id(self, engine):
        engine.log_prediction_reasoning("m-001", [{"step": 1}])
        engine.log_prediction_reasoning("m-002", [{"step": 1}, {"step": 2}])
        assert len(engine.get_reasoning_log("m-001")) == 1
        assert len(engine.get_reasoning_log("m-002")) == 2

    def test_unknown_match_returns_empty(self, engine):
        assert engine.get_reasoning_log("no-such-match") == []


def _make_prediction(match_id="m-001", **kwargs):
    base = {
        "match_id": match_id,
        "league": "PL",
        "match_type": "STANDARD",
        "season_phase": "MID",
        "p_home": 0.55,
        "p_draw": 0.25,
        "p_away": 0.20,
        "selection": "home",
        "confidence": 0.55,
        "shap_values": {"xg_advantage": 0.15, "odds_movement": 0.08, "lineup_delta": 0.02},
    }
    base.update(kwargs)
    return base

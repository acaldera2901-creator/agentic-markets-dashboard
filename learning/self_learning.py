from __future__ import annotations

import uuid
import datetime
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional


class CorrectionStatus(Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    ROLLED_BACK = "ROLLED_BACK"


@dataclass
class FeatureMemory:
    feature_name: str
    rolling_shap_accuracy: float = 0.0
    error_contribution: float = 0.0
    trend: str = "stable"          # "improving", "degrading", "stable"
    last_100_accuracy: float = 0.0
    recommended_weight_adjustment: float = 0.0
    sample_count: int = 0
    cumulative_error: float = 0.0


@dataclass
class ErrorPattern:
    name: str
    occurrences: int = 0
    auto_correction: Optional[dict] = None
    requires_approval: bool = False
    context: dict = field(default_factory=dict)


@dataclass
class CorrectionProposal:
    proposal_id: str
    pattern_name: str
    correction_description: str
    previous_value: float
    proposed_value: float
    status: CorrectionStatus
    requires_approval: bool
    created_at: datetime.datetime


class SelfLearningEngine:
    """
    Learns from completed matches: tracks feature reliability, detects systematic
    error patterns, and proposes weight corrections with approve/rollback lifecycle.
    """

    def __init__(
        self,
        min_errors_for_auto_correction: int = 3,
        max_auto_weight_change: float = 0.10,
        max_auto_threshold_change: float = 0.01,
        correction_review_required_above: float = 0.15,
    ) -> None:
        self.min_errors_for_auto_correction = min_errors_for_auto_correction
        self.max_auto_weight_change = max_auto_weight_change
        self.max_auto_threshold_change = max_auto_threshold_change
        self.correction_review_required_above = correction_review_required_above

        self._feature_memories: dict[str, FeatureMemory] = {}
        self._patterns: dict[str, ErrorPattern] = {}
        self._proposals: dict[str, CorrectionProposal] = {}
        self._reasoning_logs: dict[str, list[dict]] = {}

    # ── Core processing ───────────────────────────────────────────────────────

    def process_completed_match(
        self,
        prediction: dict[str, Any],
        actual_result: dict[str, Any],
    ) -> dict[str, Any]:
        match_id = prediction.get("match_id", "unknown")
        selection = prediction.get("selection", "home")
        outcome = actual_result.get("outcome", "")
        confidence = prediction.get("confidence", 0.5)
        shap_values: dict[str, float] = prediction.get("shap_values", {})
        match_type = prediction.get("match_type", "STANDARD")

        correct = selection == outcome
        prediction_error = (1.0 - confidence) if correct else confidence

        feature_errors: dict[str, float] = {}
        for feature, shap_val in shap_values.items():
            contribution_error = abs(shap_val) * (0 if correct else 1)
            feature_errors[feature] = contribution_error
            self._update_feature_memory(feature, shap_val, prediction_error)

        self._detect_patterns(prediction, prediction_error, match_type)

        return {
            "match_id": match_id,
            "prediction_error": prediction_error,
            "feature_errors": feature_errors,
            "correct": correct,
        }

    # ── Feature memory ────────────────────────────────────────────────────────

    def _update_feature_memory(
        self, feature: str, shap_val: float, error: float
    ) -> None:
        mem = self._feature_memories.setdefault(
            feature, FeatureMemory(feature_name=feature)
        )
        mem.sample_count += 1
        mem.cumulative_error += error
        avg_error = mem.cumulative_error / mem.sample_count
        mem.error_contribution = avg_error
        mem.last_100_accuracy = 1.0 - avg_error
        mem.rolling_shap_accuracy = abs(shap_val) * (1.0 - avg_error)
        # Recommend reducing weight if feature consistently contributes to errors
        if avg_error > 0.5:
            mem.recommended_weight_adjustment = -min(
                self.max_auto_weight_change, avg_error - 0.5
            )
        else:
            mem.recommended_weight_adjustment = 0.0

    def get_feature_memory(self, feature: str) -> Optional[FeatureMemory]:
        return self._feature_memories.get(feature)

    def get_all_feature_memories(self) -> dict[str, FeatureMemory]:
        return dict(self._feature_memories)

    # ── Pattern detection ─────────────────────────────────────────────────────

    def _detect_patterns(
        self, prediction: dict, error: float, match_type: str
    ) -> None:
        self._check_derby_overconfidence(prediction, error, match_type)

    def _check_derby_overconfidence(
        self, prediction: dict, error: float, match_type: str
    ) -> None:
        if match_type not in ("DERBY_NATIONAL", "DERBY_LOCAL", "DERBY"):
            return
        selection = prediction.get("selection", "home")
        p_map = {
            "home": prediction.get("p_home", 0.0),
            "draw": prediction.get("p_draw", 0.0),
            "away": prediction.get("p_away", 0.0),
        }
        selection_prob = p_map.get(selection, prediction.get("confidence", 0.0))
        if selection_prob < 0.75:
            return

        pattern = self._patterns.setdefault(
            "derby_overconfidence",
            ErrorPattern(
                name="derby_overconfidence",
                auto_correction={
                    "param": "confidence_threshold_derby",
                    "current_value": 0.75,
                    "delta": -self.max_auto_threshold_change,
                },
                requires_approval=False,
            ),
        )
        pattern.occurrences += 1

        if pattern.occurrences >= self.min_errors_for_auto_correction:
            self._generate_correction_proposal(pattern)

    def get_detected_patterns(self) -> list[ErrorPattern]:
        return [
            p for p in self._patterns.values()
            if p.occurrences >= self.min_errors_for_auto_correction
        ]

    # ── Correction proposals ──────────────────────────────────────────────────

    def _generate_correction_proposal(self, pattern: ErrorPattern) -> None:
        # Avoid duplicating an already-pending proposal for the same pattern
        for p in self._proposals.values():
            if (
                p.pattern_name == pattern.name
                and p.status == CorrectionStatus.PENDING
            ):
                return

        correction = pattern.auto_correction or {}
        current = float(correction.get("current_value", 0.0))
        delta = float(correction.get("delta", 0.0))
        proposed = current + delta
        change = abs(proposed - current)
        requires_approval = (
            pattern.requires_approval
            or change > self.correction_review_required_above
        )

        proposal = CorrectionProposal(
            proposal_id=str(uuid.uuid4()),
            pattern_name=pattern.name,
            correction_description=(
                f"Auto-correction for pattern '{pattern.name}': "
                f"{correction.get('param', 'unknown')} "
                f"{current:.4f} → {proposed:.4f}"
            ),
            previous_value=current,
            proposed_value=proposed,
            status=CorrectionStatus.PENDING,
            requires_approval=requires_approval,
            created_at=datetime.datetime.utcnow(),
        )
        self._proposals[proposal.proposal_id] = proposal

    def get_pending_proposals(self) -> list[CorrectionProposal]:
        return [
            p for p in self._proposals.values()
            if p.status == CorrectionStatus.PENDING
        ]

    def get_proposal(self, proposal_id: str) -> CorrectionProposal:
        if proposal_id not in self._proposals:
            raise KeyError(f"Proposal '{proposal_id}' not found")
        return self._proposals[proposal_id]

    # ── Approve / rollback ────────────────────────────────────────────────────

    def approve(self, proposal_id: str) -> None:
        proposal = self.get_proposal(proposal_id)
        proposal.status = CorrectionStatus.APPROVED

    def rollback(self, proposal_id: str) -> None:
        proposal = self.get_proposal(proposal_id)
        if proposal.status != CorrectionStatus.APPROVED:
            raise ValueError(
                f"Cannot rollback proposal '{proposal_id}': "
                f"status is {proposal.status.value}, not APPROVED"
            )
        proposal.status = CorrectionStatus.ROLLED_BACK

    # ── Reasoning log ─────────────────────────────────────────────────────────

    def log_prediction_reasoning(
        self, match_id: str, steps: list[dict]
    ) -> None:
        self._reasoning_logs.setdefault(match_id, []).extend(steps)

    def get_reasoning_log(self, match_id: str) -> list[dict]:
        return self._reasoning_logs.get(match_id, [])

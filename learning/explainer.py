from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class ExplanationResult:
    match_id: str
    top_features: list[dict]
    narrative: str
    confidence_breakdown: dict
    shap_sum: float
    base_probability: float

    def to_dict(self) -> dict:
        return {
            "match_id": self.match_id,
            "top_features": self.top_features,
            "narrative": self.narrative,
            "confidence_breakdown": self.confidence_breakdown,
            "shap_sum": self.shap_sum,
            "base_probability": self.base_probability,
        }


class PredictionExplainer:
    """
    Builds human-readable SHAP-based explanations for model predictions.
    Does not require running a model at explain time — consumes pre-computed
    shap_values from the prediction dict.
    """

    def __init__(self, top_n_features: int = 5) -> None:
        self.top_n_features = top_n_features

    def explain(self, prediction: dict[str, Any]) -> ExplanationResult:
        match_id = prediction.get("match_id", "unknown")
        shap_values: dict[str, float] = prediction.get("shap_values", {})
        base_probability: float = float(prediction.get("base_probability", 0.0))
        selection: str = prediction.get("selection", "home")

        top_features = self._rank_features(shap_values)
        shap_sum = sum(shap_values.values()) if shap_values else 0.0
        confidence_breakdown = {
            "base": base_probability,
            "shap_contribution": shap_sum,
        }
        narrative = self._build_narrative(top_features, selection)

        return ExplanationResult(
            match_id=match_id,
            top_features=top_features,
            narrative=narrative,
            confidence_breakdown=confidence_breakdown,
            shap_sum=shap_sum,
            base_probability=base_probability,
        )

    # ── Internals ─────────────────────────────────────────────────────────────

    def _rank_features(self, shap_values: dict[str, float]) -> list[dict]:
        if not shap_values:
            return []
        sorted_items = sorted(
            shap_values.items(), key=lambda kv: abs(kv[1]), reverse=True
        )
        result = []
        for name, value in sorted_items[: self.top_n_features]:
            result.append(
                {
                    "feature_name": name,
                    "shap_value": value,
                    "direction": "positive" if value >= 0 else "negative",
                }
            )
        return result

    def _build_narrative(
        self, top_features: list[dict], selection: str
    ) -> str:
        if not top_features:
            return f"No feature data available for {selection} selection."

        top = top_features[0]
        parts = [
            f"Primary driver: {top['feature_name']} "
            f"({top['direction']}, SHAP={top['shap_value']:+.3f})."
        ]
        if len(top_features) > 1:
            supporting = [
                f"{f['feature_name']} ({f['direction']})"
                for f in top_features[1:3]
            ]
            parts.append(f"Supporting: {', '.join(supporting)}.")
        parts.append(f"Selection: {selection}.")
        return " ".join(parts)

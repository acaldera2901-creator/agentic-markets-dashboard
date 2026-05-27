from __future__ import annotations

import datetime
from dataclasses import dataclass
from enum import Enum
from typing import Optional


class SeasonPhase(Enum):
    EARLY = "EARLY"
    MID = "MID"
    LATE = "LATE"
    INTERNATIONAL_BREAK = "INTERNATIONAL_BREAK"


@dataclass
class PhaseConfig:
    xg_weight: float = 1.0
    form_weight: float = 1.0
    pi_rating_weight: float = 1.0
    odds_movement_weight: float = 1.0
    motivation_weight: float = 1.0
    stake_multiplier: float = 1.0
    min_matches_for_rolling: int = 5
    edge_min_boost: float = 0.0
    dead_rubber_auto_skip: bool = False
    notes: str = ""


_PHASE_CONFIGS: dict[SeasonPhase, PhaseConfig] = {
    SeasonPhase.EARLY: PhaseConfig(
        xg_weight=0.60,
        form_weight=0.20,
        pi_rating_weight=0.80,
        odds_movement_weight=1.20,
        min_matches_for_rolling=3,
        edge_min_boost=0.01,
        dead_rubber_auto_skip=False,
        notes="Alta incertezza, fidati del mercato più del modello",
    ),
    SeasonPhase.MID: PhaseConfig(
        xg_weight=1.0,
        form_weight=1.0,
        pi_rating_weight=1.0,
        odds_movement_weight=1.0,
        min_matches_for_rolling=5,
        edge_min_boost=0.0,
        notes="Fase stabile, pesi standard",
    ),
    SeasonPhase.LATE: PhaseConfig(
        xg_weight=0.80,
        form_weight=0.70,
        pi_rating_weight=0.90,
        motivation_weight=1.50,
        odds_movement_weight=1.10,
        edge_min_boost=0.015,
        dead_rubber_auto_skip=True,
        notes="Motivazione domina, attenzione a rotation",
    ),
    SeasonPhase.INTERNATIONAL_BREAK: PhaseConfig(
        stake_multiplier=0.50,
        edge_min_boost=0.02,
        notes="Prima giornata post-pausa: alta varianza",
    ),
}

# Feature keyword → PhaseConfig attribute name
_FEATURE_WEIGHT_MAP: dict[str, str] = {
    "xg":         "xg_weight",
    "form":       "form_weight",
    "pi_rating":  "pi_rating_weight",
    "pi":         "pi_rating_weight",
    "odds_move":  "odds_movement_weight",
    "odds_mvt":   "odds_movement_weight",
    "motivation": "motivation_weight",
}


class SeasonPhaseAdapter:
    """
    Adjusts feature weights and edge minimums based on the current season phase.

    Phase thresholds (configurable):
      progress < early_threshold  → EARLY
      progress < late_threshold   → MID
      otherwise                   → LATE
    """

    def __init__(
        self,
        early_threshold: float = 0.28,
        late_threshold: float = 0.75,
    ) -> None:
        self.early_threshold = early_threshold
        self.late_threshold = late_threshold
        self._breaks: list[tuple[datetime.date, datetime.date]] = []

    # ── Phase detection ───────────────────────────────────────────────────────

    def detect_phase(
        self,
        current_matchday: int,
        total_matchdays: int,
        reference_date: Optional[datetime.date] = None,
    ) -> SeasonPhase:
        if reference_date and self.is_international_break(reference_date):
            return SeasonPhase.INTERNATIONAL_BREAK
        progress = current_matchday / max(total_matchdays, 1)
        if progress < self.early_threshold:
            return SeasonPhase.EARLY
        if progress < self.late_threshold:
            return SeasonPhase.MID
        return SeasonPhase.LATE

    def get_config(self, phase: SeasonPhase) -> PhaseConfig:
        return _PHASE_CONFIGS[phase]

    # ── Weight adjustment ─────────────────────────────────────────────────────

    def apply_weights(
        self,
        feature_weights: dict[str, float],
        phase: SeasonPhase,
    ) -> dict[str, float]:
        cfg = _PHASE_CONFIGS[phase]
        adjusted: dict[str, float] = {}
        for feature, weight in feature_weights.items():
            multiplier = self._find_multiplier(feature, cfg)
            adjusted[feature] = weight * multiplier
        return adjusted

    def adjust_edge_min(self, base_edge: float, phase: SeasonPhase) -> float:
        cfg = _PHASE_CONFIGS[phase]
        return base_edge + cfg.edge_min_boost

    # ── International break ───────────────────────────────────────────────────

    def mark_international_break(
        self,
        start: datetime.date,
        end: datetime.date,
    ) -> None:
        self._breaks.append((start, end))

    def is_international_break(self, date: datetime.date) -> bool:
        return any(start <= date <= end for start, end in self._breaks)

    # ── Internal ──────────────────────────────────────────────────────────────

    @staticmethod
    def _find_multiplier(feature: str, cfg: PhaseConfig) -> float:
        fl = feature.lower()
        for keyword, attr in _FEATURE_WEIGHT_MAP.items():
            if keyword in fl:
                return float(getattr(cfg, attr, 1.0))
        return 1.0

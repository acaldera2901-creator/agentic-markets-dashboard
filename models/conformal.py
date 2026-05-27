"""
Conformal Prediction for uncertainty quantification.

Computes prediction intervals [p_low, p_high] for each outcome probability
using inductive conformal prediction (split conformal).

Usage:
    calibrator = ConformalCalibrator(alpha=0.10)  # 90% coverage
    calibrator.calibrate(calibration_probs, calibration_outcomes)
    interval = calibrator.predict_interval(p_home)
"""
from __future__ import annotations

import math
from typing import Optional


class ConformalCalibrator:
    """
    Split Conformal Predictor for probability outputs.

    Calibrates on a held-out set and produces valid prediction intervals
    at coverage level (1 - alpha).
    """

    def __init__(self, alpha: float = 0.10):
        """
        Args:
            alpha: miscoverage rate (0.10 = 90% coverage intervals)
        """
        self.alpha = alpha
        self._q_hat: Optional[float] = None

    def calibrate(
        self,
        predicted_probs: list[float],
        true_labels: list[int],   # 1 if outcome occurred, 0 otherwise
    ) -> None:
        """
        Compute the conformal quantile from calibration data.

        Args:
            predicted_probs: model's predicted probability for each outcome
            true_labels: 1 if the outcome actually occurred, 0 otherwise
        """
        if len(predicted_probs) != len(true_labels) or len(predicted_probs) < 4:
            return

        # Nonconformity score: |label - predicted_prob|
        scores = [abs(y - p) for y, p in zip(true_labels, predicted_probs)]
        scores.sort()

        # Quantile at level ceil((n+1)*(1-alpha))/n
        n = len(scores)
        idx = math.ceil((n + 1) * (1 - self.alpha)) - 1
        idx = min(max(idx, 0), n - 1)
        self._q_hat = scores[idx]

    def predict_interval(self, p: float) -> tuple[float, float]:
        """
        Return (p_low, p_high) prediction interval for a probability estimate.

        Args:
            p: model's point estimate probability

        Returns:
            (lower_bound, upper_bound) clamped to [0, 1]
        """
        if self._q_hat is None:
            # No calibration data: return ±0.05 as default
            q = 0.05
        else:
            q = self._q_hat

        return (
            round(max(p - q, 0.0), 4),
            round(min(p + q, 1.0), 4),
        )

    @property
    def is_calibrated(self) -> bool:
        return self._q_hat is not None

    def width(self, p: float) -> float:
        lo, hi = self.predict_interval(p)
        return round(hi - lo, 4)


class LeagueConformalStore:
    """
    Per-league ConformalCalibrator storage.
    Stores calibrators indexed by league code.
    """

    def __init__(self, alpha: float = 0.10):
        self.alpha = alpha
        self._calibrators: dict[str, ConformalCalibrator] = {}

    def get_or_create(self, league: str) -> ConformalCalibrator:
        if league not in self._calibrators:
            self._calibrators[league] = ConformalCalibrator(self.alpha)
        return self._calibrators[league]

    def calibrate(
        self,
        league: str,
        predicted_probs: list[float],
        true_labels: list[int],
    ) -> None:
        cal = self.get_or_create(league)
        cal.calibrate(predicted_probs, true_labels)

    def predict_interval(self, league: str, p: float) -> tuple[float, float]:
        cal = self._calibrators.get(league)
        if cal is None or not cal.is_calibrated:
            # Fallback: uncalibrated uses ±0.07 margin
            q = 0.07
            return (round(max(p - q, 0.0), 4), round(min(p + q, 1.0), 4))
        return cal.predict_interval(p)

    def interval_width(self, league: str, p: float) -> float:
        lo, hi = self.predict_interval(league, p)
        return round(hi - lo, 4)


# Module-level shared store (used by ModelAgent)
_store = LeagueConformalStore(alpha=0.10)


def calibrate_from_history(
    league: str,
    match_results: list[dict],
) -> None:
    """
    Calibrate conformal predictor from historical match data.

    Args:
        league: league code (e.g. "SA", "PL")
        match_results: list of dicts with keys:
            p_home, p_draw, p_away  — model predictions
            home_goals, away_goals  — actual result
    """
    home_probs, home_labels = [], []
    draw_probs, draw_labels = [], []
    away_probs, away_labels = [], []

    for r in match_results:
        try:
            hg = int(r["home_goals"])
            ag = int(r["away_goals"])
            outcome = "home" if hg > ag else "draw" if hg == ag else "away"

            home_probs.append(float(r["p_home"]))
            draw_probs.append(float(r["p_draw"]))
            away_probs.append(float(r["p_away"]))
            home_labels.append(1 if outcome == "home" else 0)
            draw_labels.append(1 if outcome == "draw" else 0)
            away_labels.append(1 if outcome == "away" else 0)
        except (KeyError, ValueError, TypeError):
            continue

    # Calibrate on all outcomes together (pooling home/draw/away)
    all_probs = home_probs + draw_probs + away_probs
    all_labels = home_labels + draw_labels + away_labels
    _store.calibrate(league, all_probs, all_labels)


def get_interval(league: str, p: float) -> tuple[float, float]:
    """Return conformal interval for a probability from the shared store."""
    return _store.predict_interval(league, p)


def interval_width(league: str, p: float) -> float:
    return _store.interval_width(league, p)

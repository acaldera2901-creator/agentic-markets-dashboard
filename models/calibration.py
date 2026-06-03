"""Probability calibration for 1X2 predictions.

Calibration maps a model's predicted probability to the empirically observed
frequency, so that "60%" really happens ~60% of the time. This directly lowers
Brier/log-loss — exactly the value we sell (honest, well-calibrated probabilities).

Per-outcome isotonic regression (monotonic, non-parametric), then row renormalised
so the three outcomes still sum to 1. Distinct from models/conformal.py, which gives
reliability *intervals*, not point-probability calibration.
"""
from __future__ import annotations

from typing import List, Sequence, Tuple

import numpy as np
from sklearn.isotonic import IsotonicRegression


class IsotonicCalibrator:
    def __init__(self) -> None:
        self._iso: List[IsotonicRegression | None] = [None, None, None]
        self.fitted = False

    def fit(self, probs: Sequence[Sequence[float]], outcomes: Sequence[int]) -> "IsotonicCalibrator":
        """probs: array [N,3] of (pH,pD,pA). outcomes: [N] with 0=H, 1=D, 2=A."""
        p = np.asarray(probs, dtype=float)
        y = np.asarray(outcomes, dtype=int)
        if p.ndim != 2 or p.shape[1] != 3 or len(p) != len(y) or len(p) == 0:
            raise ValueError("probs must be [N,3] and outcomes [N], non-empty")
        for k in range(3):
            target = (y == k).astype(float)
            ir = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0)
            ir.fit(p[:, k], target)
            self._iso[k] = ir
        self.fitted = True
        return self

    def transform_one(self, p: Tuple[float, float, float]) -> Tuple[float, float, float]:
        if not self.fitted:
            return p
        cal = [float(self._iso[k].predict([p[k]])[0]) for k in range(3)]  # type: ignore[union-attr]
        s = sum(cal)
        if s <= 0:
            return p
        return (cal[0] / s, cal[1] / s, cal[2] / s)

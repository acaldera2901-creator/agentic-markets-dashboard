"""XGModel — the xG-enhanced football model, packaged for serving.

Wraps the logic validated in scripts/backtest_xg.py (which closes ~60% of the gap
to the Pinnacle line) into a reusable fit/predict object:

    base   = Poisson v2 probabilities (lib/poisson-model.ts parity, in Python)
    + pi-rating diff, recent-form diff
    + running xG form (attack / defence) per team
    -> multinomial logistic stack -> calibrated (pH, pD, pA)

fit() does one walk-forward pass to collect leakage-free training rows for the
logistic and leaves the trackers in their final state; predict() uses that final
state for upcoming fixtures. Trained on Understat matches (goals + xG).
"""
from __future__ import annotations

from collections import defaultdict
from typing import List, Sequence, Tuple

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

from core.understat_data import XGMatch
from models.match_features import PiRating, form_ppg, result_char
from models.poisson import PoissonModel

OUTCOMES = ("H", "D", "A")
XG_PRIOR = 1.40
POISSON_REFIT_EVERY = 40


class _XGForm:
    def __init__(self) -> None:
        self.f = defaultdict(float); self.fn = defaultdict(int)
        self.a = defaultdict(float); self.an = defaultdict(int)

    def attack(self, t: str) -> float:
        return self.f[t] / self.fn[t] if self.fn[t] >= 3 else XG_PRIOR

    def defense(self, t: str) -> float:
        return self.a[t] / self.an[t] if self.an[t] >= 3 else XG_PRIOR

    def update(self, m: XGMatch) -> None:
        self.f[m.home_team] += m.home_xg; self.fn[m.home_team] += 1
        self.a[m.home_team] += m.away_xg; self.an[m.home_team] += 1
        self.f[m.away_team] += m.away_xg; self.fn[m.away_team] += 1
        self.a[m.away_team] += m.home_xg; self.an[m.away_team] += 1


class XGModel:
    def __init__(self, half_life_days: float = 0.0) -> None:
        self.half_life_days = half_life_days
        self._clf: LogisticRegression | None = None
        self._scaler: StandardScaler | None = None
        self._poisson = PoissonModel(half_life_days=half_life_days)
        self._pi = PiRating()
        self._xg = _XGForm()
        self._form: dict[str, list] = defaultdict(list)
        self._train: list[dict] = []
        self._since = 0
        self.fitted = False

    def _advance(self, m: XGMatch) -> None:
        """Advance trackers with an observed result (no refit)."""
        self._train.append(m.as_model_match())
        self._pi.update(m.home_team, m.away_team, m.home_goals, m.away_goals)
        self._xg.update(m)
        self._form[m.home_team].append(result_char(m.home_goals, m.away_goals))
        self._form[m.away_team].append(result_char(m.away_goals, m.home_goals))
        self._since += 1

    def _ensure_poisson(self) -> None:
        if not self._poisson.fitted or self._since >= POISSON_REFIT_EVERY:
            self._poisson.fit(self._train)
            self._since = 0

    def update(self, m: XGMatch) -> None:
        """Public: feed an observed result as it arrives (between retrains)."""
        self._advance(m)

    def _features(self, poi: Tuple[float, float, float], home: str, away: str) -> list[float]:
        return [
            poi[0], poi[1], poi[2],
            self._pi.rating_diff(home, away),
            form_ppg(self._form[home]) - form_ppg(self._form[away]),
            self._xg.attack(home) - self._xg.attack(away),
            self._xg.defense(away) - self._xg.defense(home),
        ]

    def fit(self, matches: Sequence[XGMatch]) -> "XGModel":
        ms = sorted(matches, key=lambda m: m.date)
        X: list[list[float]] = []
        y: list[int] = []
        for m in ms:
            if len(self._train) >= 20:
                self._ensure_poisson()
                poi = self._poisson.predict(m.home_team, m.away_team)
                if poi:
                    X.append(self._features(poi, m.home_team, m.away_team))
                    y.append(OUTCOMES.index(m.result))
            self._advance(m)  # record features first -> no leakage

        self._poisson.fit(self._train); self._since = 0  # final state for prediction
        self._scaler = StandardScaler().fit(np.asarray(X))
        self._clf = LogisticRegression(max_iter=2000).fit(
            self._scaler.transform(np.asarray(X)), np.asarray(y)
        )
        self.fitted = True
        return self

    def predict(self, home: str, away: str) -> Tuple[float, float, float] | None:
        if not self.fitted:
            return None
        self._ensure_poisson()  # keep the base no more than one refit window stale
        poi = self._poisson.predict(home, away)
        if poi is None:
            return None
        x = self._scaler.transform([self._features(poi, home, away)])
        p = self._clf.predict_proba(x)[0]
        # classes_ may reorder; map back to (H, D, A)
        out = {self._clf.classes_[i]: p[i] for i in range(len(p))}
        return (out.get(0, 0.0), out.get(1, 0.0), out.get(2, 0.0))

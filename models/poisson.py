"""Poisson v2 — the upgraded served model.

v1 (lib/poisson-model.ts, mirrored in the CLV backtest) = shrunk attack/defence
goal ratios with independent Poisson goals. v2 keeps the shrinkage (which is what
makes it well-calibrated) and adds two principled, data-free upgrades:

  1. Time-decay weighting   — recent matches count more (half-life in days).
  2. Dixon-Coles tau         — low-score correlation correction (fixes the draw
                               under-prediction of the independent-Poisson grid).

Pure and cheap: fit() recomputes weighted team strengths in O(n); no optimiser,
so it is safe to refit every match in walk-forward. predict() returns (pH, pD, pA).
"""
from __future__ import annotations

from datetime import date
from math import exp
from typing import Dict, List, Tuple

from models.dixon_coles import _tau, decay_weights

DEFAULT_SHRINKAGE = 4.0
DEFAULT_RHO = -0.10  # Dixon-Coles low-score correction (negative inflates draws)


class PoissonModel:
    def __init__(
        self,
        shrinkage_prior: float = DEFAULT_SHRINKAGE,
        half_life_days: float = 0.0,
        rho: float = DEFAULT_RHO,
        max_goals: int = 9,
    ) -> None:
        self.shrinkage_prior = shrinkage_prior
        self.half_life_days = half_life_days
        self.rho = rho
        self.max_goals = max_goals
        self.avg_home = 1.0
        self.avg_away = 1.0
        self._strength: Dict[str, dict] = {}
        self.fitted = False

    def _shrink(self, raw: float, weight: float) -> float:
        return (raw * weight + 1.0 * self.shrinkage_prior) / (weight + self.shrinkage_prior)

    def fit(self, matches: List[Dict]) -> "PoissonModel":
        if not matches:
            self.fitted = False
            return self

        if self.half_life_days and self.half_life_days > 0:
            dates = [date.fromisoformat(m["date"]) if m.get("date") else None for m in matches]
            weights = decay_weights(dates, self.half_life_days)
        else:
            weights = [1.0] * len(matches)

        wsum = sum(weights)
        self.avg_home = sum(w * m["home_goals"] for w, m in zip(weights, matches)) / wsum
        self.avg_away = sum(w * m["away_goals"] for w, m in zip(weights, matches)) / wsum
        if self.avg_home <= 0 or self.avg_away <= 0:
            self.fitted = False
            return self

        # weighted per-team home/away goal aggregates
        agg: Dict[str, dict] = {}

        def slot(team: str) -> dict:
            return agg.setdefault(
                team, {"hw": 0.0, "hgf": 0.0, "hga": 0.0, "aw": 0.0, "agf": 0.0, "aga": 0.0}
            )

        for w, m in zip(weights, matches):
            h, a = slot(m["home_team"]), slot(m["away_team"])
            h["hw"] += w; h["hgf"] += w * m["home_goals"]; h["hga"] += w * m["away_goals"]
            a["aw"] += w; a["agf"] += w * m["away_goals"]; a["aga"] += w * m["home_goals"]

        self._strength = {}
        for team, s in agg.items():
            atk_h = self._shrink((s["hgf"] / s["hw"]) / self.avg_home if s["hw"] else 1.0, s["hw"])
            def_h = self._shrink((s["hga"] / s["hw"]) / self.avg_away if s["hw"] else 1.0, s["hw"])
            atk_a = self._shrink((s["agf"] / s["aw"]) / self.avg_away if s["aw"] else 1.0, s["aw"])
            def_a = self._shrink((s["aga"] / s["aw"]) / self.avg_home if s["aw"] else 1.0, s["aw"])
            self._strength[team] = {"atk_h": atk_h, "def_h": def_h, "atk_a": atk_a, "def_a": def_a}

        self.fitted = True
        return self

    def lambdas(self, home: str, away: str) -> Tuple[float, float] | None:
        sh, sa = self._strength.get(home), self._strength.get(away)
        if not sh or not sa:
            return None
        lam = self.avg_home * sh["atk_h"] * sa["def_a"]
        mu = self.avg_away * sa["atk_a"] * sh["def_h"]
        return lam, mu

    def predict(self, home: str, away: str) -> Tuple[float, float, float] | None:
        if not self.fitted:
            return None
        lm = self.lambdas(home, away)
        if lm is None:
            return None
        lam, mu = lm

        def pois(k: int, l: float) -> float:
            p = exp(-l)
            for i in range(1, k + 1):
                p *= l / i
            return p

        ph = pd = pa = 0.0
        for i in range(self.max_goals + 1):
            for j in range(self.max_goals + 1):
                p = _tau(i, j, lam, mu, self.rho) * pois(i, lam) * pois(j, mu)
                if i > j:
                    ph += p
                elif i == j:
                    pd += p
                else:
                    pa += p
        tot = ph + pd + pa
        if tot <= 0:
            return None
        return (ph / tot, pd / tot, pa / tot)

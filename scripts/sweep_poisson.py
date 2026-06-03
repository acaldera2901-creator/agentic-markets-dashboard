"""Sweep Poisson v2 hyperparameters to test whether ANY config beats v1.

If no shrinkage/time-decay/tau combination beats v1 on Brier, the conclusion is
robust: goals-only data is maxed out and the gap to the market is an information
gap (needs richer features), not a model-form or calibration gap.

Run:  venv/bin/python -m scripts.sweep_poisson
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.football_data_uk import FDMatch, implied_probs  # noqa: E402
from models.poisson import PoissonModel  # noqa: E402
from scripts.backtest_clv import (  # noqa: E402
    LEAGUES,
    START_YEARS,
    WARMUP,
    brier_1x2,
    load_cached,
    poisson_v1_predict,
)

OUTCOMES = ("H", "D", "A")

# (label, shrinkage, half_life_days, rho)
CONFIGS = [
    ("v2 plain (s4,hl0,rho0)", 4.0, 0.0, 0.0),
    ("v2 +tau (rho-.10)", 4.0, 0.0, -0.10),
    ("v2 +decay (hl120)", 4.0, 120.0, 0.0),
    ("v2 +both", 4.0, 120.0, -0.10),
    ("v2 shrink8", 8.0, 0.0, 0.0),
    ("v2 shrink2", 2.0, 0.0, 0.0),
]


def run() -> None:
    print("Loading football-data.co.uk (cached)…")
    by_league: dict[str, list[FDMatch]] = {}
    for lg in LEAGUES:
        ms: list[FDMatch] = []
        for yr in START_YEARS:
            ms.extend(load_cached(lg, yr))
        ms.sort(key=lambda m: m.date)
        by_league[lg] = ms

    v1_b: list[float] = []
    mkt_b: list[float] = []
    cfg_b: dict[str, list[float]] = {c[0]: [] for c in CONFIGS}

    for lg, matches in by_league.items():
        if len(matches) <= WARMUP:
            continue
        train: list[dict] = [m.as_model_match() for m in matches[:WARMUP]]
        for m in matches[WARMUP:]:
            outcome = m.result if m.result in OUTCOMES else (
                "H" if m.home_goals > m.away_goals else "A" if m.away_goals > m.home_goals else "D"
            )
            mkt = implied_probs(m.closing_home, m.closing_draw, m.closing_away)
            v1 = poisson_v1_predict(train, m.home_team, m.away_team)
            preds = {}
            for label, s, hl, rho in CONFIGS:
                preds[label] = (
                    PoissonModel(shrinkage_prior=s, half_life_days=hl, rho=rho)
                    .fit(train)
                    .predict(m.home_team, m.away_team)
                )
            if v1 and mkt and all(preds.values()):
                v1_b.append(brier_1x2(v1, outcome))
                mkt_b.append(brier_1x2(mkt, outcome))
                for label in cfg_b:
                    cfg_b[label].append(brier_1x2(preds[label], outcome))
            train.append(m.as_model_match())

    def mean(xs: list[float]) -> float:
        return sum(xs) / len(xs) if xs else float("nan")

    rows = [("Poisson v1 (baseline)", mean(v1_b))]
    rows += [(label, mean(cfg_b[label])) for label in cfg_b]
    rows.append(("Market (Pinnacle)", mean(mkt_b)))

    print("\n" + "=" * 56)
    print(f"Eval matches: {len(v1_b)}")
    print(f"{'Model':<32}{'Brier':>12}")
    print("-" * 56)
    for label, b in rows:
        print(f"{label:<32}{b:>12.5f}")
    print("=" * 56)
    best = min(((label, mean(cfg_b[label])) for label in cfg_b), key=lambda x: x[1])
    v1m = mean(v1_b)
    verdict = "BEATS v1" if best[1] < v1m else "does NOT beat v1"
    print(f"Best v2 config: {best[0]} ({best[1]:.5f}) {verdict} ({mean(v1_b):.5f})")


if __name__ == "__main__":
    run()

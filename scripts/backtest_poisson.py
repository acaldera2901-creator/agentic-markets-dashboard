"""Compare Poisson v1 vs v2 vs v2+isotonic-calibration vs the market.

Walk-forward per league (v2 refit each match — cheap, no optimiser). We collect
every out-of-sample prediction in time order, fit the isotonic calibrator on the
FIRST half and evaluate everything on the SECOND half, so calibration never sees
its own evaluation data. Metric of record (per chosen product direction): Brier,
i.e. how well-calibrated our probabilities are vs the market baseline.

Run:  venv/bin/python -m scripts.backtest_poisson
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.football_data_uk import FDMatch, implied_probs  # noqa: E402
from models.calibration import IsotonicCalibrator  # noqa: E402
from models.poisson import PoissonModel  # noqa: E402
from scripts.backtest_clv import (  # noqa: E402
    LEAGUES,
    START_YEARS,
    WARMUP,
    brier_1x2,
    load_cached,
    poisson_v1_predict,
    roi_bets,
)

OUTCOMES = ("H", "D", "A")
V2_HALF_LIFE = 120.0
V2_RHO = -0.10
V2_SHRINKAGE = 4.0


def run() -> None:
    print("Loading football-data.co.uk (cached)…")
    by_league: dict[str, list[FDMatch]] = {}
    for lg in LEAGUES:
        ms: list[FDMatch] = []
        for yr in START_YEARS:
            ms.extend(load_cached(lg, yr))
        ms.sort(key=lambda m: m.date)
        by_league[lg] = ms

    # records: (v1, v2, market, outcome, odds) in temporal order across leagues
    records: list[tuple] = []
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
            v2 = PoissonModel(
                shrinkage_prior=V2_SHRINKAGE, half_life_days=V2_HALF_LIFE, rho=V2_RHO
            ).fit(train).predict(m.home_team, m.away_team)
            if v1 and v2 and mkt:
                odds = (m.closing_home, m.closing_draw, m.closing_away)
                records.append((v1, v2, mkt, outcome, odds))
            train.append(m.as_model_match())

    # temporal split: calibrate on first half, evaluate on second half
    split = len(records) // 2
    cal_set, eval_set = records[:split], records[split:]
    cal = IsotonicCalibrator().fit(
        [r[1] for r in cal_set], [OUTCOMES.index(r[3]) for r in cal_set]
    )

    def brier_mean(key) -> float:
        xs = [brier_1x2(key(r), r[3]) for r in eval_set]
        return sum(xs) / len(xs) if xs else float("nan")

    b_v1 = brier_mean(lambda r: r[0])
    b_v2 = brier_mean(lambda r: r[1])
    b_v2c = brier_mean(lambda r: cal.transform_one(r[1]))
    b_mkt = brier_mean(lambda r: r[2])

    def roi(key) -> tuple[int, float, float]:
        staked = profit = 0.0
        nb = 0
        for r in eval_set:
            s, pr, n = roi_bets(key(r), r[4], r[3])
            staked += s; profit += pr; nb += n
        return nb, profit, (profit / staked * 100 if staked else float("nan"))

    r_v1 = roi(lambda r: r[0])
    r_v2 = roi(lambda r: r[1])
    r_v2c = roi(lambda r: cal.transform_one(r[1]))

    print("\n" + "=" * 70)
    print(f"Eval matches (2nd half): {len(eval_set)}   (calibrated on first {split})")
    print(f"{'Model':<22}{'Brier':>10}{'ROI bets':>12}{'ROI %':>10}")
    print("-" * 70)
    print(f"{'Poisson v1':<22}{b_v1:>10.5f}{r_v1[0]:>12}{r_v1[2]:>9.2f}%")
    print(f"{'Poisson v2':<22}{b_v2:>10.5f}{r_v2[0]:>12}{r_v2[2]:>9.2f}%")
    print(f"{'Poisson v2 + calib':<22}{b_v2c:>10.5f}{r_v2c[0]:>12}{r_v2c[2]:>9.2f}%")
    print(f"{'Market (Pinnacle)':<22}{b_mkt:>10.5f}{'—':>12}{'—':>10}")
    print("=" * 70)
    gain = (b_v1 - b_v2c) / b_v1 * 100 if b_v1 else 0.0
    print(f"v2+calib vs v1: Brier {b_v1:.5f} -> {b_v2c:.5f}  ({gain:+.2f}%)")
    print(f"gap to market : {b_v2c - b_mkt:+.5f} Brier")


if __name__ == "__main__":
    run()

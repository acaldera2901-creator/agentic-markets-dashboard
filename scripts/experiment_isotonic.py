"""CALIB-1 experiment (step 2/2): does isotonic calibration improve the SERVED
football model out-of-time?

Input: /tmp/served_predictions.csv from scripts/experiment-isotonic-export.ts
(walk-forward replay of lib/poisson-model.ts at production w=0.5).

Protocol: fit IsotonicCalibrator (models/calibration.py — the exact class that
would ship) on seasons 2021-2023, evaluate on the held-out 2024 season.
Metrics: multi-class Brier + per-outcome ECE (10 equal-width bins), raw vs
calibrated. Also reports a global-vs-per-league fit comparison and exports the
winning calibration curve to /tmp/calibration_curve.json (the artifact the TS
serving layer would load).

Read-only vs prod: writes only /tmp files.
Run: ./venv/bin/python scripts/experiment_isotonic.py
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from models.calibration import IsotonicCalibrator  # noqa: E402

CSV_PATH = "/tmp/served_predictions.csv"
HOLDOUT_SEASON = "2024"
CURVE_OUT = "/tmp/calibration_curve.json"
GRID = [i / 200 for i in range(201)]  # 0.000..1.000 step 0.005 — TS lookup table


def brier(p: np.ndarray, y: np.ndarray) -> float:
    onehot = np.eye(3)[y]
    return float(np.mean(np.sum((p - onehot) ** 2, axis=1)))


def ece(p: np.ndarray, y: np.ndarray, bins: int = 10) -> float:
    """Mean per-outcome expected calibration error, equal-width bins."""
    total = 0.0
    for k in range(3):
        conf = p[:, k]
        hit = (y == k).astype(float)
        e = 0.0
        for b in range(bins):
            lo, hi = b / bins, (b + 1) / bins
            m = (conf >= lo) & (conf < hi if b < bins - 1 else conf <= hi)
            if m.sum() == 0:
                continue
            e += (m.sum() / len(conf)) * abs(conf[m].mean() - hit[m].mean())
        total += e
    return total / 3


def load() -> list[dict]:
    with open(CSV_PATH) as fh:
        return list(csv.DictReader(fh))


def main() -> None:
    rows = load()
    train = [r for r in rows if r["season"] != HOLDOUT_SEASON]
    hold = [r for r in rows if r["season"] == HOLDOUT_SEASON]
    print(f"predizioni totali: {len(rows)} | train (≤2023): {len(train)} | holdout (2024): {len(hold)}")

    def arr(rs: list[dict]) -> tuple[np.ndarray, np.ndarray]:
        p = np.array([[float(r["pHome"]), float(r["pDraw"]), float(r["pAway"])] for r in rs])
        y = np.array([int(r["outcome"]) for r in rs])
        return p, y

    p_tr, y_tr = arr(train)
    p_ho, y_ho = arr(hold)

    print(f"\nHOLDOUT 2024 — raw (servito):      Brier {brier(p_ho, y_ho):.4f}   ECE {ece(p_ho, y_ho):.4f}")

    # Global fit (the shipping candidate)
    cal = IsotonicCalibrator().fit(p_tr.tolist(), y_tr.tolist())
    p_cal = np.array([cal.transform_one(tuple(row)) for row in p_ho])
    print(f"HOLDOUT 2024 — isotonica GLOBALE:  Brier {brier(p_cal, y_ho):.4f}   ECE {ece(p_cal, y_ho):.4f}")

    # Per-league fit (more parameters, less data each — overfit check)
    leagues = sorted({r["league"] for r in rows})
    p_pl = p_ho.copy()
    for lg in leagues:
        tr_lg = [r for r in train if r["league"] == lg]
        if len(tr_lg) < 300:
            continue
        ptl, ytl = arr(tr_lg)
        cal_lg = IsotonicCalibrator().fit(ptl.tolist(), ytl.tolist())
        idx = [i for i, r in enumerate(hold) if r["league"] == lg]
        for i in idx:
            p_pl[i] = cal_lg.transform_one(tuple(p_ho[i]))
    print(f"HOLDOUT 2024 — isotonica PER-LEGA: Brier {brier(p_pl, y_ho):.4f}   ECE {ece(p_pl, y_ho):.4f}")

    # Sanity: calibrated probs sum to 1
    assert np.allclose(p_cal.sum(axis=1), 1.0, atol=1e-9)

    # Train-set (in-sample) numbers for reference — NOT the decision metric
    p_tr_cal = np.array([cal.transform_one(tuple(row)) for row in p_tr])
    print(f"\n(train in-sample, solo riferimento: raw Brier {brier(p_tr, y_tr):.4f} -> cal {brier(p_tr_cal, y_tr):.4f})")

    # Export the global curve as a TS-loadable lookup table.
    curve = {
        "model_version": "football-v4-xg-model",
        "fitted_on": "understat walk-forward 2021-2023 (served replay, w=0.5)",
        "n_train": len(train),
        "holdout": {
            "season": HOLDOUT_SEASON,
            "n": len(hold),
            "brier_raw": round(brier(p_ho, y_ho), 4),
            "brier_cal": round(brier(p_cal, y_ho), 4),
            "ece_raw": round(ece(p_ho, y_ho), 4),
            "ece_cal": round(ece(p_cal, y_ho), 4),
        },
        "grid_step": 0.005,
        "maps": {
            name: [round(float(cal._iso[k].predict([x])[0]), 6) for x in GRID]  # type: ignore[union-attr]
            for k, name in enumerate(("home", "draw", "away"))
        },
    }
    Path(CURVE_OUT).write_text(json.dumps(curve))
    print(f"\ncurva esportata -> {CURVE_OUT} (lookup {len(GRID)} punti per outcome)")


if __name__ == "__main__":
    main()

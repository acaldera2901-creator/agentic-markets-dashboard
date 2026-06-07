"""CALIB-2 experiment: calibration of the SERVED World Cup national model.

Walk-forward replay of core/world_cup_probability.national_match_probabilities
(the exact code that feeds WC paper rows) over the production national history
(core/world_cup_history.load_national_history — same since/tournament filters
as production). For each international from EVAL_START on, predict 1X2 using
only PRIOR matches, keep predictions that pass the production-equivalent
quality bar (data_quality >= 0.75), record the outcome.

Then: fit temperature scaling (grid) and IsotonicCalibrator on the train
window, evaluate Brier/ECE on the temporal holdout (>= HOLDOUT_START).

Read-only: writes only /tmp/wc_calibration_results.json.
Run: ./venv/bin/python scripts/experiment_wc_calibration.py
"""
from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from core.world_cup_history import load_national_history  # noqa: E402
from core.world_cup_probability import national_match_probabilities  # noqa: E402
from models.calibration import IsotonicCalibrator  # noqa: E402

EVAL_START = date(2021, 1, 1)     # predictions start (3y burn-in from 2018)
HOLDOUT_START = date(2025, 1, 1)  # temporal holdout: 2025 + 2026 (incl. WC qualifiers)
MIN_QUALITY = 0.75                # production gate equivalent
OUT = "/tmp/wc_calibration_results.json"


def brier(p: np.ndarray, y: np.ndarray) -> float:
    return float(np.mean(np.sum((p - np.eye(3)[y]) ** 2, axis=1)))


def ece(p: np.ndarray, y: np.ndarray, bins: int = 10) -> float:
    tot = 0.0
    for k in range(3):
        conf, hit = p[:, k], (y == k).astype(float)
        e = 0.0
        for b in range(bins):
            lo, hi = b / bins, (b + 1) / bins
            m = (conf >= lo) & (conf < hi if b < bins - 1 else conf <= hi)
            if m.sum():
                e += (m.sum() / len(conf)) * abs(conf[m].mean() - hit[m].mean())
        tot += e
    return tot / 3


def temp_scale(p: np.ndarray, tau: float) -> np.ndarray:
    q = np.power(np.clip(p, 1e-9, 1), 1.0 / tau)
    return q / q.sum(axis=1, keepdims=True)


def main() -> None:
    matches = load_national_history()  # production loader: since 2018, tournament filter
    matches.sort(key=lambda m: m["date"])
    print(f"storico nazionali (filtri produzione): {len(matches)} match")

    preds: list[tuple[date, list[float], int]] = []
    for i, m in enumerate(matches):
        if m["date"] < EVAL_START:
            continue
        prior = matches[:i]
        res = national_match_probabilities(prior, m["home_team"], m["away_team"])
        if not res:
            continue
        if float(res.get("data_quality", 0.0)) < MIN_QUALITY:
            continue
        hg, ag = m["home_goals"], m["away_goals"]
        outcome = 0 if hg > ag else 1 if hg == ag else 2
        preds.append((m["date"], [res["p_team_a"], res["p_draw"], res["p_team_b"]], outcome))

    train = [(p, o) for d, p, o in preds if d < HOLDOUT_START]
    hold = [(p, o) for d, p, o in preds if d >= HOLDOUT_START]
    print(f"predizioni valide: {len(preds)} | train (<2025): {len(train)} | holdout (2025-26): {len(hold)}")

    p_tr = np.array([p for p, _ in train]); y_tr = np.array([o for _, o in train])
    p_ho = np.array([p for p, _ in hold]); y_ho = np.array([o for _, o in hold])

    print(f"\nHOLDOUT — raw (servito WC):     Brier {brier(p_ho, y_ho):.4f}   ECE {ece(p_ho, y_ho):.4f}")

    taus = np.arange(0.6, 2.01, 0.01)
    best_tau = float(min(taus, key=lambda t: brier(temp_scale(p_tr, t), y_tr)))
    p_t = temp_scale(p_ho, best_tau)
    print(f"HOLDOUT — temp (tau={best_tau:.2f}):    Brier {brier(p_t, y_ho):.4f}   ECE {ece(p_t, y_ho):.4f}")

    cal = IsotonicCalibrator().fit(p_tr.tolist(), y_tr.tolist())
    p_iso = np.array([cal.transform_one(tuple(r)) for r in p_ho])
    print(f"HOLDOUT — isotonica globale:    Brier {brier(p_iso, y_ho):.4f}   ECE {ece(p_iso, y_ho):.4f}")

    # robustness: second split (holdout 2024+, train <2024)
    train2 = [(p, o) for d, p, o in preds if d < date(2024, 1, 1)]
    hold2 = [(p, o) for d, p, o in preds if d >= date(2024, 1, 1)]
    p_tr2 = np.array([p for p, _ in train2]); y_tr2 = np.array([o for _, o in train2])
    p_h2 = np.array([p for p, _ in hold2]); y_h2 = np.array([o for _, o in hold2])
    tau2 = float(min(taus, key=lambda t: brier(temp_scale(p_tr2, t), y_tr2)))
    print(f"\nrobustezza (holdout 2024+): raw Brier {brier(p_h2, y_h2):.4f} ECE {ece(p_h2, y_h2):.4f} | "
          f"temp(tau={tau2:.2f}) Brier {brier(temp_scale(p_h2, tau2), y_h2):.4f} ECE {ece(temp_scale(p_h2, tau2), y_h2):.4f}")

    # where does miscalibration live?
    p_all = np.array([p for _, p, _ in preds]); y_all = np.array([o for _, _, o in preds])
    for k, name in enumerate(("home", "draw", "away")):
        print(f"outcome {name}: mean pred {p_all[:, k].mean():.4f} vs freq reale {(y_all == k).mean():.4f}")

    Path(OUT).write_text(json.dumps({
        "n_preds": len(preds), "n_train": len(train), "n_holdout": len(hold),
        "raw": {"brier": brier(p_ho, y_ho), "ece": ece(p_ho, y_ho)},
        "temp": {"tau": best_tau, "brier": brier(p_t, y_ho), "ece": ece(p_t, y_ho)},
        "temp_split2": {"tau": tau2},
        "iso": {"brier": brier(p_iso, y_ho), "ece": ece(p_iso, y_ho)},
    }))
    print(f"\nrisultati -> {OUT}")


if __name__ == "__main__":
    main()

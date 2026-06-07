"""Backtest of the PRODUCTION tennis model (models/elo_surface.EloSurfaceModel).

Until #CALIB-2 (2026-06-07) the tennis backtest exercised a DIFFERENT model
(models/tennis_elo.SurfaceElo) than the one served — audit finding. This
script replays the real production class chronologically over the Sackmann
ATP+WTA files in data/tennis/: predict BEFORE update, alphabetical player
ordering (outcome-independent, no label leakage), 2 years burn-in.

Reference numbers (2026-06-07, holdout 2025-26, n=8044):
  Brier 0.2209 · ECE 0.0179 · accuracy 63.6%
Calibration verdict: already well calibrated — temperature tau unstable
across splits (1.06 vs 1.00), isotonic degrades. NO calibration shipped for
tennis (evidence-based no-ship).

Read-only. Run: ./venv/bin/python scripts/backtest_tennis_production.py
"""
from __future__ import annotations

import csv
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from models.elo_surface import EloSurfaceModel  # noqa: E402

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "tennis"
BURN_IN_END = "20230101"
HOLDOUT_START = "20250101"


def brier(p: np.ndarray, y: np.ndarray) -> float:
    return float(np.mean((p - y) ** 2))


def ece(p: np.ndarray, y: np.ndarray, bins: int = 10) -> float:
    e = 0.0
    for b in range(bins):
        lo, hi = b / bins, (b + 1) / bins
        m = (p >= lo) & (p < hi if b < bins - 1 else p <= hi)
        if m.sum():
            e += (m.sum() / len(p)) * abs(p[m].mean() - y[m].mean())
    return e


def main() -> None:
    rows = []
    for f in sorted(DATA_DIR.glob("*.csv")):
        for r in csv.DictReader(open(f)):
            d = r.get("tourney_date", "")
            w, l = r.get("winner_name", ""), r.get("loser_name", "")
            s = (r.get("surface") or "hard").lower()
            if d and w and l:
                rows.append((d, w, l, s))
    rows.sort(key=lambda x: x[0])
    print(f"match Sackmann totali: {len(rows)}")

    model = EloSurfaceModel()
    preds: list[tuple[str, float, int]] = []
    for d, w, l, s in rows:
        if d >= BURN_IN_END:
            first, second = sorted([w, l])
            p = model.predict(first, second, s)
            preds.append((d, float(p["p1"]), 1 if first == w else 0))
        model.update(w, l, s)

    for start, label in ((HOLDOUT_START, "holdout 2025-26"), ("20240101", "holdout 2024 (split2)")):
        hold = [(p, o) for d, p, o in preds if d >= start] if start == HOLDOUT_START else [
            (p, o) for d, p, o in preds if "20240101" <= d < "20250101"
        ]
        p_h = np.array([p for p, _ in hold])
        y_h = np.array([float(o) for _, o in hold])
        acc = float(((p_h > 0.5) == (y_h == 1)).mean())
        print(f"{label}: n={len(hold)}  Brier {brier(p_h, y_h):.4f}  ECE {ece(p_h, y_h):.4f}  acc {acc:.4f}")


if __name__ == "__main__":
    main()

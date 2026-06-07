"""Regenerate the FROZEN artifacts for core/world_cup_elo_model (v2).

Deterministic, no leakage by construction. Recomputes World Football Elo from
data/national_teams/international_results_raw.csv with the EXACT lab logic
(scripts/lab_backtest_10y.py: K by tournament 60/50/40/30/20, MOV multiplier,
+100 home when not neutral), then:

  1. fits the winning candidate `elo2` logit on [elo_diff, |elo_diff|] over ALL
     matches with date < 2026-01-01 (the last walk-forward fold of the lab),
  2. fits the per-outcome isotonic calibration on the pre-2021 folds (the same
     train split the lab uses for its headline OOS number),
  3. writes both, plus the final team ratings snapshot, to
     data/national_teams/wc_elo_artifacts.json.

The coefficients this prints are hardcoded into core/world_cup_elo_model.py with
a comment citing this lab; the isotonic knots + rating snapshot live in the JSON
(too many knots to inline). Re-run after refreshing the CSV:

  ./.venv/bin/python scripts/freeze_wc_elo_artifacts.py
"""
from __future__ import annotations

import csv
import io
import json
from collections import defaultdict
from datetime import date
from pathlib import Path

import numpy as np
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "data" / "national_teams" / "international_results_raw.csv"
OUT_PATH = ROOT / "data" / "national_teams" / "wc_elo_artifacts.json"

ELO_INIT = 1500.0
ELO_HOME = 100.0
FREEZE_CUT = date(2026, 1, 1)      # fit logit on all data strictly before this
ISO_TRAIN_CUT = date(2021, 1, 1)   # isotonic fit on folds before 2021 (lab split)


def elo_k(tournament: str) -> float:
    t = tournament.lower()
    if t == "fifa world cup":
        return 60.0
    if any(s in t for s in ("euro", "copa américa", "copa america", "african cup",
                            "afc asian cup", "gold cup", "confederations")) and "qualification" not in t:
        return 50.0
    if "qualification" in t or "nations league" in t:
        return 40.0
    if t == "friendly":
        return 20.0
    return 30.0


def mov_mult(margin: int) -> float:
    if margin <= 1:
        return 1.0
    if margin == 2:
        return 1.5
    return 1.75 + max(0, margin - 3) / 8.0


def load_rows() -> list[dict]:
    rows = []
    with io.open(CSV_PATH, encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            try:
                hg, ag = int(r["home_score"]), int(r["away_score"])
            except (TypeError, ValueError):
                continue
            rows.append({
                "date": date.fromisoformat(r["date"]),
                "home": r["home_team"], "away": r["away_team"],
                "hg": hg, "ag": ag, "tournament": r["tournament"],
                "neutral": (r["neutral"] or "").strip().upper() == "TRUE",
            })
    rows.sort(key=lambda r: r["date"])
    return rows


def compute_ratings(rows: list[dict]) -> dict[str, float]:
    """One forward pass; stamps pre-match ratings on each row, returns finals."""
    elo: dict[str, float] = defaultdict(lambda: ELO_INIT)
    for r in rows:
        ra, rb = elo[r["home"]], elo[r["away"]]
        dr = ra - rb + (0.0 if r["neutral"] else ELO_HOME)
        we = 1.0 / (10 ** (-dr / 400) + 1)
        res = 1.0 if r["hg"] > r["ag"] else (0.5 if r["hg"] == r["ag"] else 0.0)
        k = elo_k(r["tournament"]) * mov_mult(abs(r["hg"] - r["ag"]))
        delta = k * (res - we)
        r["elo_h_pre"], r["elo_a_pre"] = ra, rb
        elo[r["home"]] = ra + delta
        elo[r["away"]] = rb - delta
    return dict(elo)


def main() -> None:
    rows = load_rows()
    finals = compute_ratings(rows)

    X, y = [], []
    for r in rows:
        if r["date"] < FREEZE_CUT:
            dr = r["elo_h_pre"] - r["elo_a_pre"] + (0.0 if r["neutral"] else ELO_HOME)
            X.append([dr, abs(dr)])
            y.append(0 if r["hg"] > r["ag"] else (1 if r["hg"] == r["ag"] else 2))
    logit = LogisticRegression(max_iter=1000)
    logit.fit(np.array(X), np.array(y))

    # raw elo2 probs on the isotonic-train side (pre-2021), then per-outcome iso
    iso_knots: dict[str, dict[str, list[float]]] = {}
    classes = list(logit.classes_)
    Xi, yi = [], []
    for r in rows:
        if r["date"] < ISO_TRAIN_CUT:
            dr = r["elo_h_pre"] - r["elo_a_pre"] + (0.0 if r["neutral"] else ELO_HOME)
            Xi.append([dr, abs(dr)])
            yi.append(0 if r["hg"] > r["ag"] else (1 if r["hg"] == r["ag"] else 2))
    raw = logit.predict_proba(np.array(Xi))
    yi_arr = np.array(yi)
    for k in range(3):
        col = classes.index(k)
        iso = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0)
        iso.fit(raw[:, col], (yi_arr == k).astype(float))
        iso_knots[str(k)] = {
            "x": [float(v) for v in iso.X_thresholds_],
            "y": [float(v) for v in iso.y_thresholds_],
        }

    artifacts = {
        "lab_source": "scripts/lab_backtest_10y.py (candidate elo2)",
        "elo_init": ELO_INIT,
        "elo_home": ELO_HOME,
        "freeze_cut": FREEZE_CUT.isoformat(),
        "iso_train_cut": ISO_TRAIN_CUT.isoformat(),
        "logit": {
            "classes": [int(c) for c in classes],
            "coef": logit.coef_.tolist(),
            "intercept": logit.intercept_.tolist(),
            "n_train": len(y),
        },
        "isotonic": iso_knots,
        "ratings": {team: round(r, 4) for team, r in sorted(finals.items())},
        "n_matches": len(rows),
    }
    OUT_PATH.write_text(json.dumps(artifacts, indent=2))

    print(f"wrote {OUT_PATH}")
    print(f"  n_matches={len(rows)}  logit n_train={len(y)}  iso n_train={len(yi)}")
    print(f"  classes={classes}")
    print(f"  coef={logit.coef_.tolist()}")
    print(f"  intercept={logit.intercept_.tolist()}")
    print(f"  Argentina={finals.get('Argentina'):.1f}  San Marino={finals.get('San Marino'):.1f}  "
          f"Brazil={finals.get('Brazil'):.1f}")


if __name__ == "__main__":
    main()

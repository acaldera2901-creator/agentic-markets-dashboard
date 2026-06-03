"""
Backtest harness — Dixon-Coles vs Poisson v1 on identical historical matches.

Walk-forward per league: for each match, train both models on all earlier matches
of that league (within the same dataset), predict 1X2, score against the real
result. Compares Brier score, log-loss, and calibration (reliability bins).

Poisson v1 here is a faithful Python port of lib/poisson-model.ts (same shrinkage
prior, same lambda construction, same 0..10 score grid) so the comparison is fair.

This produces the numbers for the promotion gate. It does NOT promote anything.

Run:  venv/bin/python -m scripts.backtest_dc_vs_poisson
"""
from __future__ import annotations

import csv
import math
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
from scipy.stats import poisson as sp_poisson

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from models.dixon_coles import DixonColesModel  # noqa: E402

DATA = ROOT / "data" / "match_results.csv"

# Mirror lib/poisson-model.ts constants.
SHRINKAGE_PRIOR = 4
MIN_TRAIN_MATCHES = 50  # need enough history before a prediction is meaningful
DC_REFIT_EVERY = 40     # refit Dixon-Coles every N matches; warm-started so params barely drift between refits


# ─── Poisson v1 port (faithful to lib/poisson-model.ts) ────────────────────────

def _mean(xs: list[float]) -> float:
    return sum(xs) / len(xs) if xs else 1.0


def _shrink(raw: float, n: int) -> float:
    return (raw * n + 1.0 * SHRINKAGE_PRIOR) / (n + SHRINKAGE_PRIOR)


def poisson_v1_predict(train: list[dict], home: str, away: str) -> tuple[float, float, float] | None:
    if len(train) < 8:
        return None
    home_goals, home_conc = defaultdict(list), defaultdict(list)
    away_goals, away_conc = defaultdict(list), defaultdict(list)
    for r in train:
        home_goals[r["home_team"]].append(r["home_goals"])
        home_conc[r["home_team"]].append(r["away_goals"])
        away_goals[r["away_team"]].append(r["away_goals"])
        away_conc[r["away_team"]].append(r["home_goals"])

    avg_home = _mean([r["home_goals"] for r in train])
    avg_away = _mean([r["away_goals"] for r in train])
    if home not in home_goals and home not in away_goals:
        return None
    if away not in away_goals and away not in home_goals:
        return None

    def strength(team: str) -> dict:
        hg, hc = home_goals[team], home_conc[team]
        ag, ac = away_goals[team], away_conc[team]
        return {
            "attack_home": _shrink(_mean(hg if hg else [avg_home]) / avg_home, len(hg)),
            "defense_home": _shrink(_mean(hc if hc else [avg_away]) / avg_away, len(hc)),
            "attack_away": _shrink(_mean(ag if ag else [avg_away]) / avg_away, len(ag)),
            "defense_away": _shrink(_mean(ac if ac else [avg_home]) / avg_home, len(ac)),
        }

    h, a = strength(home), strength(away)
    lam_h = h["attack_home"] * a["defense_away"] * avg_home
    lam_a = a["attack_away"] * h["defense_home"] * avg_away

    ph = pd_ = pa = 0.0
    for i in range(11):
        for j in range(11):
            p = sp_poisson.pmf(i, lam_h) * sp_poisson.pmf(j, lam_a)
            if i > j:
                ph += p
            elif i == j:
                pd_ += p
            else:
                pa += p
    tot = ph + pd_ + pa
    return ph / tot, pd_ / tot, pa / tot


# ─── Metrics ───────────────────────────────────────────────────────────────────

def brier_1x2(p: tuple[float, float, float], outcome: str) -> float:
    target = {"H": (1, 0, 0), "D": (0, 1, 0), "A": (0, 0, 1)}[outcome]
    return sum((pi - ti) ** 2 for pi, ti in zip(p, target))


def log_loss_1x2(p: tuple[float, float, float], outcome: str) -> float:
    idx = {"H": 0, "D": 1, "A": 2}[outcome]
    return -math.log(max(p[idx], 1e-12))


def calibration_table(preds: list[tuple[float, int]], bins: int = 10) -> list[tuple[str, int, float, float]]:
    """preds: (predicted_prob, hit). Returns (bin_label, n, avg_pred, hit_rate)."""
    buckets: dict[int, list[tuple[float, int]]] = defaultdict(list)
    for p, hit in preds:
        b = min(int(p * bins), bins - 1)
        buckets[b].append((p, hit))
    rows = []
    for b in range(bins):
        items = buckets.get(b, [])
        if not items:
            continue
        avg_pred = sum(p for p, _ in items) / len(items)
        hit_rate = sum(h for _, h in items) / len(items)
        rows.append((f"{b/bins:.1f}-{(b+1)/bins:.1f}", len(items), avg_pred, hit_rate))
    return rows


# ─── Backtest ──────────────────────────────────────────────────────────────────

def load_matches() -> dict[str, list[dict]]:
    by_league: dict[str, list[dict]] = defaultdict(list)
    with open(DATA, newline="") as f:
        for row in csv.DictReader(f):
            try:
                m = {
                    "date": row["date"],
                    "league": row["league"],
                    "home_team": row["home_team"],
                    "away_team": row["away_team"],
                    "home_goals": int(row["home_goals"]),
                    "away_goals": int(row["away_goals"]),
                }
            except (ValueError, KeyError):
                continue
            m["outcome"] = "H" if m["home_goals"] > m["away_goals"] else "D" if m["home_goals"] == m["away_goals"] else "A"
            by_league[m["league"]].append(m)
    for league in by_league:
        by_league[league].sort(key=lambda r: r["date"])
    return by_league


def run() -> None:
    by_league = load_matches()
    leagues = ["PL", "SA", "PD", "BL1", "FL1"]  # skip CL (cross-league, few per-team samples)

    dc_brier, dc_ll, poi_brier, poi_ll = [], [], [], []
    dc_cal, poi_cal = [], []  # (prob_of_pick, hit) for calibration
    n_compared = 0

    for league in leagues:
        matches = by_league.get(league, [])
        if len(matches) <= MIN_TRAIN_MATCHES:
            continue

        dc_model: DixonColesModel | None = None
        last_fit_at = -10_000

        for k in range(MIN_TRAIN_MATCHES, len(matches)):
            train = matches[:k]
            test = matches[k]
            home, away, outcome = test["home_team"], test["away_team"], test["outcome"]

            poi = poisson_v1_predict(train, home, away)
            if poi is None:
                continue

            if dc_model is None or (k - last_fit_at) >= DC_REFIT_EVERY:
                m = DixonColesModel()
                try:
                    m.fit(train, warm_start=dc_model)
                    dc_model = m
                    last_fit_at = k
                except Exception:
                    dc_model = None
            if dc_model is None or home not in dc_model._team_idx or away not in dc_model._team_idx:
                continue
            try:
                dc = dc_model.predict(home, away)
            except (KeyError, ValueError):
                continue

            dc_brier.append(brier_1x2(dc, outcome))
            dc_ll.append(log_loss_1x2(dc, outcome))
            poi_brier.append(brier_1x2(poi, outcome))
            poi_ll.append(log_loss_1x2(poi, outcome))

            idx = {"H": 0, "D": 1, "A": 2}[outcome]
            dc_pick = int(np.argmax(dc))
            poi_pick = int(np.argmax(poi))
            dc_cal.append((dc[dc_pick], 1 if dc_pick == idx else 0))
            poi_cal.append((poi[poi_pick], 1 if poi_pick == idx else 0))
            n_compared += 1

    def mean(xs: list[float]) -> float:
        return sum(xs) / len(xs) if xs else float("nan")

    print("=" * 64)
    print("BACKTEST — Dixon-Coles vs Poisson v1 (walk-forward, same matches)")
    print(f"Leagues: {', '.join(leagues)}")
    print(f"Matches compared (both models predicted): {n_compared}")
    print("=" * 64)
    print(f"{'metric':<22}{'Dixon-Coles':>16}{'Poisson v1':>16}")
    print(f"{'Brier (lower=better)':<22}{mean(dc_brier):>16.5f}{mean(poi_brier):>16.5f}")
    print(f"{'Log-loss (lower=better)':<22}{mean(dc_ll):>16.5f}{mean(poi_ll):>16.5f}")
    pick_acc_dc = mean([h for _, h in dc_cal])
    pick_acc_poi = mean([h for _, h in poi_cal])
    print(f"{'Pick accuracy':<22}{pick_acc_dc:>16.4f}{pick_acc_poi:>16.4f}")
    print("=" * 64)

    print("\nCalibration — Dixon-Coles (pick prob vs realized hit rate)")
    print(f"{'bin':<10}{'n':>6}{'avg_pred':>12}{'hit_rate':>12}")
    for label, n, ap, hr in calibration_table(dc_cal):
        print(f"{label:<10}{n:>6}{ap:>12.3f}{hr:>12.3f}")

    print("\nCalibration — Poisson v1 (pick prob vs realized hit rate)")
    print(f"{'bin':<10}{'n':>6}{'avg_pred':>12}{'hit_rate':>12}")
    for label, n, ap, hr in calibration_table(poi_cal):
        print(f"{label:<10}{n:>6}{ap:>12.3f}{hr:>12.3f}")

    def ece(cal: list[tuple[float, int]]) -> float:
        rows = calibration_table(cal)
        total = sum(n for _, n, _, _ in rows)
        return sum(n * abs(ap - hr) for _, n, ap, hr in rows) / total if total else float("nan")

    print("\nExpected Calibration Error (lower=better)")
    print(f"  Dixon-Coles: {ece(dc_cal):.4f}")
    print(f"  Poisson v1 : {ece(poi_cal):.4f}")


if __name__ == "__main__":
    run()

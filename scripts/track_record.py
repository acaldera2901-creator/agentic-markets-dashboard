"""Track-record proof from the walk-forward backtest (out-of-sample, no lookahead).

Produces citable evidence of model quality: Brier, accuracy/hit-rate, log-loss and
calibration error (ECE) on a held-out slice, for football (xG model) and tennis.
This is a statistically valid track record — train only on the past, predict the
future, never peek — equivalent in rigour to forward paper, on far more matches.

Run:  venv/bin/python -m scripts.track_record
"""
from __future__ import annotations

import sys
from collections import defaultdict
from math import log
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.tennis_data import TennisMatch  # noqa: E402
from core.understat_data import load as us_load  # noqa: E402
from models.match_features import PiRating, form_ppg, result_char  # noqa: E402
from models.poisson import PoissonModel  # noqa: E402
from models.tennis_elo import SurfaceElo  # noqa: E402
from scripts.backtest_clv import poisson_v1_predict  # noqa: E402
from scripts.backtest_tennis import Running, load_cached as load_atp  # noqa: E402
from scripts.backtest_xg import XGForm  # noqa: E402

OUTCOMES = ("H", "D", "A")


def _logloss(p, k):  # multiclass, single sample
    return -log(max(p[k], 1e-12))


def _ece(confs, hits, bins=10):
    confs, hits = np.asarray(confs), np.asarray(hits)
    e = 0.0
    for b in range(bins):
        lo, hi = b / bins, (b + 1) / bins
        m = (confs > lo) & (confs <= hi)
        if m.any():
            e += m.mean() * abs(hits[m].mean() - confs[m].mean())
    return e


def football_record():
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler
    matches = sorted(us_load(), key=lambda m: m.date)
    by_lg = defaultdict(list)
    for m in matches:
        by_lg[m.league].append(m)
    X, xg_x, poi_probs, mkt_unavail, y = [], [], [], [], []
    for lg, ms in by_lg.items():
        ms.sort(key=lambda m: m.date)
        train, pi, xg, form = [], PiRating(), XGForm(), defaultdict(list)
        for i, m in enumerate(ms):
            if i >= 60:
                poi = poisson_v1_predict(train, m.home_team, m.away_team)
                if poi:
                    X.append([poi[0], poi[1], poi[2], pi.rating_diff(m.home_team, m.away_team),
                              form_ppg(form[m.home_team]) - form_ppg(form[m.away_team])])
                    xg_x.append([xg.attack(m.home_team) - xg.attack(m.away_team),
                                 xg.defense(m.away_team) - xg.defense(m.home_team)])
                    poi_probs.append(poi); y.append(OUTCOMES.index(m.result))
            train.append(m.as_model_match())
            pi.update(m.home_team, m.away_team, m.home_goals, m.away_goals)
            xg.update(m)
            form[m.home_team].append(result_char(m.home_goals, m.away_goals))
            form[m.away_team].append(result_char(m.away_goals, m.home_goals))
    Xa = np.hstack([np.asarray(X), np.asarray(xg_x)]); ya = np.asarray(y)
    s = len(Xa) // 2
    sc = StandardScaler().fit(Xa[:s])
    clf = LogisticRegression(max_iter=2000).fit(sc.transform(Xa[:s]), ya[:s])
    p = clf.predict_proba(sc.transform(Xa[s:]))
    ey = ya[s:]
    brier = float(np.mean([sum((p[i][k] - (1 if ey[i] == k else 0)) ** 2 for k in range(3)) for i in range(len(ey))]))
    acc = float(np.mean(p.argmax(1) == ey))
    ll = float(np.mean([_logloss(p[i], ey[i]) for i in range(len(ey))]))
    ece = _ece(p.max(1), p.argmax(1) == ey)
    return {"n": len(ey), "brier": brier, "acc": acc, "logloss": ll, "ece": ece}


def tennis_record():
    ms = []
    for yr in (2021, 2022, 2023, 2024):
        ms.extend(load_atp("atp", yr))
    ms.sort(key=lambda m: m.date)
    elo, rs = SurfaceElo(), Running()
    probs, y = [], []
    for i, m in enumerate(ms):
        p1, p2 = sorted([m.winner, m.loser])
        if i >= 800:
            probs.append(elo.expected(p1, p2, m.surface)); y.append(1 if p1 == m.winner else 0)
        elo.update(m.winner, m.loser, m.surface); rs.update(m)
    probs, y = np.asarray(probs), np.asarray(y)
    s = len(probs) // 2
    pe, ye = probs[s:], y[s:]
    brier = float(np.mean((pe - ye) ** 2))
    acc = float(np.mean((pe > 0.5) == ye))
    conf = np.where(pe > 0.5, pe, 1 - pe)
    hit = np.where(pe > 0.5, ye, 1 - ye)
    return {"n": len(ye), "brier": brier, "acc": acc, "ece": _ece(conf, hit)}


def run():
    fb = football_record()
    tn = tennis_record()
    print("=== TRACK RECORD (out-of-sample walk-forward) ===")
    print(f"FOOTBALL (xG model, {fb['n']} held-out matches, 5 leagues, 2021-24)")
    print(f"  Brier {fb['brier']:.4f} | Accuracy {fb['acc']:.1%} | LogLoss {fb['logloss']:.4f} | ECE {fb['ece']:.4f}")
    print(f"  Reference: market (Pinnacle) Brier ~0.575; goals-only base ~0.589")
    print(f"TENNIS (surface-Elo, {tn['n']} held-out ATP matches, 2021-24)")
    print(f"  Brier {tn['brier']:.4f} | Accuracy {tn['acc']:.1%} | ECE {tn['ece']:.4f}")
    print("Market test (football, vs Pinnacle closing): value picks ROI -5..-6% =")
    print("  we do NOT beat the closing line -> product sells calibrated probabilities, not edge.")


if __name__ == "__main__":
    run()

"""
Walk-forward selection of the confidence floor for surfacing a directional pick.

Honest protocol (NOT in-sample):
  * Per-match probabilities are already leak-free walk-forward (each season's
    blend uses only prior seasons), reusing the proven club recipe from
    lab_segment_patterns_10y (Elo + season-refit logit + 0.3/0.7 market blend).
  * We then split those test matches by TIME: FLOOR-TRAIN = 2017-18..2021-22,
    FLOOR-TEST = 2022-23..now. The floor is CHOSEN on floor-train and VALIDATED
    on the held-out floor-test. A floor that holds out-of-sample is real.

Selection rule: smallest floor whose floor-train hit-rate >= TARGET. We report
two targets (0.65 = "right ~2 in 3", 0.70) and the held-out test hit-rate + the
fraction of picks kept, so the volume/quality trade-off is explicit.

Confidence floor is on max(blended prob); served confidence_score = round(that*100),
so floor 0.60 == confidence_score >= 60.

Run: PYTHONUTF8=1 .venv/Scripts/python.exe C:/Users/bragh/am-lab/threshold_walkforward.py
"""
from __future__ import annotations
import sys
from pathlib import Path
import numpy as np
from sklearn.linear_model import LogisticRegression

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lab_segment_patterns_10y import load_rows, season_of, mov_mult, ELO_INIT_T1, ELO_INIT_T2, ELO_HOME, ELO_K, FIRST_TEST_SEASON

FLOOR_TRAIN_END = 2022  # floor-train = seasons < 2022 (2017-18..2021-22); test = 2022-23..now


def build_recs():
    rows = load_rows()
    elo = {}
    for r in rows:
        for team in (r["home"], r["away"]):
            elo.setdefault(team, ELO_INIT_T2 if r["tier2"] else ELO_INIT_T1)
        ra, rb = elo[r["home"]], elo[r["away"]]
        r["elo_h_pre"], r["elo_a_pre"] = ra, rb
        dr = ra - rb + ELO_HOME
        we = 1.0 / (10 ** (-dr / 400) + 1)
        res = 1.0 if r["hg"] > r["ag"] else (0.5 if r["hg"] == r["ag"] else 0.0)
        delta = ELO_K * mov_mult(abs(r["hg"] - r["ag"])) * (res - we)
        elo[r["home"]] = ra + delta; elo[r["away"]] = rb - delta

    recs = []
    for ts in range(FIRST_TEST_SEASON, 2027):
        X, Y = [], []
        for r in rows:
            if season_of(r["date"]) < ts:
                d = r["elo_h_pre"] - r["elo_a_pre"]; X.append([d, abs(d)])
                Y.append(0 if r["hg"] > r["ag"] else (1 if r["hg"] == r["ag"] else 2))
        if len(X) < 2000:
            continue
        lg = LogisticRegression(max_iter=1000); lg.fit(np.array(X), np.array(Y)); order = list(lg.classes_)
        for r in rows:
            if season_of(r["date"]) != ts or not r["odds"]:
                continue
            y = 0 if r["hg"] > r["ag"] else (1 if r["hg"] == r["ag"] else 2)
            inv = [1/o for o in r["odds"]]; s = sum(inv); p_mkt = [x/s for x in inv]
            d = r["elo_h_pre"] - r["elo_a_pre"]
            pe = lg.predict_proba(np.array([[d, abs(d)]]))[0]
            p_elo = [float(pe[order.index(k)]) for k in range(3)]
            p_bl = [0.3*a + 0.7*b for a, b in zip(p_elo, p_mkt)]
            recs.append({"y": y, "season": ts, "p": p_bl, "maxp": max(p_bl),
                         "hit": max(range(3), key=lambda k: p_bl[k]) == y})
    return recs


def hr(sel):
    return (sum(r["hit"] for r in sel) / len(sel)) if sel else float("nan")


def main():
    recs = build_recs()
    train = [r for r in recs if r["season"] < FLOOR_TRAIN_END]
    test = [r for r in recs if r["season"] >= FLOOR_TRAIN_END]
    print(f"# recs={len(recs)}  floor-train(2017-21)={len(train)}  floor-test(2022+)={len(test)}")
    print(f"# baseline (no floor): train hit={hr(train):.3f}  test hit={hr(test):.3f}\n")

    floors = [round(x, 2) for x in np.arange(0.45, 0.81, 0.025)]
    print("floor | train_hit train_keep% | TEST_hit TEST_keep%")
    for f in floors:
        tr = [r for r in train if r["maxp"] >= f]
        te = [r for r in test if r["maxp"] >= f]
        if not tr or not te:
            continue
        print(f" {f:4.2f} |   {hr(tr):.3f}    {100*len(tr)/len(train):5.1f}   |  {hr(te):.3f}   {100*len(te)/len(test):5.1f}")

    print("\n=== SELECTION (smallest floor with train hit-rate >= target) ===")
    for target in (0.65, 0.70):
        chosen = None
        for f in floors:
            tr = [r for r in train if r["maxp"] >= f]
            if tr and hr(tr) >= target:
                chosen = f; break
        if chosen is None:
            print(f"  target {target:.0%}: not reached"); continue
        te = [r for r in test if r["maxp"] >= chosen]
        print(f"  target {target:.0%}: floor={chosen:.2f} (confidence_score>={int(chosen*100)})  "
              f"-> HELD-OUT test hit={hr(te):.3f}  keeps {100*len(te)/len(test):.1f}% of picks (n={len(te)})")


if __name__ == "__main__":
    main()

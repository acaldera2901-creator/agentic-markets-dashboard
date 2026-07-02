"""#GOALSCORER-FEATURES — do extra features beat the season goals/90 rate?

Same walk-forward as backtest_goalscorer.py, but for each player we compute the scoring
rate three ways and compare the resulting P(scores) out-of-sample (Brier + calibration):

  A) SEASON   : cumulative goals / (cumulative minutes/90)                [current model]
  B) RECENCY  : exponentially time-decayed rate (recent matches weigh more)
  C) HOME/AWAY: side-specific rate (home rate when home, away rate when away)

Ship a feature only if it improves OOS. Data: data/player_backfill (5 leagues + WC).
Run:  .venv/bin/python -m scripts.backtest_goalscorer_features
"""
from __future__ import annotations

import json
import math
from collections import defaultdict, deque
from pathlib import Path

import numpy as np
from sklearn.isotonic import IsotonicRegression

ROOT = Path(__file__).resolve().parents[1]
BACKFILL = ROOT / "data" / "player_backfill"
MIN_MATCHES, MIN_MIN = 3, 180
DECAY = 0.90  # per-match decay for recency (half-life ~6.6 matches)


def load():
    out = []
    for fp in sorted(BACKFILL.glob("*.json")):
        for fid, m in json.loads(fp.read_text()).items():
            m["league"] = fp.stem.rsplit("_", 1)[0]
            out.append(m)
    out.sort(key=lambda x: x["date"])
    return out


def run():
    fx = load()
    print(f"fixtures: {len(fx)}")
    # per-player state
    g = defaultdict(float); mn = defaultdict(float); nm = defaultdict(int)     # season cumul
    wg = defaultdict(float); wm = defaultdict(float)                            # decayed cumul
    hg = defaultdict(float); hm = defaultdict(float); ag = defaultdict(float); am = defaultdict(float)  # home/away
    tg = defaultdict(float); tn = defaultdict(int)                              # team goals

    P = {"A": [], "B": [], "C": []}; Y = []; dates = []

    for m in fx:
        home, away = m["home"], m["away"]
        lam_t = {home: (tg[home] / tn[home]) if tn[home] else None,
                 away: (tg[away] / tn[away]) if tn[away] else None}
        players = m.get("players") or []
        # build team groups with the three rate variants
        groups = defaultdict(list)
        for p in players:
            pid, team, mins = p["id"], p["team"], p["min"]
            if nm[pid] < MIN_MATCHES or mn[pid] < MIN_MIN:
                continue
            is_home = team == home
            r_season = g[pid] / (mn[pid] / 90.0)
            r_recent = (wg[pid] / (wm[pid] / 90.0)) if wm[pid] > 0 else r_season
            side_g, side_m = (hg[pid], hm[pid]) if is_home else (ag[pid], am[pid])
            r_side = (side_g / (side_m / 90.0)) if side_m >= 90 else r_season  # fallback if thin
            mshare = min(1.0, max(0.0, (mn[pid] / nm[pid]) / 90.0))
            groups[team].append({"scored": 1 if p["goals"] > 0 else 0, "played": mins > 0,
                                 "mshare": mshare, "A": r_season, "B": r_recent, "C": r_side})
        for team, ps in groups.items():
            lt = lam_t.get(team)
            if not lt or lt <= 0:
                continue
            for key in ("A", "B", "C"):
                den = sum(x[key] * x["mshare"] for x in ps)
                if den <= 0:
                    continue
                for x in ps:
                    if not x["played"]:
                        continue
                    lam = lt * (x[key] * x["mshare"] / den)
                    x["p_" + key] = 1 - math.exp(-lam)
            for x in ps:
                if x["played"] and all(("p_" + k) in x for k in ("A", "B", "C")):
                    for k in ("A", "B", "C"):
                        P[k].append(x["p_" + k])
                    Y.append(x["scored"]); dates.append(m["date"])

        # update state AFTER match
        for p in players:
            pid, team = p["id"], p["team"]
            gg, mm = p["goals"], p["min"]
            g[pid] += gg; mn[pid] += mm; nm[pid] += 1
            wg[pid] = wg[pid] * DECAY + gg; wm[pid] = wm[pid] * DECAY + mm
            if team == home:
                hg[pid] += gg; hm[pid] += mm
            else:
                ag[pid] += gg; am[pid] += mm
        tg[home] += m["gh"] or 0; tn[home] += 1
        tg[away] += m["ga"] or 0; tn[away] += 1

    Y = np.array(Y); n = len(Y)
    order = np.argsort(dates); cut = int(n * 0.6)
    tr, te = order[:cut], order[cut:]
    print(f"\neval samples: {n} | actual rate {Y.mean():.4f} | OOS test {len(te)}")
    print(f"{'feature':<26}{'Brier(raw)':>12}{'Brier(cal)':>12}{'meanP':>9}")
    print("-" * 60)
    names = {"A": "A season (current)", "B": "B recency-decayed", "C": "C home/away split"}
    for k in ("A", "B", "C"):
        arr = np.array(P[k])
        iso = IsotonicRegression(out_of_bounds="clip", y_min=0, y_max=1).fit(arr[tr], Y[tr])
        b_raw = float(np.mean((arr[te] - Y[te]) ** 2))
        b_cal = float(np.mean((iso.predict(arr[te]) - Y[te]) ** 2))
        print(f"{names[k]:<26}{b_raw:>12.5f}{b_cal:>12.5f}{arr[te].mean():>9.4f}")
    print("\n(lower Brier = better; ship a feature only if it clearly beats A)")


if __name__ == "__main__":
    run()

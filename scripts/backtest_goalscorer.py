"""Goalscorer calibration backtest — does the model's P(scores) match reality?

Walk-forward on the locally backfilled player-match data (scripts/backfill_player_match_local.py,
API-Football /fixtures/players). For each match, for each player who played, we compute the
anytime-scorer probability with BOTH the OLD and the NEW allocation and compare to the actual
outcome (scored yes/no). This MEASURES what the #GOALSCORER-CALIB-1 fix argued in the unit test:
the old share normalization under-allocated goals → under-predicted P(scores); the new one
conserves Σλ = teamλ and should be better calibrated.

  OLD:  share = g90/Σg90 ; λ = teamλ · share · minutesShare
  NEW:  w = g90·minutesShare ; share = w/Σw ; λ = teamλ · share
  P(scores) = 1 - exp(-λ)

Metrics: Brier + calibration (mean predicted vs actual scoring rate; reliability by bin).

Run:  .venv/bin/python -m scripts.backtest_goalscorer
"""
from __future__ import annotations

import json
import math
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKFILL = ROOT / "data" / "player_backfill"
MIN_MATCHES = 3      # player needs some history before we predict
MIN_MINUTES = 180


def load_fixtures() -> list[dict]:
    out = []
    for fp in sorted(BACKFILL.glob("*.json")):
        league = fp.stem.rsplit("_", 1)[0]  # "PL_2023" -> "PL", "WC_2026" -> "WC"
        for fid, m in json.loads(fp.read_text()).items():
            m["fixture_id"] = fid
            m["league"] = league
            out.append(m)
    out.sort(key=lambda x: x["date"])
    return out


def run() -> None:
    fixtures = load_fixtures()
    print(f"backfilled fixtures: {len(fixtures)}")
    if not fixtures:
        print("no backfill data yet — run scripts.backfill_player_match_local first")
        return

    pg = defaultdict(float); pm = defaultdict(float); pn = defaultdict(int)   # player goals/minutes/matches
    tg = defaultdict(float); tn = defaultdict(int)                            # team goals scored / matches

    old_b, new_b = [], []          # brier
    old_p, new_p, y_all, dates_all, leagues_all = [], [], [], [], []
    n_eval = 0

    for fx in fixtures:
        players = fx.get("players") or []
        home, away = fx["home"], fx["away"]
        # team λ (pre-match avg goals scored)
        lam_team = {home: (tg[home] / tn[home]) if tn[home] else None,
                    away: (tg[away] / tn[away]) if tn[away] else None}

        # group players by team with pre-match history
        by_team = defaultdict(list)
        for p in players:
            pid, team, mins = p["id"], p["team"], p["min"]
            if pn[pid] >= MIN_MATCHES and pm[pid] >= MIN_MINUTES:
                g90 = pg[pid] / (pm[pid] / 90.0)
                mshare = min(1.0, max(0.0, (pm[pid] / pn[pid]) / 90.0))
                by_team[team].append({"pid": pid, "g90": g90, "mshare": mshare,
                                      "played": mins > 0, "scored": 1 if p["goals"] > 0 else 0})

        for team, ps in by_team.items():
            lt = lam_team.get(team)
            if not lt or lt <= 0:
                continue
            # denominators
            den_old = sum(x["g90"] for x in ps)
            den_new = sum(x["g90"] * x["mshare"] for x in ps)
            if den_old <= 0 or den_new <= 0:
                continue
            for x in ps:
                if not x["played"]:
                    continue  # calibration among players who actually took the pitch
                lam_old = lt * (x["g90"] / den_old) * x["mshare"]
                lam_new = lt * (x["g90"] * x["mshare"] / den_new)
                po = 1 - math.exp(-lam_old)
                pnw = 1 - math.exp(-lam_new)
                y = x["scored"]
                old_b.append((po - y) ** 2); new_b.append((pnw - y) ** 2)
                old_p.append(po); new_p.append(pnw); y_all.append(y); dates_all.append(fx["date"]); leagues_all.append(fx["league"])
                n_eval += 1

        # update AFTER the match
        for p in players:
            pid = p["id"]
            pg[pid] += p["goals"]; pm[pid] += p["min"]; pn[pid] += 1
        tg[home] += fx["gh"] or 0; tn[home] += 1
        tg[away] += fx["ga"] or 0; tn[away] += 1

    if not n_eval:
        print("no eval samples (need more backfilled history)")
        return
    mean = lambda a: sum(a) / len(a)
    actual = mean(y_all)
    print(f"\nEval player-matches: {n_eval}  |  actual scoring rate: {actual:.4f}")
    print(f"{'Model':<8}{'Brier':>10}{'mean P':>10}{'calib gap':>12}")
    print("-" * 42)
    print(f"{'OLD':<8}{mean(old_b):>10.5f}{mean(old_p):>10.4f}{mean(old_p) - actual:>+12.4f}")
    print(f"{'NEW':<8}{mean(new_b):>10.5f}{mean(new_p):>10.4f}{mean(new_p) - actual:>+12.4f}")
    print("\n(calib gap = mean predicted − actual; closer to 0 = better calibrated)")
    # reliability by predicted-prob bin (NEW)
    print("\nreliability (NEW): bin  n   pred   actual")
    edges = [0, 0.05, 0.10, 0.20, 0.35, 1.0]
    for i in range(len(edges) - 1):
        lo, hi = edges[i], edges[i + 1]
        idx = [k for k, pp in enumerate(new_p) if (pp > lo if i else pp >= lo) and pp <= hi]
        if idx:
            print(f"  {lo:.2f}-{hi:.2f}  {len(idx):>4}  {mean([new_p[k] for k in idx]):.3f}  {mean([y_all[k] for k in idx]):.3f}")

    # ── ISOTONIC CALIBRATION: fit on the earliest 60% (by date), test on the last 40% ──
    import numpy as np
    from sklearn.isotonic import IsotonicRegression
    order = sorted(range(len(new_p)), key=lambda k: dates_all[k])
    cut = int(len(order) * 0.6)
    tr, te = order[:cut], order[cut:]
    xtr = np.array([new_p[k] for k in tr]); ytr = np.array([y_all[k] for k in tr])
    xte = np.array([new_p[k] for k in te]); yte = np.array([y_all[k] for k in te])
    iso = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0).fit(xtr, ytr)
    cal_te = iso.predict(xte)
    b_raw = float(np.mean((xte - yte) ** 2)); b_cal = float(np.mean((cal_te - yte) ** 2))
    print(f"\n── ISOTONIC (train {len(tr)} → test {len(te)}, out-of-sample) ──")
    print(f"  NEW raw       : Brier {b_raw:.5f}  mean P {xte.mean():.4f}  (actual {yte.mean():.4f})")
    print(f"  NEW+isotonic  : Brier {b_cal:.5f}  mean P {cal_te.mean():.4f}")
    print(f"  reliability top bin (p>0.35): raw pred {xte[xte>0.35].mean() if (xte>0.35).any() else float('nan'):.3f} "
          f"→ cal {cal_te[xte>0.35].mean() if (xte>0.35).any() else float('nan'):.3f}  actual {yte[xte>0.35].mean() if (xte>0.35).any() else float('nan'):.3f}")

    # ── PER-LEAGUE vs GLOBAL: does a league-specific curve beat the global one OOS? ──
    xs = np.linspace(0, 0.8, 33)
    def curve_of(iso_):
        return [[round(float(x), 4), round(float(iso_.predict([x])[0]), 4)] for x in xs]
    P, Y, L, D = np.array(new_p), np.array(y_all), np.array(leagues_all), np.array(dates_all)
    MIN_TRAIN = 3000  # a per-league curve needs enough train samples to be trustworthy
    iso_global_full = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0).fit(P, Y)

    print("\n── PER-LEAGUE calibration (OOS, 60/40 by date within league) ──")
    print(f"{'league':<6}{'n':>7}{'Brier raw':>11}{'glob-cal':>10}{'league-cal':>12}  winner")
    league_curves = {}
    for lg in sorted(set(leagues_all)):
        idx = [k for k in range(len(P)) if L[k] == lg]
        idx.sort(key=lambda k: D[k])
        c = int(len(idx) * 0.6)
        if c < 500 or len(idx) - c < 300:
            print(f"{lg:<6}{len(idx):>7}   (too few samples → global fallback)")
            continue
        tr_l, te_l = idx[:c], idx[c:]
        xtr_l, ytr_l = P[tr_l], Y[tr_l]
        xte_l, yte_l = P[te_l], Y[te_l]
        iso_l = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0).fit(xtr_l, ytr_l)
        b_raw_l = float(np.mean((xte_l - yte_l) ** 2))
        b_glob = float(np.mean((iso.predict(xte_l) - yte_l) ** 2))       # global curve (train-fit)
        b_lg = float(np.mean((iso_l.predict(xte_l) - yte_l) ** 2))       # per-league curve
        win = "league" if (b_lg < b_glob - 1e-5 and len(tr_l) >= MIN_TRAIN) else "global"
        print(f"{lg:<6}{len(idx):>7}{b_raw_l:>11.5f}{b_glob:>10.5f}{b_lg:>12.5f}  {win}")
        if win == "league":
            # ship a per-league curve fit on 100% of that league's data
            iso_l_full = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0).fit(P[idx], Y[idx])
            league_curves[lg] = curve_of(iso_l_full)

    out = ROOT / "data" / "goalscorer_calibration.json"
    out.write_text(json.dumps({
        "method": "isotonic", "n_train_all": len(new_p),
        "global": curve_of(iso_global_full),
        "leagues": league_curves,  # only leagues that beat global OOS with enough data
    }, indent=2))
    print(f"\n  exported → {out.relative_to(ROOT)}: global + {len(league_curves)} per-league curves "
          f"({sorted(league_curves)})")


if __name__ == "__main__":
    sys.exit(run())

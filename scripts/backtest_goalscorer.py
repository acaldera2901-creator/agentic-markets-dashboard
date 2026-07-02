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
        for fid, m in json.loads(fp.read_text()).items():
            m["fixture_id"] = fid
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
    old_p, new_p, y_all = [], [], []
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
                old_p.append(po); new_p.append(pnw); y_all.append(y)
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


if __name__ == "__main__":
    sys.exit(run())

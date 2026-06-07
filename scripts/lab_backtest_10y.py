"""
LAB — 10-year walk-forward backtest of the WC national-team model + candidate upgrades.

Analysis only (michele-side lab): does NOT touch any served model. Mirrors the
production logic bit-for-bit (core/world_cup_probability.national_match_probabilities
formulas) and pits it against literature-backed variants on ~10k internationals
(2016 → today, walk-forward by year, no leakage).

Models compared
  prod      — production replica: 5y-window goal-rate profiles -> independent
              Poisson grid (lambda_a = att_a * def_b / mu), neutral venue.
  prod_dc   — prod + Dixon-Coles tau low-score correction, rho fitted on train.
  decay     — prod with exp time-decay (half-life 2y) + friendlies at half weight.
  elo       — World Football Elo (recomputed from 1872, K by tournament, MOV
              multiplier, +100 home when not neutral) -> multinomial logit on
              elo_diff (KU Leuven-style), refit each test year.
  elo_dc    — 50/50 blend of elo and prod_dc.

All models get the same post-hoc per-outcome isotonic calibration fitted on the
train side of each fold (mirrors the production isotonic stage).

Run:  PYTHONUTF8=1 python scripts/lab_backtest_10y.py
"""
from __future__ import annotations

import csv
import io
import math
import sys
from bisect import bisect_left
from collections import defaultdict
from datetime import date
from pathlib import Path

import numpy as np
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "data" / "national_teams" / "international_results_raw.csv"

FIRST_TEST_YEAR = 2016
LAST_TEST_DATE = date(2026, 6, 7)
WINDOW_YEARS = 5          # production history window (loader ships ~5y of data)
MIN_MATCHES = 15          # prod gate: quality = n/20 >= 0.75
MAX_GOALS = 10
EPS = 1e-12

# ── Elo (World Football Elo Ratings, eloratings.net formula) ──────────────────
ELO_INIT = 1500.0
ELO_HOME = 100.0

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


# ── data loading ───────────────────────────────────────────────────────────────
def load_rows() -> list[dict]:
    rows = []
    with io.open(CSV_PATH, encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            try:
                hg, ag = int(r["home_score"]), int(r["away_score"])
            except (TypeError, ValueError):
                continue
            d = date.fromisoformat(r["date"])
            rows.append({
                "date": d, "home": r["home_team"], "away": r["away_team"],
                "hg": hg, "ag": ag, "tournament": r["tournament"],
                "neutral": (r["neutral"] or "").strip().upper() == "TRUE",
            })
    rows.sort(key=lambda r: r["date"])
    return rows


# ── fast per-team windowed profiles (replicates core/world_cup_team_model) ────
class TeamIndex:
    """Per-team chronological rows + prefix sums for O(log n) window profiles."""

    def __init__(self, rows: list[dict]):
        self.by_team: dict[str, dict[str, list]] = defaultdict(
            lambda: {"dates": [], "gf": [0], "ga": [0], "pts": [0], "wgf": [0], "wga": [0], "w": [0.0]})
        self.glob_dates: list[date] = []
        self.glob_goals = [0]   # prefix sum of total goals
        self.glob_n = [0]
        for r in rows:
            self.glob_dates.append(r["date"])
            self.glob_goals.append(self.glob_goals[-1] + r["hg"] + r["ag"])
            self.glob_n.append(self.glob_n[-1] + 1)
            for team, gf, ga in ((r["home"], r["hg"], r["ag"]), (r["away"], r["ag"], r["hg"])):
                t = self.by_team[team]
                pts = 3 if gf > ga else (1 if gf == ga else 0)
                t["dates"].append(r["date"])
                t["gf"].append(t["gf"][-1] + gf)
                t["ga"].append(t["ga"][-1] + ga)
                t["pts"].append(t["pts"][-1] + pts)

    def profile(self, team: str, start: date, end: date):
        """(n, gf_pm, ga_pm) for team matches with start <= date < end."""
        t = self.by_team.get(team)
        if not t:
            return None
        lo = bisect_left(t["dates"], start)
        hi = bisect_left(t["dates"], end)
        n = hi - lo
        if n <= 0:
            return None
        gf = (t["gf"][hi] - t["gf"][lo]) / n
        ga = (t["ga"][hi] - t["ga"][lo]) / n
        return n, gf, ga

    def mu(self, start: date, end: date) -> float:
        lo = bisect_left(self.glob_dates, start)
        hi = bisect_left(self.glob_dates, end)
        n = self.glob_n[hi] - self.glob_n[lo]
        if n == 0:
            return 1.25
        return max((self.glob_goals[hi] - self.glob_goals[lo]) / (2 * n), 0.1)


# ── Poisson machinery ──────────────────────────────────────────────────────────
def pois_grid(lam_a: float, lam_b: float, rho: float = 0.0):
    """1X2 probs from independent Poisson grid, optional Dixon-Coles tau."""
    pa = [math.exp(-lam_a) * lam_a**k / math.factorial(k) for k in range(MAX_GOALS + 1)]
    pb = [math.exp(-lam_b) * lam_b**k / math.factorial(k) for k in range(MAX_GOALS + 1)]
    p_a = p_d = p_b_ = 0.0
    for ga in range(MAX_GOALS + 1):
        for gb in range(MAX_GOALS + 1):
            p = pa[ga] * pb[gb]
            if rho:
                if ga == 0 and gb == 0:
                    p *= 1 - lam_a * lam_b * rho
                elif ga == 0 and gb == 1:
                    p *= 1 + lam_a * rho
                elif ga == 1 and gb == 0:
                    p *= 1 + lam_b * rho
                elif ga == 1 and gb == 1:
                    p *= 1 - rho
            if ga > gb:
                p_a += p
            elif ga == gb:
                p_d += p
            else:
                p_b_ += p
    tot = p_a + p_d + p_b_
    return p_a / tot, p_d / tot, p_b_ / tot


def prod_lambdas(idx: TeamIndex, home: str, away: str, d: date,
                 *, weighted: dict | None = None):
    """Production lambda formulas over the trailing window. Returns None if a
    profile is missing or below the prod quality gate (n < MIN_MATCHES)."""
    start = date(d.year - WINDOW_YEARS, d.month, min(d.day, 28))
    if weighted is not None:
        pa = weighted_profile(weighted, home, start, d)
        pb = weighted_profile(weighted, away, start, d)
        mu = weighted_mu(weighted, start, d)
    else:
        pa = idx.profile(home, start, d)
        pb = idx.profile(away, start, d)
        mu = idx.mu(start, d)
    if not pa or not pb or pa[0] < MIN_MATCHES or pb[0] < MIN_MATCHES:
        return None
    lam_a = max(pa[1] * (pb[2] / mu), 0.05)
    lam_b = max(pb[1] * (pa[2] / mu), 0.05)
    return lam_a, lam_b


# ── decay variant: weighted profiles (half-life 2y, friendlies x0.5) ──────────
HALF_LIFE_Y = 2.0
FRIENDLY_W = 0.5

def build_weighted(rows: list[dict]):
    per_team: dict[str, list] = defaultdict(list)   # (date, gf, ga, w_base)
    glob: list = []                                  # (date, goals, w_base)
    for r in rows:
        wb = FRIENDLY_W if r["tournament"] == "Friendly" else 1.0
        glob.append((r["date"], r["hg"] + r["ag"], wb))
        per_team[r["home"]].append((r["date"], r["hg"], r["ag"], wb))
        per_team[r["away"]].append((r["date"], r["ag"], r["hg"], wb))
    return {"per_team": per_team, "glob": glob}

def _decay_w(age_days: int) -> float:
    return math.exp(-math.log(2) * age_days / (HALF_LIFE_Y * 365.25))

def weighted_profile(w, team, start, end):
    rows = w["per_team"].get(team)
    if not rows:
        return None
    n_raw, sw, sgf, sga = 0, 0.0, 0.0, 0.0
    for d, gf, ga, wb in rows:
        if start <= d < end:
            n_raw += 1
            k = wb * _decay_w((end - d).days)
            sw += k
            sgf += k * gf
            sga += k * ga
    if n_raw == 0 or sw <= 0:
        return None
    return n_raw, sgf / sw, sga / sw

def weighted_mu(w, start, end):
    sw = sg = 0.0
    for d, goals, wb in w["glob"]:
        if start <= d < end:
            k = wb * _decay_w((end - d).days)
            sw += k
            sg += k * goals
    if sw <= 0:
        return 1.25
    return max(sg / (2 * sw), 0.1)


# ── Dixon-Coles rho fit (grid search, train side) ─────────────────────────────
def fit_rho(train_samples) -> float:
    """train_samples: list of (lam_a, lam_b, hg, ag). Max joint LL on the grid."""
    best_rho, best_ll = 0.0, -math.inf
    for rho in [x / 1000 for x in range(-200, 55, 5)]:
        ll = 0.0
        ok = True
        for lam_a, lam_b, hg, ag in train_samples:
            p = (math.exp(-lam_a) * lam_a**hg / math.factorial(hg)
                 * math.exp(-lam_b) * lam_b**ag / math.factorial(ag))
            if hg == 0 and ag == 0:
                p *= 1 - lam_a * lam_b * rho
            elif hg == 0 and ag == 1:
                p *= 1 + lam_a * rho
            elif hg == 1 and ag == 0:
                p *= 1 + lam_b * rho
            elif hg == 1 and ag == 1:
                p *= 1 - rho
            if p <= 0:
                ok = False
                break
            ll += math.log(p)
        if ok and ll > best_ll:
            best_ll, best_rho = ll, rho
    return best_rho


# ── metrics ────────────────────────────────────────────────────────────────────
def brier3(p, y):
    t = [0.0, 0.0, 0.0]
    t[y] = 1.0
    return sum((pi - ti) ** 2 for pi, ti in zip(p, t))

def ece_3way(probs, ys, bins=10):
    eces = []
    for k in range(3):
        tot, e = 0, 0.0
        for b in range(bins):
            lo, hi = b / bins, (b + 1) / bins
            sel = [(p[k], 1.0 if y == k else 0.0) for p, y in zip(probs, ys) if lo <= p[k] < hi]
            if not sel:
                continue
            avg_p = sum(s[0] for s in sel) / len(sel)
            avg_y = sum(s[1] for s in sel) / len(sel)
            e += len(sel) * abs(avg_p - avg_y)
            tot += len(sel)
        eces.append(e / tot if tot else 0.0)
    return sum(eces) / 3


def summarize(name, recs):
    probs = [r["p"] for r in recs]
    ys = [r["y"] for r in recs]
    n = len(recs)
    br = sum(brier3(p, y) for p, y in zip(probs, ys)) / n
    ll = sum(-math.log(max(p[y], EPS)) for p, y in zip(probs, ys)) / n
    acc = sum(1 for p, y in zip(probs, ys) if max(range(3), key=lambda k: p[k]) == y) / n
    ece = ece_3way(probs, ys)
    pred_draw = sum(p[1] for p in probs) / n
    act_draw = sum(1 for y in ys if y == 1) / n
    print(f"{name:11s} n={n:5d}  Brier={br:.4f}  LL={ll:.4f}  acc={acc:.3f}  "
          f"ECE={ece:.4f}  draw pred/act={pred_draw:.3f}/{act_draw:.3f}")
    return {"name": name, "n": n, "brier": br, "ll": ll, "acc": acc, "ece": ece}


def isotonic_apply(train, test):
    """Per-outcome isotonic fitted on train, renormalized (mirrors prod stage)."""
    if not train or not test:
        return test
    out = []
    isos = []
    for k in range(3):
        x = np.array([r["p"][k] for r in train])
        y = np.array([1.0 if r["y"] == k else 0.0 for r in train])
        iso = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0)
        iso.fit(x, y)
        isos.append(iso)
    for r in test:
        cal = [float(isos[k].predict([r["p"][k]])[0]) for k in range(3)]
        s = sum(cal)
        cal = [c / s for c in cal] if s > 0 else r["p"]
        out.append({**r, "p": cal})
    return out


# ── main ───────────────────────────────────────────────────────────────────────
def main():
    rows = load_rows()
    idx = TeamIndex(rows)
    weighted = build_weighted(rows)

    # Elo over the full history (pre-match ratings, no leakage by construction)
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

    results = {m: [] for m in ("prod", "prod_dc", "decay", "elo", "elo2", "elo_dc")}

    for test_year in range(FIRST_TEST_YEAR, 2027):
        cut = date(test_year, 1, 1)
        test_end = date(test_year + 1, 1, 1)
        test = [r for r in rows if cut <= r["date"] < test_end and r["date"] <= LAST_TEST_DATE]
        if not test:
            continue

        # train-side artifacts for this fold
        # 1) rho on the 3 years before the cut, using prod lambdas (no leakage)
        rho_train = []
        for r in rows:
            if date(test_year - 3, 1, 1) <= r["date"] < cut:
                lams = prod_lambdas(idx, r["home"], r["away"], r["date"])
                if lams:
                    rho_train.append((lams[0], lams[1], r["hg"], r["ag"]))
        rho = fit_rho(rho_train) if len(rho_train) > 300 else 0.0

        # 2) elo logit on the 10 years before the cut
        X_tr, y_tr = [], []
        for r in rows:
            if date(test_year - 10, 1, 1) <= r["date"] < cut:
                dr = r["elo_h_pre"] - r["elo_a_pre"] + (0.0 if r["neutral"] else ELO_HOME)
                X_tr.append([dr])
                y_tr.append(0 if r["hg"] > r["ag"] else (1 if r["hg"] == r["ag"] else 2))
        logit = LogisticRegression(max_iter=1000)
        logit.fit(np.array(X_tr), np.array(y_tr))
        # elo2: + |dr| (closeness -> draws) — draw-aware variant
        X2_tr = np.array([[x[0], abs(x[0])] for x in X_tr])
        logit2 = LogisticRegression(max_iter=1000)
        logit2.fit(X2_tr, np.array(y_tr))

        for r in test:
            y = 0 if r["hg"] > r["ag"] else (1 if r["hg"] == r["ag"] else 2)
            lams = prod_lambdas(idx, r["home"], r["away"], r["date"])
            if not lams:
                continue  # prod gate: skip exactly what production would skip
            meta = {"y": y, "year": test_year, "tournament": r["tournament"],
                    "neutral": r["neutral"], "date": r["date"]}

            p = pois_grid(*lams)
            results["prod"].append({**meta, "p": list(p)})
            p_dc = pois_grid(*lams, rho=rho)
            results["prod_dc"].append({**meta, "p": list(p_dc)})

            lams_w = prod_lambdas(idx, r["home"], r["away"], r["date"], weighted=weighted)
            if lams_w:
                results["decay"].append({**meta, "p": list(pois_grid(*lams_w))})

            dr = r["elo_h_pre"] - r["elo_a_pre"] + (0.0 if r["neutral"] else ELO_HOME)
            pe = logit.predict_proba(np.array([[dr]]))[0]
            order = list(logit.classes_)
            p_elo = [float(pe[order.index(k)]) for k in range(3)]
            results["elo"].append({**meta, "p": p_elo})
            pe2 = logit2.predict_proba(np.array([[dr, abs(dr)]]))[0]
            order2 = list(logit2.classes_)
            p_elo2 = [float(pe2[order2.index(k)]) for k in range(3)]
            results["elo2"].append({**meta, "p": p_elo2})
            results["elo_dc"].append(
                {**meta, "p": [(a + b) / 2 for a, b in zip(p_elo, p_dc)]})

        print(f"fold {test_year}: test={len(test)} rho={rho:+.3f} "
              f"elo_coef={logit.coef_.ravel()}", file=sys.stderr)

    print("\n=== RAW (no isotonic) — walk-forward 2016-2026, prod-gated sample ===")
    for name, recs in results.items():
        if recs:
            summarize(name, recs)

    print("\n=== + per-outcome ISOTONIC (fitted on pre-2021 folds, applied 2021+) ===")
    for name, recs in results.items():
        if not recs:
            continue
        train = [r for r in recs if r["year"] < 2021]
        test = [r for r in recs if r["year"] >= 2021]
        if train and test:
            summarize(name + "+iso", isotonic_apply(train, test))

    # ── error analysis on the prod baseline ──────────────────────────────────
    print("\n=== WHERE THE PROD BASELINE IS WRONG (raw, all folds) ===")
    base = results["prod"]

    def seg(label, pred):
        sel = [r for r in base if pred(r)]
        if len(sel) >= 100:
            summarize(f"  {label}", sel)

    seg("friendly", lambda r: r["tournament"] == "Friendly")
    seg("qualifier", lambda r: "qualification" in r["tournament"].lower())
    seg("final_tour", lambda r: r["tournament"] != "Friendly"
        and "qualification" not in r["tournament"].lower())
    seg("neutral", lambda r: r["neutral"])
    seg("home_venue", lambda r: not r["neutral"])
    for lo, hi in ((0.33, 0.45), (0.45, 0.60), (0.60, 0.75), (0.75, 1.01)):
        seg(f"maxp {lo:.2f}-{hi:.2f}", lambda r, lo=lo, hi=hi: lo <= max(r["p"]) < hi)
    print("\n  (drawn matches only) how much prob did each model give the draw?")
    for name, recs in results.items():
        drawn = [r for r in recs if r["y"] == 1]
        if drawn:
            avg = sum(r["p"][1] for r in drawn) / len(drawn)
            print(f"    {name:9s} avg p(draw|drawn)={avg:.3f}  n={len(drawn)}")

    # ── the WC-relevant cut: NEUTRAL-venue matches, every model ───────────────
    # (Elo carries +100 for home in non-neutral games — prod ignores venue, so
    # the all-matches comparison could flatter Elo. Neutral removes that edge.)
    print("\n=== NEUTRAL-ONLY (the World Cup case) — raw, all folds ===")
    for name, recs in results.items():
        sel = [r for r in recs if r["neutral"]]
        if sel:
            summarize(name, sel)
    print("\n=== NEUTRAL-ONLY final tournaments (no friendlies/qualifiers) ===")
    for name, recs in results.items():
        sel = [r for r in recs if r["neutral"] and r["tournament"] != "Friendly"
               and "qualification" not in r["tournament"].lower()]
        if sel:
            summarize(name, sel)
    print("\n=== NEUTRAL-ONLY + isotonic (train pre-2021 neutral, test 2021+ neutral) ===")
    for name, recs in results.items():
        train = [r for r in recs if r["year"] < 2021 and r["neutral"]]
        test = [r for r in recs if r["year"] >= 2021 and r["neutral"]]
        if train and test:
            summarize(name + "+iso", isotonic_apply(train, test))

    # ── robustness: prod vs elo, Brier per fold year ──────────────────────────
    print("\n=== PER-YEAR Brier (prod vs elo vs elo2) — consistency check ===")
    for yr in range(FIRST_TEST_YEAR, 2027):
        line = f"  {yr}: "
        ok = False
        for name in ("prod", "elo", "elo2"):
            sel = [r for r in results[name] if r["year"] == yr]
            if sel:
                br = sum(brier3(r["p"], r["y"]) for r in sel) / len(sel)
                line += f"{name}={br:.4f} (n={len(sel)})  "
                ok = True
        if ok:
            print(line)


if __name__ == "__main__":
    main()

"""
LAB — 10-year walk-forward backtest on CLUB football (all divisions), vs the market.

Michele-side analysis only — no served code touched. Companion to
scripts/lab_backtest_10y.py (internationals): same recipe, applied to ~45k club
matches across 16 divisions / 11 countries (football-data.co.uk, 2015-16 → today),
which — unlike internationals — come with historical bookmaker odds, so for the
first time the models are benchmarked against the actual MARKET.

Data: data/football_data_uk_10y/<season>_<div>.csv  (downloaded from
https://www.football-data.co.uk/mmz4281/<season>/<div>.csv — public dataset).

Models
  market     — bookmaker de-vig (closing Pinnacle PSC* when present, else PS*,
               else B365C*, else B365*). The ceiling to approach.
  goalrate   — prod-WC-style baseline: 2y goal-rate profiles -> independent
               Poisson, no home term (deliberately the same recipe served for WC).
  elo_logit  — per-country club Elo (K=20·MOV, +65 home in the update; promoted
               teams init at tier baseline) -> logit on [elo_diff, |elo_diff|]
               (home advantage learned by the intercepts), refit each season.
  blend      — 0.3·elo_logit + 0.7·market (the production alpha).

Walk-forward by season: warm-up 2015-16/2016-17, test 2017-18 → 2025-26.
Only matches with usable odds enter the eval sample (same sample for all models).

Run:  PYTHONUTF8=1 python scripts/lab_backtest_clubs_10y.py
"""
from __future__ import annotations

import csv
import io
import math
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "football_data_uk_10y"

FIRST_TEST_SEASON = 2017      # season starting year (2017-18)
MAX_GOALS = 10
EPS = 1e-12

COUNTRY = {"E0": "ENG", "E1": "ENG", "I1": "ITA", "I2": "ITA", "SP1": "ESP",
           "SP2": "ESP", "D1": "GER", "D2": "GER", "F1": "FRA", "F2": "FRA",
           "P1": "POR", "N1": "NED", "B1": "BEL", "T1": "TUR", "G1": "GRE",
           "SC0": "SCO"}
TIER2 = {"E1", "I2", "SP2", "D2", "F2"}
ELO_INIT_T1, ELO_INIT_T2 = 1500.0, 1400.0
ELO_HOME = 65.0
ELO_K = 20.0

ODDS_PREF = [("PSCH", "PSCD", "PSCA"), ("PSH", "PSD", "PSA"),
             ("B365CH", "B365CD", "B365CA"), ("B365H", "B365D", "B365A"),
             ("AvgCH", "AvgCD", "AvgCA"), ("AvgH", "AvgD", "AvgA")]


def parse_date(s: str) -> date | None:
    for fmt in ("%d/%m/%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(s.strip(), fmt).date()
        except ValueError:
            continue
    return None


SEASONS = ["1516", "1617", "1718", "1819", "1920", "2021", "2122", "2223",
           "2324", "2425", "2526"]


def ensure_data():
    """Auto-download the public football-data.co.uk CSVs on first run (~23 MB)."""
    import urllib.request
    DATA.mkdir(parents=True, exist_ok=True)
    for s in SEASONS:
        for d in COUNTRY:
            f = DATA / f"{s}_{d}.csv"
            if not f.exists():
                url = f"https://www.football-data.co.uk/mmz4281/{s}/{d}.csv"
                try:
                    urllib.request.urlretrieve(url, f)
                except Exception as e:  # missing season/div combos are fine
                    print(f"  skip {url}: {e}")


def load_rows() -> list[dict]:
    ensure_data()
    rows = []
    for f in sorted(DATA.glob("*.csv")):
        season, div = f.stem.split("_", 1)
        with io.open(f, encoding="utf-8", errors="replace") as fh:
            for r in csv.DictReader(fh):
                if not r.get("HomeTeam") or not r.get("AwayTeam"):
                    continue
                d = parse_date(r.get("Date") or "")
                try:
                    hg, ag = int(float(r["FTHG"])), int(float(r["FTAG"]))
                except (KeyError, TypeError, ValueError):
                    continue
                if d is None:
                    continue
                odds = None
                for ch, cd, ca in ODDS_PREF:
                    try:
                        oh, od, oa = float(r[ch]), float(r[cd]), float(r[ca])
                        if oh > 1 and od > 1 and oa > 1:
                            odds = (oh, od, oa)
                            break
                    except (KeyError, TypeError, ValueError):
                        continue
                rows.append({"date": d, "div": div, "country": COUNTRY[div],
                             "tier2": div in TIER2, "home": f"{COUNTRY[div]}:{r['HomeTeam'].strip()}",
                             "away": f"{COUNTRY[div]}:{r['AwayTeam'].strip()}",
                             "hg": hg, "ag": ag, "odds": odds})
    rows.sort(key=lambda r: r["date"])
    return rows


def season_of(d: date) -> int:
    return d.year if d.month >= 7 else d.year - 1


# ── goal-rate Poisson baseline (prod WC recipe on clubs, 2y window) ───────────
class GoalIndex:
    def __init__(self):
        self.team: dict[str, list] = defaultdict(list)   # (date, gf, ga)
        self.glob: list = []                              # (date, goals)

    def add(self, r):
        self.team[r["home"]].append((r["date"], r["hg"], r["ag"]))
        self.team[r["away"]].append((r["date"], r["ag"], r["hg"]))
        self.glob.append((r["date"], r["hg"] + r["ag"]))

    def profile(self, team, start, end):
        rows = [x for x in self.team.get(team, []) if start <= x[0] < end]
        if len(rows) < 10:
            return None
        n = len(rows)
        return n, sum(x[1] for x in rows) / n, sum(x[2] for x in rows) / n

    def mu(self, start, end):
        sel = [g for d, g in self.glob if start <= d < end]
        if not sel:
            return 1.3
        return max(sum(sel) / (2 * len(sel)), 0.1)


def pois_1x2(lam_a, lam_b):
    pa = [math.exp(-lam_a) * lam_a**k / math.factorial(k) for k in range(MAX_GOALS + 1)]
    pb = [math.exp(-lam_b) * lam_b**k / math.factorial(k) for k in range(MAX_GOALS + 1)]
    p_h = p_d = p_a_ = 0.0
    for x in range(MAX_GOALS + 1):
        for y in range(MAX_GOALS + 1):
            p = pa[x] * pb[y]
            if x > y:
                p_h += p
            elif x == y:
                p_d += p
            else:
                p_a_ += p
    t = p_h + p_d + p_a_
    return p_h / t, p_d / t, p_a_ / t


def mov_mult(m):
    if m <= 1:
        return 1.0
    if m == 2:
        return 1.5
    return 1.75 + max(0, m - 3) / 8.0


def brier3(p, y):
    t = [0.0, 0.0, 0.0]
    t[y] = 1.0
    return sum((pi - ti) ** 2 for pi, ti in zip(p, t))


def summarize(name, recs):
    n = len(recs)
    br = sum(brier3(r["p"], r["y"]) for r in recs) / n
    ll = sum(-math.log(max(r["p"][r["y"]], EPS)) for r in recs) / n
    acc = sum(1 for r in recs if max(range(3), key=lambda k: r["p"][k]) == r["y"]) / n
    pd_ = sum(r["p"][1] for r in recs) / n
    ad = sum(1 for r in recs if r["y"] == 1) / n
    print(f"{name:11s} n={n:6d}  Brier={br:.4f}  LL={ll:.4f}  acc={acc:.3f}  "
          f"draw pred/act={pd_:.3f}/{ad:.3f}")
    return br


def main():
    rows = load_rows()
    with_odds = sum(1 for r in rows if r["odds"])
    print(f"# {len(rows)} club matches loaded, {with_odds} with odds "
          f"({len(set(r['div'] for r in rows))} divisions)")

    # goal index: holds ALL rows; leak-free because profile()/mu() filter on
    # [start, match_date) — strictly-past window at query time.
    gidx = GoalIndex()
    for r in rows:
        gidx.add(r)

    # incremental Elo, walk in chronological order (pre-match ratings stored)
    elo: dict[str, float] = {}
    for r in rows:
        for side, team in (("h", r["home"]), ("a", r["away"])):
            if team not in elo:
                elo[team] = ELO_INIT_T2 if r["tier2"] else ELO_INIT_T1
        ra, rb = elo[r["home"]], elo[r["away"]]
        r["elo_h_pre"], r["elo_a_pre"] = ra, rb
        dr = ra - rb + ELO_HOME
        we = 1.0 / (10 ** (-dr / 400) + 1)
        res = 1.0 if r["hg"] > r["ag"] else (0.5 if r["hg"] == r["ag"] else 0.0)
        delta = ELO_K * mov_mult(abs(r["hg"] - r["ag"])) * (res - we)
        elo[r["home"]] = ra + delta
        elo[r["away"]] = rb - delta

    results = {m: [] for m in ("market", "goalrate", "elo_logit", "blend")}

    for ts in range(FIRST_TEST_SEASON, 2026):
        # train logit on everything before this season
        X, Y = [], []
        for r in rows:
            if season_of(r["date"]) < ts:
                d = r["elo_h_pre"] - r["elo_a_pre"]
                X.append([d, abs(d)])
                Y.append(0 if r["hg"] > r["ag"] else (1 if r["hg"] == r["ag"] else 2))
        if len(X) < 2000:
            continue
        logit = LogisticRegression(max_iter=1000)
        logit.fit(np.array(X), np.array(Y))
        order = list(logit.classes_)

        test = [r for r in rows if season_of(r["date"]) == ts and r["odds"]]
        for r in test:
            y = 0 if r["hg"] > r["ag"] else (1 if r["hg"] == r["ag"] else 2)
            # market de-vig
            inv = [1 / o for o in r["odds"]]
            s = sum(inv)
            p_mkt = [x / s for x in inv]
            # goal-rate baseline (2y window, prod recipe, no home term)
            start = date(r["date"].year - 2, r["date"].month, min(r["date"].day, 28))
            ph = gidx.profile(r["home"], start, r["date"])
            pa = gidx.profile(r["away"], start, r["date"])
            if not ph or not pa:
                continue
            mu = gidx.mu(start, r["date"])
            lam_h = max(ph[1] * (pa[2] / mu), 0.05)
            lam_a = max(pa[1] * (ph[2] / mu), 0.05)
            p_gr = list(pois_1x2(lam_h, lam_a))
            # elo logit
            d = r["elo_h_pre"] - r["elo_a_pre"]
            pe = logit.predict_proba(np.array([[d, abs(d)]]))[0]
            p_elo = [float(pe[order.index(k)]) for k in range(3)]
            meta = {"y": y, "season": ts, "div": r["div"], "tier2": r["tier2"],
                    "country": r["country"]}
            results["market"].append({**meta, "p": p_mkt})
            results["goalrate"].append({**meta, "p": p_gr})
            results["elo_logit"].append({**meta, "p": p_elo})
            results["blend"].append(
                {**meta, "p": [0.3 * a + 0.7 * b for a, b in zip(p_elo, p_mkt)]})

    print("\n=== OVERALL — walk-forward 2017-18 → 2025-26, matches with odds ===")
    for name, recs in results.items():
        if recs:
            summarize(name, recs)

    print("\n=== PER TIER ===")
    for label, pred in (("top flights", lambda r: not r["tier2"]),
                        ("second divs", lambda r: r["tier2"])):
        print(f"-- {label}")
        for name, recs in results.items():
            sel = [r for r in recs if pred(r)]
            if len(sel) > 200:
                summarize(f"  {name}", sel)

    print("\n=== elo_logit vs market, per country (Brier delta; +ve = market better) ===")
    for c in sorted(set(r["country"] for r in results["market"])):
        m = [r for r in results["market"] if r["country"] == c]
        e = [r for r in results["elo_logit"] if r["country"] == c]
        if len(m) > 300:
            bm = sum(brier3(r["p"], r["y"]) for r in m) / len(m)
            be = sum(brier3(r["p"], r["y"]) for r in e) / len(e)
            print(f"  {c}: market={bm:.4f}  elo={be:.4f}  delta={be-bm:+.4f}  n={len(m)}")


if __name__ == "__main__":
    main()

"""Over/Under 2.5 goals edge backtest — the least-efficient mainline market.

1X2 and tennis moneyline are the sharpest, most efficient prices there are, so it
is no surprise a model can't beat them. Totals (O/U 2.5) are structurally softer,
and a goals model (Poisson/Dixon-Coles) predicts the FULL score distribution —
this is the most plausible place a genuine edge survives.

Self-contained on the cached football-data.co.uk CSVs, which carry O/U 2.5 odds:
  P>2.5 / P<2.5    Pinnacle pre-match
  PC>2.5 / PC<2.5  Pinnacle closing (the hard bar)
  Max>2.5 / Max<2.5  best price across books (line-shopping)

Model: incremental walk-forward Poisson goal-rate per team (home/away attack &
defence, shrunk) -> expected total Lambda -> P(over 2.5) = 1 - Poisson.cdf(2, Lambda).
Isotonic-calibrated on a calibration window, evaluated out-of-sample. Value picks
by edge bucket, bootstrap CI. ROI>0 with CI excluding 0 = genuine edge.

Run:  .venv/bin/python -m scripts.backtest_ou
"""
from __future__ import annotations

import csv
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import numpy as np
from scipy.stats import poisson
from sklearn.isotonic import IsotonicRegression

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.backtest_clv import LEAGUES, load_cached  # noqa: E402 (reuse loader/cache paths)

CACHE = ROOT / "data" / "football_data_uk"
from core.football_data_uk import DIVISION_MAP  # noqa: E402

# wider sample than the CLV baseline: more seasons tighten the bucket CIs (principled,
# not fishing — same model, same buckets). Older seasons may lack O/U closing columns;
# those rows still train the model and contribute where odds exist.
START_YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025]

WARMUP = 60
SHRINK = 4.0
CALIB_FRAC = 0.35    # earliest slice to fit isotonic; eval on the rest
EDGE_BUCKETS = [(0.0, 0.03), (0.03, 0.06), (0.06, 0.10), (0.10, 1.0)]
N_BOOT = 2000
RNG_SEED = 20260701


def _f(row: dict, key: str):
    v = row.get(key, "")
    if v in (None, ""):
        return None
    try:
        return float(v)
    except ValueError:
        return None


def load_ou_rows() -> list[dict]:
    """Read cached CSVs directly to grab goals + O/U 2.5 odds columns."""
    out = []
    for lg in LEAGUES:
        for yr in START_YEARS:
            load_cached(lg, yr)  # download+cache via the working loader if missing
            fp = CACHE / f"{lg}_{DIVISION_MAP[lg]}_{yr}.csv"
            if not fp.exists():
                continue
            reader = csv.DictReader(fp.read_text(encoding="utf-8", errors="replace").splitlines())
            for row in reader:
                fthg, ftag = _f(row, "FTHG"), _f(row, "FTAG")
                d = (row.get("Date") or "").strip()
                if fthg is None or ftag is None or not d:
                    continue
                dt = None
                for fmt in ("%d/%m/%Y", "%d/%m/%y"):
                    try:
                        dt = datetime.strptime(d, fmt).date()
                        break
                    except ValueError:
                        continue
                if dt is None:
                    continue
                out.append({
                    "date": dt, "league": lg,
                    "home": (row.get("HomeTeam") or "").strip(),
                    "away": (row.get("AwayTeam") or "").strip(),
                    "total": int(fthg + ftag),
                    "_hg": int(fthg), "_ag": int(ftag),
                    # Pinnacle closing, pre-match, best-odds
                    "pc_o": _f(row, "PC>2.5"), "pc_u": _f(row, "PC<2.5"),
                    "pp_o": _f(row, "P>2.5") or _f(row, "B365>2.5"),
                    "pp_u": _f(row, "P<2.5") or _f(row, "B365<2.5"),
                    "mx_o": _f(row, "Max>2.5"), "mx_u": _f(row, "Max<2.5"),
                })
    out.sort(key=lambda r: (r["date"], r["league"]))
    return out


class GoalRates:
    """Incremental home/away attack & defence rates per team (shrunk to league mean)."""

    def __init__(self) -> None:
        self.hf = defaultdict(float); self.hn = defaultdict(int)   # home goals for
        self.ha = defaultdict(float)                                # home goals against
        self.af = defaultdict(float); self.an = defaultdict(int)   # away goals for
        self.aa = defaultdict(float)                                # away goals against
        self.sum_h = 0.0; self.sum_a = 0.0; self.n = 0             # league totals

    def avg(self):
        ah = self.sum_h / self.n if self.n else 1.4
        aa = self.sum_a / self.n if self.n else 1.1
        return ah, aa

    def _sh(self, raw, n):
        return (raw * n + 1.0 * SHRINK) / (n + SHRINK)

    def lam_mu(self, home: str, away: str):
        ah, aa = self.avg()
        atk_h = self._sh((self.hf[home] / self.hn[home]) / ah if self.hn[home] else 1.0, self.hn[home])
        def_h = self._sh((self.ha[home] / self.hn[home]) / aa if self.hn[home] else 1.0, self.hn[home])
        atk_a = self._sh((self.af[away] / self.an[away]) / aa if self.an[away] else 1.0, self.an[away])
        def_a = self._sh((self.aa[away] / self.an[away]) / ah if self.an[away] else 1.0, self.an[away])
        lam = ah * atk_h * def_a
        mu = aa * atk_a * def_h
        return lam, mu

    def update(self, home, away, hg, ag):
        self.hf[home] += hg; self.ha[home] += ag; self.hn[home] += 1
        self.af[away] += ag; self.aa[away] += hg; self.an[away] += 1
        self.sum_h += hg; self.sum_a += ag; self.n += 1


def roi_ci(stakes: np.ndarray, profits: np.ndarray, rng):
    total = stakes.sum()
    if total <= 0:
        return float("nan"), (float("nan"), float("nan")), 0
    roi = profits.sum() / total * 100
    nn = len(stakes)
    boot = []
    for _ in range(N_BOOT):
        idx = rng.integers(0, nn, nn)
        s = stakes[idx].sum()
        if s > 0:
            boot.append(profits[idx].sum() / s * 100)
    lo, hi = np.percentile(boot, [2.5, 97.5]) if boot else (float("nan"), float("nan"))
    return roi, (float(lo), float(hi)), int((stakes > 0).sum())


DC_REFIT_EVERY = 20
DC_HALF_LIFE = 120.0
MODELS = ("naive", "dc")   # naive incremental Poisson vs Dixon-Coles (tau low-score)


def run() -> None:
    from models.dixon_coles import DixonColesModel

    rng = np.random.default_rng(RNG_SEED)
    rows = load_ou_rows()
    print(f"O/U rows with goals: {len(rows)}")
    print(f"  with Pinnacle closing O/U 2.5: {sum(1 for r in rows if r['pc_o'] and r['pc_u'])}")

    # walk-forward per league: naive Poisson goals model AND Dixon-Coles (tau) → P(over 2.5)
    by_lg: dict[str, list] = defaultdict(list)
    for r in rows:
        by_lg[r["league"]].append(r)
    preds = []
    for lg, ms in by_lg.items():
        ms.sort(key=lambda r: r["date"])
        gr = GoalRates()
        dc = None
        train: list[dict] = []
        since = 0
        for idx, r in enumerate(ms):
            if idx >= WARMUP and r["home"] and r["away"]:
                lam, mu = gr.lam_mu(r["home"], r["away"])
                p_naive = float(1.0 - poisson.cdf(2, lam + mu))
                p_dc = None
                if dc is not None and r["home"] in dc._team_idx and r["away"] in dc._team_idx:
                    try:
                        p_dc = float(dc.over_prob(r["home"], r["away"], 2.5))
                    except Exception:  # noqa: BLE001
                        p_dc = None
                preds.append({**r, "over": 1 if r["total"] >= 3 else 0,
                              "naive": p_naive, "dc": p_dc})
            gr.update(r["home"], r["away"], r["_hg"], r["_ag"])
            train.append({"home_team": r["home"], "away_team": r["away"],
                          "home_goals": r["_hg"], "away_goals": r["_ag"],
                          "date": r["date"].isoformat()})
            since += 1
            if len(train) >= WARMUP and (dc is None or since >= DC_REFIT_EVERY):
                prev = dc
                dc = DixonColesModel()
                dc.fit(train, warm_start=prev, half_life_days=DC_HALF_LIFE)
                since = 0
    preds.sort(key=lambda r: (r["date"], r["league"]))
    print(f"Predictions: {len(preds)}")

    # temporal calib/eval split; isotonic-calibrate each model on the calib slice
    split = int(len(preds) * CALIB_FRAC)
    calib, ev = preds[:split], preds[split:]
    iso = {}
    for mk in MODELS:
        xs = [(p[mk], p["over"]) for p in calib if p[mk] is not None]
        ir = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0)
        ir.fit([x for x, _ in xs], [y for _, y in xs])
        iso[mk] = ir
    for p in ev:
        for mk in MODELS:
            p[f"cal_{mk}"] = float(iso[mk].predict([p[mk]])[0]) if p[mk] is not None else None
    print(f"Calib {len(calib)} | eval {len(ev)}  (eval from {ev[0]['date']})")

    evc = [p for p in ev if p["pc_o"] and p["pc_u"] and p["pc_o"] > 1 and p["pc_u"] > 1]
    for p in evc:
        io, iu = 1 / p["pc_o"], 1 / p["pc_u"]
        p["p_mkt_over"] = io / (io + iu)
    print("\n" + "=" * 88)
    print("O/U 2.5 CALIBRATION (Brier on P(over), lower=better) — eval slice")
    print("=" * 88)
    for mk in MODELS:
        rowsm = [p for p in evc if p[f"cal_{mk}"] is not None]
        b_raw = np.mean([(p[mk] - p["over"]) ** 2 for p in rowsm])
        b_cal = np.mean([(p[f"cal_{mk}"] - p["over"]) ** 2 for p in rowsm])
        print(f"  {mk:<6} RAW {b_raw:.5f}  CAL {b_cal:.5f}   (n={len(rowsm)})")
    b_mkt = np.mean([(p["p_mkt_over"] - p["over"]) ** 2 for p in evc])
    print(f"  market (Pinnacle closing) {b_mkt:.5f}   (n={len(evc)})")

    # ── selective edge by bucket, per model, at three price points ──
    def bucket(rows_, mk, ko, ku, lo, hi):
        st, pr = [], []
        for p in rows_:
            pc = p[f"cal_{mk}"]
            if pc is None:
                continue
            oo, ou = p.get(ko), p.get(ku)
            for side_p, side_odds, won in ((pc, oo, p["over"]), (1 - pc, ou, 1 - p["over"])):
                if not side_odds or side_odds <= 1:
                    continue
                if lo <= side_p * side_odds - 1.0 < hi:
                    st.append(1.0)
                    pr.append((side_odds - 1.0) if won else -1.0)
        return np.array(st), np.array(pr)

    for mk in MODELS:
        for label, ko, ku in (("Pinnacle CLOSE", "pc_o", "pc_u"),
                              ("BEST-ODDS (Max)", "mx_o", "mx_u")):
            print("\n" + "=" * 88)
            print(f"[{mk.upper()}] O/U SELECTIVE EDGE @ {label} — calibrated picks by edge bucket")
            print("=" * 88)
            print(f"{'edge bucket':<14}{'bets':>7}{'ROI%':>10}{'CI95':>22}{'gate':>7}")
            print("-" * 88)
            for lo, hi in EDGE_BUCKETS:
                st, pr = bucket(ev, mk, ko, ku, lo, hi)
                if len(st) == 0:
                    continue
                roi, ci, nb = roi_ci(st, pr, rng)
                gate = "PASS" if ci[0] > 0 else "off"
                name = f"{lo*100:.0f}-{hi*100:.0f}%" if hi < 1 else f">{lo*100:.0f}%"
                print(f"{name:<14}{nb:>7}{roi:>+10.2f}{('[%+.2f,%+.2f]' % ci):>22}{gate:>7}")
    print("=" * 88)
    print("ROI>0 with CI95 excluding 0 = genuine edge on totals. dc vs naive isolates the DC+tau gain.")


if __name__ == "__main__":
    run()

"""Do referees improve card predictions? Measured on Premier League (has referee).

The soft-markets card model today uses only team attack/defence rates. Cards are
notoriously referee-dependent. This backtest quantifies the gain from a referee
card-rate feature, walk-forward, on football-data.co.uk PL (2019-2025, referee +
HY/AY/HR/AR present). Compares, on total cards:

  - league baseline   (λ = global mean)
  - team model        (λ = glob × team attack/defence, shrunk)   [today's approach]
  - team + REFEREE     (team λ × referee card-rate multiplier, shrunk)

Metric: Brier on P(Over L) for L in {3.5, 4.5, 5.5}, plus calibration (ECE-lite).
A referee gain here is the concrete lever to wire into core/soft_markets.

Run:  .venv/bin/python -m scripts.backtest_soft_referee
"""
from __future__ import annotations

import csv
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import numpy as np
from scipy.stats import poisson

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data" / "football_data_uk"
LEAGUE = ("PL", "E0")           # only PL has referee populated
YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025]
WARMUP = 60
SHRINK_TEAM = 5.0
SHRINK_REF = 8.0                # referees need more matches before trusting their rate
LINES = [3.5, 4.5, 5.5]


def load_rows() -> list[dict]:
    out = []
    for yr in YEARS:
        fp = CACHE / f"{LEAGUE[0]}_{LEAGUE[1]}_{yr}.csv"
        if not fp.exists():
            continue
        for r in csv.DictReader(fp.read_text(encoding="utf-8", errors="replace").splitlines()):
            def i(k):
                v = (r.get(k) or "").strip()
                return int(v) if v.isdigit() else None
            hy, ay, hr, ar = i("HY"), i("AY"), i("HR"), i("AR")
            d = (r.get("Date") or "").strip()
            home, away, ref = (r.get("HomeTeam") or "").strip(), (r.get("AwayTeam") or "").strip(), (r.get("Referee") or "").strip()
            if None in (hy, ay, hr, ar) or not d or not home or not away or not ref:
                continue
            dt = None
            for fmt in ("%d/%m/%Y", "%d/%m/%y"):
                try:
                    dt = datetime.strptime(d, fmt).date(); break
                except ValueError:
                    continue
            if dt is None:
                continue
            hc, ac = hy + hr, ay + ar  # cards received by home / away side
            out.append({"date": dt, "home": home, "away": away, "ref": ref,
                        "hc": hc, "ac": ac, "cards": hc + ac})
    out.sort(key=lambda r: r["date"])
    return out


def brier_over(p_over: float, actual_total: float, line: float) -> float:
    y = 1.0 if actual_total > line else 0.0
    return (p_over - y) ** 2


def p_over(lmbda: float, line: float) -> float:
    return float(1.0 - poisson.cdf(int(line), lmbda))


def run() -> None:
    rows = load_rows()
    print(f"PL matches with referee+cards: {len(rows)}")

    # incremental accumulators
    cf = defaultdict(float); cf_n = defaultdict(int)   # cards made by team
    ca = defaultdict(float); ca_n = defaultdict(int)   # cards drawn against team (conceded)
    rf = defaultdict(float); rf_n = defaultdict(int)   # referee total-cards
    glob_sum = 0.0; glob_n = 0                          # league mean total cards

    # per model: brier accumulators per line
    models = ["baseline", "team", "team+ref"]
    brier = {m: {l: [] for l in LINES} for m in models}
    n_eval = 0

    for idx, m in enumerate(rows):
        gmean = (glob_sum / glob_n) if glob_n else 4.5     # league mean TOTAL cards
        halfmean = gmean / 2.0                              # per-side prior

        if idx >= WARMUP and glob_n > 0:
            n_eval += 1
            # team rates (shrunk toward per-side league mean)
            def rate(sm, n):
                return (sm + SHRINK_TEAM * halfmean) / (n + SHRINK_TEAM)
            atk_h = rate(cf[m["home"]], cf_n[m["home"]]) / halfmean
            dfn_a = rate(ca[m["away"]], ca_n[m["away"]]) / halfmean
            atk_a = rate(cf[m["away"]], cf_n[m["away"]]) / halfmean
            dfn_h = rate(ca[m["home"]], ca_n[m["home"]]) / halfmean
            lam_team = halfmean * (atk_h * dfn_a) + halfmean * (atk_a * dfn_h)

            # referee multiplier (shrunk toward league mean)
            ref_rate = (rf[m["ref"]] + SHRINK_REF * gmean) / (rf_n[m["ref"]] + SHRINK_REF)
            ref_mult = ref_rate / gmean if gmean > 0 else 1.0
            lam_ref = lam_team * ref_mult

            for l in LINES:
                brier["baseline"][l].append(brier_over(p_over(gmean, l), m["cards"], l))
                brier["team"][l].append(brier_over(p_over(lam_team, l), m["cards"], l))
                brier["team+ref"][l].append(brier_over(p_over(lam_ref, l), m["cards"], l))

        # update AFTER scoring — per-side: cf=cards received, ca=cards induced on opponent
        cf[m["home"]] += m["hc"]; ca[m["home"]] += m["ac"]; cf_n[m["home"]] += 1; ca_n[m["home"]] += 1
        cf[m["away"]] += m["ac"]; ca[m["away"]] += m["hc"]; cf_n[m["away"]] += 1; ca_n[m["away"]] += 1
        glob_sum += m["cards"]; glob_n += 1
        rf[m["ref"]] += m["cards"]; rf_n[m["ref"]] += 1

    def summarize(tag, l):
        arr = brier[tag][l]
        return float(np.mean(arr)) if arr else float("nan")

    print(f"\nEval matches: {n_eval}")
    print(f"{'Model':<12}" + "".join(f"  Brier@{l}" for l in LINES))
    print("-" * 48)
    for mdl in models:
        print(f"{mdl:<12}" + "".join(f"  {summarize(mdl, l):.5f}" for l in LINES))
    print("\n(lower Brier = better; team+ref vs team isolates the referee gain)")


if __name__ == "__main__":
    run()

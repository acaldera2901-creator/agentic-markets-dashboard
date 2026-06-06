"""Robustness: is the market-blend alpha stable across time splits, and does
blending preserve any genuine value (ROI at closing odds) or just copy the line?

Per-season out-of-sample: train alpha selection on seasons<=Y, eval on Y+1.
Also reports flat-stake ROI of blend value-picks at closing odds (honest edge test).
"""
from __future__ import annotations

import sys
from collections import defaultdict
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.football_data_uk import DIVISION_MAP, FDMatch, implied_probs, parse_csv  # noqa: E402
from scripts.reliability_experiments import (  # noqa: E402
    LEAGUES, START_YEARS, WARMUP, OUTCOMES, poisson_v1, brier,
)

CACHE = ROOT / "data" / "football_data_uk"


def load_cached(lg, yr):
    fp = CACHE / f"{lg}_{DIVISION_MAP[lg]}_{yr}.csv"
    return parse_csv(fp.read_text(encoding="utf-8", errors="replace"), lg) if fp.exists() else []


def main():
    by_season = defaultdict(list)
    for lg in LEAGUES:
        ms: list[FDMatch] = []
        for yr in START_YEARS:
            ms.extend(load_cached(lg, yr))
        ms.sort(key=lambda m: m.date)
        train = []
        for idx, m in enumerate(ms):
            if idx >= WARMUP:
                mkt = implied_probs(m.closing_home, m.closing_draw, m.closing_away)
                base = poisson_v1(train, m.home_team, m.away_team)
                if base and mkt:
                    outcome = m.result if m.result in OUTCOMES else (
                        "H" if m.home_goals > m.away_goals else "A" if m.away_goals > m.home_goals else "D")
                    season = m.date.year if m.date.month >= 7 else m.date.year - 1
                    by_season[season].append({
                        "o": outcome, "mkt": mkt, "base": base,
                        "odds": (m.closing_home, m.closing_draw, m.closing_away)})
            train.append(m.as_model_match())

    blend = lambda r, a: tuple(a * r["base"][i] + (1 - a) * r["mkt"][i] for i in range(3))
    seasons = sorted(by_season)

    def brier_mean(recs, a):
        return sum(brier(blend(r, a), r["o"]) for r in recs) / len(recs)

    print("== Per-season: best alpha on past, applied to held-out next season ==")
    print(f"{'eval_season':<14}{'n':>6}{'alpha*':>8}{'base_brier':>12}{'blend_brier':>12}{'mkt_brier':>12}")
    grid = [round(x, 2) for x in np.arange(0.0, 1.01, 0.1)]
    for i in range(1, len(seasons)):
        past = [r for s in seasons[:i] for r in by_season[s]]
        test = by_season[seasons[i]]
        if not past or not test:
            continue
        best_a = min(grid, key=lambda a: brier_mean(past, a))
        bb = sum(brier(r["base"], r["o"]) for r in test) / len(test)
        zb = brier_mean(test, best_a)
        mb = sum(brier(r["mkt"], r["o"]) for r in test) / len(test)
        print(f"{seasons[i]:<14}{len(test):>6}{best_a:>8.1f}{bb:>12.5f}{zb:>12.5f}{mb:>12.5f}")

    # ── ROI test: does the blend still find +EV bets at closing odds? ──
    all_recs = [r for s in seasons for r in by_season[s]]
    print("\n== Flat-stake ROI of value picks @ closing odds (edge test) ==")
    print(f"{'strategy':<22}{'bets':>7}{'profit_u':>11}{'ROI%':>9}")
    for name, fn in [("Poisson v1", lambda r: r["base"]),
                     ("blend a=0.5", lambda r: blend(r, 0.5)),
                     ("blend a=0.3", lambda r: blend(r, 0.3))]:
        staked = profit = 0.0; nb = 0
        for r in all_recs:
            p = fn(r)
            for i in range(3):
                if r["odds"][i] and p[i] * r["odds"][i] > 1.0:
                    staked += 1; nb += 1
                    profit += (r["odds"][i] - 1) if OUTCOMES[i] == r["o"] else -1
        roi = profit / staked * 100 if staked else float("nan")
        print(f"{name:<22}{nb:>7}{profit:>+11.1f}{roi:>+9.2f}")
    print("Closing line is ~efficient: negative ROI = no edge beyond the line (expected).")


if __name__ == "__main__":
    main()

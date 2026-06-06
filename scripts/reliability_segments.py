"""FASE 3+4 — error analysis by segment + does the market blend fix underdogs.

Reuses the walk-forward predictions from reliability_experiments but slices by:
 - odds band of the MODEL'S best pick (favorite vs underdog)
 - 1X2 outcome class (home/draw/away)
 - divergence model-vs-market (where we disagree most with the line)

For each slice: hit-rate of Poisson v1's pick vs the market's pick vs the
α=0.3 blend pick, and Brier. Answers: where do we lose, and does blending stop it.
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
    recs = []
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
                    odds = (m.closing_home, m.closing_draw, m.closing_away)
                    recs.append({"lg": lg, "o": outcome, "mkt": mkt, "base": base, "odds": odds})
            train.append(m.as_model_match())

    blend = lambda r, a: tuple(a * r["base"][i] + (1 - a) * r["mkt"][i] for i in range(3))

    def pick_stats(recs, prob_fn):
        """hit-rate of the model's best pick + brier."""
        hit = 0; b = 0.0
        for r in recs:
            p = prob_fn(r)
            k = int(np.argmax(p))
            if OUTCOMES[k] == r["o"]:
                hit += 1
            b += brier(p, r["o"])
        n = len(recs)
        return hit / n, b / n, n

    print(f"Total: {len(recs)} matches\n")

    # ── segment by ODDS BAND of the model's favored pick ──
    print("== By model-pick odds band (the report's losing-segment question) ==")
    print(f"{'band':<14}{'n':>6}{'base_hit':>10}{'mkt_hit':>10}{'blend.3_hit':>12}{'base_brier':>12}{'blend_brier':>12}")
    bands = [(1.0, 1.6), (1.6, 1.85), (1.85, 2.10), (2.10, 2.50), (2.50, 99)]
    for lo, hi in bands:
        seg = []
        for r in recs:
            k = int(np.argmax(r["base"]))
            o = r["odds"][k]
            if o and lo <= o < hi:
                seg.append(r)
        if not seg:
            continue
        bh, bb, n = pick_stats(seg, lambda r: r["base"])
        mh, _, _ = pick_stats(seg, lambda r: r["mkt"])
        zh, zb, _ = pick_stats(seg, lambda r: blend(r, 0.3))
        print(f"{f'{lo}-{hi}':<14}{n:>6}{bh:>10.3f}{mh:>10.3f}{zh:>12.3f}{bb:>12.4f}{zb:>12.4f}")

    # ── segment by DIVERGENCE from market (top pick prob gap) ──
    print("\n== By |model_p - market_p| on the model's pick (disagreement) ==")
    print(f"{'divergence':<14}{'n':>6}{'base_hit':>10}{'mkt_hit':>10}{'blend.3_hit':>12}")
    div_bands = [(0.0, 0.05), (0.05, 0.10), (0.10, 0.20), (0.20, 1.0)]
    for lo, hi in div_bands:
        seg = []
        for r in recs:
            k = int(np.argmax(r["base"]))
            d = abs(r["base"][k] - r["mkt"][k])
            if lo <= d < hi:
                seg.append(r)
        if not seg:
            continue
        bh, _, n = pick_stats(seg, lambda r: r["base"])
        mh, _, _ = pick_stats(seg, lambda r: r["mkt"])
        zh, _, _ = pick_stats(seg, lambda r: blend(r, 0.3))
        print(f"{f'{lo}-{hi}':<14}{n:>6}{bh:>10.3f}{mh:>10.3f}{zh:>12.3f}")

    # ── by outcome class served (home/draw/away pick) ──
    print("\n== By model pick class ==")
    print(f"{'pick':<8}{'n':>6}{'base_hit':>10}{'mkt_hit':>10}{'blend.3_hit':>12}")
    for cls in range(3):
        seg = [r for r in recs if int(np.argmax(r["base"])) == cls]
        if not seg:
            continue
        bh, _, n = pick_stats(seg, lambda r: r["base"])
        mh, _, _ = pick_stats(seg, lambda r: r["mkt"])
        zh, _, _ = pick_stats(seg, lambda r: blend(r, 0.3))
        print(f"{OUTCOMES[cls]:<8}{n:>6}{bh:>10.3f}{mh:>10.3f}{zh:>12.3f}")


if __name__ == "__main__":
    main()

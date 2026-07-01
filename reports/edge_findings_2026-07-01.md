# BetRedge — Edge Findings (rigorous, reproducible) — 2026-07-01

Dual-track meta-model + edge-gate backtests, walk-forward, no-leakage, bootstrap CI.
All numbers reproduced locally on cached free data. Deploy is GATED — this is analysis.

## Scripts (all offline, cached)
- `scripts/backtest_meta.py` — football 1X2 dual-track (market-aware vs market-blind) + Edge Map. Cache: `data/meta_features_football.json`, out: `reports/edge_map_football.json`.
- `scripts/backtest_tennis_edge.py` — tennis surface-Elo vs Pinnacle, calibration + edge buckets + best-odds. Data: tennis-data.co.uk (cached `data/tennis_data_uk/`).
- `scripts/backtest_ou.py` — Over/Under 2.5 goals model vs Pinnacle O/U, calibration + edge buckets + best-odds.

## 1) Calibration — SHIPPABLE improvement over what we serve today
| Market | Served TODAY | Market-anchored (new) | Market (ceiling) |
|---|---|---|---|
| ⚽ 1X2 (Brier) | Poisson v1 **0.592** (acc 52.1%) | meta+opening **0.576** (acc 54.0%) | 0.570 |
| 🎾 Tennis (2-way Brier) | raw Elo **0.441** | blend w≈0.85 **0.408** | 0.406 |
| 🥅 O/U 2.5 (Brier) | — | goals model **0.243** | 0.236 |

→ Anchoring our published probabilities to the market materially beats the model we serve today. **But our fundamental models add ~zero over the market itself** (blind meta ≈ served; tennis blend wants 85% market). Honest product = trustworthy calibrated probabilities, NOT "we beat the book".

## 2) Edge / CLV — the honest truth
Value picks, calibrated, selective by edge bucket, priced at closing / pre-match / best-odds. Bootstrap CI95. **A segment passes the gate only if ROI>0 with CI excluding 0.**

- ⚽ **1X2**: ROI −13% vs BOTH opening and closing. All 5 leagues gated OFF. No leakage red flags. **No edge.**
- 🎾 **Tennis moneyline**: market MORE accurate than us (67.7% vs 63.0%). vs closing all buckets negative; at best-odds the best buckets reach break-even (0-5% −2.2% CI [−6.8,+2.5]) but **none confidently positive.**
- 🥅 **O/U 2.5**: closest to viable. vs closing 3-6% bucket −0.5%; at **best-odds the 6-10% bucket +2.08%** (CI [−5.96,+10.25]). Still no bucket clears the gate, but the market-model gap is tiny. High-edge (>10%) buckets lose → our big disagreements are model error, not edge.

**Verdict:** No systematic pre-close edge on 1X2, tennis moneyline, or O/U with statistical confidence. Best case = break-even with line-shopping. This is expected: these are the most efficient markets. "Beat the bookies / 85% win rate" is NOT supportable → retire it (FTC).

## 3) Most promising frontier (data-backed, honest)
**Totals (O/U) is where we are genuinely competitive** (Brier gap 0.007 vs the sharpest price). Concrete next experiment: upgrade the goals model λ with **xG-informed rates + Dixon-Coles low-score correction** (both already in the codebase) instead of goals-only λ. Given how small the gap already is, this is the realistic path to a genuine, defensible totals edge. Second frontier: **soft markets (cards)** — structurally softest, and we now have `referee` in the data; blocked only on historical soft-market odds.

## Honest repositioning this unlocks
Sell **calibrated, market-anchored probabilities + discipline** (defensible, true) — not edge over the book. Flag "value" only where a future gate genuinely passes. Removes the existential FTC/gambling-claim risk.

# WC model lab — 10-year backtest: where the served model is wrong, and a candidate that fixes it

Date: 2026-06-07 · Author: michele-claude (lab analysis, read-only — no served code touched)
Mandate: Michele's request — "backtest con tutte le partite degli ultimi 10 anni, capire dove
sbagliamo, creare una versione migliore". Execution of any change stays Andrea-side per the
2026-06-07 ownership split.
Reproduce: `PYTHONUTF8=1 python scripts/lab_backtest_10y.py` (~2 min, stdlib + numpy/sklearn
already in the venv; data = `data/national_teams/international_results_raw.csv`, already in repo).

## Setup

- **Sample**: all internationals 2016-01-01 → 2026-06-07 passing the production quality gate
  (both teams ≥15 matches in the trailing 5y window) → **9,067 matches**, walk-forward by
  calendar year (11 folds), zero leakage (Elo uses pre-match ratings by construction; logit,
  ρ and isotonic are refit per fold on data strictly before the fold).
- **prod** = bit-faithful replica of the served path: 5y goal-rate profiles →
  `lambda_a = att_a · def_b / mu` → independent Poisson grid (the exact
  `core/world_cup_probability.py` formulas), then the same per-outcome isotonic stage.
- Candidates: **prod_dc** (+Dixon-Coles ρ, fit per fold) · **decay** (half-life 2y +
  friendlies ×0.5) · **elo** (World Football Elo recomputed from 1872 on the in-repo CSV —
  K by tournament 60/50/40/30/20, margin-of-victory multiplier, +100 home when not neutral —
  → multinomial logit on elo_diff, KU Leuven-style) · **elo2** (logit on [elo_diff, |elo_diff|];
  the |diff| term is a draw-awareness feature) · **elo_dc** (50/50 blend).

## Headline result

| model (+iso, 2021-2026 OOS, n=5,256) | Brier | log-loss | acc | ECE | draw pred/act |
|---|---|---|---|---|---|
| prod (served logic) | 0.5450 | 0.9227 | 0.573 | 0.0160 | 0.239/0.234 |
| prod_dc | 0.5450 | 0.9225 | 0.573 | 0.0156 | 0.237/0.234 |
| decay | 0.5445 | 0.9262 | 0.570 | 0.0119 | 0.238/0.234 |
| elo | 0.5120 | 0.8797 | 0.597 | 0.0233 | 0.252/0.234 |
| **elo2** | **0.5105** | **0.8769** | **0.602** | 0.0162 | 0.243/0.234 |
| elo_dc | 0.5148 | 0.8812 | 0.599 | 0.0126 | 0.234/0.234 |

**ΔBrier elo2 vs prod = −0.0345** — 17× the promotion-gate tolerance (0.002). Consistency:
elo beats prod in **10 of 11 fold years** (tie in 2020, the n=337 COVID year). On the
WC-relevant cut (neutral venue, 2021+ +iso): prod 0.5936/acc 0.515 → **elo2 0.5452/acc 0.574**.
Neutral final tournaments raw: prod 0.6140/0.496 → elo2 0.5723/0.537. For context, bookmaker
closing odds sit around Brier ≈0.55-0.58 (RPS ~0.198 on internationals): **elo2 reaches the
bookmaker band without using any odds.**

## Where the served model is wrong (error analysis, raw)

1. **The strength signal is the flaw, not the Poisson grid.** Goal-rate averages over a 5y
   window are not opponent-adjusted (a 3-0 vs San Marino counts like a 3-0 vs France) and not
   importance-weighted. Elo fixes exactly this — that is the whole gap.
2. Weakest segments: friendlies (Brier 0.609, acc 0.496), final tournaments (0.599/0.518),
   neutral venue (0.601/0.504). Strongest: qualifiers (0.512/0.602) — i.e. **the served model
   is weakest precisely on the World Cup match type**.
3. Toss-up band maxp 0.33-0.45 (n=3,166): Brier 0.656, acc 0.402 — near-noise. Publication
   thresholds should never surface picks from this band (Safe Publication Gate already helps).
4. Draws are NOT underestimated on this sample (pred 0.251 vs act 0.239) — Dixon-Coles ρ adds
   ~nothing (+0.0002), consistent with Andrea's earlier finding on the full-DC model.
   The literature draw-fix that DOES work here is the |elo_diff| logit feature (elo2).
5. Time-decay/friendly down-weighting: negligible on top of prod (−0.0004); Elo's K-weighting
   subsumes it.

## Candidate for Andrea — `wc-elo-logit-v2`

Replace ONLY the strength→probability stage; keep everything else (isotonic stage, market
blend α=0.3, quality gates, Safe Publication Gate, paper tier) unchanged:

1. `core/elo_ratings.py`: incremental Elo from the in-repo martj42 CSV (one pass, <1 s at
   startup; the lab code in `scripts/lab_backtest_10y.py` is lift-ready). Neutral matches →
   no home term; WC2026 group stage = neutral except host nations at home (handled by the
   existing venue context).
2. Probabilities: logit([elo_diff, |elo_diff|]) with coefficients frozen from the last
   walk-forward fit (or refit weekly) → isotonic → market blend, identical downstream.
3. Fail-soft: missing rating (new team) → fall back to current Poisson path; model_version
   `football-worldcup-v2-elo`, A/B-able via `prediction_log` (migration 004 already snapshots
   `model_p_*`, so served-model benchmarking via `scripts/promotion_gate.py` works as-is).
4. Gate: promotion ONLY through `promotion_gate.py` green + human APPROVE (#HARNESS-1
   protocol). The lab gives the offline case; the gate gives the served-path case.

Timing is Andrea's call: the change is small and fail-soft, but kickoff is in 4 days; the
market blend (70% market once odds exist) caps the live downside either way — the biggest
gain is on the **paper tier and pre-odds windows**, which is exactly where the model is alone.

## Data still missing (next acquisitions, post-kickoff)

1. **Historical closing odds for internationals** (betexplorer/oddsportal scrape — no clean
   free CSV exists): unlocks blend/edge backtesting and a real "beat the closing line" KPI.
2. **Transfermarkt squad values** (dcaribou dataset, includes national teams): the literature's
   second-strongest feature; candidate as a second logit covariate post-WC.
3. xG for nationals: skip — historical coverage too thin to be a backbone.

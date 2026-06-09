# Prediction Systems — Improvement Research (existing models) — 2026-06-09

**Method:** 31-agent research (per-system: read our served code → research state of the art → propose) + adversarial verification on OUR harnesses + synthesis. 25 improvements evaluated: **2 strong, 8 plausible, 6 marginal, 9 refuted**.

## Headline (honest)
**The system is at the goals-only ceiling, exactly as expected.** There is **no model-form lever left that moves the served metric** — the gap to market is *information + calibration*, not model shape. The real roadmap is **calibration hygiene, harness correctness, and one genuine WC information signal.** Adversarial verification refuted most "obvious" upgrades on our own backtests (below the 0.001 Brier noise floor or wrong-sign).

## The roadmap (only what survived)

### 1. WC confederation-strength bias correction — **STRONG** · L · zero
- **Real signal:** inter-confederation Elo bias is statistically significant in OUR 49k-match history (CONMEBOL +0.039 z=2.98, CONCACAF −0.051 z=−3.59, CAF +0.048, OFC −0.225 z=−6.12).
- **Gain:** inter-confederation (= WC group stage) Brier **−0.013** walk-forward; full-neutral aggregate −0.002/−0.005. *Judge on the inter-conf/WC cut, not the diluted aggregate.*
- **Plan:** build full ~210-team FIFA confederation map → fit confederation-pair offsets on pre-cut inter-conf residuals (no lookahead) → Elo points → apply before the frozen logit → walk-forward on neutral-only + WC-only cuts (`lab_backtest_10y.py`) → gate + APPROVE. Pre-kickoff-SAFE (frozen artifact) but L-effort → **fast-follow, not pre-kickoff**.

### 2. Fix tennis production gate to score the SERVED probability — **STRONG** · M · zero
- **Gap:** the 0.2209 gate measures **pure Elo**, but users get 3 unvalidated post-hoc layers (form ±0.035, a **FIXED +0.02 H2H bump**, fatigue ±0.04). The gate doesn't measure what we serve.
- **Win:** correctness + de-risking; most probable concrete gain = **drop/shrink the untuned H2H bump** (football's own feature_adjuster caps H2H at 0.015). Durable Brier 0–0.002.
- **Plan:** refactor the served combine into ONE pure function called by both `agents/tennis_model_agent.py:_score_fixture` and a new served replay in `scripts/backtest_tennis_production.py`; ablate each layer on holdout 2025-26. **Prerequisite for trusting any other tennis change.**

### 3. Tennis Elo K 32→24 — **plausible** · S · zero (bundle behind #2)
- **Win:** ECE **0.0179→0.0099 (~45% lower)**, Brier flat, confirmed OOS on 2024 split + both ATP & WTA. On-thesis (we sell calibrated probabilities).
- ⚠️ **Dead-code trap:** `self.K` at `models/elo_surface.py:28` is DEAD; the live knob is `k_factor=32` at line 93. Production Neon ratings accrued at K=32 need re-derivation.
- Free rider in the same gate cycle: surface-blend cap **0.7→0.6** (ECE flat; **NOT 0.5** — that worsens ECE to 0.0224).

### 4. Recalibrate the SERVED (post-blend) football triple — **plausible** · M · zero
- **Gap:** we calibrate the *pre-blend* model (τ=1.20), but the only number users see is the post-blend served triple. Served ECE realistically **−5/−12%**, Brier neutral.
- **Plan:** extend `scripts/experiment-isotonic-export.ts` to devig Pinnacle closing → blend(α=0.3) → served, then fit ONE τ on the served output (drop the pre-blend τ to avoid double-correction). Refactors APPROVED #CALIB-1 → fresh gate + APPROVE. Football off-season → lower urgency.

## Not worth it (refuted / sub-noise — do not chase)
DC-τ on served grid (−0.0003, honesty-only) · disagreement-scaled α (~0.0007, a=0 still optimal) · shrinkage 4→6 (REFUTED, s4 best on temporal holdout) · opponent-adjusted rolling xG (+0.00008, double-counted) · npxG / xG-decay (sub-noise, unserved path) · log/geometric pooling (50× below noise; market is 70%) · beta calibration (worse than τ on our walk-forward) · per-class draw calibration (already done + rejected for OOT overfit) · conformal intervals (no UI, dormant betting agent) · WC neutral-only refit (wrong sign, +0.0015) · WC time-decay / online update (not backtestable now — CSV has no round/stage labels) · tennis MOV-K (noise) · WTA-specific K (no per-tour deficit) · Barnett-Clarke point model (doesn't beat tuned Elo) · rank→Elo cold-start prior (near-noise aggregate, L-effort) · live refit loop (only ~3 days of football-only data — build later with min-n guard).

## Recommended sequence
1. **#2 + #3 bundle** (tennis harness correctness + K=24 + cap 0.6) — cost-zero, tennis is LIVE now, fixes a false gate reading and ~halves ECE. Lowest risk, immediate.
2. **#1 WC confederation correction** — the one real information signal; L-effort fast-follow (post-kickoff).
3. **#4 served-football recalibration** — when football returns / as a calibration-honesty pass.

All require: backtest on existing harness → `npm run gate` green → human APPROVE before serving.

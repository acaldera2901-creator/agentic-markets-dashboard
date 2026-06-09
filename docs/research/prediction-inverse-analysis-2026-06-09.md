# Prediction Inverse-Analysis & Upgrade Study — 2026-06-09

**Owner:** Andrea via Claude Code · **Method:** live-data inverse analysis + 24-agent ultracode study + adversarial verification + read-only re-derivation on production harnesses
**Objective (Andrea):** reduce real losses in the final GTM window — win-rate of visible picks first, then model/calibration. Cost-zero prioritized. Verticals: football club, tennis (ATP+WTA), World Cup.

> **Status:** analysis + verification COMPLETE. No served code changed. Two PROPOSALs pending human APPROVE (gate).

---

## 0. Headline

The losses are **not** a model problem. Football is already xG-blended and gate-green; the WC served model is healthy. The one real **win-rate** lever is a **surfacing leak in tennis**: the confidence floor (60) is applied on the board but **bypassed by the adapter that feeds Match Builder / Creator Picks / v2**, so sub-60% picks (which hit <60%) leak onto user-facing surfaces. Fixing that is cost-zero with no volume tradeoff. Separately, the **WC promotion gate is currently RED** (stale baseline) and must be reconciled before go-live.

---

## 1. Inverse analysis on live settled data (Supabase, read-only)

### Tennis — 75 settled live picks (`tennis_predictions`, elo_surface_v4, mostly grass)
| Confidence | N | Live hit | Predicted |
|---|---:|---:|---:|
| ≥75% | 26 | 96.2% | 92.8% |
| 65–75% | 11 | 90.9% | 69.8% |
| 55–65% | 22 | 54.5% | 58.7% |
| <55% | 16 | 43.8% | 52.5% |
| **ALL** | **75** | **72.0%** | **70.8%** |

Aggregate calibration is good; losses cluster below ~65%. **Caveat (verified):** n=75 is mostly grass and noisy — the 55–65 band's 54.5% is small-sample. Re-derived on the full out-of-sample set below.

### Football club — paper ledger (`bets`)
87 won / 73 lost = **54.4%** win-rate. `profit_loss` is **NULL → ROI untracked**. No live `prediction_log` rows settled (all 3462 are WC/friendlies snapshots 7–21 Jun). Football is **not** the visible-loss source in this window; the blind spot is **measurement**, not the model.

---

## 2. Verification (read-only re-derivation on production harnesses)

### Tennis floor re-derived on FULL out-of-sample (n=8044, ATP+WTA, all surfaces — EloSurfaceModel replay)
Per-band hit-rate (exclusive), the production model is **monotone** — the team's floor=60 was a sound choice:

| Band | N | Hit |
|---|---:|---:|
| 0–52 | 732 | 52.7% |
| 52–55 | 1022 | 52.0% |
| 55–60 | 1456 | 56.7% |
| 60–65 | 1313 | **60.4%** |
| 65–70 | 1038 | 67.7% |
| 70–75 | 832 | 68.4% |
| 75+ | 1651 | 79.6% |

Floor sweep (pick shown iff conf ≥ floor):

| Floor | Shown | Hit | Vol kept |
|---:|---:|---:|---:|
| 60 (current) | 4834 | 69.9% | 60% |
| 65 | 3521 | 73.4% | 44% |

**Conclusion:** raising 60→65 is a **win-rate↔volume tradeoff** (+3.5pp hit, −27% volume; removed 60–65 band still wins 60%), **not** a bug fix. The live "coin-flip 54.5%" was grass small-sample noise; true forward is ~60%.

### Football served Brier (promotion gate, read-only)
`football brier 0.5942 / ece 0.0146 — OK`. The served TS model **already ingests xG** (w=0.5 blend + τ=1.20 + market α=0.3). The "xG never served / 0.601" framing was stale. Porting `models/xg_model.py` (LR-stack 0.582) to TS is **refuted**: its features are Dixon-Coles probs, not Poisson-TS — base-distribution mismatch, won't transfer.

### World Cup served-prob health (`prediction_log`, served model `football-worldcup-v2-elo`)
40 Day-1 fixtures: **0 uniform fallback, 0 clamped extremes**, top-prob range 0.376–0.901. No silent Poisson fallback on the served path. (The 20 uniform-fallback rows are on the non-served `v1` namespace.)

### World Cup promotion gate — **RED**
`wc brier 0.5451 → 0.5479 (Δ+0.0028 > tol 0.002) FAIL`. Cause: the WC model changed in APPROVED post-HARNESS commits (v2-elo + isotonic plateau-guard, 7 Jun) but `config/model-baselines.json` wc baseline was never re-aligned. The holdout overlaps the fit window ("regression detector only"), so this is **stale-baseline governance, not a skill regression** — but it must be reconciled before claiming "WC gate green".

### Tennis cold-start
119 launch-week players; **11 (9.2%) have no Elo row** → fabricated 50/50. These are <60 → nulled by the floor-everywhere fix, so the leak is contained; re-seeding the bootstrap is an honesty improvement, not a loss driver.

---

## 3. The real bug — tennis floor not enforced uniformly

- Floor lives in `lib/surfacing-gate.ts` (`SURFACE_FLOOR_TENNIS=60`) + `config/settings.py:170`, applied in `app/api/tennis/route.ts` → the **board** card nulls the pick below 60.
- BUT `lib/tennis-adapter.ts:53` (`syncTennisPredictionsToUnified`, called by `app/api/predictions/refresh`) writes `best_selection` **raw** into `unified_predictions`, with **no floor**. From there `/api/v2/predictions`, `/api/v2/history`, Match Builder and Creator-Picks projections surface the sub-floor pick.
- **Net:** the board hides weak tennis picks; every other surface shows them. This is the mechanism behind the visible losers.

---

## 4. Ranked plan (cost-zero first, verified)

| # | Lever | Vert. | Effect on losses | Effort | Cost | Gate |
|---|---|---|---|---|---|---|
| **1** | Enforce surfacing floor in the adapter sync (`syncTennisPredictionsToUnified` → null pick / `below_floor` when conf<floor; verify football/unified parity) | tennis | Removes <60% picks (hit <60%) from ALL surfaces — no volume tradeoff. **The win-rate lever.** | S | zero | ✅ APPROVE + tests |
| **2** | Reconcile WC gate baseline (`gate:update` to the served v2-elo numbers) so the gate is green and honest before go-live | WC | Governance; unblocks "gate green" claim | S | zero | ✅ APPROVE |
| 3 | (Decision, not bug) Raise tennis floor 60→65 | tennis | +3.5pp shown hit, −27% volume | S | zero | ✅ APPROVE — product call |
| 4 | Fix stale docstrings (`core/surfacing_gate.py:12`) + align WHY copy boundary (56→floor) | tennis | Text↔pick consistency | S | zero | no |
| 5 | Re-seed tennis Elo on live full-name key (warms the 11 cold-start players) | tennis | Probability honesty | M | zero | ✅ APPROVE (DB write + backup) |
| — | **Freeze WC model** (no refit in the 2-day window) | WC | Avoids unvalidated drift | S | zero | no |

### Post-launch (not GTM window)
- Populate `profit_loss` on the paper ledger → track football ROI (the real football blind spot).
- Totals/BTTS market-devig blend with its **own** walk-forward backtest + gate baseline before serving (add Under-2.5 leg to `lib/odds-api.ts`).

### Do NOT do (refuted/overstated)
Port xg_model.py LR-stack to TS · re-run backtest "on 2025" (already in artifact, byte-identical) · conformal intervals on cards (disabled subsystem, statistically invalid) · shrink-toward-50% in the route (overfit n=75, bypasses gate) · API-Football injuries into Poisson (no role/importance signal, unbacktestable) · live CLV badge now (~0 displayable picks at launch) · touch MATCHBOOK (load-bearing for WC odds/settlement).

---

## 5. Data spend audit
**Paying:** The Odds API (100K/mo, large — odds_snapshots 575k rows). **Free:** football-data.org, API-Football (Michele, 2022-24 only), OpenWeatherMap, Sackmann. **Dormant (no spend risk):** BALLDONTLIE (no NBA vertical), Polymarket (wallet key, not a subscription). No extra paid source is justified for the GTM window — every recommended lever is cost-zero.

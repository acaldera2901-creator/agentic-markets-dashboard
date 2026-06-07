# WC Elo v2 model — implementation report

Date: 2026-06-07 · Author: Andrea via Claude Code (ML engineer)
Mandate: APPROVE Andrea (deploy-gate) — implement `football-worldcup-v2-elo` with shadow A/B,
per the michele-claude lab (reproduced: neutral+iso Brier 0.5936→0.5452, acc 51.5→57.4%, wins
10/11 years). NO commit/push/deploy/restart — review by Andrea.

## Status

- **Built + Verified** (operating_standard §1). NOT operative: the v2 model is SHADOW only,
  logged to `prediction_log` for A/B. The served path is unchanged (Poisson v1). Promotion to
  served requires a separate explicit APPROVE from Andrea.

## Files touched

| File | Change |
|---|---|
| `core/world_cup_elo_model.py` | NEW — frozen-Elo → logit[Δelo, |Δelo|] → isotonic; `predict_wc_match(home, away, neutral=True) -> (p_home,p_draw,p_away) | None`. Coefficients frozen (hardcoded, lab `elo2`). |
| `data/national_teams/wc_elo_artifacts.json` | NEW — frozen team ratings snapshot + per-outcome isotonic knots (32 KB). Regenerable. |
| `scripts/freeze_wc_elo_artifacts.py` | NEW — deterministic regenerator for the artifacts (run after a CSV refresh). |
| `scripts/wc_elo_v2_compare_fixtures.py` | NEW — read-only v1-vs-v2 replay on the real WC2026 fixtures. |
| `agents/model.py` | Shadow wiring: `_log_wc_elo_v2_shadow` called at the end of `_persist_world_cup_paper`, isolated try/except; new `_wc_v2_snapshot_state`; import of v2 predictor. |
| `config/settings.py` | `WC_ELO_V2_MODEL_VERSION`, `WC_ELO_V2_SHADOW_VERSION`, `WC_ELO_V2_SHADOW_ENABLED`. |
| `scripts/promotion_gate.py` | `bench_wc_v2()` + `--wc-v2-compare` flag (v2-vs-v1 on the served-path holdout). Routine gate unchanged. |
| `tests/test_world_cup_elo_model.py` | NEW — 8 tests (determinism, fallback, shape, sanity, monotonicity, home term). |
| `tests/test_wc_elo_v2_shadow.py` | NEW — 5 tests (shadow fires, fallback, fail-soft, served-row identical, insert-on-change). |

## Design decisions (deviations vs spec, all noted)

1. **Frozen coefficients split.** Spec said "coefficienti CONGELATI … hardcoded nel modulo".
   Done: the logit `coef`/`intercept` are hardcoded in `world_cup_elo_model.py` with a comment
   citing the lab. The *ratings snapshot* and *isotonic knots* are too large to inline, so they
   live in `wc_elo_artifacts.json` (spec explicitly allowed "persisti i rating finali in un JSON
   in data/ rigenerabile con uno script"). A test asserts the hardcoded logit == the JSON logit
   (no silent drift). Logit fit = all matches `date < 2026-01-01` (last walk-forward fold);
   isotonic fit = pre-2021 (the lab's OOS train split).
2. **Shadow path = `prediction_log` via the existing Python writer** (`log_prediction_snapshot`,
   PostgREST), model_version `football-worldcup-v2-elo-shadow`. This is the "strada più pulita
   lato Python" the brief asked to choose: the served WC v1 snapshot already lands in the same
   table keyed by `model_version`, so v2-vs-v1 lives side-by-side in one table, no schema change.
   The enrichment-field option was rejected (would couple v2 to the served row payload).
3. **No `source_errors` in the model loop.** That mechanism is a `data_collector` concept; the
   model loop's fail-soft convention is `self.logger.warning(...)`. The shadow uses the same.
4. **Startup cost.** Brief flagged "~2 min ricalcolo è troppo per ogni ciclo". Resolved by the
   frozen JSON snapshot: no per-cycle Elo recompute — `predict_wc_match` is an O(1) lookup +
   logit + isotonic. The ~2 min recompute happens only in the offline regenerator script.

## Fail-soft (verified by test)

- Unknown team (no frozen rating) → `predict_wc_match` returns `None` → no shadow row, served
  v1 untouched (`test_shadow_skipped_for_unknown_team`).
- v2 raising → swallowed in `_log_wc_elo_v2_shadow`'s own try/except; the served upsert still
  ran (`test_shadow_failure_is_non_fatal_and_served_still_written`).
- Served unified row byte-identical with/without the shadow (`test_shadow_does_not_alter_served_row`).

## Verification

### Test suite

`./.venv/bin/python -m pytest` → **815 passed, 0 failed** (was 793+ baseline; +21 new). New
model + shadow tests: 13 passed.

### Promotion gate (v2 vs v1, served-path holdout — neutral 2025+, n=262, identical sample)

`./.venv/bin/python scripts/promotion_gate.py --wc-v2-compare`

| model | n | Brier | ECE | acc |
|---|---|---|---|---|
| v1 (served Poisson) | 262 | 0.5451 | 0.0466 | — |
| **v2 (Elo shadow)** | 262 | **0.4672** | 0.0601 | 0.6336 |

**ΔBrier v2−v1 = −0.0779** → ~39× the promotion tolerance (0.002) → **v2 WINS**. Caveat
(inherited from the gate's `bench_wc`): this holdout overlaps the logit fit window, so it is a
*regression detector / directional* check, not an absolute skill claim — the authoritative OOS
number is the lab's walk-forward (Brier 0.5936→0.5452 on the neutral+iso WC cut). ECE rises
slightly (0.047→0.060): the frozen isotonic was fit pre-2021; worth a re-fit window review
before promotion, but it does not change the verdict.

**GATE VERDICT: GREEN for v2.** Per #HARNESS-1 / ops/PROMOTION-GATE.md, promotion to served
still needs a SEPARATE human APPROVE from Andrea — not done here (shadow only).

### v1-vs-v2 on the 33 real WC2026 fixtures

`./.venv/bin/python scripts/wc_elo_v2_compare_fixtures.py` — all 33 teams rated, 0 fallback.
**20 same pick, 13 different.** The differences are exactly the opponent-adjustment flaw the lab
named (v1's 5y goal-rate averages can't tell a 3-0 vs San Marino from a 3-0 vs France):

| match | v1 H/D/A | v2 H/D/A | pick |
|---|---|---|---|
| Mexico vs South Africa | 0.34/0.32/0.34 | 0.83/0.12/0.05 | AWAY→HOME |
| South Korea vs Czech Republic | 0.51/0.24/0.25 | 0.50/0.26/0.24 | HOME (same) |
| Canada vs Bosnia | 0.67/0.20/0.13 | 0.76/0.16/0.08 | HOME (same) |
| United States vs Paraguay | 0.63/0.23/0.13 | 0.41/0.28/0.31 | HOME (same) |
| Qatar vs Switzerland | 0.29/0.23/0.48 | 0.08/0.16/0.77 | AWAY (same) |
| Brazil vs Morocco | 0.31/0.34/0.35 | 0.50/0.26/0.24 | AWAY→HOME |
| Haiti vs Scotland | 0.53/0.22/0.26 | 0.28/0.26/0.47 | HOME→AWAY |
| Australia vs Turkey | 0.53/0.24/0.23 | 0.31/0.27/0.42 | HOME→AWAY |
| Germany vs Curaçao | 0.50/0.22/0.28 | 0.81/0.12/0.07 | HOME (same) |
| Ivory Coast vs Ecuador | 0.49/0.30/0.21 | 0.19/0.23/0.58 | HOME→AWAY |
| Netherlands vs Japan | 0.30/0.23/0.46 | 0.43/0.27/0.30 | AWAY→HOME |
| Sweden vs Tunisia | 0.26/0.29/0.45 | 0.43/0.27/0.30 | AWAY→HOME |
| Belgium vs Egypt | 0.40/0.29/0.31 | 0.54/0.26/0.20 | HOME (same) |
| Iran vs New Zealand | 0.53/0.24/0.23 | 0.61/0.23/0.16 | HOME (same) |
| Spain vs Cape Verde | 0.59/0.24/0.17 | 0.90/0.08/0.02 | HOME (same) |
| Saudi Arabia vs Uruguay | 0.24/0.33/0.43 | 0.11/0.21/0.68 | AWAY (same) |
| France vs Senegal | 0.31/0.30/0.39 | 0.65/0.22/0.13 | AWAY→HOME |
| Iraq vs Norway | 0.25/0.27/0.47 | 0.19/0.23/0.58 | AWAY (same) |
| Argentina vs Algeria | 0.39/0.29/0.32 | 0.76/0.16/0.08 | HOME (same) |
| Austria vs Jordan | 0.47/0.26/0.27 | 0.53/0.26/0.20 | HOME (same) |
| Portugal vs DR Congo | 0.56/0.27/0.17 | 0.70/0.21/0.09 | HOME (same) |
| Uzbekistan vs Colombia | 0.32/0.30/0.37 | 0.19/0.23/0.58 | AWAY (same) |
| England vs Croatia | 0.63/0.21/0.16 | 0.54/0.26/0.20 | HOME (same) |
| Ghana vs Panama | 0.41/0.27/0.32 | 0.19/0.23/0.58 | HOME→AWAY |
| Czech Republic vs South Africa | 0.29/0.28/0.43 | 0.54/0.26/0.20 | AWAY→HOME |
| Mexico vs South Korea | 0.31/0.28/0.41 | 0.63/0.23/0.15 | AWAY→HOME |
| Switzerland vs Bosnia | 0.60/0.22/0.18 | 0.75/0.16/0.09 | HOME (same) |
| Canada vs Qatar | 0.56/0.22/0.22 | 0.85/0.12/0.04 | HOME (same) |
| Scotland vs Morocco | 0.10/0.21/0.68 | 0.24/0.26/0.50 | AWAY (same) |
| Brazil vs Haiti | 0.60/0.22/0.18 | 0.76/0.16/0.08 | HOME (same) |
| United States vs Australia | 0.32/0.28/0.40 | 0.45/0.27/0.28 | AWAY→HOME |
| Turkey vs Paraguay | 0.56/0.25/0.20 | 0.45/0.26/0.28 | HOME (same) |
| Germany vs Ivory Coast | 0.30/0.24/0.46 | 0.63/0.23/0.13 | AWAY→HOME |

Reading: where v1 is near a 3-way coin flip (Mexico/SA 0.34/0.32/0.34, Brazil/Morocco
0.31/0.34/0.35, Argentina/Algeria 0.39/…), v2 resolves the favourite the way the bookmaker
would. That is the lab's whole thesis, visible on the live slate.

## Not done (out of scope / gated)

- **Live shadow cycle against the real fixture feed.** Needs `.env` (DB + API-Football) and a
  running model loop; I did not source secrets or start any service (vincolo: no restart). The
  shadow WIRING is unit-tested end-to-end with mocked PostgREST, and the v2 numbers on the real
  fixtures are produced offline by `wc_elo_v2_compare_fixtures.py`. When the loop next runs with
  `WC_ELO_V2_SHADOW_ENABLED=True`, each WC cycle will write a `…-v2-elo-shadow` row per rated
  match. **Recommend Andrea run one real cycle and eyeball the `prediction_log` rows before
  considering promotion.**
- **Promotion to served.** Gated by a separate explicit APPROVE (= production deploy).

## Recommendation

Gate is green and the live-slate behaviour is sane and directionally correct. Before promotion:
(1) run one real shadow cycle to confirm the writer fires against the live feed; (2) review the
slight ECE rise (consider re-fitting the isotonic on a more recent window). Promotion itself
needs your explicit APPROVE.

# WC accuracy — P1 altitude · P2 heat-risk · P3 venue-factor backtest

Date: 2026-06-07
Author: Andrea via Claude Code (ML engineer)
Mandate: APPROVE deploy-gate + direct execution of P1+P2+P3 from michele-claude's
PROPOSAL (`msg_mq3ufltj`).
Branch: `main` @ `d277a8c` (venue-city aliases merge — pulled, up to date).
Constraints honoured: NO commit/push/deploy/restart · DB read-only · review pending.

---

## Summary verdict

| Part | Status | Note |
|---|---|---|
| P1 Altitude | DONE + VERIFIED | `venue_altitude_m` + `altitude_delta_*` in context/enrichment; why line >1000 m. 16/16 venues covered. |
| P2 Heat-risk | DONE + VERIFIED | `heat_risk` + `venue_indoor` flags; why line when true. Probabilities untouched. |
| P3 Backtest | DONE — **BOCCIA all three factors** | travel/rest/altitude add no out-of-sample skill once strength+host are controlled. P4 (model weights) must NOT proceed. |

Full test suite: **793 passed** (was 776; +13 altitude/heat unit tests, +4 explanation
tests). No NaN/None leakage in enrichment (verified on real renders below).

---

## P1 — Altitude (additive, zero risk)

Files touched:
- `core/world_cup_venue_context.py` — `HOST_CITY_ALTITUDE_M` (16 cities + aliases),
  `TEAM_HOME_ALTITUDE_M`, `venue_altitude_m()`, `team_home_altitude_m()`; new keys
  `venue_altitude_m`, `altitude_delta_team_a/b` in `enrich_venue_context`.
- `core/world_cup_context.py` — propagates the new fields through
  `WorldCupContext` + `build_world_cup_context` (NOT part of the completeness gate
  — pure display).
- `core/world_cup_explanation.py` — `altitude_m`/`altitude_delta_*` in the venue
  enrichment block; `_altitude_phrase()` adds a why line only when `altitude_m >
  1000`.
- `agents/model.py` — wires the context fields into the enrichment `venue` dict.

Altitude values (verified 2026-06-07 vs public elevation / stadium data; the AP/TSN
"Mexico City altitude" coverage confirms Azteca ~2,200-2,240 m and Akron/Guadalajara
1,566 m as the only documented competitive-altitude venues):

| City | m | | City | m |
|---|---|---|---|---|
| Mexico City (Azteca) | 2240 | | Kansas City | 270 |
| Guadalajara (Akron) | 1566 | | Boston (Foxborough) | 43 |
| Monterrey (BBVA) | 540 | | Toronto | 76 |
| Atlanta | 320 | | Philadelphia | 12 |
| Dallas (Arlington) | 140 | | New York (E. Rutherford) | 3 |
| Houston | 15 | | San Francisco (Santa Clara) | 3 |
| Los Angeles (Inglewood) | 30 | | Miami | 2 |
| Seattle | 50 | | Vancouver | 2 |

Aliases (arlington→dallas, inglewood→los angeles, guadalupe→monterrey, etc.) resolve
to the metro altitude — tested. Only Mexico City and Guadalajara clear the 1000 m
why-line threshold.

`altitude_delta_team_x = venue_altitude_m − team_home_altitude_m`. Absent team
home-altitude → delta is `None` (never fabricated 0). The why line names the side
with the largest climb when it is ≥1000 m.

## P2 — Heat-risk (additive, zero risk)

Files touched: same `world_cup_venue_context.py` / `world_cup_context.py` /
`world_cup_explanation.py` / `model.py`.

- `VENUE_INDOOR` (verified 2026-06-07): the four climate-controlled / roofed venues
  are **Atlanta** (Mercedes-Benz, AC), **Dallas/Arlington** (AT&T, AC), **Houston**
  (NRG, AC), **Vancouver** (BC Place, roof). SoFi (LA/Inglewood) has a fixed canopy
  but is **not** fully air-conditioned → stays outdoor.
- `HOT_CLIMATE_CITIES` = {miami, monterrey, guadalajara, kansas city, philadelphia,
  dallas, houston, atlanta, los angeles} — documented US-South / interior + central
  Mexico summer heat for the Jun/Jul window. Conservative: northern/coastal-cool
  sites (seattle, boston, NY, SF, toronto, vancouver) excluded.
- `heat_risk_flag(city, kickoff)` = `True` iff venue is **outdoor** AND in a
  **hot-climate** city AND local kickoff hour ∈ [12:00, 17:00). Indoor venues are
  always `False`; unknown city / missing kickoff → `None` (fail-soft, never a
  silent `False`). `venue_indoor` exposed alongside.
- `_heat_phrase()` adds a why line only when `heat_risk is True`.
- **NO probability adjustment.** OpenWeatherMap wiring intentionally out of scope.

## Verified — real enriched `why` renders (end-to-end through the served code path)

Rendered via `enrich_venue_context → build_world_cup_context → build_wc_enrichment
→ build_wc_explanation` on the real 49k-match history (no fabrication, no NaN):

**Azteca (altitude fires, no heat — evening):** Mexico vs Germany, Mexico City,
group. `venue_altitude_m=2240, altitude_delta_away=2206, indoor=False, heat_risk=False`
> "… Played at 2,240m altitude — Germany climb ~2,206m above their usual base;
> visiting sides typically tire in the closing stages. …"

**Heat (fires, no altitude — sea level):** Brazil vs Morocco, Miami, 14:00 EDT.
`venue_altitude_m=2, indoor=False, heat_risk=True`
> "… Midday outdoor kickoff in summer heat — fatigue and tempo risk for both
> sides. …"

**Control (indoor + sea level → neither line):** Argentina vs Spain, Houston, 14:00
CDT. `venue_altitude_m=15, indoor=True, heat_risk=False` → no altitude line, no
heat line, clean output ending "Bet responsibly."

---

## P3 — Backtest: do travel / rest / altitude carry OOS predictive power?

Tool: `scripts/backtest_venue_factors.py` (analysis only — does not touch any
served model). Multinomial logistic regression, standardized features, expanding-
window temporal walk-forward (5 folds), market-free skill baseline.

- **Sample**: 619 matches (516 OOS-scored), since 2002, where venue city +
  both teams' home coords + both home-altitudes are resolvable (no imputation).
  Americas + documented high-altitude venues. Outcomes: home 280 / draw 169 / away 170.
- **Baseline (without the factor)**: rolling leakage-free strength gap (last-10
  goal-difference form) + host indicator. Brier **0.6421**, log-loss **1.0630**.

| Factor (added to baseline) | OOS Brier | ΔBrier | OOS log-loss | Δlog-loss | Verdict |
|---|---|---|---|---|---|
| travel_diff_km | 0.6440 | **+0.0019** | 1.0653 | +0.0023 | **BOCCIA** |
| rest_diff | 0.6462 | **+0.0041** | 1.0694 | +0.0064 | **BOCCIA** |
| alt_delta_diff | 0.6427 | **+0.0006** | 1.0655 | +0.0025 | **BOCCIA** |
| all three together | 0.6496 | +0.0075 | 1.0760 | +0.0129 | **BOCCIA** |

Every factor **worsens** out-of-sample calibration. Gate criterion (improve Brier
by ≥ the gate tolerance 0.002 AND improve log-loss) is met by none.

Coefficients (multinomial logit, away-win class, standardized, bootstrap SE n=200):

| Feature | coef | SE | z |
|---|---|---|---|
| strength_gap | −0.2675 | 0.0695 | −3.85 |
| host | −0.1792 | 0.0654 | −2.74 |
| travel_diff_km | −0.0386 | 0.0632 | −0.61 |
| rest_diff | −0.0271 | 0.0550 | −0.49 |
| alt_delta_diff | +0.0962 | 0.0628 | +1.53 |

Only strength and host are significant. travel/rest are statistical noise (|z|<1).
alt_delta is borderline (z=1.53) and its sign reflects a **team-quality confound**
(high-altitude home teams — Bolivia/Ecuador/Colombia — are simply strong at home),
not a clean venue effect.

### Altitude — the descriptive effect IS real, but already absorbed

Direct descriptive split (non-neutral matches since 1990, by how far the venue sits
above the away team's habitual altitude):

| Venue vs away-team altitude | n | home win | draw | away win | away pts/game |
|---|---|---|---|---|---|
| ≥ 1500 m above | 231 | 0.597 | 0.238 | **0.165** | **0.73** |
| < 1500 m above | 1380 | 0.533 | 0.258 | **0.209** | **0.89** |

So away sides do underperform at very-high-altitude venues (16.5% vs 20.9% win
rate) — consistent with the literature. **But** this raw gap is confounded with
home-team strength + home advantage, and once `strength_gap` + `host` are in the
model the residual altitude information adds nothing out-of-sample (ΔBrier +0.0006).

### P3 verdict per factor (promotion gate spirit, #HARNESS-1)

- **travel_km — BOCCIA.** No OOS improvement (worsens Brier/log-loss), z=−0.61.
- **rest_days — BOCCIA.** Largest OOS regression, z=−0.49.
- **altitude_delta — BOCCIA for model promotion.** Real descriptive effect but no
  incremental OOS skill over strength+host; would only re-introduce a confound and
  risk market divergence (the blend lesson). Keep it as **display context only**
  (P1) — which is exactly what shipped.

**Conclusion: P4 (model weights from these factors) must NOT proceed.** The honest
result is that these venue factors are good *narrative* context (P1/P2 display) and
poor *predictive* features at this sample/resolution. Any future attempt needs a
materially larger Americas-venue sample and must still pass `promotion_gate.py`
green on the served model + human APPROVE before touching probabilities.

---

## Files touched

- `core/world_cup_venue_context.py` (P1+P2 tables + lookups + enrich fields)
- `core/world_cup_context.py` (propagate 5 new fields through the context)
- `core/world_cup_explanation.py` (altitude/heat enrichment + why phrases)
- `agents/model.py` (wire context → enrichment venue dict)
- `tests/test_wc_venue_altitude_heat.py` (NEW, 13 tests)
- `tests/test_world_cup_explanation.py` (+4 tests)
- `scripts/backtest_venue_factors.py` (NEW, P3 analysis only)

Reproduce: `./.venv/bin/python -m pytest -q` (793 passed) ·
`./.venv/bin/python scripts/backtest_venue_factors.py` (P3 tables above).

## Risks / notes for review

- P1/P2 are display-only and probability-neutral by construction (asserted by
  tests; the served national-Poisson + isotonic path is untouched).
- The new context fields are NOT in the `data_completeness_score` gate, so they
  cannot block or change publication status.
- P3 sample (619) is modest; the BOCCIA is robust (factors regress, not merely
  fail to help) but a larger sample could be revisited post-tournament with real
  WC2026 matches at Azteca/Akron.

// #CALIB-1 (APPROVE Andrea 2026-06-07): temperature scaling of the served
// football model probabilities, applied BEFORE the market blend.
//
// Provenance: walk-forward replay of the served model (scripts/
// experiment-isotonic-export.ts, production w=0.5, understat 2021-2024) showed
// the model is consistently slightly overconfident — tau fitted on two
// temporally disjoint holdouts landed at 1.18 (holdout 2024) and 1.22
// (holdout 2023). tau = 1.20 is the mean. Out-of-time effect: ECE
// 0.0175 -> 0.0142 (holdout 2024), Brier unchanged. IsotonicRegression was
// REJECTED by the same experiment (Brier degraded out-of-time — in-sample
// gains were overfitting; see scripts/experiment_isotonic.py).
//
// tau > 1 flattens the distribution: overconfident favourites come down, the
// systematically under-predicted draw (23.3% predicted vs 25.0% observed)
// comes up. tau = 1.0 is the exact identity (instant rollback knob).
//
// Scope: club football TS pipeline only. The WC national model and tennis Elo
// are different models — this tau does not transfer. /api/research/calibration
// monitors live calibration so each model can earn its own correction from
// settled data (revisit after the WC group stage).
//
// ─── #CALIB-4 (2026-09-10): tau 1.20 -> 1.00, on our OWN settled data ───────
//
// The revisit above is this one, and the monitor gave the answer the original
// author asked it for. tau = 1.20 was fitted on understat 2021-2024 — an
// EXTERNAL dataset, a different model — to correct an overconfidence that our
// served data does not show. Two of its premises fail on us:
//
//   * the under-predicted draw that justifies flattening (23.3% vs 25.0%) is
//     ~1.3 sigma on our 1.067 settled matches, i.e. noise, and P(0-0) comes
//     out OVER-predicted, not under.
//   * the direction is backwards. Optimal temperature on `prediction_log`
//     (1.254 matches, one row per match — last snapshot before kickoff —
//     11/06 -> 10/09, train/holdout split in time) lands BELOW 1 on all three
//     independent series: served 0.86, raw model 0.92, market 0.94. Our
//     probabilities are too FLAT, not too sharp. tau = 1.20 makes that worse:
//     out-of-sample Brier vs tau = 1.00 is +0.0038 (served), +0.0017 (model),
//     +0.0027 (market) — worse than doing nothing, on all three.
//
// Why 1.00 and not 0.86, which scored best: the MARKET also wants t < 1, and
// the market never passes through tau. A correction the benchmark wants too is
// a property of the period, not of our model — fitting it is exactly how the
// isotonic regression above earned its rejection. So the sharpening we take is
// only the part we can defend: removing a correction fitted elsewhere.
//
// What is actually proven (and what is not). Accuracy: the paired difference
// is +0.00109 Brier, CI 95% [-0.00163, +0.00380], 5 of 8 walk-forward windows
// — tau = 1.00 is NOT measurably more accurate. Calibration: on the 1X2 side
// we serve at >= 55%, tau = 1.20 declares 63.9% and delivers 71.4%, an error
// of +7.5pt at z = +2.96 (significantly UNDER-confident); tau = 1.00 declares
// 66.1% and delivers 66.5%, +0.3pt at z = +0.15. For a number shown to a user
// as a probability, being right is the requirement — and that is the claim
// this change rests on, not a sharper model.
//
// Product effect, measured on the same 1.254 matches: the headline percentage
// rises on 1.254 of 1.254 cards and falls on none (+3.09pt mean, +5.29pt on
// cards already above 55%), and cards above 55% go 350 -> 465.
//
// The promotion gate (ops/PROMOTION-GATE.md) is GREEN, and its numbers are the
// most instructive part of this change, so they are recorded rather than just
// passed: football Brier 0.5942 -> 0.5942 (delta 0.0000) and football ECE
// 0.0146 -> 0.0175 (delta +0.0029, tolerance +0.005). The ECE gets WORSE. That
// is not a detail to bury — on understat 2024 tau = 1.20 genuinely helps, and
// 0.0175 is exactly the pre-tau figure the #CALIB-1 comment above reports. The
// two measurements do not contradict each other: they say understat 2024 and
// the population we actually serve are different populations. Understat is the
// big five European leagues; we serve MLS, Eliteserien, Allsvenskan, Portugal,
// Mexico, Greece, Brazil, Argentina. A calibration belongs to the population it
// is served on, so the correction fitted on the other one goes — but the gate
// keeps watching it, and if this reasoning is wrong the ECE there is where it
// will show first.
//
// Rollback is one character: back to 1.2. Nothing else changes — there is a
// single production call site (app/api/predictions/route.ts), no Python
// counterpart to keep in parity (core/wc_calibration.py is a different model
// and says so), and no test pins this value.

import type { TripleProb } from "@/lib/poisson-model";

export const CALIBRATION_TAU = 1.0;

export function applyTemperature(p: TripleProb, tau: number = CALIBRATION_TAU): TripleProb {
  if (tau === 1.0) return p;
  if (!(tau > 0) || !isFinite(tau)) return p; // fail-safe: bad tau = identity
  const h = Math.pow(Math.max(p.pHome, 1e-9), 1 / tau);
  const d = Math.pow(Math.max(p.pDraw, 1e-9), 1 / tau);
  const a = Math.pow(Math.max(p.pAway, 1e-9), 1 / tau);
  const s = h + d + a;
  if (!(s > 0)) return p;
  return { pHome: h / s, pDraw: d / s, pAway: a / s };
}

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

import type { TripleProb } from "@/lib/poisson-model";

export const CALIBRATION_TAU = 1.2;

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

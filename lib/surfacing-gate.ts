// Confidence-surfacing gate — TS mirror of core/surfacing_gate.py (Wave 1,
// APPROVE Andrea 2026-06-08).
//
// SINGLE SOURCE OF TRUTH: config/settings.py SURFACE_FLOOR_FOOTBALL (56). This
// module mirrors only the club-football floor: the TS predictions route serves
// domestic club leagues, while World Cup and international friendlies are served
// by the Python national path (which reads the floors from settings directly).
// Keep this constant in sync with settings.py — tests/surfacing-gate.test.ts
// pins the value.
//
// PROBABILITY-NEUTRAL: this decides only whether a row is surfaced as a
// directional pick. It never touches p_home/p_draw/p_away or confidence_score.

export const SURFACE_FLOOR_FOOTBALL = 56;

export type SurfaceDecision = {
  isPick: boolean;
  belowFloor: boolean;
};

// `confidence` is the picked-outcome probability in whole percent (max-prob).
// The floor is inclusive: confidence >= floor surfaces a directional pick.
export function surfaceDecision(
  confidence: number,
  floor: number = SURFACE_FLOOR_FOOTBALL
): SurfaceDecision {
  const isPick = confidence >= floor;
  return { isPick, belowFloor: !isPick };
}

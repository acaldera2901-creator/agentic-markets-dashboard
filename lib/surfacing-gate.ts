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
// International friendlies floor (heavy rotation → noisier). Mirror of
// config/settings.py SURFACE_FLOOR_FRIENDLY (61).
export const SURFACE_FLOOR_FRIENDLY = 61;
// Tennis floor (10y lab 2026-06-08: tennis confidence IS monotone; the earlier
// "no floor" was a 60-match artifact). Keep in sync with config/settings.py
// SURFACE_FLOOR_TENNIS. Applied by the tennis predictions route.
export const SURFACE_FLOOR_TENNIS = 62;

export type SurfaceDecision = {
  isPick: boolean;
  belowFloor: boolean;
};

// Resolve the surfacing floor for a row from its sport + competition. Mirrors
// core/surfacing_gate.py: tennis → tennis floor; football → friendly floor for
// international friendlies, otherwise the football floor (WC + competitive club).
export function surfaceFloorFor(
  sport: string | null | undefined,
  competition: string | null | undefined
): number {
  if ((sport ?? "").toLowerCase() === "tennis") return SURFACE_FLOOR_TENNIS;
  const isFriendly = (competition ?? "").toLowerCase().includes("friendly");
  return isFriendly ? SURFACE_FLOOR_FRIENDLY : SURFACE_FLOOR_FOOTBALL;
}

// Was this settled row actually surfaced as a directional pick? A row whose
// confidence sat below its floor was shown as "no clear favourite" (no pick),
// so it must NOT count toward the public hit-rate. A null confidence cannot be
// proven to have been surfaced → excluded (fail-closed, defensive).
export function isSurfacedRow(row: {
  sport?: string | null;
  competition?: string | null;
  confidence_score?: number | null;
}): boolean {
  const c = row.confidence_score;
  if (c == null) return false;
  return c >= surfaceFloorFor(row.sport, row.competition);
}

// `confidence` is the picked-outcome probability in whole percent (max-prob).
// The floor is inclusive: confidence >= floor surfaces a directional pick.
export function surfaceDecision(
  confidence: number,
  floor: number = SURFACE_FLOOR_FOOTBALL
): SurfaceDecision {
  const isPick = confidence >= floor;
  return { isPick, belowFloor: !isPick };
}

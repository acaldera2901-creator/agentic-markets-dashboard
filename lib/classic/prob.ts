// lib/classic/prob.ts — #CLASSIC-CARD-1008: il sottoinsieme di betredge/v3c-fixq:lib/v3c/prob.ts
// (0909e2eb) che serve qui. Copiato così com'è, senza i tipi di contracts.ts (che restano in v3c).
import { bookmakerMargin, noVigProbabilities } from "@/lib/betting-math";
import { MARKET_BLEND_ALPHA } from "@/lib/poisson-model";

/** Served football blend: estimate = MODEL_WEIGHT·model + MARKET_WEIGHT·market. */
export const MODEL_WEIGHT = MARKET_BLEND_ALPHA;
export const MARKET_WEIGHT = 1 - MARKET_BLEND_ALPHA;

export function roundP(x: number): number {
  return Math.round(x * 10_000) / 10_000;
}

function finitePos(x: number | null | undefined): x is number {
  return typeof x === "number" && Number.isFinite(x) && x > 1;
}

/** De-vigged 1X2 market + the margin removed (proportional). null when any leg is missing. */
export function market1x2(
  price: { home: number | null | undefined; draw: number | null | undefined; away: number | null | undefined },
): { p: { home: number; draw: number; away: number }; margin: number } | null {
  if (!finitePos(price.home) || !finitePos(price.draw) || !finitePos(price.away)) return null;
  const legs = [price.home, price.draw, price.away];
  const p = noVigProbabilities(legs);
  const margin = bookmakerMargin(legs);
  if (!p || margin == null) return null;
  return { p: { home: p[0], draw: p[1], away: p[2] }, margin };
}

/** De-vigged 2-way market (tennis moneyline) + margin removed. */
export function market2way(
  p1: number | null | undefined,
  p2: number | null | undefined,
): { p1: number; p2: number; margin: number } | null {
  if (!finitePos(p1) || !finitePos(p2)) return null;
  const p = noVigProbabilities([p1, p2]);
  const margin = bookmakerMargin([p1, p2]);
  if (!p || margin == null) return null;
  return { p1: p[0], p2: p[1], margin };
}

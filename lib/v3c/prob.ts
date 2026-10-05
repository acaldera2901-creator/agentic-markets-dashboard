// The probability arithmetic every v3 endpoint shares. One function per number,
// so market% / estimate% / edge cannot drift between board, line movement,
// record and calibration.
import { bookmakerMargin, noVigProbabilities } from "@/lib/betting-math";
import { MARKET_BLEND_ALPHA } from "@/lib/poisson-model";
import type { Outcome, Triple } from "./contracts";

export const OUTCOMES: readonly Outcome[] = ["home", "draw", "away"] as const;

/** Served football blend: estimate = MODEL_WEIGHT·model + MARKET_WEIGHT·market. */
export const MODEL_WEIGHT = MARKET_BLEND_ALPHA;
export const MARKET_WEIGHT = 1 - MARKET_BLEND_ALPHA;

export function roundP(x: number): number {
  return Math.round(x * 10_000) / 10_000;
}

export function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function finitePos(x: number | null | undefined): x is number {
  return typeof x === "number" && Number.isFinite(x) && x > 1;
}

/**
 * De-vigged 1X2 market + the margin removed, from decimal prices.
 * Proportional method (lib/betting-math noVigProbabilities) — the same one
 * prediction_log.market_p_* is computed with (verified: max diff 0 on prod).
 * null when any leg is missing: we never fabricate a market.
 */
export function market1x2(
  price: { home: number | null | undefined; draw: number | null | undefined; away: number | null | undefined },
): { p: Triple; margin: number } | null {
  if (!finitePos(price.home) || !finitePos(price.draw) || !finitePos(price.away)) return null;
  const legs = [price.home, price.draw, price.away];
  const p = noVigProbabilities(legs);
  const margin = bookmakerMargin(legs);
  if (!p || margin == null) return null;
  return { p: { home: p[0], draw: p[1], away: p[2] }, margin };
}

/**
 * De-vigged 2-way market (tennis moneyline) + margin removed. Same proportional
 * method as market1x2 and as the partner ingest (lib/partner-fixtures devig2vie).
 */
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

/** (estimate − market) in signed percentage points, 2 decimals. */
export function edgePp(estimate: number, market: number | null): number | null {
  if (market == null || !Number.isFinite(market)) return null;
  return round2((estimate - market) * 100);
}

/** Outcome with the highest probability; ties resolve home > draw > away. */
export function topOutcome(t: Triple): Outcome {
  let best: Outcome = "home";
  for (const o of OUTCOMES) if (t[o] > t[best]) best = o;
  return best;
}

/** "HOME" | "DRAW" | "AWAY" (settlement outcome) → Outcome. */
export function parseOutcome(raw: string | null | undefined): Outcome | null {
  const s = String(raw ?? "").trim().toUpperCase();
  if (s === "HOME") return "home";
  if (s === "DRAW") return "draw";
  if (s === "AWAY") return "away";
  return null;
}

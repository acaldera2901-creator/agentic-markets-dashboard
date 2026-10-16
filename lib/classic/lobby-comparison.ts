import type { ClassicView } from "./card-view";

/** Display eligibility only. Never changes valueAllowed, prices, or pick access.
 * Elo remains explicitly labelled and unsealed, with the same freshness checks
 * as its card; only comparisons within the 15-point raw guard enter the rail. */
export function comparisonGap(view: ClassicView | null): number | null {
  if (!view || view.started || !["estimate", "elo_blend"].includes(view.kind)) return null;
  if (view.guard.level !== "ok" || (view.guard.delta_pp ?? Infinity) > 15) return null;
  if (view.gapPp == null || !Number.isFinite(view.gapPp) || view.gapPp === 0) return null;
  // A tempered tennis estimate is often within 1.5 points of the market.
  // The card keeps its "in line" label; inclusion is not a value endorsement.
  if (view.kind === "estimate" && view.flat) return null;
  return Math.abs(view.gapPp);
}

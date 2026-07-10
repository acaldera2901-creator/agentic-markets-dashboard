import type { PickCardVM } from "./pick-view-model";

export function selectPickOfDay(picks: PickCardVM[]): string | null {
  let best: PickCardVM | null = null;
  for (const p of picks) {
    if (p.locked) continue;
    if (!best || (p.confidenceScore ?? 0) > (best.confidenceScore ?? 0)) best = p;
  }
  return best?.id ?? null;
}

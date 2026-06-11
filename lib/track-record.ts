// #HITRATE-GUARD-1 (copy audit 2026-06-11, Andrea: anchor comms to sustainable
// rates, never small-sample spikes like the 93.8% football day-one figure).
//
// A published hit-rate is a CLAIM. Below this many decided picks (won+lost) the
// percentage is variance, not signal — at 4 settled matches a 75% reads like a
// promise the next weekend will break. Until the threshold is met the UI shows
// the raw record (X won · Y lost) and no percentage, everywhere a rate renders:
// WC TrackRecordStrip, History KPIs, desk header KPI, house banners.
// Sustainable anchors (walk-forward held-out): WC ~64-67%, club ~70%,
// friendlies ~74%, qualifiers ~75%, tennis ~72%.
export const MIN_DECIDED_FOR_RATE = 15;

export function isRateMeaningful(decided: number): boolean {
  return Number.isFinite(decided) && decided >= MIN_DECIDED_FOR_RATE;
}

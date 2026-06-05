import type { AccessState } from "@/lib/auth";

// Fields that are ALWAYS visible (the populated board: who plays, when).
const PUBLIC_FIELDS = [
  "id", "sport", "competition", "league", "event_name",
  "home_team", "away_team", "starts_at", "status",
] as const;

// Fields revealed only when a row is "unlocked" for the state.
// `result`/`settled_at` are the real settled outcome (won/lost) — the honest track
// record, not money — revealed alongside the pick when the row is unlocked.
const REVEAL_FIELDS = [
  "pick", "p_home", "p_draw", "p_away", "confidence_score",
  "fair_odds", "market", "signal_type", "explanation", "model_version",
  "is_paper", "affiliate", "result", "settled_at",
] as const;

// Premium-only extra fields (advanced depth).
const PREMIUM_FIELDS = ["closing_line_value", "stake_suggestion", "edge_percent"] as const;

export type ProjectedPrediction = Record<string, unknown> & { locked: boolean };

// A row is unlocked when the state pays (base/premium/admin) OR the row is the
// free Pick of the Day (revealed to free + anonymous teaser).
export function isUnlocked(state: AccessState, isPickOfDay: boolean): boolean {
  if (state === "base" || state === "premium" || state === "admin_full") return true;
  if (state === "free" && isPickOfDay) return true;
  return false; // anonymous, pending_payment, free(non-PotD)
}

export function projectPrediction(
  row: Record<string, unknown>,
  state: AccessState,
  isPickOfDay: boolean
): ProjectedPrediction {
  const out: Record<string, unknown> = {};
  for (const f of PUBLIC_FIELDS) out[f] = row[f];
  out.pick_of_day = isPickOfDay;

  const unlocked = isUnlocked(state, isPickOfDay);
  if (unlocked) {
    for (const f of REVEAL_FIELDS) if (f in row) out[f] = row[f];
    if (state === "base" || state === "premium" || state === "admin_full") {
      for (const f of PREMIUM_FIELDS) if (f in row) out[f] = row[f];
    }
  }
  return { ...out, locked: !unlocked } as ProjectedPrediction;
}

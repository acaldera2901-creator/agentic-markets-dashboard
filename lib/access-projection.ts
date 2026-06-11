import type { AccessState } from "@/lib/auth";

// Fields that are ALWAYS visible (the populated board: who plays, when).
// `result`/`settled_at` are the settled outcome (won/lost/void) — a public fact
// like the final score, so the honest track record (hit rate, settled history)
// stays visible even on locked rows. The PICK itself remains gated below.
const PUBLIC_FIELDS = [
  "id", "sport", "competition", "league", "event_name",
  "home_team", "away_team", "starts_at", "status",
  "result", "settled_at",
] as const;

// Fields revealed only when a row is "unlocked" for the state.
const REVEAL_FIELDS = [
  "pick", "p_home", "p_draw", "p_away", "confidence_score",
  "fair_odds", "market", "signal_type", "explanation", "model_version",
  "is_paper", "affiliate",
  // 1X2 distribution for model rows that carry it as JSON (WC paper rows,
  // off-season DC fallback) instead of dedicated p_* columns.
  "notes",
] as const;

// Paid-tier extra fields (base + premium + admin): advanced depth that any
// paying user gets. NOTE the historical name — this set is granted to base too
// (see projectPrediction), it is NOT premium-exclusive.
const PREMIUM_FIELDS = ["closing_line_value", "stake_suggestion", "edge_percent"] as const;

// Strictly premium/admin fields — never base. `enrichment` is the structured
// Deep-Analysis payload (form, venue, squad, lambdas, market), mirroring the
// home board's Deep Analysis panel which is gated on the premium plan only.
const PREMIUM_ONLY_FIELDS = ["enrichment"] as const;

export type ProjectedPrediction = Record<string, unknown> & { locked: boolean };

// ── Vetrina curata settimanale (#PLANS-3TIER-1) ──────────────────────────────
// Quante prediction SBLOCCATE per ciascuno sport (le top-N per edge della
// settimana). Modello stateless: nessun conteggio per-utente, tutti i free
// vedono le stesse top. premium/admin = illimitato.
export function showcaseAllowance(state: AccessState): number {
  if (state === "premium" || state === "admin_full") return Infinity;
  if (state === "base") return 5;   // top 5 per sport
  if (state === "free") return 1;   // top 1 per sport
  return 0;                          // anonymous, pending_payment, unpaid
}

// Una riga è sbloccata se il suo rank (0-based, per edge desc dentro lo sport)
// rientra nella quota della vetrina del piano.
export function isUnlocked(state: AccessState, rankInSport: number): boolean {
  return rankInSport < showcaseAllowance(state);
}

export function projectPrediction(
  row: Record<string, unknown>,
  state: AccessState,
  rankInSport: number
): ProjectedPrediction {
  const out: Record<string, unknown> = {};
  for (const f of PUBLIC_FIELDS) out[f] = row[f];
  // top-1 per sport = "pick della settimana" (badge UI, ex pick-of-day).
  out.pick_of_day = rankInSport === 0;

  const unlocked = isUnlocked(state, rankInSport);
  if (unlocked) {
    for (const f of REVEAL_FIELDS) if (f in row) out[f] = row[f];
    if (state === "base" || state === "premium" || state === "admin_full") {
      for (const f of PREMIUM_FIELDS) if (f in row) out[f] = row[f];
    }
    if (state === "premium" || state === "admin_full") {
      for (const f of PREMIUM_ONLY_FIELDS) if (f in row) out[f] = row[f];
    }
  }
  return { ...out, locked: !unlocked } as ProjectedPrediction;
}

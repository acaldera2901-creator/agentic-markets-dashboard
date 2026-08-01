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

// Una riga è sbloccata se il suo rank (0-based, dentro lo sport) rientra nella
// quota della vetrina del piano.
export function isUnlocked(state: AccessState, rankInSport: number): boolean {
  return rankInSport < showcaseAllowance(state);
}

// ── Ordine della vetrina (#SHOWCASE-EDGE-0801) ───────────────────────────────
// QUESTA è la funzione che decide quali righe un abbonato vede sbloccate, e per
// questo l'ordine deve essere quello di ciò che il prodotto vende.
//
// Prima ordinava per EDGE decrescente, in football e in tennis, con la
// confidenza come solo spareggio. Era coerente col prodotto di allora, che
// ragionava per edge. Poi il lab dell'08/06 ha stabilito la verità #1 — non
// battiamo la linea di chiusura in nessun segmento — e da lì il blend (α=0.3)
// tira le probabilità servite verso il mercato PER COSTRUZIONE: l'edge sulle
// righe servite è ≈ 0 per progetto. Ordinare per edge, oggi, è ordinare per
// rumore: i primi cinque non sono i cinque migliori, sono i cinque in cui il
// residuo numerico è capitato più alto.
//
// L'effetto misurato sul board del 2026-08-01 (49 partite football servite, 4
// con un pick sopra floor): con l'ordine per edge un abbonato `base` sbloccava
// 5 righe di cui UNA sola conteneva un pick, e tre dei quattro pick finivano ai
// rank 22, 24 e 42. Il caso peggiore era il pick con la confidenza più alta di
// tutto il board (71%), che avendo edge NEGATIVO stava al rank 42 su 49.
//
// L'ordine corretto mette davanti ciò che il floor ha promosso a pick, poi la
// confidenza (che è l'asset misurato dal lab: calibrazione + selettività), e
// solo come ultimo spareggio l'edge. `id` chiude come tiebreak deterministico:
// senza, due righe identiche cambierebbero posto a ogni ciclo e con loro
// cambierebbe cosa l'utente trova sbloccato.
export type ShowcaseCandidate = {
  id: string;
  /** true = il gate di surfacing ha promosso la riga a pick direzionale. */
  surfaced: boolean;
  /** probabilità dell'esito di punta, 0-1. */
  conf: number;
  /** edge servito; null/NaN quando non calcolabile (nessuna quota reale). */
  edge: number | null;
};

export function compareShowcase(a: ShowcaseCandidate, b: ShowcaseCandidate): number {
  if (a.surfaced !== b.surfaced) return a.surfaced ? -1 : 1;
  if (b.conf !== a.conf) return b.conf - a.conf;
  const ea = typeof a.edge === "number" && Number.isFinite(a.edge) ? a.edge : -Infinity;
  const eb = typeof b.edge === "number" && Number.isFinite(b.edge) ? b.edge : -Infinity;
  if (eb !== ea) return eb - ea;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Rank 0-based per id. Non muta l'input. */
export function showcaseRanking(rows: readonly ShowcaseCandidate[]): Map<string, number> {
  const rank = new Map<string, number>();
  [...rows].sort(compareShowcase).forEach((r, i) => rank.set(r.id, i));
  return rank;
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

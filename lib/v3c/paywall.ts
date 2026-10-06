// lib/v3c/paywall.ts (#REDESIGN-V3C F8-UI · filone pages) — puro, sicuro nel client.
// Le regole del paywall «Unlock why the model disagrees» (POSITIONING §4).
import { FLAT_PP } from "./scale";

/** «$29.99» — due decimali sempre, USD come il resto del sito (#UI-USD-DISPLAY-0623). */
export function usd(n: number): string {
  return `$${n.toFixed(2)}`;
}

/**
 * Il paywall «why» si mostra SOLO dove c'è un disaccordo da spiegare: gap noto e
 * fuori dalla fascia «in linea» (|gap| ≥ FLAT_PP, la stessa soglia della board).
 * Vendere il perché di un disaccordo che non c'è è un dark pattern (POSITIONING §4).
 */
export function paywallApplies(gapPp: number | null | undefined, factors: number): boolean {
  if (gapPp == null || !Number.isFinite(gapPp)) return false;
  if (Math.abs(gapPp) < FLAT_PP) return false;
  return factors > 0;
}

/** Quanti fattori del paywall restano aperti in Free: il primo, sempre intero. */
export const PAYWALL_OPEN = 1;
/** Quanti titoli chiusi si mostrano dopo il primo (#2–3). */
export const PAYWALL_CLOSED = 2;


// lib/affiliate/screening.ts — #AFFILIATE-V2-CRYPTO-1007 PR-5
// Screening dell'indirizzo di payout contro le liste di sanzioni (D3).
//
// NESSUN provider è integrato: il fornitore non è scelto né verificato
// (termini, costi, affidabilità — SPEC-ui §13.6). Qui c'è solo l'interfaccia,
// sostituibile, e la regola fail-closed:
//  · nessun provider configurato → il wallet si salva come `not_screened` e NON
//    è pagabile (l'admin lo vede escluso con il motivo `not_screened`);
//  · provider configurato che non risponde → non si salva niente (503, «riprova»);
//  · provider che dice `blocked` → non si salva niente (`address_blocked`), senza
//    spiegare il motivo all'affiliato.
// Per integrare un provider: implementare `AddressScreener` e restituirlo da
// `addressScreener()`. Nient'altro cambia.

import type { PayoutNetwork } from "./wallet";

export type ScreeningVerdict = "clear" | "blocked";

export interface AddressScreener {
  /** Nome stabile del provider: finisce in `affiliate_wallets.screening_provider`. */
  readonly name: string;
  /** Lancia se il provider non risponde o risponde in modo illeggibile. */
  screen(network: PayoutNetwork, address: string): Promise<ScreeningVerdict>;
}

export class ScreeningUnavailableError extends Error {}

/** Il provider in uso. Oggi nessuno: vedi intestazione. */
export function addressScreener(): AddressScreener | null {
  return null;
}

export type ScreeningOutcome =
  | { kind: "clear"; provider: string }
  | { kind: "not_screened" }
  | { kind: "blocked"; provider: string };

/** Fail-closed: ogni errore del provider diventa `ScreeningUnavailableError`. */
export async function screenPayoutAddress(
  network: PayoutNetwork,
  address: string,
  screener: AddressScreener | null = addressScreener(),
): Promise<ScreeningOutcome> {
  if (!screener) return { kind: "not_screened" };
  let verdict: unknown;
  try {
    verdict = await screener.screen(network, address);
  } catch (e) {
    throw new ScreeningUnavailableError(`screening provider ${screener.name} failed: ${String(e)}`);
  }
  if (verdict === "clear") return { kind: "clear", provider: screener.name };
  if (verdict === "blocked") return { kind: "blocked", provider: screener.name };
  throw new ScreeningUnavailableError(`screening provider ${screener.name} returned an unknown verdict`);
}

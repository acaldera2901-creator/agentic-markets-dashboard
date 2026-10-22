// lib/affiliate/reversal.ts — #AFFILIATE-REVERSAL-1022 (PROPOSAL-tecnica §4.2, PR-3)
// Un rimborso o uno storno riduce la commissione del pagamento che lo ha
// generato, in proporzione (termini §4). Il ledger resta append-only: si scrive
// una riga NEGATIVA (`reversal` prima della maturazione, `clawback` dopo, entro
// CLAWBACK_DAYS), la positiva cambia solo stato (`→ reversed`) se è stornata
// per intero prima di maturare.
//
// Tutta la decisione e la scrittura stanno nella funzione SQL
// `affiliate_reverse_commission` (migration 20261022120000): serve il lock della
// riga originale, che exec_sql non può dare. Qui solo il contratto dei rail:
// non lancia mai, AFFILIATE_MODE=off no-op, gira dopo la risposta del webhook.

import { after } from "next/server";
import { opsAlert } from "@/lib/ops-alert";
import { affiliateConfig, affiliateMode } from "./config";
import type { AffiliateRail } from "./net";
import { affiliateRpc } from "./rpc";

export type ReverseInput = {
  rail: AffiliateRail;
  /** Lo stesso `paymentRef` con cui il pagamento è entrato nel ledger. */
  paymentRef: string;
  /** Id del rimborso / dello storno sul rail: rende idempotente la redelivery. */
  eventRef: string;
  /** Lordo rimborsato in USD; null = storno totale (chargeback, rimborso totale). */
  refundedGrossUsd: number | null;
};

export type ReversalOutcome = { written: boolean; reason: string };

/** Non lancia mai. Su errore: log + alert ops con TUTTO ciò che serve per
 *  ripeterlo a mano da POST /api/admin/affiliate/reverse (stessa event_ref =
 *  nessun doppio storno), perché la redelivery del webhook non lo ritenta. */
export async function reverseAffiliateCommissionSafe(input: ReverseInput): Promise<ReversalOutcome> {
  try {
    const config = affiliateConfig();
    if (config.mode === "off") return { written: false, reason: "mode_off" };
    const r = await affiliateRpc<{ ok: boolean; written?: boolean; reason?: string; amount?: number; status?: string }>(
      "affiliate_reverse_commission",
      {
        p_rail: input.rail,
        p_ref: String(input.paymentRef ?? "").trim(),
        p_event: String(input.eventRef ?? "").trim(),
        p_refunded: input.refundedGrossUsd,
        p_clawback_days: config.clawbackDays,
      }
    );
    const outcome = { written: r.written === true, reason: String(r.reason ?? "unknown") };
    console.log(
      `[affiliate/reversal] rail=${input.rail} ref=${input.paymentRef} event=${input.eventRef} → ${outcome.reason}` +
        (outcome.written ? ` ${String(r.status)} amount=${String(r.amount)}` : "")
    );
    return outcome;
  } catch (e) {
    const msg =
      `storno affiliato NON registrato: rail=${String(input?.rail)} payment_ref=${String(input?.paymentRef)} ` +
      `event_ref=${String(input?.eventRef)} refunded_usd=${String(input?.refundedGrossUsd)} — ${String(e)}`;
    console.error(`[affiliate/reversal] ${msg}`);
    await opsAlert("affiliate-reversal", [msg]);
    return { written: false, reason: "error" };
  }
}

/** Punto d'ingresso dei webhook: lo storno gira DOPO la risposta, come la
 *  commissione. Sincrona, non lancia mai; con AFFILIATE_MODE=off non registra
 *  nemmeno il callback. */
export function scheduleAffiliateReversal(input: ReverseInput): void {
  try {
    if (affiliateMode() === "off") return;
  } catch {
    return;
  }
  const run = () => reverseAffiliateCommissionSafe(input);
  try {
    after(run);
  } catch {
    void run();
  }
}

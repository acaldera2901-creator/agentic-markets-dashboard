// lib/affiliate/reversal.ts — #AFFILIATE-REVERSAL-1022 (PROPOSAL-tecnica §4.2, PR-3)
// Un rimborso o uno storno riduce la commissione del pagamento che lo ha
// generato, in proporzione (termini §4). Il ledger resta append-only: si scrive
// una riga NEGATIVA, la positiva non si riscrive mai — salvo il solo cambio di
// stato `→ reversed` quando non è ancora maturata.
//
//  · originale `shadow|pending` (dentro l'hold) → riga `reversal`.
//      - totale: originale e reversal parziali precedenti dello stesso pagamento
//        → `reversed` (non matureranno mai); la riga di reversal nasce `reversed`.
//      - parziale: la riga nasce nello stato dell'originale con lo stesso
//        payable_after, così matura insieme e il saldo la compensa.
//  · originale `payable|in_payout|paid` entro CLAWBACK_DAYS da paid_at → riga
//    `clawback` negativa `payable`: si compensa sul prossimo saldo (un saldo
//    negativo non addebita mai il wallet, termini §4).
//  · oltre CLAWBACK_DAYS → nessuna azione, solo il log.
//
// Idempotenza: UNIQUE (rail, rail_payment_ref, kind, rail_event_ref) — la
// redelivery dello stesso rimborso non scrive due volte — e il tetto «mai più
// della commissione residua» sul totale degli storni.
// Contratto dei rail come il ledger: non lancia mai, AFFILIATE_MODE=off no-op.
//
// ⚠ LIMITE NOTO: due rimborsi DIVERSI dello stesso pagamento consegnati nello
// stesso istante leggono lo stesso residuo e possono stornare oltre il 100%
// (exec_sql non dà una transazione). Caso raro (Shopify li serializza per
// ordine); upgrade path: una funzione SQL con lock sulla riga originale.

import { after } from "next/server";
import { dbExecute, dbQueryStrict } from "@/lib/db";
import { opsAlert } from "@/lib/ops-alert";
import { affiliateConfig, affiliateMode } from "./config";
import { round2, type AffiliateRail } from "./net";

export type ReverseInput = {
  rail: AffiliateRail;
  /** Lo stesso `paymentRef` con cui il pagamento è entrato nel ledger. */
  paymentRef: string;
  /** Id del rimborso / dello storno sul rail: rende idempotente la redelivery. */
  eventRef: string;
  /** Lordo rimborsato in USD; null = storno totale (chargeback, rimborso totale). */
  refundedGrossUsd: number | null;
  at?: Date;
};

export type OriginalRow = {
  id: number;
  status: string;
  gross_usd: number;
  net_usd: number;
  rate: number;
  amount_usd: number;
  renewal_index: number;
  affiliate_id: number;
  referred_identifier: string;
  paid_at: string;
  payable_after: string;
};

export type ReversalPlan =
  | { action: "none"; reason: string }
  | {
      action: "reversal" | "clawback";
      /** Negativo. */
      amountUsd: number;
      grossUsd: number;
      netUsd: number;
      /** true = dopo questa riga la commissione residua è zero. */
      full: boolean;
      status: "shadow" | "pending" | "reversed" | "payable";
      payableAfterISO: string;
    };

const DAY_MS = 86_400_000;
const PRE_MATURITY = new Set(["shadow", "pending"]);
const MATURED = new Set(["payable", "in_payout", "paid"]);

/** La decisione, pura. `alreadyReversedUsd` = somma (positiva) degli storni già
 *  scritti per questo pagamento, esclusi i `void`. */
export function planReversal(opts: {
  original: OriginalRow | null;
  alreadyReversedUsd: number;
  refundedGrossUsd: number | null;
  now: Date;
  clawbackDays: number;
}): ReversalPlan {
  const o = opts.original;
  if (!o) return { action: "none", reason: "no_commission" };
  if (!PRE_MATURITY.has(o.status) && !MATURED.has(o.status)) {
    return { action: "none", reason: `original_${o.status}` };
  }
  const remaining = round2(Number(o.amount_usd) - Math.max(0, opts.alreadyReversedUsd));
  if (!(remaining > 0)) return { action: "none", reason: "already_reversed" };

  let share = 1;
  if (opts.refundedGrossUsd != null) {
    if (!Number.isFinite(opts.refundedGrossUsd) || opts.refundedGrossUsd <= 0) {
      return { action: "none", reason: "zero_refund" };
    }
    share = Number(o.gross_usd) > 0 ? Math.min(1, opts.refundedGrossUsd / Number(o.gross_usd)) : 1;
  }
  const amount = Math.min(remaining, round2(Number(o.amount_usd) * share));
  if (!(amount > 0)) return { action: "none", reason: "zero_amount" };
  const full = amount >= remaining;
  const ratio = Number(o.amount_usd) > 0 ? amount / Number(o.amount_usd) : 1;
  const grossUsd = -round2(opts.refundedGrossUsd != null ? Math.min(opts.refundedGrossUsd, Number(o.gross_usd)) : Number(o.gross_usd) * ratio);
  const netUsd = -round2(Number(o.net_usd) * ratio);

  if (PRE_MATURITY.has(o.status)) {
    return {
      action: "reversal",
      amountUsd: -amount,
      grossUsd,
      netUsd,
      full,
      status: full ? "reversed" : (o.status as "shadow" | "pending"),
      payableAfterISO: new Date(o.payable_after).toISOString(),
    };
  }
  const age = opts.now.getTime() - new Date(o.paid_at).getTime();
  if (!(age <= opts.clawbackDays * DAY_MS)) return { action: "none", reason: "outside_clawback_window" };
  return {
    action: "clawback",
    amountUsd: -amount,
    grossUsd,
    netUsd,
    full,
    status: "payable",
    payableAfterISO: opts.now.toISOString(),
  };
}

async function readOriginal(rail: string, ref: string): Promise<OriginalRow | null> {
  const rows = await dbQueryStrict<OriginalRow>(
    `SELECT id, status, gross_usd::float8 AS gross_usd, net_usd::float8 AS net_usd, rate::float8 AS rate,
            amount_usd::float8 AS amount_usd, renewal_index, affiliate_id, referred_identifier,
            paid_at::text AS paid_at, payable_after::text AS payable_after
       FROM affiliate_commissions
      WHERE rail = $1 AND rail_payment_ref = $2 AND kind IN ('first','renewal')
      LIMIT 1`,
    [rail, ref]
  );
  const r = rows[0];
  return r ? { ...r, id: Number(r.id), affiliate_id: Number(r.affiliate_id) } : null;
}

async function reversedSoFar(rail: string, ref: string): Promise<{ total: number; events: string[] }> {
  const rows = await dbQueryStrict<{ amount_usd: number; rail_event_ref: string }>(
    `SELECT amount_usd::float8 AS amount_usd, rail_event_ref
       FROM affiliate_commissions
      WHERE rail = $1 AND rail_payment_ref = $2 AND kind IN ('reversal','clawback') AND status <> 'void'`,
    [rail, ref]
  );
  return {
    total: round2(rows.reduce((s, r) => s + Math.abs(Number(r.amount_usd)), 0)),
    events: rows.map((r) => r.rail_event_ref),
  };
}

export type ReversalOutcome = { written: boolean; reason: string };

async function reverse(input: ReverseInput, clawbackDays: number): Promise<ReversalOutcome> {
  const ref = String(input.paymentRef ?? "").trim();
  const eventRef = String(input.eventRef ?? "").trim();
  if (!ref || !eventRef) return { written: false, reason: "missing_ref" };
  const now = input.at ?? new Date();

  // Due giri al massimo: il primo può perdere la corsa con la maturazione
  // (pending → payable tra la lettura e l'UPDATE), il secondo rilegge e
  // ripianifica come clawback.
  for (let attempt = 0; attempt < 2; attempt++) {
    const original = await readOriginal(input.rail, ref);
    const so = await reversedSoFar(input.rail, ref);
    if (so.events.includes(eventRef)) return { written: false, reason: "duplicate" };
    const plan = planReversal({
      original,
      alreadyReversedUsd: so.total,
      refundedGrossUsd: input.refundedGrossUsd,
      now,
      clawbackDays,
    });
    if (plan.action === "none") {
      console.log(`[affiliate/reversal] nessuna azione rail=${input.rail} ref=${ref} event=${eventRef}: ${plan.reason}`);
      return { written: false, reason: plan.reason };
    }
    const o = original!;

    if (plan.action === "reversal" && plan.full) {
      // Storno totale prima della maturazione: l'originale e gli storni parziali
      // ancora non maturati non matureranno mai. Condizionato allo stato: se la
      // maturazione è passata nel frattempo l'UPDATE non tocca l'originale e si
      // ripianifica.
      await dbExecute(
        `UPDATE affiliate_commissions SET status = 'reversed'
          WHERE rail = $1 AND rail_payment_ref = $2 AND status IN ('shadow','pending') AND payout_id IS NULL`,
        [input.rail, ref]
      );
      const fresh = await readOriginal(input.rail, ref);
      if (fresh?.status !== "reversed") continue;
    }

    await dbExecute(
      `INSERT INTO affiliate_commissions
         (affiliate_id, referred_identifier, rail, rail_payment_ref, rail_event_ref, kind,
          gross_usd, net_usd, rate, amount_usd, renewal_index, status,
          paid_at, payable_after, reverses_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::timestamptz, $14::timestamptz, $15)
       ON CONFLICT DO NOTHING`,
      [
        o.affiliate_id,
        o.referred_identifier,
        input.rail,
        ref,
        eventRef,
        plan.action,
        plan.grossUsd,
        plan.netUsd,
        o.rate,
        plan.amountUsd,
        o.renewal_index,
        plan.status,
        new Date(o.paid_at).toISOString(),
        plan.payableAfterISO,
        o.id,
      ]
    );
    console.log(
      `[affiliate/reversal] ${plan.action} ${plan.status} rail=${input.rail} ref=${ref} event=${eventRef} amount=${plan.amountUsd} full=${plan.full}`
    );
    return { written: true, reason: plan.action };
  }
  return { written: false, reason: "maturity_race" };
}

/** Non lancia mai. Su errore: log + alert ops, perché uno storno perso è una
 *  commissione pagata su un incasso che non c'è più. */
export async function reverseAffiliateCommissionSafe(input: ReverseInput): Promise<ReversalOutcome> {
  try {
    const config = affiliateConfig();
    if (config.mode === "off") return { written: false, reason: "mode_off" };
    return await reverse(input, config.clawbackDays);
  } catch (e) {
    const msg = `storno affiliato NON registrato rail=${String(input?.rail)} ref=${String(input?.paymentRef)} event=${String(input?.eventRef)}: ${String(e)}`;
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

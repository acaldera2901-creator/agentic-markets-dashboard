// lib/affiliate/net.ts — #AFFILIATE-V2-0930
// Il NETTO su cui si calcola la commissione. Pura, niente DB.
//
// Netto = lordo dell'abbonamento − IVA/sales tax − importo rimborsato − fee del
// processore (decisione di Andrea, 2026-09-30: «netto senza IVA/rimborsi/fee»).
// Non conosce depositi, perdite o link bookmaker: le sue sole fonti sono gli
// ordini dei rail e l'invoice Stripe, passati dal chiamante.
//
// ⚠ LIMITE NOTO (fee): oggi nessun rail espone la fee del processore nei punti
// in cui si incassa (paygate_orders/paypal_orders/shopify_events/invoice Stripe
// non la portano). Una fee NON fornita vale 0, cioè NON viene dedotta: in shadow
// il netto è sovrastimato della fee. Va chiuso prima del `live` (upgrade path:
// il chiamante legge la fee dal rail — PayPal seller_receivable_breakdown,
// Stripe balance_transaction — e la passa in `feeUsd`).

export type AffiliateRail = "paygate" | "crypto" | "paypal" | "shopify" | "stripe" | "admin";

export type NetMeta = {
  /** IVA / sales tax inclusa nel lordo. */
  taxUsd?: number | null;
  /** Parte del lordo già rimborsata. */
  refundedUsd?: number | null;
  /** Fee del processore (vedi LIMITE NOTO sopra). */
  feeUsd?: number | null;
};

/** Arrotonda a 2 decimali (centesimi), senza l'errore di 1.005 → 1.00. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function component(v: number | null | undefined): number | null {
  if (v == null) return 0;
  return Number.isFinite(v) && v >= 0 ? v : null;
}

/** Netto in USD arrotondato a 2 decimali, oppure `null` quando non si può
 *  calcolare senza inventare: lordo assente (es. righe Shopify storiche con
 *  `amount` NULL) o non valido, una componente non valida, o il rail `admin`
 *  (attivazioni manuali USDT: nessuna commissione, decisione di Andrea).
 *  Un netto che scende sotto zero vale 0: non esiste una commissione negativa
 *  su un incasso — i negativi sono reversal/clawback, un'altra strada. */
export function netAmount(
  rail: AffiliateRail,
  gross: number | null | undefined,
  meta: NetMeta = {}
): number | null {
  if (rail === "admin") return null;
  if (gross == null || !Number.isFinite(gross) || gross < 0) return null;
  const tax = component(meta.taxUsd);
  const refunded = component(meta.refundedUsd);
  const fee = component(meta.feeUsd);
  if (tax == null || refunded == null || fee == null) return null;
  return Math.max(0, round2(gross - tax - refunded - fee));
}

function money(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Lordo e tasse di un ordine Shopify `orders/paid`. `total_price` include
 *  sempre le tasse (con o senza `taxes_included`), `total_tax` le isola.
 *  Una valuta diversa da USD → lordo null: niente conversioni inventate. */
export function shopifyOrderAmounts(
  payload: unknown,
  totalPrice: number | null
): { grossUsd: number | null; taxUsd: number | null } {
  const o = (payload ?? {}) as { currency?: unknown; total_tax?: unknown };
  const currency = typeof o.currency === "string" ? o.currency.toUpperCase() : null;
  if (currency && currency !== "USD") return { grossUsd: null, taxUsd: null };
  return { grossUsd: totalPrice, taxUsd: money(o.total_tax) };
}

/** Lordo e tasse di un'invoice Stripe `invoice.paid` (importi in centesimi).
 *  Una valuta diversa da USD → lordo null. */
export function stripeInvoiceAmounts(inv: {
  amount_paid?: number | null;
  currency?: string | null;
  total_taxes?: Array<{ amount?: number | null }> | null;
}): { grossUsd: number | null; taxUsd: number | null } {
  if ((inv.currency ?? "").toLowerCase() !== "usd" || inv.amount_paid == null) {
    return { grossUsd: null, taxUsd: null };
  }
  const taxCents = (inv.total_taxes ?? []).reduce((s, t) => s + (t.amount ?? 0), 0);
  return { grossUsd: inv.amount_paid / 100, taxUsd: taxCents / 100 };
}

/** Commissione = netto × tasso, arrotondata a 2 decimali. */
export function commissionAmount(net: number, rate: number): number {
  return round2(net * rate);
}

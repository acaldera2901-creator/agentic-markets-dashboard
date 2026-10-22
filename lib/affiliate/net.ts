// lib/affiliate/net.ts — #AFFILIATE-V2-0930
// La BASE su cui si calcola la commissione. Pura, niente DB.
//
// #AFFILIATE-TERMS-V3-1022 — termini aff-2026-10-22-v3 (decisione di Andrea,
// 22/10/2026): base LORDA = prezzo pagato dal cliente, imposte comprese, fee
// del processore e di rete NON dedotte. Si sottrae solo la parte già rimborsata
// al momento dell'incasso (i rimborsi successivi sono reversal/clawback).
// `taxUsd` e `feeUsd` restano nel tipo (i rail li passano) ma non riducono più
// la base; un valore non valido rende comunque l'importo non verificabile (null).
// Prima: «netto senza IVA/rimborsi/fee» (decisione 2026-09-30, termini v1/v2).
// Non conosce depositi, perdite o link bookmaker: le sue sole fonti sono gli
// ordini dei rail e l'invoice Stripe, passati dal chiamante.
//

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

/** Base (lordo meno il già rimborsato) in USD arrotondata a 2 decimali, oppure `null` quando non si può
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
  return Math.max(0, round2(gross - refunded));
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

/** Marcatore su `shopify_events.last_error` di un ordine 'unresolved' che NON è
 *  un solo piano (Weekly Pick, righe sconosciute, quantità multiple): il suo
 *  `amount` non è il prezzo del piano. Lo scrive il webhook, lo legge la
 *  reconcile — stesso idioma del `lapse-alerted` già su quella colonna. */
export const SHOPIFY_NOT_SINGLE_PLAN_MARK = "[affiliate:non-monopiano]";

export function withNotSinglePlanMark(why: string, notSinglePlan: boolean): string {
  return notSinglePlan ? `${why} ${SHOPIFY_NOT_SINGLE_PLAN_MARK}` : why;
}

export function isNotSinglePlanMarked(lastError: string | null | undefined): boolean {
  return (lastError ?? "").includes(SHOPIFY_NOT_SINGLE_PLAN_MARK);
}

/** #SHOPIFY-RECONCILE-USD-1022 — `shopify_events` non conserva la valuta, e i termini
 *  pagano commissioni solo su acquisti in USD: un ordine 'unresolved' in altra valuta
 *  porta questo marcatore, e la reconcile non tratta il suo `amount` come USD. */
export const SHOPIFY_NON_USD_MARK = "[affiliate:non-usd]";

export function shopifyOrderIsNonUsd(payload: unknown): boolean {
  const c = (payload ?? {}) as { currency?: unknown };
  return typeof c.currency === "string" && c.currency.toUpperCase() !== "USD";
}

export function withNonUsdMark(why: string, nonUsd: boolean): string {
  return nonUsd ? `${why} ${SHOPIFY_NON_USD_MARK}` : why;
}

export function isNonUsdMarked(lastError: string | null | undefined): boolean {
  return (lastError ?? "").includes(SHOPIFY_NON_USD_MARK);
}

/** Data dell'incasso di un ordine `orders/paid`: `processed_at` del payload (Shopify
 *  ritenta il webhook fino a 48 h: l'ora di consegna non è l'ora del pagamento).
 *  Assente, illeggibile o nel futuro → `now`. */
export function shopifyPaidAt(payload: unknown, now = new Date()): Date {
  const v = ((payload ?? {}) as { processed_at?: unknown }).processed_at;
  const d = typeof v === "string" ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) && d.getTime() <= now.getTime() ? d : now;
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

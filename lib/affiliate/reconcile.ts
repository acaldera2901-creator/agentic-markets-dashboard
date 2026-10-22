// lib/affiliate/reconcile.ts — #AFFILIATE-RECONCILE-1022
// Riconciliazione ordini ↔ ledger. La commissione si registra in `after()` dopo
// la risposta del rail e, per contratto, non lancia mai: un errore del DB in
// quel momento la perde, con la sola traccia nel log. Qui si ritrovano i
// pagamenti concessi di referiti di un affiliato senza riga nel ledger.
//
//  · PayGate e crypto (paygate_orders) e PayPal (paypal_orders non rimborsati):
//    si ripassano dal ledger vero (recordAffiliateCommissionSafe, modalità
//    `recovery`): stessa decisione, stessa idempotenza (UNIQUE su rail +
//    pagamento), paidAt = data reale dell'incasso, in ordine di incasso.
//  · Shopify: solo SEGNALATI, mai scritti in automatico. shopify_events non
//    conserva né la valuta né il legame ordine→rimborso, e un ordine misto
//    recuperato da shopify-reconcile perde il marcatore: una commissione scritta
//    da qui potrebbe pagare un rimborsato, un carrello misto o un importo in EUR
//    (review Codex). Upgrade path: salvare currency, total_tax e l'order_id del
//    rimborso sull'evento, poi trattarli come gli altri rail.
//  · Stripe non ha una tabella ordini locale (rail non live).

import { dbQueryStrict } from "@/lib/db";
import { affiliateConfig } from "./config";
import { recordAffiliateCommissionSafe } from "./ledger";
import type { AffiliateRail } from "./net";

export const RECONCILE_LOOKBACK_DAYS = 35;
/** Ogni recupero costa ~7 RPC in serie: 50 stanno nel budget anche a 100 ms l'una. */
export const RECONCILE_LIMIT = 50;
const TIME_BUDGET_MS = 40_000;

type Candidate = { rail: AffiliateRail; ref: string; identifier: string; gross: number | null; paid_at: string };

/** Pagamenti concessi negli ultimi RECONCILE_LOOKBACK_DAYS, più vecchi di 15
 *  minuti (l'after() del rail ha avuto il suo tempo), senza riga positiva nel
 *  ledger, di un referito che PUÒ ancora generare commissione: attribuzione
 *  valida o in revisione, oppure nessuna attribuzione ma `referred_by` di un
 *  affiliato attivo e pagamento dentro la finestra dalla registrazione ($1 gg).
 *  Chi non può (void, self_referral, fuori finestra) non si riseleziona a ogni
 *  giro: non toglie posto ai recuperabili. */
export const CANDIDATES_SQL = `
SELECT p.rail, p.ref, p.identifier, p.gross::float8 AS gross, p.paid_at::text AS paid_at
  FROM (
    SELECT CASE WHEN COALESCE(coin, '') <> '' THEN 'crypto' ELSE 'paygate' END AS rail,
           id::text AS ref, identifier, amount_usd AS gross, granted_at AS paid_at
      FROM paygate_orders
     WHERE granted_at > NOW() - INTERVAL '${RECONCILE_LOOKBACK_DAYS} days'
    UNION ALL
    SELECT 'paypal', id::text, identifier, amount_usd, granted_at
      FROM paypal_orders
     WHERE granted_at > NOW() - INTERVAL '${RECONCILE_LOOKBACK_DAYS} days' AND status <> 'refunded'
    UNION ALL
    SELECT 'shopify', event_id, identifier, amount, processed_at
      FROM shopify_events
     WHERE event_type = 'orders/paid' AND status = 'granted'
       AND processed_at > NOW() - INTERVAL '${RECONCILE_LOOKBACK_DAYS} days'
  ) p
 WHERE p.paid_at < NOW() - INTERVAL '15 minutes'
   AND COALESCE(TRIM(p.identifier), '') <> ''
   AND NOT EXISTS (
     SELECT 1 FROM affiliate_commissions c
      WHERE c.rail = p.rail AND c.rail_payment_ref = p.ref AND c.kind IN ('first','renewal'))
   AND (
     EXISTS (SELECT 1 FROM affiliate_attributions a
              WHERE a.referred_identifier = LOWER(TRIM(p.identifier)) AND a.status IN ('valid','fraud_review'))
     OR (
       NOT EXISTS (SELECT 1 FROM affiliate_attributions a WHERE a.referred_identifier = LOWER(TRIM(p.identifier)))
       AND EXISTS (
         SELECT 1 FROM profiles pr
           JOIN affiliates af ON af.code = UPPER(TRIM(pr.referred_by)) AND af.status = 'active'
          WHERE LOWER(TRIM(pr.identifier)) = LOWER(TRIM(p.identifier))
            AND p.paid_at - pr.created_at <= make_interval(days => $1))
     )
   )
 ORDER BY p.paid_at ASC
 LIMIT ${RECONCILE_LIMIT}`;

export type ReconcileResult = {
  checked: number;
  written: number;
  reasons: Record<string, number>;
  /** Pagamenti Shopify senza commissione da verificare a mano (rail, ref). */
  shopify_manual: string[];
  /** true = budget di tempo esaurito, il resto al prossimo giro. */
  truncated: boolean;
};

export async function reconcileAffiliateLedger(now: () => number = Date.now): Promise<ReconcileResult> {
  const started = now();
  const rows = await dbQueryStrict<Candidate>(CANDIDATES_SQL, [affiliateConfig().attributionWindowDays]);
  const reasons: Record<string, number> = {};
  const shopifyManual: string[] = [];
  let written = 0;
  let truncated = false;
  for (const r of rows) {
    if (r.rail === "shopify") {
      shopifyManual.push(r.ref);
      continue;
    }
    if (now() - started > TIME_BUDGET_MS) {
      truncated = true;
      break;
    }
    const paidAt = new Date(r.paid_at);
    if (Number.isNaN(paidAt.getTime())) {
      reasons.bad_paid_at = (reasons.bad_paid_at ?? 0) + 1;
      continue;
    }
    const out = await recordAffiliateCommissionSafe({
      identifier: r.identifier,
      rail: r.rail,
      paymentRef: r.ref,
      grossUsd: r.gross == null ? null : Number(r.gross),
      paidAt,
      recovery: true,
    });
    if (out.written) {
      written++;
      console.log(`[affiliate/reconcile] RECUPERATA rail=${r.rail} ref=${r.ref} → ${out.reason}`);
    }
    reasons[out.reason] = (reasons[out.reason] ?? 0) + 1;
  }
  return { checked: rows.length, written, reasons, shopify_manual: shopifyManual, truncated };
}

// lib/affiliate/reconcile.ts — #AFFILIATE-RECONCILE-1022
// Riconciliazione ordini ↔ ledger. La commissione si registra in `after()` dopo
// la risposta del rail e, per contratto, non lancia mai: un errore del DB in
// quel momento la perde, con la sola traccia nel log. Qui si ritrovano i
// pagamenti concessi di referiti di un affiliato senza riga nel ledger e si
// ripassano dal ledger vero (recordAffiliateCommissionSafe): stessa decisione,
// stessa idempotenza (UNIQUE su rail + pagamento), paidAt = data reale
// dell'incasso.
//
// Rail coperti: PayGate e crypto (paygate_orders), PayPal (paypal_orders, non
// rimborsati) e Shopify (shopify_events `granted` = un solo piano; i carrelli
// misti non danno commissione per decisione, come nel webhook). Stripe non ha
// una tabella ordini locale: non è riconciliabile qui (rail non live).
//
// ⚠ LIMITE NOTO (Shopify): shopify_events non conserva le tasse, quindi una
// commissione Shopify recuperata qui si calcola sul totale tasse incluse (il
// webhook le toglie). Upgrade path: salvare total_tax sull'evento.

import { dbQueryStrict } from "@/lib/db";
import { recordAffiliateCommissionSafe } from "./ledger";
import type { AffiliateRail } from "./net";

export const RECONCILE_LOOKBACK_DAYS = 35;
export const RECONCILE_LIMIT = 200;

type Candidate = { rail: AffiliateRail; ref: string; identifier: string; gross: number | null; paid_at: string };

/** Pagamenti concessi negli ultimi RECONCILE_LOOKBACK_DAYS, più vecchi di 15
 *  minuti (l'after() del rail ha avuto il suo tempo), senza riga positiva nel
 *  ledger, di un referito con attribuzione o con `referred_by` di un affiliato
 *  attivo. Gli altri non possono generare commissione: inutile ripassarli. */
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
     EXISTS (SELECT 1 FROM affiliate_attributions a WHERE a.referred_identifier = LOWER(TRIM(p.identifier)))
     OR EXISTS (
       SELECT 1 FROM profiles pr
         JOIN affiliates af ON af.code = UPPER(TRIM(pr.referred_by)) AND af.status = 'active'
        WHERE LOWER(TRIM(pr.identifier)) = LOWER(TRIM(p.identifier)))
   )
 ORDER BY p.paid_at ASC
 LIMIT ${RECONCILE_LIMIT}`;

export type ReconcileResult = { checked: number; written: number; reasons: Record<string, number> };

export async function reconcileAffiliateLedger(): Promise<ReconcileResult> {
  const rows = await dbQueryStrict<Candidate>(CANDIDATES_SQL);
  const reasons: Record<string, number> = {};
  let written = 0;
  for (const r of rows) {
    const paidAt = new Date(r.paid_at);
    if (Number.isNaN(paidAt.getTime())) {
      reasons.bad_paid_at = (reasons.bad_paid_at ?? 0) + 1;
      continue;
    }
    // In ordine di incasso: il primo pagamento perso resta il «primo».
    const out = await recordAffiliateCommissionSafe({
      identifier: r.identifier,
      rail: r.rail,
      paymentRef: r.ref,
      grossUsd: r.gross == null ? null : Number(r.gross),
      paidAt,
    });
    if (out.written) {
      written++;
      console.log(`[affiliate/reconcile] RECUPERATA rail=${r.rail} ref=${r.ref} → ${out.reason}`);
    }
    reasons[out.reason] = (reasons[out.reason] ?? 0) + 1;
  }
  return { checked: rows.length, written, reasons };
}

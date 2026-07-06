// #PRICING-CREATORS-0706 (rev. Michele) — eligibilità alla PROMO DI LANCIO
// (-50% primo mese, vale per TUTTI: nessuna condizione referral — il link
// creator fa solo attribuzione). Helper CONDIVISO dai due rail (PayGate +
// PayPal): unica condizione = NESSUN ordine già pagato su NESSUN rail
// (granted_at è il marcatore di pagamento verificato in entrambe le tabelle).
// Il lookup gira solo a promo attiva; qualunque errore degrada al prezzo
// PIENO (fail-closed: un problema di DB non regala sconti).
import { dbQuery } from "@/lib/db";
import { launchPromoActive } from "@/lib/paygate";

export type PromoEligibility = { firstPaidOrder: boolean };

const NOT_ELIGIBLE: PromoEligibility = { firstPaidOrder: false };

export async function promoEligibility(identifier: string): Promise<PromoEligibility> {
  if (!launchPromoActive()) return NOT_ELIGIBLE;
  try {
    // audit #3 (race doppio-sconto): oltre agli ordini PAGATI contano anche
    // gli ordini PENDENTI creati negli ultimi 15 minuti — due checkout aperti
    // in parallelo (2 tab) non prendono entrambi il -50%. Un checkout
    // abbandonato blocca lo sconto solo per 15 minuti, poi rientra.
    const [row] = await dbQuery<{ paid_orders: number }>(
      `SELECT ((SELECT COUNT(*) FROM paygate_orders o
                 WHERE o.identifier = $1
                   AND (o.granted_at IS NOT NULL OR o.created_at > NOW() - INTERVAL '15 minutes'))
             + (SELECT COUNT(*) FROM paypal_orders q
                 WHERE q.identifier = $1
                   AND (q.granted_at IS NOT NULL OR q.created_at > NOW() - INTERVAL '15 minutes'))) AS paid_orders`,
      [identifier]
    );
    return { firstPaidOrder: Number(row?.paid_orders ?? 1) === 0 };
  } catch (e) {
    console.error("[creator-promo] eligibility lookup failed (full price):", String(e));
    return NOT_ELIGIBLE;
  }
}

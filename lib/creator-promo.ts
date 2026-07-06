// #PRICING-CREATORS-0706 — eligibilità alla promo creator (-50% primo mese).
// Helper CONDIVISO dai due rail (PayGate + PayPal) così le condizioni non
// possono divergere: referred_by dal link creator (#MB-1) + NESSUN ordine già
// pagato su NESSUN rail (granted_at è il marcatore di pagamento verificato in
// entrambe le tabelle). Il lookup gira solo a promo attiva; qualunque errore
// degrada al prezzo PIENO (fail-closed: un problema di DB non regala sconti).
import { dbQuery } from "@/lib/db";
import { creatorPromoActive } from "@/lib/paygate";

export type PromoEligibility = { referred: boolean; firstPaidOrder: boolean };

const NOT_ELIGIBLE: PromoEligibility = { referred: false, firstPaidOrder: false };

export async function promoEligibility(identifier: string): Promise<PromoEligibility> {
  if (!creatorPromoActive()) return NOT_ELIGIBLE;
  try {
    const [row] = await dbQuery<{ referred_by: string | null; paid_orders: number }>(
      `SELECT p.referred_by,
              ((SELECT COUNT(*) FROM paygate_orders o
                 WHERE o.identifier = p.identifier AND o.granted_at IS NOT NULL)
             + (SELECT COUNT(*) FROM paypal_orders q
                 WHERE q.identifier = p.identifier AND q.granted_at IS NOT NULL)) AS paid_orders
       FROM profiles p WHERE p.identifier = $1`,
      [identifier]
    );
    return {
      referred: !!row?.referred_by,
      firstPaidOrder: Number(row?.paid_orders ?? 1) === 0,
    };
  } catch (e) {
    console.error("[creator-promo] eligibility lookup failed (full price):", String(e));
    return NOT_ELIGIBLE;
  }
}

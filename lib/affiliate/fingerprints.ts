// lib/affiliate/fingerprints.ts — #AFFILIATE-FINGERPRINTS-1022 (R4)
// Scrive `affiliate_payer_fingerprints`, che il ledger LEGGE alla prima
// conversione (resolveAttribution → selfReferralCheck) ma che finora nessuno
// scriveva: l'anti-self-referral si fermava a identifier ed email canonica.
//
// Solo l'IP, solo HMAC (AFFILIATE_HASH_SECRET, mai il valore in chiaro), solo
// per chi partecipa al programma: il referito alla registrazione con un codice,
// l'affiliato all'iscrizione e quando apre il pannello. Due account che si
// vedono dallo stesso IP entro 24 ore → `fraud_review` (commissione ferma,
// sblocco a mano), mai un rifiuto automatico (self-referral.ts).
// seen_at si rinfresca a ogni passaggio: la finestra misura l'ultima volta.
//
// Non lancia mai e non rallenta la richiesta (after()). Senza segreto o con
// AFFILIATE_MODE=off non scrive niente.
// ⚠ LIMITE NOTO: paypal_payer_id / stripe_card_fp / shopify_customer_id non si
// scrivono ancora (PayPal e Stripe non sono live; il customer Shopify segue
// l'email, già coperta dall'email canonica). Upgrade path: stesso helper,
// chiamato dal rail con il suo id pagatore.

import { after } from "next/server";
import { dbExecute } from "@/lib/db";
import { hashIp } from "./account";
import { affiliateMode } from "./config";

export async function recordIpFingerprintSafe(identifier: string, ip: string): Promise<boolean> {
  try {
    if (affiliateMode() === "off") return false;
    const who = (identifier ?? "").trim().toLowerCase();
    const hash = hashIp(ip);
    if (!who || !hash) return false;
    await dbExecute(
      `INSERT INTO affiliate_payer_fingerprints (identifier, kind, value_hash, seen_at)
       VALUES ($1, 'ip_hash', $2, NOW())
       ON CONFLICT (identifier, kind, value_hash) DO UPDATE SET seen_at = NOW()`,
      [who, hash]
    );
    return true;
  } catch (e) {
    console.error("[affiliate/fingerprints] ip non registrato:", String(e));
    return false;
  }
}

/** Dopo la risposta; sincrona, non lancia mai. */
export function scheduleIpFingerprint(identifier: string, ip: string): void {
  try {
    if (affiliateMode() === "off") return;
  } catch {
    return;
  }
  const run = () => recordIpFingerprintSafe(identifier, ip);
  try {
    after(run);
  } catch {
    void run();
  }
}

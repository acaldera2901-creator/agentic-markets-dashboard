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
// Ogni avvistamento conserva la sua data, senza cancellare i precedenti (review
// Codex: un rinfresco cancellava la prova di una co-presenza passata, il solo
// «primo avvistamento» perdeva quelle successive). Lo UNIQUE della tabella
// (identifier, kind, value_hash) ammette una riga per valore, quindi il valore
// è l'HMAC di IP + GIORNO UTC: una riga per IP per giorno, con la prima ora di
// quel giorno. Ogni avvistamento scrive il bucket di oggi E quello di ieri, così
// due avvistamenti a cavallo della mezzanotte (23:00 / 01:00) condividono un
// valore. La finestra di 24 h la applica comunque selfReferralCheck sulle date
// vere: il bucket allarga solo il confronto, non lo rende più permissivo.
// ⚠ LIMITE NOTO (debito accettato, review Codex #3): dentro lo stesso bucket
// resta solo il PRIMO avvistamento (DO NOTHING: una prova non si cancella mai).
// Un secondo avvistamento lo stesso giorno, seguito da una registrazione 24-47 h
// dopo il primo, non fa scattare fraud_review. È un segnale morbido (revisione
// a mano, non rifiuto); upgrade path: tabella con più date per valore.
// Conservazione: le righe ip_hash oltre FINGERPRINT_RETENTION_DAYS non possono
// più decidere niente (attribuzione entro 60 gg dalla registrazione, finestra
// IP 24 h) e si cancellano a ogni scrittura.
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

export const FINGERPRINT_RETENTION_DAYS = 90;

/** Giorno UTC di oggi e di ieri, «YYYY-MM-DD». */
export function ipDayBuckets(at: Date): [string, string] {
  const today = at.toISOString().slice(0, 10);
  const yesterday = new Date(at.getTime() - 86_400_000).toISOString().slice(0, 10);
  return [today, yesterday];
}

export async function recordIpFingerprintSafe(identifier: string, ip: string, at: Date = new Date()): Promise<boolean> {
  try {
    if (affiliateMode() === "off") return false;
    const who = (identifier ?? "").trim().toLowerCase();
    if (!who || !ip || ip === "unknown") return false;
    const hashes = ipDayBuckets(at).map((day) => hashIp(`${ip}|${day}`));
    if (hashes.some((h) => !h)) return false;
    // Prima la pulizia: altrimenti una riga scaduta con lo stesso valore farebbe
    // saltare l'INSERT (DO NOTHING) e poi verrebbe cancellata.
    try {
      await dbExecute(
        `DELETE FROM affiliate_payer_fingerprints
          WHERE kind = 'ip_hash' AND seen_at < NOW() - make_interval(days => $1)`,
        [FINGERPRINT_RETENTION_DAYS]
      );
    } catch (e) {
      console.error("[affiliate/fingerprints] pulizia non riuscita:", String(e));
    }
    await dbExecute(
      `INSERT INTO affiliate_payer_fingerprints (identifier, kind, value_hash, seen_at)
       VALUES ($1, 'ip_hash', $2, $4::timestamptz), ($1, 'ip_hash', $3, $4::timestamptz)
       ON CONFLICT (identifier, kind, value_hash) DO NOTHING`,
      [who, hashes[0], hashes[1], at.toISOString()]
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

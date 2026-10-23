// lib/affiliate/clicks.ts — #AFFILIATE-CLICKS-1022 (B4)
// `affiliate_referral_clicks` esisteva dalla migration 20261007120000 ma nessuno
// la scriveva: /r/CODE redirigeva senza contare, e ricostruiva l'URL con il solo
// `ref`, perdendo gli utm che il creator mette sul link per misurare i canali.
//
// Qui: (1) quali parametri del link sopravvivono al redirect (utm_*, src);
// (2) se un click va contato (solo produzione, niente bot/anteprime/prefetch,
// niente link marcati test); (3) l'INSERT, solo per un affiliato ATTIVO (codici
// inesistenti o sospesi non lasciano righe). IP e UA solo come HMAC
// (AFFILIATE_HASH_SECRET), l'IP con il giorno UTC come per i fingerprint: conta
// i click unici per giorno senza collegare giorni diversi. Senza segreto il click
// si conta lo stesso, senza hash.
// ⚠ LIMITE NOTO: il freno alle ricariche (1 click per codice+IP ogni 30 min) è
// in memoria per istanza serverless: su più istanze un click ripetuto può
// contare due volte. I report usano COUNT(DISTINCT ip_hash) per giorno. Upgrade
// path: dedup per (affiliate_id, ip_hash) nella stessa ora, in SQL.

import { after } from "next/server";
import { dbExecute } from "@/lib/db";
import { isBotUserAgent } from "@/lib/bot-filter";
import { analyticsWriteAllowed } from "@/lib/events-write-gate";
import { hashIp } from "./account";
import { affiliateMode } from "./config";

const KEEP_PARAM = /^(utm_[a-z]{1,20}|src)$/;
const SAFE_VALUE = /^[A-Za-z0-9 _.\-~+%]{1,100}$/;
const MAX_KEPT = 8;

/** I parametri di provenienza del link da portare sulla landing (mai `ref`: lo decide il codice). */
export function keptSourceParams(from: URL): [string, string][] {
  const out: [string, string][] = [];
  for (const [k, v] of from.searchParams) {
    const key = k.toLowerCase();
    if (!KEEP_PARAM.test(key) || !SAFE_VALUE.test(v) || out.some(([x]) => x === key)) continue;
    out.push([key, v]);
    if (out.length >= MAX_KEPT) break;
  }
  return out;
}

/** Vero se il click va contato. Il redirect avviene comunque. */
export function clickCountable(req: Request, kept: [string, string][], env: Record<string, string | undefined> = process.env): boolean {
  if (!analyticsWriteAllowed(env)) return false; // dev/preview: stesso DB di prod
  if (affiliateMode(env) === "off") return false;
  if (isBotUserAgent(req.headers.get("user-agent"))) return false;
  const purpose = `${req.headers.get("sec-purpose") ?? ""} ${req.headers.get("purpose") ?? ""}`.toLowerCase();
  if (purpose.includes("prefetch") || purpose.includes("prerender") || req.headers.get("next-router-prefetch")) return false;
  if (kept.some(([, v]) => /test/i.test(v))) return false; // link di collaudo (utm_campaign=test…)
  return true;
}

export async function recordReferralClickSafe(code: string, ip: string, ua: string, landing: string, at = new Date()): Promise<boolean> {
  try {
    const day = at.toISOString().slice(0, 10);
    await dbExecute(
      `INSERT INTO affiliate_referral_clicks (affiliate_id, clicked_at, ip_hash, ua_hash, landing)
       SELECT id, $2::timestamptz, $3, $4, $5 FROM affiliates WHERE code = $1 AND status = 'active' AND left_at IS NULL`,
      [code, at.toISOString(), hashIp(`${ip}|${day}`), ua ? hashIp(ua) : null, landing.slice(0, 500)]
    );
    return true;
  } catch (e) {
    console.error("[affiliate/clicks] click non registrato:", String(e));
    return false;
  }
}

/** Dopo la risposta; sincrona, non lancia mai. */
export function scheduleReferralClick(code: string, ip: string, ua: string, landing: string): void {
  const run = () => recordReferralClickSafe(code, ip, ua, landing);
  try {
    after(run);
  } catch {
    void run();
  }
}

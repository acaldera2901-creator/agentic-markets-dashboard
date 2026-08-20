// lib/internal-invite.ts — #INTERNAL-INVITE-0813
// Il link invito INTERNO: un codice che non appartiene a nessun profilo e regala
// N giorni di PRO a chi si iscrive con quel link. Serve a mandarlo a mano agli
// amici stretti (deciso da Andrea 2026-08-13: nessun tetto di usi, chiunque
// riceve il link si iscrive e prende i giorni).
//
// Vive in una env e non in tabella perché il set di codici cambia raramente e
// una tabella vorrebbe migration + mint + UI. Il prezzo di questa scelta è che
// per REVOCARE un codice serve cambiare la env e fare un redeploy: i deploy
// esistenti continuano a leggere il valore con cui sono stati costruiti.
//
// Formato: INTERNAL_INVITE_CODES="CODICE:GIORNI, ALTRO:GIORNI"
//   es. "MAVEN30:30"
//
// Fail-closed in ogni ramo: una voce che non si capisce viene scartata e non
// concede niente. Un errore di configurazione non deve poter regalare accesso.

import { normalizeRefCode } from "./referral-code";

export type InternalInvite = { code: string; days: number };

const ENV_KEY = "INTERNAL_INVITE_CODES";

/** Tetto di sanità: oltre un anno è una battitura sbagliata, non un'intenzione. */
const MAX_DAYS = 365;

/** La env si legge a ogni chiamata (non al load del modulo): così un test la può
 *  cambiare e il valore non resta congelato nel bundle del server. */
function parseEnv(): Map<string, InternalInvite> {
  const out = new Map<string, InternalInvite>();
  for (const entry of (process.env[ENV_KEY] ?? "").split(",")) {
    const [rawCode, rawDays] = entry.split(":");
    // Stessa regex del rail (lib/referral-code): un codice che non la passa non
    // arriverebbe mai in profiles.referred_by, quindi è configurazione morta.
    const code = normalizeRefCode(rawCode ?? "");
    if (!code) continue;
    const days = Number((rawDays ?? "").trim());
    if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) continue;
    if (!out.has(code)) out.set(code, { code, days }); // il primo vince
  }
  return out;
}

/** La spec del codice interno, o null se non è interno (o è malformato). */
export function internalInviteSpec(code: string): InternalInvite | null {
  const c = normalizeRefCode(code);
  if (!c) return null;
  return parseEnv().get(c) ?? null;
}

/** Comodo per i guard che devono solo sapere se il codice è riservato. */
export function isInternalInviteCode(code: string): boolean {
  return internalInviteSpec(code) !== null;
}

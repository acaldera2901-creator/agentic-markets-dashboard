// Single transactional-email path. Wraps sendEmail() and RECORDS every attempt
// into the shared `notifications` table (the same table the operator backoffice
// renders), so automated customer emails are visible/auditable next to the
// operator-sent ones — not just a swallowed console.error.
//
// Default behaviour is best-effort: a send/record failure never throws out of
// here (callers like the Stripe webhook must still ack 200). Pass
// { throwOnError: true } for flows that MUST fail loud (e.g. activation on
// registration, where a non-deliverable email should block signup).

import { sendEmail, marketingFromAddress } from "./email";
import { dbExecute } from "./db";

export type TxEmailType =
  | "activation"
  | "password_reset"
  | "welcome"
  | "payment_received"
  | "plan_activated"
  | "receipt"
  | "cancellation"
  | "renewal_reminder"
  | "winback"
  // #MAIL-I18N-5LANG-0805: il cron CRM marcava OGNI email come "winback", anche
  // le acquisition e le retention. Nella tabella `notifications` — l'unico registro
  // di cosa abbiamo spedito — non si poteva contare per flusso: è così che 8
  // offerte inesistenti sono uscite senza che nessuno le notasse in un conteggio.
  // Il flusso vero era già in `meta.flow`, quindi lo storico resta leggibile.
  | "acquisition"
  | "retention"
  | "onboarding";

// #EMAIL-WARMUP-0819 — quali flussi sono marketing e quali sono servizio. I primi
// escono dal dominio marketing, i secondi restano sulla radice.
// `renewal_reminder` sta di proposito FUORI: parla di un abbonamento già in corso,
// quindi è servizio dovuto al cliente, non promozione — e un cliente che paga deve
// riceverlo anche se la reputazione del dominio marketing è compromessa.
const MARKETING_TYPES: ReadonlySet<TxEmailType> = new Set([
  "acquisition",
  "retention",
  "onboarding",
  "winback",
]);

export async function sendTransactional(opts: {
  type: TxEmailType;
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  meta?: Record<string, unknown>;
  throwOnError?: boolean;
}): Promise<{ sent: boolean; error?: string }> {
  let sent = false;
  let error: string | undefined;

  try {
    await sendEmail({
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      // Un `from` esplicito del chiamante vince sempre; altrimenti il mittente lo
      // decide il tipo di flusso. `undefined` fa applicare il default di sendEmail.
      from: opts.from || (MARKETING_TYPES.has(opts.type) ? marketingFromAddress() : undefined),
      replyTo: opts.replyTo,
      headers: opts.headers,
    });
    sent = true;
  } catch (e) {
    error = String(e);
    console.error(`[notify] ${opts.type} email to ${opts.to} failed:`, error);
  }

  // Record the attempt (best-effort — recording failures must never mask the send
  // result or throw). Mirrors the events-table insert pattern in plan-grant.ts.
  try {
    await dbExecute(
      `INSERT INTO notifications (type, title, body, target, sent, sent_at, meta)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        `email:${opts.type}`,
        opts.subject,
        opts.text.slice(0, 2000),
        opts.to,
        sent,
        sent ? new Date().toISOString() : null,
        JSON.stringify({ type: opts.type, via: "betredge-app", ...(error ? { error } : {}), ...(opts.meta ?? {}) }),
      ]
    );
  } catch (e) {
    console.error(`[notify] failed to record ${opts.type} email:`, String(e));
  }

  if (!sent && opts.throwOnError) {
    throw new Error(error || `[notify] ${opts.type} email failed`);
  }
  return { sent, error };
}

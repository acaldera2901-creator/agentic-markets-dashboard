// Single transactional-email path. Wraps sendEmail() and RECORDS every attempt
// into the shared `notifications` table (the same table the operator backoffice
// renders), so automated customer emails are visible/auditable next to the
// operator-sent ones — not just a swallowed console.error.
//
// Default behaviour is best-effort: a send/record failure never throws out of
// here (callers like the Stripe webhook must still ack 200). Pass
// { throwOnError: true } for flows that MUST fail loud (e.g. activation on
// registration, where a non-deliverable email should block signup).

import { sendEmail } from "./email";
import { dbExecute } from "./db";

export type TxEmailType =
  | "activation"
  | "welcome"
  | "payment_received"
  | "plan_activated"
  | "receipt"
  | "cancellation"
  | "renewal_reminder"
  | "winback";

export async function sendTransactional(opts: {
  type: TxEmailType;
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
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
      from: opts.from,
      replyTo: opts.replyTo,
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

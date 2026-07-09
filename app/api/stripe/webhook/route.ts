import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, isStripeConfigured, resolvePlanFromPriceId, periodEndToIso } from "@/lib/stripe";
import { activateStripePlan } from "@/lib/plan-grant";
import { dbQuery, dbQueryStrict, dbExecute } from "@/lib/db";
import { receiptEmail, cancellationEmail } from "@/lib/email";
import { sendTransactional } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Extract price id from a line item pricing field (stripe v22: pricing.price_details.price
// is string | Price — the legacy top-level `price` field no longer exists on InvoiceLineItem).
function extractPriceId(lineItem: Stripe.InvoiceLineItem): string | undefined {
  const priceOrId = lineItem.pricing?.price_details?.price;
  if (!priceOrId) return undefined;
  if (typeof priceOrId === "string") return priceOrId;
  return priceOrId.id;
}

// Extract subscription id from an Invoice (stripe v22: top-level `subscription` is gone;
// the link lives at parent.subscription_details.subscription).
function extractSubscriptionId(inv: Stripe.Invoice): string | null {
  const sub = inv.parent?.subscription_details?.subscription;
  if (!sub) return null;
  if (typeof sub === "string") return sub;
  return sub.id;
}

export async function POST(req: Request) {
  if (!isStripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "stripe not configured" }, { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  const raw = await req.text(); // raw body obbligatorio per la verifica firma
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    console.error("[stripe/webhook] bad signature:", String(e));
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  // Idempotency: Stripe redelivers events (and a captured signed body can be
  // replayed) — without this, a replayed invoice.paid re-extends the plan and
  // re-sends the receipt. NB: exec_sql does NOT return RETURNING rows — it wraps
  // every statement in `SELECT ... FROM (<stmt>) t`, which is invalid for a
  // writing statement, so it falls back to running the bare write and returns [].
  // Relying on "INSERT ... RETURNING returned a row" therefore treats EVERY event
  // as a duplicate and the activation never runs. Instead: SELECT first
  // (fail-loud), then mark the event as processing.
  try {
    const seen = await dbQueryStrict<{ event_id: string }>(
      `SELECT event_id FROM stripe_events WHERE event_id = $1 LIMIT 1`,
      [event.id]
    );
    if (seen.length > 0) {
      // Already processed — ack 200 so Stripe stops retrying.
      return NextResponse.json({ received: true, duplicate: true });
    }
    // Mark BEFORE handling. ON CONFLICT DO NOTHING absorbs a near-simultaneous
    // redelivery; the row is rolled back in the catch below if handling throws,
    // so a transient failure is reprocessed on Stripe's next retry.
    await dbExecute(
      `INSERT INTO stripe_events (event_id, event_type)
       VALUES ($1, $2)
       ON CONFLICT (event_id) DO NOTHING`,
      [event.id, event.type]
    );
  } catch (e) {
    // Can't confirm idempotency → 500 so Stripe retries (no unguarded processing).
    console.error("[stripe/webhook] idempotency check failed:", String(e));
    return NextResponse.json({ error: "idempotency unavailable" }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const identifier = s.client_reference_id ?? s.customer_email ?? null;
        if (identifier) {
          // I3: store SQL NULL (not "") when Stripe omits the customer/subscription.
          const customerId = typeof s.customer === "string" ? s.customer : s.customer?.id ?? null;
          const subscriptionId =
            typeof s.subscription === "string" ? s.subscription : s.subscription?.id ?? null;
          await dbQuery(
            `UPDATE profiles
                SET stripe_customer_id = $2, stripe_subscription_id = $3, updated_at = NOW()
              WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1`,
            [identifier, customerId, subscriptionId]
          );
        }
        break;
      }
      case "invoice.paid": {
        const inv = event.data.object as Stripe.Invoice;
        // I4: guard a malformed invoice with no line items — accessing price/period
        // on undefined would throw -> 500 -> infinite Stripe retries. Ack 200 instead.
        const line = inv.lines?.data?.[0];
        if (!line) {
          console.error("[stripe/webhook] invoice.paid has no line items", { invoice: inv.id });
          break;
        }
        // v22: price id lives at lineItem.pricing.price_details.price (string | Price)
        const priceId = extractPriceId(line);
        const plan = resolvePlanFromPriceId(priceId);
        // period.end is still on the line item period object
        const periodEnd = line.period?.end ?? null;
        // identifier: from subscription metadata (preferred) or lookup by customer
        let identifier: string | null = null;
        // C1: only activate when the subscription is actually live. A stale or
        // redelivered invoice.paid must not re-upgrade a user who already cancelled.
        let subActive = false;
        const subId = extractSubscriptionId(inv);
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          identifier = sub.metadata?.identifier ?? null;
          subActive = sub.status === "active" || sub.status === "trialing";
        }
        if (!identifier && inv.customer) {
          const rows = await dbQuery<{ identifier: string }>(
            "SELECT identifier FROM profiles WHERE stripe_customer_id = $1 LIMIT 1",
            [String(inv.customer)]
          );
          identifier = rows[0]?.identifier ?? null;
        }
        if (!subActive) {
          // Stripe is the source of truth: sub not active/trialing -> no activation.
          console.error("[stripe/webhook] invoice.paid sub not active, skipping activation", {
            identifier,
            subId,
          });
          break;
        }
        if (identifier && plan) {
          // Persist the sub id in the same update (set even if checkout.session.completed is late).
          await activateStripePlan(identifier, plan, subId, periodEndToIso(periodEnd));
          // Receipt with the real amount. The event-id guard above ensures one
          // send per payment event (no duplicates on Stripe redelivery).
          if (identifier.includes("@")) {
            const mail = receiptEmail(
              inv.amount_paid ?? null,
              inv.currency ?? null,
              plan,
              periodEndToIso(periodEnd)
            );
            await sendTransactional({
              type: "receipt",
              to: identifier,
              subject: mail.subject,
              html: mail.html,
              text: mail.text,
              meta: { invoice: inv.id, plan },
            });
          }
        } else {
          console.error("[stripe/webhook] invoice.paid unresolved", { identifier, priceId });
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        // exec_sql can't return RETURNING rows → read who we're about to cancel
        // BEFORE nulling stripe_subscription_id, then run the downgrade.
        const cancelled = await dbQuery<{ identifier: string; language: string | null }>(
          `SELECT identifier, language FROM profiles
            WHERE stripe_subscription_id = $1 LIMIT 1`,
          [String(sub.id)]
        );
        await dbExecute(
          `UPDATE profiles
              SET plan = 'free', stripe_subscription_id = NULL, updated_at = NOW()
            WHERE stripe_subscription_id = $1`,
          [String(sub.id)]
        );
        // Notify the customer their subscription was cancelled (best-effort + recorded).
        const c = cancelled[0];
        if (c?.identifier?.includes("@")) {
          const mail = cancellationEmail(c.language === "en" ? "en" : "it");
          await sendTransactional({
            type: "cancellation",
            to: c.identifier,
            subject: mail.subject,
            html: mail.html,
            text: mail.text,
          });
        }
        break;
      }
      default:
        break; // eventi non gestiti: ack 200 per non far ritentare
    }
  } catch (e) {
    console.error("[stripe/webhook] handler error:", String(e));
    // F1 (#REVIEW-RESEND-I18N-0617): we recorded the event id BEFORE processing
    // (for dedup), but processing just threw — likely a transient error. Roll the
    // idempotency record back so Stripe's retry actually reprocesses; otherwise a
    // paid invoice that transiently failed would be acked as a duplicate next time
    // and the customer would be charged without ever getting the plan.
    try {
      await dbExecute(`DELETE FROM stripe_events WHERE event_id = $1`, [event.id]);
    } catch (delErr) {
      console.error("[stripe/webhook] idempotency rollback failed:", String(delErr));
    }
    return NextResponse.json({ error: "handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

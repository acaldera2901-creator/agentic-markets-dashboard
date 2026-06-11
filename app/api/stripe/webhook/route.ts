import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, isStripeConfigured, resolvePlanFromPriceId, periodEndToIso } from "@/lib/stripe";
import { activateStripePlan } from "@/lib/plan-grant";
import { dbQuery } from "@/lib/db";

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
        } else {
          console.error("[stripe/webhook] invoice.paid unresolved", { identifier, priceId });
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await dbQuery(
          `UPDATE profiles
              SET plan = 'free', plan_expires_at = NULL, stripe_subscription_id = NULL, updated_at = NOW()
            WHERE stripe_subscription_id = $1`,
          [String(sub.id)]
        );
        break;
      }
      default:
        break; // eventi non gestiti: ack 200 per non far ritentare
    }
  } catch (e) {
    console.error("[stripe/webhook] handler error:", String(e));
    return NextResponse.json({ error: "handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

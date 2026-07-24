import { NextResponse } from "next/server";
import {
  verifyShopifyHmac,
  extractOrder,
  resolvePlanFromVariant,
  isWeeklyPickVariant,
  isShopifyConfigured,
} from "@/lib/shopify";
import { activateShopifyPlan } from "@/lib/plan-grant";
import { grantWeeklyPick } from "@/lib/weekly-pick-server";
import { currentWeekStart } from "@/lib/weekly-pick";
import { dbQueryStrict, dbExecute } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isShopifyConfigured()) {
    return NextResponse.json({ error: "shopify not configured" }, { status: 503 });
  }

  const raw = await req.text(); // raw body obbligatorio per l'HMAC
  const hmac = req.headers.get("x-shopify-hmac-sha256");
  if (!verifyShopifyHmac(raw, hmac)) {
    console.error("[shopify/webhook] bad signature");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const order = extractOrder(payload);
  if (!order) {
    return NextResponse.json({ received: true, skipped: "no order id" });
  }

  // Idempotenza per order id (pattern stripe_events). SELECT-prima (fail-loud),
  // poi INSERT ON CONFLICT DO NOTHING; rollback della riga se l'handler throwa.
  try {
    const seen = await dbQueryStrict<{ event_id: string }>(
      `SELECT event_id FROM shopify_events WHERE event_id = $1 LIMIT 1`,
      [order.orderId]
    );
    if (seen.length > 0) return NextResponse.json({ received: true, duplicate: true });
    await dbExecute(
      `INSERT INTO shopify_events (event_id, event_type) VALUES ($1, 'orders/paid')
       ON CONFLICT (event_id) DO NOTHING`,
      [order.orderId]
    );
  } catch (e) {
    console.error("[shopify/webhook] idempotency unavailable:", String(e));
    return NextResponse.json({ error: "idempotency unavailable" }, { status: 500 });
  }

  try {
    // Weekly Pick: SKU one-off → entitlement della settimana corrente, non un
    // piano. La settimana la decide il SERVER al momento dell'ordine (mai il
    // payload), e grantWeeklyPick è idempotente sulla UNIQUE identifier+week.
    if (isWeeklyPickVariant(order.variantId)) {
      if (!order.identifier) {
        console.error("[shopify/webhook] weekly pick senza identifier", { order });
        return NextResponse.json({ received: true, unresolved: true });
      }
      await grantWeeklyPick(order.identifier, currentWeekStart(new Date()), null);
      return NextResponse.json({ received: true, weeklyPick: true });
    }

    const plan = resolvePlanFromVariant(order.variantId);
    if (!order.identifier || !plan) {
      // Non mappabile: NON scartare in silenzio → resta senza grant per la reconcile.
      console.error("[shopify/webhook] unresolved order", { order });
      return NextResponse.json({ received: true, unresolved: true });
    }
    const granted = await activateShopifyPlan(order.identifier, plan, "monthly");
    if (!granted) {
      console.error("[shopify/webhook] grant null (utente inesistente o grandfather)", {
        identifier: order.identifier,
      });
    }
  } catch (e) {
    console.error("[shopify/webhook] handler error:", String(e));
    // Rollback idempotenza così Shopify ritenta (pattern Stripe).
    try {
      await dbExecute(`DELETE FROM shopify_events WHERE event_id = $1`, [order.orderId]);
    } catch (delErr) {
      console.error("[shopify/webhook] idempotency rollback failed:", String(delErr));
    }
    return NextResponse.json({ error: "handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

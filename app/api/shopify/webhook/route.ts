import { NextResponse } from "next/server";
import {
  verifyShopifyHmac,
  extractOrder,
  extractRefund,
  resolveOrderFromVariant,
  isWeeklyPickVariant,
  isShopifyConfigured,
} from "@/lib/shopify";
import { activateShopifyPlan, revokeShopifyPlan } from "@/lib/plan-grant";
import { grantWeeklyPick } from "@/lib/weekly-pick-server";
import { currentWeekStart } from "@/lib/weekly-pick";
import { dbQueryStrict, dbExecute } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Traccia l'esito sull'evento. Volutamente non fail-loud: se questa scrittura
// fallisce il grant è già avvenuto, e far throware qui provocherebbe il rollback
// dell'idempotenza e quindi un DOPPIO grant al retry di Shopify.
async function markEvent(orderId: string, status: string, lastError?: string): Promise<void> {
  try {
    await dbExecute(
      `UPDATE shopify_events SET status = $2, last_error = $3 WHERE event_id = $1`,
      [orderId, status, lastError ?? null]
    );
  } catch (e) {
    console.error("[shopify/webhook] markEvent failed:", String(e));
  }
}

// Rimborso/chargeback → revoca l'accesso. L'identifier non è nel payload del
// rimborso: lo recuperiamo dall'evento dell'ordine originale.
async function handleRefund(payload: unknown) {
  const refund = extractRefund(payload);
  if (!refund) return NextResponse.json({ received: true, skipped: "no refund id" });

  // Idempotenza su chiave dedicata: un rimborso NON deve collidere con l'ordine.
  const eventKey = `refund:${refund.refundId}`;
  try {
    const seen = await dbQueryStrict<{ event_id: string }>(
      `SELECT event_id FROM shopify_events WHERE event_id = $1 LIMIT 1`,
      [eventKey]
    );
    if (seen.length > 0) return NextResponse.json({ received: true, duplicate: true });
  } catch (e) {
    console.error("[shopify/webhook] refund idempotency unavailable:", String(e));
    return NextResponse.json({ error: "idempotency unavailable" }, { status: 500 });
  }

  let identifier: string | null = null;
  try {
    const rows = await dbQueryStrict<{ identifier: string | null }>(
      `SELECT identifier FROM shopify_events WHERE event_id = $1 LIMIT 1`,
      [refund.orderId]
    );
    identifier = rows[0]?.identifier ?? null;
  } catch (e) {
    console.error("[shopify/webhook] refund lookup failed:", String(e));
    return NextResponse.json({ error: "refund lookup failed" }, { status: 500 });
  }

  if (!identifier) {
    // Ordine sconosciuto (es. precedente a questa colonna): non tiriamo a
    // indovinare chi disattivare, lo registriamo per revisione manuale.
    console.error("[shopify/webhook] rimborso senza identifier noto", { refund });
    await dbExecute(
      `INSERT INTO shopify_events (event_id, event_type, status, last_error)
       VALUES ($1, 'refunds/create', 'unresolved', 'order non trovato: revoca manuale')
       ON CONFLICT (event_id) DO NOTHING`,
      [eventKey]
    );
    return NextResponse.json({ received: true, unresolved: true });
  }

  const revoked = await revokeShopifyPlan(identifier);
  await dbExecute(
    `INSERT INTO shopify_events (event_id, event_type, identifier, status)
     VALUES ($1, 'refunds/create', $2, $3)
     ON CONFLICT (event_id) DO NOTHING`,
    [eventKey, identifier, revoked ? "revoked" : "unresolved"]
  );
  return NextResponse.json({ received: true, revoked });
}

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
  // Il topic decide il ramo. Assente → orders/paid, per non cambiare il
  // comportamento dei webhook già registrati.
  const topic = req.headers.get("x-shopify-topic") ?? "orders/paid";

  if (topic === "refunds/create") {
    return handleRefund(payload);
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
    // identifier e variant vengono registrati perché la reconcile possa ri-tentare
    // un ordine rimasto senza grant: senza di essi l'evento è irrecuperabile.
    await dbExecute(
      `INSERT INTO shopify_events (event_id, event_type, identifier, variant_id, status)
       VALUES ($1, 'orders/paid', $2, $3, 'pending')
       ON CONFLICT (event_id) DO NOTHING`,
      [order.orderId, order.identifier, order.variantId]
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
      await markEvent(order.orderId, "weekly");
      return NextResponse.json({ received: true, weeklyPick: true });
    }

    const resolved = resolveOrderFromVariant(order.variantId);
    if (!order.identifier || !resolved) {
      // Non mappabile: NON scartare in silenzio → resta 'unresolved' e la
      // reconcile lo ri-tenta (es. l'utente si registra DOPO aver pagato).
      console.error("[shopify/webhook] unresolved order", { order });
      await markEvent(order.orderId, "unresolved", "identifier o variant non risolvibili");
      return NextResponse.json({ received: true, unresolved: true });
    }
    // Il periodo viene dal variant id, non hardcoded: un ordine annuale deve
    // valere 365 giorni, non 30.
    const granted = await activateShopifyPlan(order.identifier, resolved.plan, resolved.period);
    if (!granted) {
      console.error("[shopify/webhook] grant null (utente inesistente o grandfather)", {
        identifier: order.identifier,
      });
      await markEvent(order.orderId, "unresolved", "grant null: profilo inesistente o grandfather");
    } else {
      await markEvent(order.orderId, "granted");
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

import { NextResponse } from "next/server";
import {
  verifyShopifyHmac,
  extractOrder,
  extractRefund,
  resolveOrderFromVariant,
  isWeeklyPickVariant,
  isShopifyConfigured,
  isFullRefund,
  isCryptoGatewayOrder,
} from "@/lib/shopify";
import { activateShopifyPlan, revokeShopifyPlan } from "@/lib/plan-grant";
import { grantWeeklyPick } from "@/lib/weekly-pick-server";
import { currentWeekStart } from "@/lib/weekly-pick";
import { dbQueryStrict, dbExecute } from "@/lib/db";
import { opsAlert } from "@/lib/ops-alert";

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

  let order: { identifier: string | null; variant_id: string | null; amount: number | null } | null = null;
  try {
    const rows = await dbQueryStrict<{
      identifier: string | null;
      variant_id: string | null;
      amount: string | number | null;
    }>(
      `SELECT identifier, variant_id, amount FROM shopify_events WHERE event_id = $1 LIMIT 1`,
      [refund.orderId]
    );
    const r = rows[0];
    order = r
      ? {
          identifier: r.identifier ?? null,
          variant_id: r.variant_id ?? null,
          amount: r.amount == null ? null : Number(r.amount),
        }
      : null;
  } catch (e) {
    console.error("[shopify/webhook] refund lookup failed:", String(e));
    return NextResponse.json({ error: "refund lookup failed" }, { status: 500 });
  }
  const identifier = order?.identifier ?? null;

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

  // Un rimborso NON è sempre "spegni l'abbonamento". Due casi che la revoca
  // cieca sbagliava, entrambi a nostro danno o del cliente:
  // 1) rimborso della Weekly Pick (SKU one-off): spegneva l'ABBONAMENTO di chi
  //    aveva comprato anche un piano, cioè revocava un piano regolarmente pagato;
  // 2) rimborso PARZIALE su un annuale (una mensilità, un gesto commerciale):
  //    azzerava 12 mesi pagati.
  // In entrambi i casi non indoviniamo: lasciamo l'accesso e chiediamo mani umane.
  const manual = async (status: string, why: string) => {
    console.error(`[shopify/webhook] rimborso da gestire a mano: ${why}`, { refund, order });
    await dbExecute(
      `INSERT INTO shopify_events (event_id, event_type, identifier, status, last_error)
       VALUES ($1, 'refunds/create', $2, $3, $4)
       ON CONFLICT (event_id) DO NOTHING`,
      [eventKey, identifier, status, why]
    );
    await opsAlert("shopify-refund", [`rimborso ${refund.refundId} da gestire a mano: ${why}`]);
    return NextResponse.json({ received: true, manual: why });
  };

  if (isWeeklyPickVariant(order?.variant_id)) {
    return manual("weekly-refund", "rimborso Weekly Pick: entitlement one-off, piano non toccato");
  }
  if (!isFullRefund(refund.amount, order?.amount ?? null)) {
    return manual(
      "partial-refund",
      `rimborso parziale ${String(refund.amount)}/${String(order?.amount)}: accesso mantenuto`
    );
  }

  let revoked: boolean;
  try {
    revoked = await revokeShopifyPlan(identifier);
  } catch (e) {
    // Nessuna riga di idempotenza scritta → Shopify ritenta il rimborso.
    console.error("[shopify/webhook] revoke failed:", String(e));
    return NextResponse.json({ error: "revoke failed" }, { status: 500 });
  }
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
  // Il topic decide il ramo. NIENTE default a orders/paid: un header assente o
  // un topic sconosciuto NON deve concedere (whitelist esplicita sotto).
  const topic = req.headers.get("x-shopify-topic");

  if (topic === "refunds/create") {
    return handleRefund(payload);
  }
  // Whitelist: solo orders/paid concede. Qualunque altro topic (o header assente,
  // es. un topic aggiunto in futuro sullo stesso URL) → ack senza grant, così non
  // si concede mai su un ordine non pagato.
  if (topic !== "orders/paid") {
    return NextResponse.json({ received: true, ignored: topic ?? null });
  }

  const order = extractOrder(payload);
  if (!order) {
    return NextResponse.json({ received: true, skipped: "no order id" });
  }

  // Idempotenza ATOMICA: l'INSERT È il gate. ON CONFLICT DO NOTHING RETURNING →
  // 0 righe significa che un'altra delivery ha già preso questo ordine (duplicato):
  // ack senza grant. Elimina la race SELECT-poi-INSERT — due delivery concorrenti
  // dello stesso ordine passavano entrambe la SELECT → doppio activateShopifyPlan
  // → 2x giorni concessi per 1 pagamento.
  // identifier e variant vengono registrati perché la reconcile possa ri-tentare
  // un ordine rimasto senza grant: senza di essi l'evento è irrecuperabile.
  let won: { event_id: string }[];
  try {
    won = await dbQueryStrict<{ event_id: string }>(
      `INSERT INTO shopify_events (event_id, event_type, identifier, variant_id, amount, status)
       VALUES ($1, 'orders/paid', $2, $3, $4, 'pending')
       ON CONFLICT (event_id) DO NOTHING
       RETURNING event_id`,
      [order.orderId, order.identifier, order.variantId, order.totalPrice]
    );
  } catch (e) {
    console.error("[shopify/webhook] idempotency unavailable:", String(e));
    return NextResponse.json({ error: "idempotency unavailable" }, { status: 500 });
  }
  if (won.length === 0) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    // Weekly Pick: SKU one-off → entitlement della settimana corrente, non un
    // piano. La settimana la decide il SERVER al momento dell'ordine (mai il
    // payload), e grantWeeklyPick è idempotente sulla UNIQUE identifier+week.
    if (isWeeklyPickVariant(order.variantId)) {
      if (!order.identifier) {
        console.error("[shopify/webhook] weekly pick senza identifier", { order });
        // 'unresolved' e non 'pending': così resta visibile invece di sparire
        // (la weekly pick non la ri-tenta la reconcile, che gestisce solo i piani).
        await markEvent(order.orderId, "unresolved", "weekly pick senza identifier");
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
    // #SHOPIFY-CRYPTO-2 — chi concede il piano. Un ordine crypto è PAGATO da
    // PayGate: il grant lo fa il callback PayGate (verifica on-chain + claim
    // atomico). Questo webhook scatta perché SIAMO NOI a marcare l'ordine
    // pagato via Admin API, quindi concedere qui significherebbe stackare altri
    // 30 giorni sopra quelli già dati. Solo bookkeeping.
    if (isCryptoGatewayOrder(order.gatewayNames)) {
      console.log(`[shopify/webhook] crypto order=${order.orderId}: grant owned by paygate callback`);
      await markEvent(order.orderId, "crypto-paygate");
      return NextResponse.json({ received: true, cryptoPaygate: true });
    }
    // Il periodo viene dal variant id, non hardcoded: un ordine annuale deve
    // valere 365 giorni, non 30. `recurring:false` = SKU one-off (30 giorni
    // comprati una volta): pagata con carta va concessa qui, ma con plan_source
    // distinto perché non c'è nessun contratto da rinnovare.
    const granted = await activateShopifyPlan(
      order.identifier,
      resolved.plan,
      resolved.period,
      !resolved.recurring
    );
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

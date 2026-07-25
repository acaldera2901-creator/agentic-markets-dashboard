import { NextResponse } from "next/server";
import { getSessionPlan } from "@/lib/auth";
import { dbQueryStrict } from "@/lib/db";
import { settleCryptoOrder, type CryptoOrder } from "@/lib/crypto-settle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// #CRYPTO-DIRECT-1 — la pagina di pagamento interroga questo endpoint mentre
// l'utente invia le monete. Non si limita a leggere lo stato: prova a SALDARE.
// Così l'attivazione non dipende dal callback di PayGate (che può perdersi):
// appena la catena mostra il pagamento confermato, chi sta guardando la pagina
// ottiene il piano. Il claim atomico dentro settleCryptoOrder rende innocuo il
// fatto che callback, polling e cron possano scattare insieme.
export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await getSessionPlan(req);
  } catch (e) {
    console.error("[crypto/status] session lookup failed:", String(e));
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("order") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "invalid order" }, { status: 400 });
  }

  let rows;
  try {
    // L'ordine deve essere DI CHI CHIEDE: senza questo filtro, con un id
    // altrui si leggerebbe (e si farebbe attivare) l'ordine di un altro.
    rows = await dbQueryStrict<CryptoOrder & { granted_at: string | null }>(
      `SELECT id::text AS id, identifier, plan, period,
              amount_usd::float8 AS amount_usd, status, coin,
              expected_value_coin::float8 AS expected_value_coin,
              crypto_address_in, shopify_order_id, granted_at::text AS granted_at
         FROM paygate_orders
        WHERE id = $1::uuid
          AND (identifier = $2 OR LOWER(TRIM(identifier)) = $2)
          AND coin IS NOT NULL
        LIMIT 1`,
      [id, ctx.identifier]
    );
  } catch (e) {
    console.error("[crypto/status] db error:", String(e));
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
  const order = rows[0];
  if (!order) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (order.status === "paid") {
    return NextResponse.json({ status: "paid", granted: Boolean(order.granted_at) });
  }

  const r = await settleCryptoOrder(order);
  return NextResponse.json({
    status: r.granted ? "paid" : "pending",
    granted: r.granted,
    reason: r.reason,
    received: r.received ?? 0,
    awaiting_confirmations: (r.pending ?? 0) > 0,
    expected: order.expected_value_coin,
  });
}

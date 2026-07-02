import { NextResponse } from "next/server";
import { dbQuery, dbExecute, getSupabaseAdminClient } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/paypal";
import { activatePaypalPlan } from "@/lib/plan-grant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type OrderRow = {
  id: string;
  identifier: string;
  plan: "base" | "premium";
  period: "monthly" | "annual";
  amount_usd: number;
  status: string;
};

export async function POST(req: Request) {
  if (!process.env.PAYPAL_WEBHOOK_ID) return NextResponse.json({ ok: true });

  const raw = await req.text(); // corpo grezzo per la verifica firma
  const headers: Record<string, string | null> = {
    "paypal-auth-algo": req.headers.get("paypal-auth-algo"),
    "paypal-cert-url": req.headers.get("paypal-cert-url"),
    "paypal-transmission-id": req.headers.get("paypal-transmission-id"),
    "paypal-transmission-sig": req.headers.get("paypal-transmission-sig"),
    "paypal-transmission-time": req.headers.get("paypal-transmission-time"),
  };

  let ok = false;
  try { ok = await verifyWebhookSignature({ headers, body: raw }); }
  catch (e) { console.error("[paypal/webhook] verify error:", String(e)); }
  if (!ok) { console.warn("[paypal/webhook] firma non valida → ignoro"); return NextResponse.json({ ok: true }); }

  let event: { event_type?: string; resource?: { custom_id?: string; amount?: { value?: string; currency_code?: string }; id?: string } };
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ ok: true }); }
  if (event.event_type !== "PAYMENT.CAPTURE.COMPLETED") return NextResponse.json({ ok: true });

  const orderId = event.resource?.custom_id ?? ""; // = il nostro paypal_orders.id
  if (!orderId) return NextResponse.json({ ok: true });

  const orders = await dbQuery<OrderRow>(
    `SELECT id, identifier, plan, period, amount_usd::float8 AS amount_usd, status FROM paypal_orders WHERE id = $1 LIMIT 1`,
    [orderId]
  );
  const order = orders[0] ?? null;
  if (!order || order.status !== "pending") return NextResponse.json({ ok: true }); // idempotenza

  const value = Number(event.resource?.amount?.value ?? NaN);
  const currencyCode = event.resource?.amount?.currency_code;
  const captureId = event.resource?.id ?? null;

  // Gate anti-spoof (parità con /capture: evaluateCapture): l'esito dell'evento
  // non basta, valida importo/valuta prima del claim.
  if (!Number.isFinite(value) || value + 1e-9 < order.amount_usd) {
    console.warn(`[paypal/webhook] no-grant: amount below expected (order=${order.id})`);
    return NextResponse.json({ ok: true });
  }
  if (currencyCode != null && currencyCode !== "USD") {
    console.warn(`[paypal/webhook] no-grant: wrong currency (order=${order.id})`);
    return NextResponse.json({ ok: true });
  }

  const db = getSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: true });
  const { data: claimed, error: claimErr } = await db.rpc("claim_paypal_order", {
    p_id: order.id, p_value: Number.isFinite(value) ? value : null, p_capture: captureId,
  });
  if (claimErr || claimed !== true) return NextResponse.json({ ok: true });

  const granted = await activatePaypalPlan(order.identifier, order.plan, order.period);
  if (!granted) {
    console.error(`[paypal/webhook] RECONCILE: paid ma piano NON concesso order=${order.id} identifier=${order.identifier}`);
  } else {
    await dbExecute("UPDATE paypal_orders SET granted_at = NOW() WHERE id = $1", [order.id]);
    console.log(`[paypal/webhook] GRANT order=${order.id} plan=${granted.plan}`);
  }
  return NextResponse.json({ ok: true });
}

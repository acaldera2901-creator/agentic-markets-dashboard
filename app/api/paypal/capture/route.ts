import { NextResponse } from "next/server";
import { dbQuery, dbExecute, getSupabaseAdminClient } from "@/lib/db";
import { captureOrder, evaluateCapture } from "@/lib/paypal";
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
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    return NextResponse.json({ error: "paypal not configured" }, { status: 503 });
  }
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "cross-site request blocked" }, { status: 403 });
  }

  let body: { paypal_order_id?: unknown };
  try { body = (await req.json()) as typeof body; }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const paypalOrderId = typeof body.paypal_order_id === "string" ? body.paypal_order_id : "";
  if (!paypalOrderId) return NextResponse.json({ error: "missing paypal_order_id" }, { status: 400 });

  const orders = await dbQuery<OrderRow>(
    `SELECT id, identifier, plan, period, amount_usd::float8 AS amount_usd, status
       FROM paypal_orders WHERE paypal_order_id = $1 LIMIT 1`,
    [paypalOrderId]
  );
  const order = orders[0] ?? null;
  if (!order || order.status !== "pending") {
    // sconosciuto o già processato → idempotenza
    return NextResponse.json({ ok: true, granted: false });
  }

  // VERIFICA SERVER-SIDE: l'esito reale lo dice PayPal (capture), non il client.
  let captured;
  try {
    captured = await captureOrder(paypalOrderId);
  } catch (e) {
    console.error(`[paypal/capture] capture failed (order=${order.id}):`, String(e));
    return NextResponse.json({ ok: true, granted: false });
  }

  const decision = evaluateCapture({
    order: { status: order.status, amount_usd: order.amount_usd },
    captured: { status: captured.status, value: captured.capturedValue, currency: captured.currency },
  });
  if (!decision.grant) {
    console.warn(`[paypal/capture] no-grant: ${decision.reason} (order=${order.id})`);
    return NextResponse.json({ ok: true, granted: false });
  }

  // CLAIM ATOMICO: solo il vincitore della race passa pending→paid.
  const db = getSupabaseAdminClient();
  if (!db) { console.error("[paypal/capture] no supabase client"); return NextResponse.json({ ok: true, granted: false }); }
  const { data: claimed, error: claimErr } = await db.rpc("claim_paypal_order", {
    p_id: order.id, p_value: captured.capturedValue, p_capture: captured.captureId,
  });
  if (claimErr) { console.error("[paypal/capture] claim rpc error:", claimErr.message); return NextResponse.json({ ok: true, granted: false }); }
  if (claimed !== true) return NextResponse.json({ ok: true, granted: false }); // già processato

  // GRANT dopo il claim.
  const granted = await activatePaypalPlan(order.identifier, order.plan, order.period);
  if (!granted) {
    console.error(`[paypal/capture] RECONCILE: paid ma piano NON concesso (identifier-not-found) order=${order.id} identifier=${order.identifier}`);
    return NextResponse.json({ ok: true, granted: false });
  }
  await dbExecute("UPDATE paypal_orders SET granted_at = NOW() WHERE id = $1", [order.id]);
  console.log(`[paypal/capture] GRANT order=${order.id} plan=${granted.plan} amount_usd=${String(order.amount_usd)}`);
  return NextResponse.json({ ok: true, granted: true });
}

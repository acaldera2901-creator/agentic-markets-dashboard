import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSessionPlan } from "@/lib/auth";
import { dbExecute } from "@/lib/db";
import { createOrder, type PlanKey, type Period } from "@/lib/paypal";
import { discountedAmountFor } from "@/lib/paygate";
import { promoEligibility } from "@/lib/creator-promo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    return NextResponse.json({ error: "paypal not configured" }, { status: 503 });
  }
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "cross-site request blocked" }, { status: 403 });
  }

  let ctx;
  try {
    ctx = await getSessionPlan(req);
  } catch (e) {
    console.error("[paypal/create-order] session lookup failed:", String(e));
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { requested_plan?: unknown; period?: unknown };
  try { body = (await req.json()) as typeof body; }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const plan = body.requested_plan;
  const period = body.period;
  if (plan !== "base" && plan !== "premium") return NextResponse.json({ error: "invalid requested_plan" }, { status: 400 });
  if (period !== "monthly" && period !== "annual") return NextResponse.json({ error: "invalid period" }, { status: 400 });

  // #PRICING-CREATORS-0706: stesse condizioni promo del rail PayGate (helper
  // condiviso) — i due rail non possono divergere sul prezzo. Flag OFF = full.
  const eligibility = await promoEligibility(ctx.identifier);
  const { amount } = discountedAmountFor(plan as PlanKey, period as Period, eligibility);

  // exec_sql non ritorna RETURNING → id generato qui e inserito esplicitamente.
  const orderId = crypto.randomUUID();

  let paypalOrder;
  try {
    paypalOrder = await createOrder({ amount, plan: plan as PlanKey, period: period as Period, identifier: ctx.identifier, orderId });
  } catch (e) {
    console.error("[paypal/create-order] createOrder failed:", String(e));
    return NextResponse.json({ error: "paypal create failed" }, { status: 502 });
  }

  try {
    await dbExecute(
      `INSERT INTO paypal_orders (id, identifier, plan, period, amount_usd, paypal_order_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [orderId, ctx.identifier, plan, period, amount, paypalOrder.id]
    );
  } catch (e) {
    console.error("[paypal/create-order] order insert failed:", String(e));
    return NextResponse.json({ error: "order create failed" }, { status: 500 });
  }

  return NextResponse.json({ id: paypalOrder.id });
}

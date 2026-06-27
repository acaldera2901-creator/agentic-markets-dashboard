import { NextResponse } from "next/server";
import { getSessionPlan } from "@/lib/auth";
import { dbQuery, dbExecute } from "@/lib/db";
import { siteOrigin } from "@/lib/activation";
import { amountFor, newOrderToken, createReceivingWallet, buildPayUrl, type PlanKey, type Period } from "@/lib/paygate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const payoutWallet = process.env.PAYGATE_PAYOUT_WALLET;
  if (!payoutWallet) return NextResponse.json({ error: "paygate not configured" }, { status: 503 });
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "cross-site request blocked" }, { status: 403 });
  }

  const ctx = await getSessionPlan(req);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { requested_plan?: unknown; period?: unknown };
  try { body = (await req.json()) as typeof body; }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const plan = body.requested_plan;
  const period = body.period;
  if (plan !== "base" && plan !== "premium") return NextResponse.json({ error: "invalid requested_plan" }, { status: 400 });
  if (period !== "monthly" && period !== "annual") return NextResponse.json({ error: "invalid period" }, { status: 400 });

  const amount = amountFor(plan as PlanKey, period as Period);
  const { token, tokenHash } = newOrderToken();

  // Crea l'ordine pending (fonte dell'idempotenza + del token anti-spoof).
  const created = await dbExecute<{ id: string }>(
    `INSERT INTO paygate_orders (identifier, plan, period, amount_usd, token_hash)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [ctx.identifier, plan, period, amount, tokenHash]
  );
  const orderId = created?.[0]?.id;
  if (!orderId) return NextResponse.json({ error: "order create failed" }, { status: 500 });

  // Segna pending_payment (come il path Stripe/USDT).
  await dbQuery(
    `UPDATE profiles SET plan = 'pending_payment', requested_plan = $2, updated_at = NOW()
      WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1`,
    [ctx.identifier, plan]
  );

  const origin = siteOrigin(req);
  const callbackUrl = `${origin}/api/paygate/callback?token=${encodeURIComponent(token)}&order=${orderId}`;

  let wallet;
  try {
    wallet = await createReceivingWallet(payoutWallet, callbackUrl);
  } catch (e) {
    console.error("[paygate/checkout] wallet.php failed:", String(e));
    return NextResponse.json({ error: "paygate wallet failed" }, { status: 502 });
  }

  await dbExecute(
    "UPDATE paygate_orders SET polygon_address_in = $2 WHERE id = $1",
    [orderId, wallet.polygonAddressIn]
  );

  const url = buildPayUrl({ addressIn: wallet.addressIn, amount, email: ctx.identifier });
  return NextResponse.json({ url });
}

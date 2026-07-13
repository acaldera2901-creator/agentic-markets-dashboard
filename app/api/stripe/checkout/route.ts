import { NextResponse } from "next/server";
import { getSessionPlan } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { getStripe, isStripeConfigured, planToPriceId, type StripePlan } from "@/lib/stripe";
import { normalizeCheckoutPlan } from "@/lib/commercial-plan";
import { siteOrigin } from "@/lib/activation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "stripe not configured" }, { status: 503 });
  }
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "cross-site request blocked" }, { status: 403 });
  }

  const ctx = await getSessionPlan(req);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { requested_plan?: unknown };
  try {
    body = (await req.json()) as { requested_plan?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const plan = normalizeCheckoutPlan(body.requested_plan) as StripePlan | null;
  if (plan !== "base" && plan !== "premium") {
    return NextResponse.json({ error: "invalid requested_plan" }, { status: 400 });
  }

  // Riusa il customer Stripe se già presente.
  const existing = await dbQuery<{ stripe_customer_id: string | null }>(
    "SELECT stripe_customer_id FROM profiles WHERE identifier = $1 LIMIT 1",
    [ctx.identifier]
  );
  const customerId = existing[0]?.stripe_customer_id ?? undefined;

  // Segna pending_payment (UI mostra "in attesa"), come il path USDT.
  // #GOLIVE-QW-B guard: marca pending_payment SOLO su un piano free/pending —
  // MAI su un piano già attivo pagato (base/premium). Senza questo WHERE, chiunque
  // chiami l'endpoint declasserebbe un abbonato attivo prima ancora di pagare. Il
  // rail Stripe è dormiente e la fonte di verità del piano resta il webhook
  // invoice.paid: qui segniamo solo l'intento di pagamento.
  await dbQuery(
    `UPDATE profiles
        SET plan = 'pending_payment', requested_plan = $2, updated_at = NOW()
      WHERE (identifier = $1 OR LOWER(TRIM(identifier)) = $1)
        AND plan IN ('free', 'pending_payment')`,
    [ctx.identifier, plan]
  );

  const origin = siteOrigin(req);
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: planToPriceId(plan), quantity: 1 }],
    client_reference_id: ctx.identifier,
    ...(customerId ? { customer: customerId } : { customer_email: ctx.identifier }),
    subscription_data: { metadata: { plan, identifier: ctx.identifier } },
    metadata: { plan, identifier: ctx.identifier },
    success_url: `${origin}/app?stripe=success`,
    cancel_url: `${origin}/app?stripe=cancel`,
    allow_promotion_codes: false,
  });

  if (!session.url) {
    return NextResponse.json({ error: "stripe session has no url" }, { status: 502 });
  }
  return NextResponse.json({ url: session.url });
}

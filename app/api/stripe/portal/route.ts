import { NextResponse } from "next/server";
import { getSessionPlan } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
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

  const rows = await dbQuery<{ stripe_customer_id: string | null }>(
    "SELECT stripe_customer_id FROM profiles WHERE identifier = $1 LIMIT 1",
    [ctx.identifier]
  );
  const customerId = rows[0]?.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json({ error: "no stripe customer" }, { status: 409 });
  }

  const stripe = getStripe();
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${siteOrigin(req)}/app`,
  });
  return NextResponse.json({ url: portal.url });
}

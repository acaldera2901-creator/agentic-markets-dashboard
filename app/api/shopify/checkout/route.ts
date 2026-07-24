import { NextResponse } from "next/server";
import { getSessionPlan } from "@/lib/auth";
import { dbQueryStrict } from "@/lib/db";
import { buildShopifyCheckoutUrl } from "@/lib/shopify";
import { shopifyGrantAllowed } from "@/lib/plan-grant";
import { blocksLowerTierPurchase } from "@/lib/paygate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// #SHOPIFY-CHECKOUT-1: apre il checkout Shopify (rail carta + abbonamento
// ricorrente). L'identifier viene SEMPRE dalla sessione, mai dal body: è la
// chiave con cui il webhook orders/paid mappa il grant, quindi un valore
// client-supplied permetterebbe di attivare il piano di un altro account.
// Env-gated: senza store configurato risponde 503 e il chiamante resta sul
// flusso PayGate esistente (deploy safe dark).
export async function POST(req: Request) {
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "cross-site request blocked" }, { status: 403 });
  }

  let ctx;
  try {
    ctx = await getSessionPlan(req);
  } catch (e) {
    console.error("[shopify/checkout] session lookup failed:", String(e));
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { requested_plan?: unknown; period?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const plan = body.requested_plan;
  if (plan !== "base" && plan !== "premium") {
    return NextResponse.json({ error: "invalid requested_plan" }, { status: 400 });
  }
  // Su Shopify esiste solo il selling plan MENSILE: l'annuale resta su PayGate.
  // 503 (non 400) perché per il client è lo stesso caso "rail non disponibile".
  if (body.period !== "monthly") {
    return NextResponse.json({ error: "period not on shopify" }, { status: 503 });
  }

  // Stessa tier-guard di PayGate: premium attivo non compra 'base' (tier-arbitrage).
  if (blocksLowerTierPurchase(ctx.plan, plan)) {
    return NextResponse.json({ error: "active premium plan — cannot purchase lower tier" }, { status: 409 });
  }

  // Grandfather: l'abbonato crypto ATTIVO resta su PayGate fino a scadenza.
  // activateShopifyPlan applica lo stesso predicato sul grant → senza questo
  // controllo l'utente pagherebbe su Shopify e NON riceverebbe il piano.
  // Read strict: un errore DB fa 500 (fail-closed), mai un pagamento orfano.
  let source: string | null = null;
  try {
    const rows = await dbQueryStrict<{ plan_source: string | null }>(
      `SELECT plan_source FROM profiles WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1 LIMIT 1`,
      [ctx.identifier]
    );
    source = rows[0]?.plan_source ?? null;
  } catch (e) {
    console.error("[shopify/checkout] plan_source lookup failed:", String(e));
    return NextResponse.json({ error: "checkout unavailable" }, { status: 500 });
  }
  if (!shopifyGrantAllowed(source, ctx.plan_expires_at)) {
    return NextResponse.json({ error: "active paygate subscription" }, { status: 409 });
  }

  const url = buildShopifyCheckoutUrl(plan, ctx.identifier);
  if (!url) return NextResponse.json({ error: "shopify not configured" }, { status: 503 });
  return NextResponse.json({ url });
}

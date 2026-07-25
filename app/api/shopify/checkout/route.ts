import { NextResponse } from "next/server";
import { getSessionPlan } from "@/lib/auth";
import { dbQueryStrict } from "@/lib/db";
import { buildShopifyCheckoutUrl } from "@/lib/shopify";
import { shopifyGrantAllowed } from "@/lib/plan-grant";
import { blocksLowerTierPurchase, discountedAmountFor, type PlanKey } from "@/lib/paygate";
import { promoEligibility } from "@/lib/creator-promo";
import {
  currentWeekStart,
  weeklyPickEnabled,
  weeklyPickIncludedInPlan,
  weeklyPickAmount,
} from "@/lib/weekly-pick";
import { hasWeeklyPick } from "@/lib/weekly-pick-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// #SHOPIFY-CHECKOUT-1: apre il checkout Shopify (rail carta). L'identifier viene
// SEMPRE dalla sessione, mai dal body: è la chiave con cui il webhook orders/paid
// mappa il grant, quindi un valore client-supplied permetterebbe di attivare il
// piano di un altro account. Env-gated: senza store configurato risponde 503 e il
// chiamante resta sul flusso PayGate esistente (deploy safe dark).
//
// requested_plan: "base" | "premium" (abbonamento, period "monthly" | "annual")
// oppure "weekly" (Weekly Pick, acquisto singolo della settimana corrente).
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

  const sku = body.requested_plan;
  if (sku !== "base" && sku !== "premium" && sku !== "weekly") {
    return NextResponse.json({ error: "invalid requested_plan" }, { status: 400 });
  }

  // ---- Weekly Pick: one-off, nessun piano, nessun selling plan ----
  if (sku === "weekly") {
    if (!weeklyPickEnabled()) return NextResponse.json({ error: "not available" }, { status: 404 });
    // Stesse guardie del rail PayGate (app/api/weekly-pick/checkout): chi la ha
    // inclusa nel Pro o l'ha già comprata questa settimana non deve pagare due volte.
    if (weeklyPickIncludedInPlan(ctx.plan)) {
      return NextResponse.json({ error: "already included" }, { status: 409 });
    }
    const week = currentWeekStart(new Date());
    try {
      if (await hasWeeklyPick(ctx.identifier, week)) {
        return NextResponse.json({ error: "already purchased" }, { status: 409 });
      }
    } catch (e) {
      // Fail-closed: se non sappiamo se l'ha già comprata, non la vendiamo.
      console.error("[shopify/checkout] hasWeeklyPick failed:", String(e));
      return NextResponse.json({ error: "checkout unavailable" }, { status: 500 });
    }
    // Il prezzo su Shopify è FISSO ($12.99): con la promo di lancio attiva il
    // server sconta -50% e mostrerebbe un importo diverso da quello addebitato.
    // In quel caso il rail Shopify non è utilizzabile → fallback a PayGate, che
    // porta lo sconto dentro l'ordine.
    if (weeklyPickAmount().discounted) {
      return NextResponse.json({ error: "promo not on shopify" }, { status: 503 });
    }
    const weeklyUrl = buildShopifyCheckoutUrl("weekly", ctx.identifier);
    if (!weeklyUrl) return NextResponse.json({ error: "shopify not configured" }, { status: 503 });
    return NextResponse.json({ url: weeklyUrl });
  }

  // ---- Piani base/premium: abbonamento mensile o annuale ----
  const period = body.period;
  if (period !== "monthly" && period !== "annual") {
    return NextResponse.json({ error: "invalid period" }, { status: 400 });
  }

  // Stessa tier-guard di PayGate: premium attivo non compra 'base' (tier-arbitrage).
  if (blocksLowerTierPurchase(ctx.plan, sku)) {
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

  // Promo di lancio -50% sul primo ordine: il prezzo del selling plan Shopify è
  // fisso, quindi non può rifletterla. Se questo acquisto è scontato mandiamo
  // l'utente su PayGate, altrimenti pagherebbe pieno vedendo il prezzo scontato.
  try {
    const promo = await promoEligibility(ctx.identifier);
    if (discountedAmountFor(sku as PlanKey, period, promo).discounted) {
      return NextResponse.json({ error: "promo not on shopify" }, { status: 503 });
    }
  } catch (e) {
    console.error("[shopify/checkout] promo lookup failed:", String(e));
    return NextResponse.json({ error: "checkout unavailable" }, { status: 500 });
  }

  const url = buildShopifyCheckoutUrl(sku, ctx.identifier, period);
  if (!url) return NextResponse.json({ error: "shopify not configured" }, { status: 503 });
  return NextResponse.json({ url });
}

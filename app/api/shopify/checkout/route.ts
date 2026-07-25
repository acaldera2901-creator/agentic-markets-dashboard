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
// Ogni uscita non-200 passa da qui. Senza questo, i rami 400/409/503 tornavano
// SENZA lasciare traccia: il client cadeva su PayGate e nei log non c'era nulla
// che dicesse perché — impossibile diagnosticare "il sito non reindirizza".
function deny(status: number, reason: string, ctx?: { identifier: string; plan: string }) {
  console.error(
    `[shopify/checkout] DENY ${status} ${reason}` +
      (ctx ? ` identifier=${ctx.identifier} plan=${ctx.plan}` : "")
  );
  return NextResponse.json({ error: reason }, { status });
}

export async function POST(req: Request) {
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return deny(403, "cross-site request blocked");
  }

  let ctx;
  try {
    ctx = await getSessionPlan(req);
  } catch (e) {
    console.error("[shopify/checkout] session lookup failed:", String(e));
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx) return deny(401, "no session");

  let body: { requested_plan?: unknown; period?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return deny(400, "invalid json");
  }

  const sku = body.requested_plan;
  if (sku !== "base" && sku !== "premium" && sku !== "weekly") {
    return deny(400, `invalid requested_plan=${String(sku)}`);
  }

  // ---- Weekly Pick: one-off, nessun piano, nessun selling plan ----
  if (sku === "weekly") {
    if (!weeklyPickEnabled()) return deny(404, "weekly pick flag off");
    // Stesse guardie del rail PayGate (app/api/weekly-pick/checkout): chi la ha
    // inclusa nel Pro o l'ha già comprata questa settimana non deve pagare due volte.
    if (weeklyPickIncludedInPlan(ctx.plan)) {
      return deny(409, "weekly gia inclusa nel piano", ctx);
    }
    const week = currentWeekStart(new Date());
    try {
      if (await hasWeeklyPick(ctx.identifier, week)) {
        return deny(409, "weekly gia comprata questa settimana", ctx);
      }
    } catch (e) {
      // Fail-closed: se non sappiamo se l'ha già comprata, non la vendiamo.
      console.error("[shopify/checkout] hasWeeklyPick failed:", String(e));
      return deny(500, "lettura DB fallita (fail-closed)", ctx);
    }
    // Il prezzo su Shopify è FISSO ($12.99): con la promo di lancio attiva il
    // server sconta -50% e mostrerebbe un importo diverso da quello addebitato.
    // In quel caso il rail Shopify non è utilizzabile → fallback a PayGate, che
    // porta lo sconto dentro l'ordine.
    if (weeklyPickAmount().discounted) {
      return deny(503, "promo di lancio attiva: prezzo Shopify fisso", ctx);
    }
    const weeklyUrl = buildShopifyCheckoutUrl("weekly", ctx.identifier);
    if (!weeklyUrl) return deny(503, "weekly: SHOPIFY_SHOP_DOMAIN o variant mancante", ctx);
    console.log(`[shopify/checkout] OK weekly identifier=${ctx.identifier}`);
    return NextResponse.json({ url: weeklyUrl });
  }

  // ---- Piani base/premium: abbonamento mensile o annuale ----
  const period = body.period;
  if (period !== "monthly" && period !== "annual") {
    return deny(400, `invalid period=${String(period)}`);
  }

  // Stessa tier-guard di PayGate: premium attivo non compra 'base' (tier-arbitrage).
  if (blocksLowerTierPurchase(ctx.plan, sku)) {
    return deny(409, "tier-guard: premium attivo non compra base", ctx);
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
    return deny(500, "lettura DB fallita (fail-closed)", ctx);
  }
  if (!shopifyGrantAllowed(ctx.plan, source, ctx.plan_expires_at)) {
    return deny(409, `grandfather: plan_source=${String(source)} expires=${String(ctx.plan_expires_at)}`, ctx);
  }

  // Promo di lancio -50% sul primo ordine: il prezzo del selling plan Shopify è
  // fisso, quindi non può rifletterla. Se questo acquisto è scontato mandiamo
  // l'utente su PayGate, altrimenti pagherebbe pieno vedendo il prezzo scontato.
  try {
    const promo = await promoEligibility(ctx.identifier);
    if (discountedAmountFor(sku as PlanKey, period, promo).discounted) {
      return deny(503, "promo di lancio attiva: prezzo Shopify fisso", ctx);
    }
  } catch (e) {
    console.error("[shopify/checkout] promo lookup failed:", String(e));
    return deny(500, "lettura DB fallita (fail-closed)", ctx);
  }

  const url = buildShopifyCheckoutUrl(sku, ctx.identifier, period);
  if (!url) return deny(503, `SHOPIFY_SHOP_DOMAIN o variant mancante per ${sku}/${period}`, ctx);
  console.log(`[shopify/checkout] OK ${sku}/${period} identifier=${ctx.identifier}`);
  return NextResponse.json({ url });
}

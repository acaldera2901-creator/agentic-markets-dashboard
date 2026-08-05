import { NextResponse } from "next/server";
import { getSessionPlan } from "@/lib/auth";
import { dbQueryStrict } from "@/lib/db";
import { buildShopifyCheckoutUrl, isShopifyConfigured } from "@/lib/shopify";
import { shopifyGrantAllowed, hasActiveShopifySubscription } from "@/lib/plan-grant";
import { blocksLowerTierPurchase, discountedAmountFor, type PlanKey } from "@/lib/paygate";
import { shopifyCanCarryLaunchDiscount } from "@/lib/shopify";
import { promoEligibility } from "@/lib/creator-promo";
import {
  currentWeekStart,
  weeklyPickEnabled,
  weeklyPickIncludedInPlan,
  weeklyPickAmount,
} from "@/lib/weekly-pick";
import { hasWeeklyPickStrict } from "@/lib/weekly-pick-server";

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
function deny(
  status: number,
  reason: string,
  ctx?: { identifier: string; plan: string },
  code?: string
) {
  console.error(
    `[shopify/checkout] DENY ${status} ${reason}` +
      (ctx ? ` identifier=${ctx.identifier} plan=${ctx.plan}` : "")
  );
  return NextResponse.json({ error: reason, ...(code ? { code } : {}) }, { status });
}

export async function POST(req: Request) {
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return deny(403, "cross-site request blocked");
  }

  // Stessa condizione del webhook: se il webhook non è configurato (secret
  // mancante o ruotato) NON mandiamo nessuno a pagare, perché l'ordine
  // arriverebbe, il webhook risponderebbe 503/401 e non resterebbe nemmeno la
  // riga in shopify_events → pagamento irrecuperabile anche per la reconcile.
  if (!isShopifyConfigured()) {
    return deny(503, "shopify non configurato (webhook secret o variant mancanti)");
  }

  let ctx;
  try {
    ctx = await getSessionPlan(req);
  } catch (e) {
    console.error("[shopify/checkout] session lookup failed:", String(e));
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx) return deny(401, "no session");

  let body: { requested_plan?: unknown; period?: unknown; lang?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return deny(400, "invalid json");
  }

  // La lingua dell'app vive in localStorage (`agentic-lang`), non in un cookie:
  // il server non può leggerla, quindi arriva nel body. Non serve validarla —
  // shopifyLocalePrefix mappa qualunque valore ignoto su "/en" e non interpola
  // mai la stringa ricevuta.
  const lang = typeof body.lang === "string" ? body.lang : null;

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
      if (await hasWeeklyPickStrict(ctx.identifier, week)) {
        return deny(409, "weekly gia comprata questa settimana", ctx);
      }
    } catch (e) {
      // Fail-closed: se non sappiamo se l'ha già comprata, non la vendiamo.
      console.error("[shopify/checkout] hasWeeklyPickStrict failed:", String(e));
      return deny(500, "lettura DB fallita (fail-closed)", ctx);
    }
    // #LAUNCH-PROMO-CARD-0805 — la Weekly Pick è un one-off: lo sconto di lancio
    // può viaggiare solo su una VARIANTE a metà prezzo. Se c'è, il rail carta
    // regge la promo; se non c'è si tiene il 503 di prima e si cade su PayGate.
    // Mai la terza via (mostrare 6,49 e addebitare 12,99).
    const weeklyDiscounted = weeklyPickAmount().discounted;
    if (weeklyDiscounted && !shopifyCanCarryLaunchDiscount("weekly")) {
      return deny(503, "promo di lancio attiva: variante weekly di lancio non configurata", ctx);
    }
    const weeklyUrl = buildShopifyCheckoutUrl("weekly", ctx.identifier, "monthly", lang, weeklyDiscounted);
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
  // Abbonamento Shopify già attivo → NON si apre un secondo checkout: Shopify
  // creerebbe un secondo subscription contract e l'utente pagherebbe due volte.
  // `code` è il segnale al client di NON cadere su PayGate (che sarebbe un
  // secondo addebito su un altro rail): qui va mostrato un errore.
  if (hasActiveShopifySubscription(ctx.plan, source, ctx.plan_expires_at)) {
    return deny(
      409,
      `abbonamento Shopify gia attivo (plan=${ctx.plan} expires=${String(ctx.plan_expires_at)})`,
      ctx,
      "shopify_subscription_active"
    );
  }

  if (!shopifyGrantAllowed(ctx.plan, source, ctx.plan_expires_at)) {
    return deny(409, `grandfather: plan_source=${String(source)} expires=${String(ctx.plan_expires_at)}`, ctx);
  }

  // #LAUNCH-PROMO-CARD-0805 — promo -50% sul primo ordine. Prima il rail carta
  // si spegneva del tutto (503 → PayGate), quindi per tutto il mese di lancio
  // chi aveva diritto allo sconto poteva pagare SOLO in crypto: la promo
  // disattivava il metodo di pagamento dei clienti che voleva conquistare.
  // Ora lo sconto viaggia su un selling plan di lancio (-50% sul PRIMO ciclo,
  // rinnovo pieno). Senza gli id configurati resta il 503 di prima: fail-safe,
  // mai un prezzo mostrato diverso da quello addebitato.
  let planDiscounted = false;
  try {
    const promo = await promoEligibility(ctx.identifier);
    planDiscounted = discountedAmountFor(sku as PlanKey, period, promo).discounted;
  } catch (e) {
    console.error("[shopify/checkout] promo lookup failed:", String(e));
    return deny(500, "lettura DB fallita (fail-closed)", ctx);
  }
  if (planDiscounted && !shopifyCanCarryLaunchDiscount(sku as PlanKey, period)) {
    return deny(503, `promo di lancio attiva: selling plan di lancio non configurato per ${sku}/${period}`, ctx);
  }

  const url = buildShopifyCheckoutUrl(sku, ctx.identifier, period, lang, planDiscounted);
  if (!url) return deny(503, `SHOPIFY_SHOP_DOMAIN o variant mancante per ${sku}/${period}`, ctx);
  console.log(`[shopify/checkout] OK ${sku}/${period} identifier=${ctx.identifier}`);
  return NextResponse.json({ url });
}

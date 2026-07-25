import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSessionPlan } from "@/lib/auth";
import { dbQueryStrict, dbExecute } from "@/lib/db";
import { siteOrigin } from "@/lib/activation";
import { newOrderToken, createReceivingWallet, buildPayUrl } from "@/lib/paygate";
import { resolveOrderFromVariant, isShopifyCryptoConfigured } from "@/lib/shopify";
import { findPendingCryptoOrder, isShopifyAdminConfigured } from "@/lib/shopify-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// #SHOPIFY-CRYPTO-2 — secondo tempo del rail crypto.
// Primo tempo: l'utente completa il checkout Shopify scegliendo "Crypto" e
// Shopify crea un ordine NON pagato. Le istruzioni del metodo lo mandano qui.
// Questa rotta trova quell'ordine, apre l'ordine PayGate corrispondente e
// restituisce l'URL della pagina di pagamento.
//
// L'importo NON viene dal client né dal listino: viene dal TOTALE DELL'ORDINE
// SHOPIFY. È l'unico valore che il cliente ha visto e accettato, ed è quello che
// il callback anti-spoof confronta con la somma arrivata on-chain.
export async function POST(req: Request) {
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "cross-site request blocked" }, { status: 403 });
  }
  if (!isShopifyCryptoConfigured() || !isShopifyAdminConfigured()) {
    return NextResponse.json({ error: "crypto rail not configured" }, { status: 503 });
  }
  const payoutWallet = process.env.PAYGATE_PAYOUT_WALLET;
  if (!payoutWallet) return NextResponse.json({ error: "paygate not configured" }, { status: 503 });

  let ctx;
  try {
    ctx = await getSessionPlan(req);
  } catch (e) {
    console.error("[shopify/crypto-order] session lookup failed:", String(e));
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const gatewayName = process.env.SHOPIFY_CRYPTO_GATEWAY_NAME as string;

  let pending;
  try {
    pending = await findPendingCryptoOrder(ctx.identifier, gatewayName);
  } catch (e) {
    // Fail-loud: se l'Admin API non risponde NON inventiamo un ordine, altrimenti
    // incasseremmo crypto senza sapere quale ordine Shopify stiamo pagando.
    console.error("[shopify/crypto-order] admin lookup failed:", String(e));
    return NextResponse.json({ error: "shopify lookup failed" }, { status: 502 });
  }
  if (!pending) {
    return NextResponse.json({ error: "no pending crypto order" }, { status: 404 });
  }

  const resolved = resolveOrderFromVariant(pending.variantId);
  if (!resolved) {
    console.error("[shopify/crypto-order] variant non nostro", { order: pending.name, variant: pending.variantId });
    return NextResponse.json({ error: "unknown variant" }, { status: 409 });
  }

  // Riuso dell'ordine PayGate: se l'utente ricarica la pagina non deve nascere
  // un secondo ordine (e un secondo indirizzo) per lo stesso ordine Shopify.
  let existing;
  try {
    existing = await dbQueryStrict<{ id: string; polygon_address_in: string | null; amount_usd: number }>(
      `SELECT id, polygon_address_in, amount_usd::float8 AS amount_usd
         FROM paygate_orders
        WHERE shopify_order_id = $1 AND status = 'pending'
        ORDER BY created_at DESC LIMIT 1`,
      [pending.id]
    );
  } catch (e) {
    console.error("[shopify/crypto-order] lookup ordine esistente fallito:", String(e));
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
  const reusable = existing[0];
  if (reusable?.polygon_address_in) {
    const url = buildPayUrl({
      addressIn: reusable.polygon_address_in,
      amount: reusable.amount_usd,
      email: ctx.identifier,
    });
    console.log(`[shopify/crypto-order] REUSE order=${reusable.id} shopify=${pending.name}`);
    return NextResponse.json({ url, order: pending.name, amount: reusable.amount_usd });
  }

  const { token, tokenHash } = newOrderToken();
  const orderId = crypto.randomUUID();
  try {
    await dbExecute(
      `INSERT INTO paygate_orders (id, identifier, plan, period, amount_usd, token_hash, shopify_order_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [orderId, ctx.identifier, resolved.plan, resolved.period, pending.amountUsd, tokenHash, pending.id]
    );
  } catch (e) {
    console.error("[shopify/crypto-order] order insert failed:", String(e));
    return NextResponse.json({ error: "order create failed" }, { status: 500 });
  }

  const origin = siteOrigin(req);
  const callbackUrl = `${origin}/api/paygate/callback?token=${encodeURIComponent(token)}&order=${orderId}`;

  let wallet;
  try {
    wallet = await createReceivingWallet(payoutWallet, callbackUrl);
  } catch (e) {
    console.error("[shopify/crypto-order] wallet.php failed:", String(e));
    return NextResponse.json({ error: "paygate wallet failed" }, { status: 502 });
  }

  await dbExecute(
    "UPDATE paygate_orders SET polygon_address_in = $2, ipn_token = $3 WHERE id = $1",
    [orderId, wallet.polygonAddressIn, wallet.ipnToken]
  );

  const url = buildPayUrl({ addressIn: wallet.addressIn, amount: pending.amountUsd, email: ctx.identifier });
  console.log(
    `[shopify/crypto-order] OK order=${orderId} shopify=${pending.name} plan=${resolved.plan} amount=${pending.amountUsd}`
  );
  return NextResponse.json({ url, order: pending.name, amount: pending.amountUsd });
}

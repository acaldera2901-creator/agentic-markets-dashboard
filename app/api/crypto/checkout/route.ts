import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSessionPlan } from "@/lib/auth";
import { dbExecute } from "@/lib/db";
import { siteOrigin } from "@/lib/activation";
import { newOrderToken, discountedAmountFor, blocksLowerTierPurchase, type PlanKey, type Period } from "@/lib/paygate";
import { promoEligibility } from "@/lib/creator-promo";
import { enabledCoins, findCoin, isCryptoDirectConfigured } from "@/lib/crypto-coins";
import { convertUsdToCoin, coinMinimum, createCryptoDeposit } from "@/lib/crypto-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// #CRYPTO-DIRECT-1 — apre un pagamento crypto diretto: l'utente sceglie la moneta
// che possiede, noi gli diamo indirizzo dedicato e importo esatto, lui invia.
// GET = elenco monete disponibili (per il selettore). POST = crea l'ordine.

export async function GET() {
  if (!isCryptoDirectConfigured()) {
    return NextResponse.json({ coins: [] });
  }
  return NextResponse.json({
    coins: enabledCoins().map((c) => ({ id: c.id, label: c.label })),
  });
}

export async function POST(req: Request) {
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "cross-site request blocked" }, { status: 403 });
  }
  const payoutWallet = process.env.PAYGATE_PAYOUT_WALLET;
  if (!isCryptoDirectConfigured() || !payoutWallet) {
    return NextResponse.json({ error: "crypto direct not configured" }, { status: 503 });
  }

  let ctx;
  try {
    ctx = await getSessionPlan(req);
  } catch (e) {
    console.error("[crypto/checkout] session lookup failed:", String(e));
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { requested_plan?: unknown; period?: unknown; coin?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // #PAYGATE-TEST-2USD, stessa porta già esistente sul rail carte: piano NASCOSTO
  // da $5 per fare una prova di pagamento REALE senza spendere 15 o 30 dollari.
  // Attivo solo con PAYGATE_TEST_ENABLED=1 → si spegne togliendo la env, senza
  // deploy (senza flag "test" è un plan sconosciuto → 400 come qualunque altro).
  // Mappato a base/$5 così checkout → verifica on-chain → grant → mirror girano
  // ESATTAMENTE come un acquisto vero, solo a prezzo di prova.
  const rawPlan = body.requested_plan;
  const isTest = rawPlan === "test" && process.env.PAYGATE_TEST_ENABLED === "1";
  const plan = isTest ? "base" : rawPlan;
  const period = body.period;
  if (plan !== "base" && plan !== "premium") {
    return NextResponse.json({ error: "invalid requested_plan" }, { status: 400 });
  }
  if (period !== "monthly" && period !== "annual") {
    return NextResponse.json({ error: "invalid period" }, { status: 400 });
  }
  const coin = findCoin(body.coin);
  if (!coin) return NextResponse.json({ error: "coin not available" }, { status: 400 });

  // Stessa tier-guard del rail carte: premium attivo non ricompra 'base'.
  // Il path di test la bypassa come sul rail carte: serve a provare la catena,
  // non a vendere un piano.
  if (!isTest && blocksLowerTierPurchase(ctx.plan, plan)) {
    return NextResponse.json({ error: "active premium plan — cannot purchase lower tier" }, { status: 409 });
  }

  // Prezzo SEMPRE server-side (promo inclusa): è l'importo che finisce
  // nell'ordine e contro cui si verifica il pagamento.
  const { amount } = isTest
    ? { amount: 5 }
    : discountedAmountFor(plan as PlanKey, period as Period, await promoEligibility(ctx.identifier));

  // Quanto deve inviare, e se quella moneta accetta un importo così piccolo.
  // Sotto il minimo di rete PayGate NON inoltra: l'utente pagherebbe e i fondi
  // resterebbero bloccati, quindi la moneta va rifiutata PRIMA di mostrarla.
  let expected: number;
  let minimum: number;
  try {
    [expected, minimum] = await Promise.all([convertUsdToCoin(coin, amount), coinMinimum(coin)]);
  } catch (e) {
    console.error("[crypto/checkout] paygate convert/info failed:", String(e));
    return NextResponse.json({ error: "quote unavailable" }, { status: 502 });
  }
  if (expected < minimum) {
    console.warn(`[crypto/checkout] ${coin.id}: ${expected} < minimo ${minimum} → rifiutata`);
    return NextResponse.json(
      { error: "amount below coin minimum", minimum, coin: coin.label },
      { status: 409 }
    );
  }

  const { token, tokenHash } = newOrderToken();
  const orderId = crypto.randomUUID();
  const origin = siteOrigin(req);
  const callbackUrl = `${origin}/api/crypto/callback?token=${encodeURIComponent(token)}&order=${orderId}`;

  let deposit;
  try {
    deposit = await createCryptoDeposit(coin, payoutWallet, callbackUrl);
  } catch (e) {
    console.error("[crypto/checkout] wallet.php failed:", String(e));
    return NextResponse.json({ error: "deposit address failed" }, { status: 502 });
  }

  try {
    await dbExecute(
      `INSERT INTO paygate_orders
         (id, identifier, plan, period, amount_usd, token_hash, ipn_token,
          coin, expected_value_coin, crypto_address_in)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [orderId, ctx.identifier, plan, period, amount, tokenHash, deposit.ipnToken || null,
       coin.id, expected, deposit.addressIn]
    );
  } catch (e) {
    console.error("[crypto/checkout] order insert failed:", String(e));
    return NextResponse.json({ error: "order create failed" }, { status: 500 });
  }

  console.log(`[crypto/checkout] OK order=${orderId} ${coin.id} expected=${expected} amount_usd=${amount}${isTest ? " (TEST)" : ""}`);
  return NextResponse.json({
    order: orderId,
    coin: coin.id,
    coin_label: coin.label,
    address: deposit.addressIn,
    amount_coin: expected,
    amount_usd: amount,
  });
}

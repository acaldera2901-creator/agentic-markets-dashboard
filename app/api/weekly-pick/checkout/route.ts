// /api/weekly-pick/checkout — #WEEKLY-PICK-1. Crea l'ordine one-off della weekly
// pick della settimana corrente per l'utente loggato e restituisce l'URL di
// pagamento PayGate. Mirror ESATTO di app/api/paygate/checkout (rail carta→USDC):
// stesso token monouso, stessa wallet.php + ipn_token, stesso buildPayUrl. Il
// prezzo lo decide SEMPRE il server (mai dal client). Inerte col flag OFF.

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSessionPlan } from "@/lib/auth";
import { dbExecute } from "@/lib/db";
import { siteOrigin } from "@/lib/activation";
import { newOrderToken, createReceivingWallet, buildPayUrl } from "@/lib/paygate";
import {
  currentWeekStart,
  weeklyPickEnabled,
  weeklyPickIncludedInPlan,
  weeklyPickAmount,
} from "@/lib/weekly-pick";
import { hasWeeklyPick } from "@/lib/weekly-pick-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  // Flag gate: feature OFF → checkout inerte (nessun ordine, nessun redirect).
  if (!weeklyPickEnabled()) return NextResponse.json({ error: "not available" }, { status: 404 });

  const payoutWallet = process.env.PAYGATE_PAYOUT_WALLET;
  if (!payoutWallet) return NextResponse.json({ error: "paygate not configured" }, { status: 503 });
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "cross-site request blocked" }, { status: 403 });
  }

  let ctx;
  try {
    ctx = await getSessionPlan(req);
  } catch (e) {
    console.error("[weekly-pick/checkout] session lookup failed:", String(e));
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const week = currentWeekStart(new Date());

  // Chi ha la pick INCLUSA (Pro) o l'ha GIÀ comprata questa settimana non deve
  // pagare: niente ordine, niente redirect (evita il doppio acquisto a monte;
  // l'idempotenza vera resta la UNIQUE su weekly_pick_purchases nel grant).
  if (weeklyPickIncludedInPlan(ctx.plan)) {
    return NextResponse.json({ error: "already included" }, { status: 409 });
  }
  if (await hasWeeklyPick(ctx.identifier, week)) {
    return NextResponse.json({ error: "already purchased" }, { status: 409 });
  }

  // Prezzo SEMPRE server-side. Sconto -50% se promo di lancio attiva — STESSO
  // meccanismo dei piani (launchPromoActive + LAUNCH_PROMO_DISCOUNT, via
  // weeklyPickAmount). L'importo vive nell'ordine → il callback anti-spoof valida
  // già contro amount_usd, nessun secondo punto di verità.
  const { amount } = weeklyPickAmount();
  const { token, tokenHash } = newOrderToken();

  // NB: la RPC exec_sql NON restituisce le righe di RETURNING → id generato qui e
  // inserito esplicitamente (come in paygate/checkout).
  const orderId = crypto.randomUUID();
  try {
    await dbExecute(
      `INSERT INTO weekly_pick_orders (id, identifier, week_start, amount_usd, token_hash)
       VALUES ($1, $2, $3, $4, $5)`,
      [orderId, ctx.identifier, week, amount, tokenHash]
    );
  } catch (e) {
    console.error("[weekly-pick/checkout] order insert failed:", String(e));
    return NextResponse.json({ error: "order create failed" }, { status: 500 });
  }

  const origin = siteOrigin(req);
  const callbackUrl = `${origin}/api/weekly-pick/callback?token=${encodeURIComponent(token)}&order=${orderId}`;

  let wallet;
  try {
    wallet = await createReceivingWallet(payoutWallet, callbackUrl);
  } catch (e) {
    console.error("[weekly-pick/checkout] wallet.php failed:", String(e));
    return NextResponse.json({ error: "paygate wallet failed" }, { status: 502 });
  }

  // ipn_token: serve al callback per la verifica server-side dell'esito reale.
  await dbExecute(
    "UPDATE weekly_pick_orders SET polygon_address_in = $2, ipn_token = $3 WHERE id = $1",
    [orderId, wallet.polygonAddressIn, wallet.ipnToken]
  );

  const url = buildPayUrl({ addressIn: wallet.addressIn, amount, email: ctx.identifier });
  return NextResponse.json({ url });
}

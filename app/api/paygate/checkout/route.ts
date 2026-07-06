import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSessionPlan } from "@/lib/auth";
import { dbExecute } from "@/lib/db";
import { siteOrigin } from "@/lib/activation";
import { discountedAmountFor, newOrderToken, createReceivingWallet, buildPayUrl, type PlanKey, type Period } from "@/lib/paygate";
import { promoEligibility } from "@/lib/creator-promo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const payoutWallet = process.env.PAYGATE_PAYOUT_WALLET;
  if (!payoutWallet) return NextResponse.json({ error: "paygate not configured" }, { status: 503 });
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "cross-site request blocked" }, { status: 403 });
  }

  let ctx;
  try {
    ctx = await getSessionPlan(req);
  } catch (e) {
    console.error("[paygate/checkout] session lookup failed:", String(e));
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { requested_plan?: unknown; period?: unknown };
  try { body = (await req.json()) as typeof body; }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const plan = body.requested_plan;
  const period = body.period;
  if (plan !== "base" && plan !== "premium") return NextResponse.json({ error: "invalid requested_plan" }, { status: 400 });
  if (period !== "monthly" && period !== "annual") return NextResponse.json({ error: "invalid period" }, { status: 400 });

  // #PRICING-CREATORS-0706: -50% primo mese per gli utenti arrivati da un link
  // creator (referred_by), primo ordine pagato su QUALUNQUE rail, campagna
  // attiva. Col flag spento promoEligibility non tocca il DB e il percorso è
  // identico a prima. Lo sconto vive nell'amount dell'ordine → il callback
  // anti-spoof valida già contro amount_usd scontato, nessun secondo punto di
  // verità.
  const eligibility = await promoEligibility(ctx.identifier);
  const { amount } = discountedAmountFor(plan as PlanKey, period as Period, eligibility);
  const { token, tokenHash } = newOrderToken();

  // NB: la RPC exec_sql NON restituisce le righe di RETURNING (esegue lo statement
  // ma torna []). Per questo generiamo l'id qui e lo inseriamo esplicitamente,
  // invece di leggerlo da un RETURNING.
  const orderId = crypto.randomUUID();
  try {
    await dbExecute(
      `INSERT INTO paygate_orders (id, identifier, plan, period, amount_usd, token_hash)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [orderId, ctx.identifier, plan, period, amount, tokenHash]
    );
  } catch (e) {
    console.error("[paygate/checkout] order insert failed:", String(e));
    return NextResponse.json({ error: "order create failed" }, { status: 500 });
  }

  // NB: NON segniamo 'pending_payment' qui. Il pagamento PayGate è istantaneo
  // (callback in pochi secondi) e marcare pending_payment prima del pagamento
  // nascondeva la board ai free che cliccavano "Paga" senza completare. Il piano
  // cambia SOLO al callback verificato (activatePaygatePlan). L'ordine resta
  // tracciato in paygate_orders.
  const origin = siteOrigin(req);
  const callbackUrl = `${origin}/api/paygate/callback?token=${encodeURIComponent(token)}&order=${orderId}`;

  let wallet;
  try {
    wallet = await createReceivingWallet(payoutWallet, callbackUrl);
  } catch (e) {
    console.error("[paygate/checkout] wallet.php failed:", String(e));
    return NextResponse.json({ error: "paygate wallet failed" }, { status: 502 });
  }

  // Salviamo anche ipn_token: serve al callback per la verifica server-side
  // dell'esito reale presso PayGate (finding #1).
  await dbExecute(
    "UPDATE paygate_orders SET polygon_address_in = $2, ipn_token = $3 WHERE id = $1",
    [orderId, wallet.polygonAddressIn, wallet.ipnToken]
  );

  const url = buildPayUrl({ addressIn: wallet.addressIn, amount, email: ctx.identifier });
  return NextResponse.json({ url });
}

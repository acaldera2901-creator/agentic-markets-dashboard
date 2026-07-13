import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSessionPlan } from "@/lib/auth";
import { dbExecute } from "@/lib/db";
import { siteOrigin } from "@/lib/activation";
import { discountedAmountFor, newOrderToken, createReceivingWallet, buildPayUrl, blocksLowerTierPurchase, type PlanKey, type Period } from "@/lib/paygate";
import { promoEligibility } from "@/lib/creator-promo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  // #GOLIVE-QW-B kill-switch server-side: spegnimento d'emergenza = flag a false
  // + redeploy. Il client nasconde i bottoni, ma senza questo gate il server
  // accetterebbe comunque ordini POST diretti. Con il flag != "true" rifiutiamo
  // qui, prima di creare wallet/ordine. (Stessa env che pilota la UI: unica fonte.)
  if (process.env.NEXT_PUBLIC_PAYGATE_ENABLED !== "true") {
    return NextResponse.json({ error: "paygate disabled" }, { status: 503 });
  }

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

  const rawPlan = body.requested_plan;
  const period = body.period;

  // #PAYGATE-TEST-2USD: piano test NASCOSTO per una prova di pagamento reale da $5.
  // Attivo SOLO con env PAYGATE_TEST_ENABLED=1 → spegnimento istantaneo senza
  // redeploy (rimuovendo la env il path torna 400 come qualunque plan sconosciuto).
  // "test" NON è un plan-key nel DB né in plan-grant: lo mappiamo a un ordine
  // plan="base" con amount=$5, così checkout→callback anti-spoof→grant girano
  // ESATTAMENTE come il flusso base reale (grant base 30gg) a prezzo di prova.
  // Nessun prezzo pubblico (base/premium) toccato.
  const isTest = rawPlan === "test" && process.env.PAYGATE_TEST_ENABLED === "1";
  const plan = isTest ? "base" : rawPlan;
  if (plan !== "base" && plan !== "premium") return NextResponse.json({ error: "invalid requested_plan" }, { status: 400 });
  if (period !== "monthly" && period !== "annual") return NextResponse.json({ error: "invalid period" }, { status: 400 });

  // #GOLIVE-HIGH-E tier-guard: chi ha premium ATTIVO non può comprare 'base'
  // (rinnovo Pro a prezzo base = tier-arbitrage). ctx.plan è il piano effettivo
  // già risolto fresh dal DB ed expiry-adjusted (effectivePlan degrada premium
  // scaduto a 'free'), quindi ctx.plan==="premium" ⟺ premium attivo. Il path
  // test (isTest) resta invariato: bypassa la guard.
  if (!isTest && blocksLowerTierPurchase(ctx.plan, plan)) {
    return NextResponse.json({ error: "active premium plan — cannot purchase lower tier" }, { status: 409 });
  }

  // #PRICING-CREATORS-0706 (rev. Michele): PROMO DI LANCIO -50% primo mese,
  // vale per TUTTI (primo ordine pagato su qualunque rail, campagna attiva —
  // nessuna condizione referral). Col flag spento promoEligibility non tocca
  // il DB e il percorso è identico a prima. Lo sconto vive nell'amount
  // dell'ordine → il callback anti-spoof valida già contro amount_usd
  // scontato, nessun secondo punto di verità. (Il path test bypassa la promo:
  // amount fisso $5 — sopra la soglia-fee (grant richiede ≥50% netto) per un
  // test affidabile dello sblocco; sotto i minimi on-ramp Ramp/Revolut → Coinbase.)
  const { amount } = isTest
    ? { amount: 5 }
    : discountedAmountFor(plan as PlanKey, period as Period, await promoEligibility(ctx.identifier));
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

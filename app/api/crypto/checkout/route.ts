import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSessionPlan } from "@/lib/auth";
import { dbExecute, dbQueryStrict } from "@/lib/db";
import { siteOrigin } from "@/lib/activation";
import { newOrderToken, discountedAmountFor, blocksLowerTierPurchase, type PlanKey, type Period } from "@/lib/paygate";
import { promoEligibility } from "@/lib/creator-promo";
import { enabledCoins, findCoin, isCryptoDirectConfigured } from "@/lib/crypto-coins";
import { convertUsdToCoin, coinMinimum, createCryptoDeposit } from "@/lib/crypto-api";
import {
  currentWeekStart,
  weeklyPickEnabled,
  weeklyPickIncludedInPlan,
  weeklyPickAmount,
} from "@/lib/weekly-pick";
import { hasWeeklyPickStrict } from "@/lib/weekly-pick-server";

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
  const coin = findCoin(body.coin);
  if (!coin) return NextResponse.json({ error: "coin not available" }, { status: 400 });

  // COSA si sta comprando, con il suo prezzo. Union e non campi opzionali: un piano
  // ha tier+periodo, la Weekly Pick ha una settimana — così il resto della route non
  // può leggere un `plan` che per la weekly non esiste, e ogni ramo a valle è
  // costretto a dire quale dei due sta trattando.
  // Il prezzo lo decide SEMPRE il server. Sul crypto la promo di lancio NON è un
  // problema come su Shopify (dove il prezzo è fisso dentro il prodotto): qui
  // l'importo atteso lo calcoliamo noi, quindi lo sconto è semplicemente il prezzo.
  type Purchase =
    | { kind: "weekly"; week: string; amount: number }
    | { kind: "plan"; plan: PlanKey; period: Period; amount: number };
  let purchase: Purchase;

  if (body.requested_plan === "weekly") {
    // #WEEKLY-CRYPTO-DIRECT-1 — stesse guardie del rail carta (ramo weekly di
    // app/api/shopify/checkout): chi la ha inclusa nel Pro o l'ha già comprata
    // questa settimana non deve poter pagare due volte.
    if (!weeklyPickEnabled()) return NextResponse.json({ error: "not available" }, { status: 404 });
    if (weeklyPickIncludedInPlan(ctx.plan)) {
      return NextResponse.json({ error: "already included" }, { status: 409 });
    }
    const week = currentWeekStart(new Date());
    // Lettura fail-loud + fail-closed: se non sappiamo se l'ha già comprata non la
    // vendiamo. Con la lettura tollerante un errore DB sarebbe indistinguibile da
    // "non comprata" e il cliente pagherebbe due volte la stessa pick.
    try {
      if (await hasWeeklyPickStrict(ctx.identifier, week)) {
        return NextResponse.json({ error: "already purchased" }, { status: 409 });
      }
    } catch (e) {
      console.error("[crypto/checkout] hasWeeklyPickStrict failed:", String(e));
      return NextResponse.json({ error: "unavailable" }, { status: 500 });
    }
    purchase = { kind: "weekly", week, amount: weeklyPickAmount().amount };
  } else {
    // #PAYGATE-TEST-2USD, stessa porta già esistente sul rail carte: piano NASCOSTO
    // da $5 per fare una prova di pagamento REALE senza spendere 15 o 30 dollari.
    // Attivo solo con PAYGATE_TEST_ENABLED=1 → si spegne togliendo la env, senza
    // deploy (senza flag "test" è un plan sconosciuto → 400 come qualunque altro).
    const isTest = body.requested_plan === "test" && process.env.PAYGATE_TEST_ENABLED === "1";
    const plan = isTest ? "base" : body.requested_plan;
    const period = body.period;
    if (plan !== "base" && plan !== "premium") {
      return NextResponse.json({ error: "invalid requested_plan" }, { status: 400 });
    }
    if (period !== "monthly" && period !== "annual") {
      return NextResponse.json({ error: "invalid period" }, { status: 400 });
    }
    // Stessa tier-guard del rail carte: premium attivo non ricompra 'base'.
    // Il path di test la bypassa: serve a provare la catena, non a vendere un piano.
    if (!isTest && blocksLowerTierPurchase(ctx.plan, plan)) {
      return NextResponse.json({ error: "active premium plan — cannot purchase lower tier" }, { status: 409 });
    }
    const amount = isTest
      ? 5
      : discountedAmountFor(plan, period, await promoEligibility(ctx.identifier)).amount;
    purchase = { kind: "plan", plan, period, amount };
  }
  const amount = purchase.amount;

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
  // `kind` dice al callback in quale tabella cercare il token. Manometterlo non
  // apre nulla: il lookup nella tabella sbagliata non trova la riga e non concede.
  const callbackUrl =
    `${origin}/api/crypto/callback?token=${encodeURIComponent(token)}&order=${orderId}` +
    (purchase.kind === "weekly" ? "&kind=weekly" : "");

  let deposit;
  try {
    deposit = await createCryptoDeposit(coin, payoutWallet, callbackUrl);
  } catch (e) {
    console.error("[crypto/checkout] wallet.php failed:", String(e));
    return NextResponse.json({ error: "deposit address failed" }, { status: 502 });
  }

  // #CRYPTO-ADDR-REGISTRY-0729 — un indirizzo di deposito, un ordine solo, per
  // sempre e su entrambe le tabelle. `checkIncoming` somma TUTTI i trasferimenti
  // confermati verso l'indirizzo e nessuna transazione è legata a un ordine: se
  // wallet.php restituisse un indirizzo già visto, quella somma diventerebbe il
  // saldo di due ordini. Con un indirizzo già PAGATO in passato non servirebbe
  // nemmeno una corsa — l'ordine nuovo nascerebbe saldato dalla vecchia
  // transazione. Il registro è dichiarativo (PRIMARY KEY) e vale anche fra
  // `paygate_orders` e `weekly_pick_orders`, che hanno claim atomici separati e
  // quindi concederebbero entrambi.
  //
  // Sta PRIMA dell'INSERT dell'ordine di proposito: un ordine senza indirizzo
  // sicuro non deve esistere. Se il registro non risponde non si vende — fallire
  // una vendita è recuperabile, concedere due volte lo stesso pagamento no.
  const addressKey = deposit.addressIn.toLowerCase();
  try {
    const claimed = await dbQueryStrict<{ address: string }>(
      `INSERT INTO crypto_deposit_addresses (address, order_id, order_kind, coin)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (address) DO NOTHING
       RETURNING address`,
      [addressKey, orderId, purchase.kind === "weekly" ? "weekly" : "plan", coin.id]
    );
    // Zero righe = la ON CONFLICT ha scartato l'INSERT, cioè l'indirizzo era già
    // di qualcun altro. È un gate atomico: due checkout concorrenti sullo stesso
    // indirizzo lo attraversano uno solo, senza SELECT-poi-INSERT.
    if (claimed.length === 0) {
      console.error(
        `[crypto/checkout] indirizzo di deposito GIÀ REGISTRATO (${addressKey}) — ordine ${orderId} NON creato`
      );
      return NextResponse.json({ error: "deposit address unavailable" }, { status: 409 });
    }
  } catch (e) {
    console.error("[crypto/checkout] address registry unavailable:", String(e));
    return NextResponse.json({ error: "order create failed" }, { status: 500 });
  }

  try {
    if (purchase.kind === "weekly") {
      // Tabella della Weekly Pick, non paygate_orders: là plan/period sono NOT NULL
      // e un piano finto verrebbe concesso dalla prima passata del reconcile.
      await dbExecute(
        `INSERT INTO weekly_pick_orders
           (id, identifier, week_start, amount_usd, token_hash, ipn_token,
            coin, expected_value_coin, crypto_address_in)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [orderId, ctx.identifier, purchase.week, amount, tokenHash, deposit.ipnToken || null,
         coin.id, expected, deposit.addressIn]
      );
    } else {
      await dbExecute(
        `INSERT INTO paygate_orders
           (id, identifier, plan, period, amount_usd, token_hash, ipn_token,
            coin, expected_value_coin, crypto_address_in)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [orderId, ctx.identifier, purchase.plan, purchase.period, amount, tokenHash, deposit.ipnToken || null,
         coin.id, expected, deposit.addressIn]
      );
    }
  } catch (e) {
    console.error("[crypto/checkout] order insert failed:", String(e));
    return NextResponse.json({ error: "order create failed" }, { status: 500 });
  }

  const what =
    purchase.kind === "weekly"
      ? `weekly week=${purchase.week}`
      : `${purchase.plan}/${purchase.period}`;
  console.log(`[crypto/checkout] OK order=${orderId} ${what} ${coin.id} expected=${expected} amount_usd=${amount}`);
  return NextResponse.json({
    order: orderId,
    // Il client lo rimanda a /api/crypto/status: senza, il polling cercherebbe
    // l'ordine nella tabella dei piani e non lo troverebbe mai (404 in loop).
    kind: purchase.kind,
    coin: coin.id,
    coin_label: coin.label,
    address: deposit.addressIn,
    amount_coin: expected,
    amount_usd: amount,
  });
}

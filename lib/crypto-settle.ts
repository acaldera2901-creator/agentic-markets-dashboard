// #CRYPTO-DIRECT-1 — saldo di un ordine crypto diretto: verifica on-chain →
// claim atomico → grant → ordine specchiato in Shopify.
//
// Vive in una funzione sola perché la chiamano TRE punti (callback di PayGate,
// polling della pagina di pagamento, cron di reconcile): un solo percorso significa
// un solo comportamento, e il claim atomico garantisce che anche se scattano
// insieme il grant avvenga una volta e una sola.
// Stessa sequenza di lib/paygate-settle.ts, ma con la verità presa dalla catena
// invece che da `payment-status.php` (che sul processore crypto non esiste).
//
// #WEEKLY-CRYPTO-DIRECT-1 — due rail, un solo modo di decidere "è stato pagato?".
// I piani e la Weekly Pick differiscono solo in COSA concedono (e in quale tabella
// vive l'ordine), non in come si legge la catena: quella parte sta in `verifyPaid`
// e i due orchestratori la condividono. Se divergessero, un giorno una accetterebbe
// un pagamento che l'altra rifiuta.

import { dbExecute, getSupabaseAdminClient } from "@/lib/db";
import { activatePaygatePlan } from "@/lib/plan-grant";
import { grantWeeklyPick } from "@/lib/weekly-pick-server";
import { createMirroredPaidOrder } from "@/lib/shopify-admin";
import { findCoin } from "@/lib/crypto-coins";
import { checkIncoming, isPaidEnough } from "@/lib/crypto-verify";

export type CryptoOrder = {
  id: string;
  identifier: string;
  plan: "base" | "premium";
  period: "monthly" | "annual";
  amount_usd: number;
  status: string;
  coin: string | null;
  expected_value_coin: number | null;
  crypto_address_in: string | null;
  shopify_order_id: string | null;
};

// Ordine crypto della Weekly Pick. Vive in `weekly_pick_orders` e NON in
// `paygate_orders`: là `plan` e `period` sono NOT NULL, quindi ci vorrebbe un piano
// finto — e la prima passata del reconcile lo concederebbe come abbonamento.
export type WeeklyCryptoOrder = {
  id: string;
  identifier: string;
  week_start: string;
  amount_usd: number;
  status: string;
  coin: string | null;
  expected_value_coin: number | null;
  crypto_address_in: string | null;
  shopify_order_id: string | null;
  // Lega l'entitlement all'ordine che l'ha pagato (come fa il rail hosted).
  token_hash: string;
};

export type CryptoSettleResult = {
  granted: boolean;
  reason: string;
  received?: number;
  pending?: number;
};

type ChainVerdict =
  | { paid: false; result: CryptoSettleResult }
  | { paid: true; received: number; txHash: string | null };

// La verità sta sulla catena, e vale identica per i due rail. Un errore di rete
// NON è "non pagato": si ritenta, non si chiude l'ordine.
async function verifyPaid(order: {
  status: string;
  coin: string | null;
  crypto_address_in: string | null;
  expected_value_coin: number | null;
}): Promise<ChainVerdict> {
  const no = (reason: string, extra?: Partial<CryptoSettleResult>): ChainVerdict => ({
    paid: false,
    result: { granted: false, reason, ...extra },
  });

  if (order.status !== "pending") return no("not pending");
  const coin = findCoin(order.coin);
  if (!coin) return no(`coin non abilitata: ${String(order.coin)}`);
  if (!order.crypto_address_in) return no("no deposit address");
  if (!order.expected_value_coin) return no("no expected amount");

  let chain;
  try {
    chain = await checkIncoming(coin, order.crypto_address_in);
  } catch (e) {
    return no(`explorer non raggiungibile: ${String(e)}`);
  }

  if (!isPaidEnough(chain.received, order.expected_value_coin)) {
    // `pending > 0` = pagamento visto ma ancora sotto le conferme richieste:
    // è il caso normale nei primi secondi, non un errore.
    return no(chain.pending > 0 ? "in attesa di conferme" : "nessun pagamento confermato", {
      received: chain.received,
      pending: chain.pending,
    });
  }
  return { paid: true, received: chain.received, txHash: chain.txHash };
}

export async function settleCryptoOrder(order: CryptoOrder): Promise<CryptoSettleResult> {
  const v = await verifyPaid(order);
  if (!v.paid) return v.result;

  // claim atomico pending→paid: solo il vincitore concede.
  const db = getSupabaseAdminClient();
  if (!db) return { granted: false, reason: "no supabase client" };
  const { data: claimed, error: claimErr } = await db.rpc("claim_paygate_order", {
    p_id: order.id,
    p_value: v.received,
    p_txid: v.txHash,
  });
  if (claimErr) return { granted: false, reason: `claim error: ${claimErr.message}` };
  if (claimed !== true) return { granted: false, reason: "already claimed / race lost" };

  const granted = await activatePaygatePlan(order.identifier, order.plan, order.period);
  if (!granted) return { granted: false, reason: "paid but grant failed (identifier not found?)" };
  await dbExecute("UPDATE paygate_orders SET granted_at = NOW() WHERE id = $1", [order.id]);

  // Ordine specchiato in Shopify (ricevuta/report/rimborsi in un posto solo).
  // Best-effort e DOPO il grant: i soldi sono arrivati e il piano è concesso,
  // quindi un errore di Shopify non deve toccare l'esito del pagamento.
  if (!order.shopify_order_id) {
    const gid = await createMirroredPaidOrder({
      identifier: order.identifier,
      line: { kind: "plan", plan: order.plan, period: order.period },
      amountUsd: order.amount_usd,
      paygateOrderId: order.id,
      txid: v.txHash,
    });
    if (gid) {
      await dbExecute("UPDATE paygate_orders SET shopify_order_id = $2 WHERE id = $1", [order.id, gid]);
    }
  }

  return { granted: true, reason: "ok", received: v.received };
}

// #WEEKLY-CRYPTO-DIRECT-1 — stessa sequenza, altro entitlement: concede la Weekly
// Pick della settimana dell'ORDINE, non "quella corrente". Se il pagamento arriva
// a cavallo del lunedì, la pick consegnata deve essere quella per cui si è pagato.
export async function settleWeeklyCryptoOrder(order: WeeklyCryptoOrder): Promise<CryptoSettleResult> {
  const v = await verifyPaid(order);
  if (!v.paid) return v.result;

  const db = getSupabaseAdminClient();
  if (!db) return { granted: false, reason: "no supabase client" };
  const { data: claimed, error: claimErr } = await db.rpc("claim_weekly_pick_order", {
    p_id: order.id,
    p_value: v.received,
    p_txid: v.txHash,
  });
  if (claimErr) return { granted: false, reason: `claim error: ${claimErr.message}` };
  if (claimed !== true) return { granted: false, reason: "already claimed / race lost" };

  // A differenza di activatePaygatePlan — che SOMMA tempo, quindi ri-eseguirlo
  // regalerebbe giorni — grantWeeklyPick è idempotente sulla UNIQUE
  // (identifier, week_start). È ciò che permette al cron di recuperare un ordine
  // già 'paid' rimasto senza grant, invece di lasciarlo pagato-e-non-consegnato.
  try {
    await grantWeeklyPick(order.identifier, order.week_start, order.token_hash);
  } catch (e) {
    console.error(
      `[crypto-settle] RECONCILE: weekly order=${order.id} PAGATA ma grant fallito (week=${order.week_start}): ${String(e)}`
    );
    return { granted: false, reason: `paid but grant failed: ${String(e)}`, received: v.received };
  }
  await dbExecute("UPDATE weekly_pick_orders SET granted_at = NOW() WHERE id = $1", [order.id]);

  if (!order.shopify_order_id) {
    const gid = await createMirroredPaidOrder({
      identifier: order.identifier,
      line: { kind: "weekly", weekStart: order.week_start },
      amountUsd: order.amount_usd,
      paygateOrderId: order.id,
      txid: v.txHash,
    });
    if (gid) {
      await dbExecute("UPDATE weekly_pick_orders SET shopify_order_id = $2 WHERE id = $1", [order.id, gid]);
    }
  }

  return { granted: true, reason: "ok", received: v.received };
}

// NB: le colonne NON stanno in una costante interpolata nelle query: il guard
// SQL del repo (lib/sql-guard.test.ts) vieta ogni ${…} dentro dbQuery/dbExecute,
// e un'eccezione per comodità indebolirebbe una difesa che serve. Sono elencate
// in chiaro nei chiamanti; i tipi qui sopra restano la fonte di verità di COSA serve.

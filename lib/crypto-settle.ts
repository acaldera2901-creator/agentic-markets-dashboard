// #CRYPTO-DIRECT-1 — saldo di un ordine crypto diretto: verifica on-chain →
// claim atomico → grant → ordine specchiato in Shopify.
//
// Vive in una funzione sola perché la chiamano TRE punti (callback di PayGate,
// polling della pagina di pagamento, cron di reconcile): un solo percorso significa
// un solo comportamento, e il claim atomico `claim_paygate_order` garantisce che
// anche se scattano insieme il piano venga concesso una volta e una sola.
// Stessa sequenza di lib/paygate-settle.ts, ma con la verità presa dalla catena
// invece che da `payment-status.php` (che sul processore crypto non esiste).

import { dbExecute, getSupabaseAdminClient } from "@/lib/db";
import { activatePaygatePlan } from "@/lib/plan-grant";
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

export type CryptoSettleResult = {
  granted: boolean;
  reason: string;
  received?: number;
  pending?: number;
};

export async function settleCryptoOrder(order: CryptoOrder): Promise<CryptoSettleResult> {
  if (order.status !== "pending") return { granted: false, reason: "not pending" };
  const coin = findCoin(order.coin);
  if (!coin) return { granted: false, reason: `coin non abilitata: ${String(order.coin)}` };
  if (!order.crypto_address_in) return { granted: false, reason: "no deposit address" };
  if (!order.expected_value_coin) return { granted: false, reason: "no expected amount" };

  // 1) VERITÀ: la catena. Un errore di rete qui NON è "non pagato" — si ritenta.
  let chain;
  try {
    chain = await checkIncoming(coin, order.crypto_address_in);
  } catch (e) {
    return { granted: false, reason: `explorer non raggiungibile: ${String(e)}` };
  }

  if (!isPaidEnough(chain.received, order.expected_value_coin)) {
    // `pending > 0` = pagamento visto ma ancora sotto le conferme richieste:
    // è il caso normale nei primi secondi, non un errore.
    return {
      granted: false,
      reason: chain.pending > 0 ? "in attesa di conferme" : "nessun pagamento confermato",
      received: chain.received,
      pending: chain.pending,
    };
  }

  // 2) claim atomico pending→paid: solo il vincitore concede.
  const db = getSupabaseAdminClient();
  if (!db) return { granted: false, reason: "no supabase client" };
  const { data: claimed, error: claimErr } = await db.rpc("claim_paygate_order", {
    p_id: order.id,
    p_value: chain.received,
    p_txid: chain.txHash,
  });
  if (claimErr) return { granted: false, reason: `claim error: ${claimErr.message}` };
  if (claimed !== true) return { granted: false, reason: "already claimed / race lost" };

  // 3) grant
  const granted = await activatePaygatePlan(order.identifier, order.plan, order.period);
  if (!granted) return { granted: false, reason: "paid but grant failed (identifier not found?)" };
  await dbExecute("UPDATE paygate_orders SET granted_at = NOW() WHERE id = $1", [order.id]);

  // 4) ordine specchiato in Shopify (ricevuta/report/rimborsi in un posto solo).
  // Best-effort e DOPO il grant: i soldi sono arrivati e il piano è concesso,
  // quindi un errore di Shopify non deve toccare l'esito del pagamento.
  if (!order.shopify_order_id) {
    const gid = await createMirroredPaidOrder({
      identifier: order.identifier,
      line: { kind: "plan", plan: order.plan, period: order.period },
      amountUsd: order.amount_usd,
      paygateOrderId: order.id,
      txid: chain.txHash,
    });
    if (gid) {
      await dbExecute("UPDATE paygate_orders SET shopify_order_id = $2 WHERE id = $1", [order.id, gid]);
    }
  }

  return { granted: true, reason: "ok", received: chain.received };
}

// NB: le colonne NON stanno in una costante interpolata nelle query: il guard
// SQL del repo (lib/sql-guard.test.ts) vieta ogni ${…} dentro dbQuery/dbExecute,
// e un'eccezione per comodità indebolirebbe una difesa che serve. Sono elencate
// in chiaro nei tre chiamanti; il tipo CryptoOrder qui sopra resta la fonte di
// verità di COSA serve.

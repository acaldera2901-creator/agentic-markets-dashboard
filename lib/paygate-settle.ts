// #PAYGATE-SELFHEAL: verifica un ordine PayGate 'pending' contro PayGate e, se
// realmente pagato, lo salda (claim atomico pending→paid) e concede il piano.
// È la stessa sequenza del callback (checkPaymentStatus → evaluateCallback →
// claim_paygate_order → activatePaygatePlan), riusata dalla reconcile-cron per
// recuperare pagamenti il cui callback si è perso/fallito (PayGate non ritenta
// all'infinito). Idempotente: il claim atomico garantisce niente doppio-grant.
import { dbExecute, getSupabaseAdminClient } from "@/lib/db";
import { evaluateCallback, checkPaymentStatus } from "@/lib/paygate";
import { activatePaygatePlan } from "@/lib/plan-grant";

export type PendingOrder = {
  id: string;
  identifier: string;
  plan: "base" | "premium";
  period: "monthly" | "annual";
  amount_usd: number;
  status: string;
  ipn_token: string | null;
};

export type SettleResult = { granted: boolean; reason: string };

export async function settlePendingOrder(order: PendingOrder): Promise<SettleResult> {
  if (order.status !== "pending") return { granted: false, reason: "not pending" };
  if (!order.ipn_token) return { granted: false, reason: "no ipn_token" };

  // 1) verità server-side: PayGate dice paid?
  let verify = await checkPaymentStatus(order.ipn_token);
  // #PAYGATE-RATELIMIT-FIX: payment-status.php si rate-limita dopo ~5 chiamate
  // rapide dallo stesso IP (misurato via diag events 2026-07-15: in un giro di
  // reconcile i primi 5 ordini verificavano, i successivi fallivano → l'ordine
  // PAGATO più recente, sempre in coda, non veniva MAI saldato). Un retry dopo
  // una pausa recupera il singolo transiente; il pacing tra ordini sta nel cron.
  if (!verify) {
    await new Promise((r) => setTimeout(r, 2500));
    verify = await checkPaymentStatus(order.ipn_token);
  }
  // #PAYGATE-VERIFY-OBS: distinguere "verifica NON riuscita" (null: fetch/HTTP/
  // parse falliti) da "PayGate risponde ma non-paid" (abbandonato).
  if (!verify) return { granted: false, reason: "verify unavailable (fetch/HTTP/parse failed)" };
  if (verify.status !== "paid") return { granted: false, reason: `paygate status=${verify.status || "(empty)"}` };
  const serverValue = verify.valueCoin;

  // 2) importo verificato sul valore server (assorbe le fee crypto, floor -50%)
  const decision = evaluateCallback({
    order: { status: order.status, amount_usd: order.amount_usd },
    valueCoin: serverValue,
  });
  if (!decision.grant) return { granted: false, reason: decision.reason };

  // 3) claim atomico pending→paid: solo il vincitore concede (anti doppio-grant,
  //    non fa collidere con un eventuale callback in corso)
  const db = getSupabaseAdminClient();
  if (!db) return { granted: false, reason: "no supabase client" };
  const { data: claimed, error: claimErr } = await db.rpc("claim_paygate_order", {
    p_id: order.id, p_value: serverValue, p_txid: verify.txidOut,
  });
  if (claimErr) return { granted: false, reason: `claim error: ${claimErr.message}` };
  if (claimed !== true) return { granted: false, reason: "already claimed / race lost" };

  // 4) grant del piano dell'ordine (base/premium · monthly/annual)
  const granted = await activatePaygatePlan(order.identifier, order.plan, order.period);
  if (!granted) return { granted: false, reason: "paid but grant failed (identifier not found?)" };
  await dbExecute("UPDATE paygate_orders SET granted_at = NOW() WHERE id = $1", [order.id]);
  return { granted: true, reason: "ok" };
}

import { NextResponse } from "next/server";
import { dbQuery, dbExecute, getSupabaseAdminClient } from "@/lib/db";
import { verifyBearer } from "@/lib/admin-auth";
import { activatePaygatePlan } from "@/lib/plan-grant";
import { checkPaymentStatus, shouldSettle } from "@/lib/paygate";

export const dynamic = "force-dynamic";

// #PAYGATE-SELFHEAL — finestra/limite del poll outbound sugli ordini PENDING.
// Un pagamento crypto si risolve in minuti/max ~1-2h; 3 giorni coprono un
// callback mancato con ampio margine. Oltre = quasi certamente abbandonato
// (chi non paga resta pending): finestra + LIMIT tengono bounded le chiamate a
// PayGate (uso "casual" 1-per-callback). Se il volume di pending cresce molto,
// hardening futuro = colonna last_polled_at + backoff.
const PENDING_POLL_DAYS = 3;
const PENDING_POLL_LIMIT = 50;

// #PRELAUNCH-AUDIT HIGH-4 (PayGate claim-before-grant): il callback flippa l'ordine a
// 'paid' (claim atomico anti-doppio-grant) PRIMA di concedere il piano; se il grant
// fallisce — errore DB transitorio (dbQuery ingoia → null) o profilo non ancora
// esistente (l'utente registra dopo aver pagato) — l'ordine resta paid + granted_at
// NULL e PayGate NON ritenta più (status!=pending) → utente pagato senza piano, senza
// recupero automatico. Questo cron riconcilia: ri-tenta il grant sugli ordini paid non
// ancora concessi (finestra 7g). Idempotente e self-healing: appena il profilo esiste /
// il DB risponde, il piano viene concesso e granted_at settato. Cron-secret gated.
export async function GET(req: Request) {
  if (!verifyBearer(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const orders = await dbQuery<{ id: string; identifier: string; plan: "base" | "premium"; period: "monthly" | "annual" }>(
    `SELECT id::text AS id, identifier, plan, period
       FROM paygate_orders
      WHERE status = 'paid' AND granted_at IS NULL
        AND created_at > NOW() - INTERVAL '7 days'
      ORDER BY created_at ASC
      LIMIT 100`
  );

  let granted = 0;
  const errors: string[] = [];
  for (const o of orders) {
    try {
      const g = await activatePaygatePlan(o.identifier, o.plan, o.period);
      if (g) {
        // dbExecute è fail-loud: un fallimento qui lo registriamo, non lo ingoiamo.
        await dbExecute("UPDATE paygate_orders SET granted_at = NOW() WHERE id = $1", [o.id]);
        granted++;
        console.log(`[paygate/reconcile] GRANT order=${o.id} plan=${g.plan}`);
      }
      // g === null → profilo non ancora esistente o read fallita: si ritenta al prossimo giro.
    } catch (e) {
      errors.push(`${o.id}: ${String(e)}`);
    }
  }

  // ── PASS 2 — SELF-HEAL (#PAYGATE-SELFHEAL): poll degli ordini PENDING ──────────
  // Il grant non deve dipendere dal callback inbound (GET non firmato) che PayGate
  // deve chiamare una-sola-volta e che può perdersi (finestra di deploy, host non
  // raggiungibile, PayGate che non ritenta). Qui interroghiamo PayGate SERVER-SIDE
  // (payment-status.php, non toccato da blocchi client) per ogni ordine ancora
  // pending: se risulta 'paid' facciamo lo STESSO claim atomico + grant del
  // callback. Race-safe col callback (claim_paygate_order = un solo vincitore),
  // quindi mai doppio-grant. Idempotente: un ordine già concesso non è più pending.
  const pending = await dbQuery<{
    id: string; identifier: string; plan: "base" | "premium"; period: "monthly" | "annual";
    amount_usd: number; ipn_token: string | null;
  }>(
    `SELECT id::text AS id, identifier, plan, period, amount_usd::float8 AS amount_usd, ipn_token
       FROM paygate_orders
      WHERE status = 'pending' AND ipn_token IS NOT NULL
        AND created_at > NOW() - make_interval(days => $1)
      ORDER BY created_at DESC
      LIMIT $2`,
    [PENDING_POLL_DAYS, PENDING_POLL_LIMIT]
  );

  let recovered = 0;
  const db = getSupabaseAdminClient();
  for (const o of pending) {
    if (!o.ipn_token) continue;
    try {
      const verify = await checkPaymentStatus(o.ipn_token);
      const decision = shouldSettle(verify, o.amount_usd);
      if (!decision.settle) {
        // non pagato / non ancora / importo sotto soglia → si ritenta al prossimo giro
        if (verify && verify.status === "paid") {
          console.warn(`[paygate/reconcile] pending paid ma no-settle: ${decision.reason} (order=${o.id})`);
        }
        continue;
      }
      if (!db) { errors.push(`${o.id}: no supabase client`); continue; }
      // claim atomico con i valori SERVER: solo il vincitore della race flippa pending→paid
      const { data: claimed, error: claimErr } = await db.rpc("claim_paygate_order", {
        p_id: o.id, p_value: verify!.valueCoin, p_txid: verify!.txidOut,
      });
      if (claimErr) { errors.push(`${o.id}: claim ${claimErr.message}`); continue; }
      if (claimed !== true) continue; // già processato / callback ha vinto la race → nessun grant
      const g = await activatePaygatePlan(o.identifier, o.plan, o.period);
      if (g) {
        await dbExecute("UPDATE paygate_orders SET granted_at = NOW() WHERE id = $1", [o.id]);
        recovered++;
        console.log(`[paygate/reconcile] SELF-HEAL GRANT order=${o.id} plan=${g.plan} value_coin=${String(verify!.valueCoin)}`);
      } else {
        // paid+claimed ma profilo inesistente → granted_at resta NULL, il PASS 1 lo ritenta
        console.error(`[paygate/reconcile] RECONCILE: pending paid+claimed ma piano NON concesso (identifier-not-found) order=${o.id}`);
      }
    } catch (e) {
      errors.push(`${o.id}: ${String(e)}`);
    }
  }

  return NextResponse.json({ ok: true, scanned: orders.length, granted, pendingScanned: pending.length, recovered, errors });
}

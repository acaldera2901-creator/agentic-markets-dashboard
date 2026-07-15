import { NextResponse } from "next/server";
import { dbQuery, dbExecute } from "@/lib/db";
import { verifyBearer } from "@/lib/admin-auth";
import { activatePaygatePlan } from "@/lib/plan-grant";
import { settlePendingOrder } from "@/lib/paygate-settle";
import { opsAlert } from "@/lib/ops-alert";

export const dynamic = "force-dynamic";

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

  // #PAYGATE-SELFHEAL: seconda passata — ordini ancora 'pending' con ipn_token.
  // Se il callback di PayGate si è perso/fallito, qui li ri-verifichiamo contro
  // PayGate e, se realmente pagati, li saldiamo e concediamo il piano. Il claim
  // atomico dentro settlePendingOrder evita collisioni con un callback in corso.
  // #GOLIVE-QW-B finestra 48h (era 7g): un callback perso si recupera in ore, non
  // in giorni. Con 7g + LIMIT 100 ASC gli ordini abbandonati vecchi saturavano lo
  // slot e ri-pollavano PayGate ~672 volte ciascuno (spreco), affamando i pending
  // recenti che meritano davvero il re-check. Oltre 48h l'ordine è abbandonato.
  const pending = await dbQuery<{
    id: string; identifier: string; plan: "base" | "premium"; period: "monthly" | "annual";
    amount_usd: number; status: string; ipn_token: string | null;
  }>(
    `SELECT id::text AS id, identifier, plan, period, amount_usd::float8 AS amount_usd, status, ipn_token
       FROM paygate_orders
      WHERE status = 'pending' AND ipn_token IS NOT NULL
        AND created_at > NOW() - INTERVAL '48 hours'
      ORDER BY created_at ASC
      LIMIT 100`
  );

  let settled = 0;
  for (const o of pending) {
    try {
      const r = await settlePendingOrder(o);
      if (r.granted) {
        settled++;
        console.log(`[paygate/reconcile] SELFHEAL grant order=${o.id} plan=${o.plan}`);
      } else {
        // #PAYGATE-VERIFY-OBS: prima i non-grant erano MUTI — un ordine PAGATO
        // che non si salda (es. verify bloccata dal serverless) era invisibile
        // nei log. "not paid at paygate" resta il caso normale (abbandonati).
        console.log(`[paygate/reconcile] pending order=${o.id} non saldato: ${r.reason}`);
        // #PAYGATE-VERIFY-OBS-DB: i log funzione dei cron non sono leggibili né da
        // `vercel logs` (non streama le invocazioni cron) né dall'API (403 per il
        // ruolo corrente) → persistiamo il motivo in events per diagnosi via SQL.
        // Best-effort: non deve mai far fallire il run.
        try {
          await dbExecute(
            `INSERT INTO events (event_type, session_id, country, language, plan, partner_id, value, meta)
             VALUES ('paygate_reconcile_diag', $1, NULL, NULL, NULL, NULL, 0, $2)`,
            [o.id, JSON.stringify({ reason: r.reason, amount_usd: o.amount_usd, plan: o.plan })]
          );
        } catch { /* diagnostica best-effort */ }
      }
    } catch (e) {
      errors.push(`pending ${o.id}: ${String(e)}`);
    }
  }

  const body = {
    ok: errors.length === 0,
    scanned: orders.length,
    granted,
    pendingScanned: pending.length,
    settled,
    errors,
  };

  // Fail loud: any reconcile error → 500 (Vercel marks the run failed) + an
  // out-of-band ops-alert. A clean run stays 200. Same pattern as
  // app/api/cron/subscriptions and app/api/cron/settle.
  if (errors.length > 0) {
    await opsAlert("cron/paygate-reconcile", errors);
    return NextResponse.json(body, { status: 500 });
  }
  return NextResponse.json(body);
}

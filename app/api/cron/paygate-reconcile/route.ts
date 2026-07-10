import { NextResponse } from "next/server";
import { dbQuery, dbExecute } from "@/lib/db";
import { verifyBearer } from "@/lib/admin-auth";
import { activatePaygatePlan } from "@/lib/plan-grant";

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

  return NextResponse.json({ ok: true, scanned: orders.length, granted, errors });
}

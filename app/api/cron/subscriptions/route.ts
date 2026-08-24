import { NextResponse } from "next/server";
import { dbQuery, dbExecute } from "@/lib/db";
import { verifyBearer } from "@/lib/admin-auth";
import { opsAlert } from "@/lib/ops-alert";

export const dynamic = "force-dynamic";

// Daily subscription sweep (payments GAP2):
//   1. downgrade expired paid plans to 'free' (runtime auth already enforces
//      expiry — this just cleans the stored state; plan_expires_at is preserved
//      so the CRM win-back flow can read when the plan lapsed).
// Win-back and renewal-reminder emails are now owned by the CRM engine.
// Cron-secret gated, default-deny.

// Vercel Cron calls GET with Authorization: Bearer <CRON_SECRET>.
export async function GET(req: Request) {
  if (!verifyBearer(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 1. Downgrade expired paid plans (fail-loud — a silent failure would leave
  //    expired subscribers showing as paid in the stored state).
  //    plan_expires_at is intentionally NOT cleared: the CRM win-back flow
  //    reads it to know when the plan lapsed.
  let downgraded = 0;
  try {
    // exec_sql can't return RETURNING rows → count the rows that will be
    // downgraded with a SELECT, then run the UPDATE. The count is report-only;
    // the downgrade UPDATE is the authoritative side effect.
    const rows = await dbQuery<{ identifier: string; plan: string; plan_source: string | null }>(
      `SELECT identifier, plan, plan_source FROM profiles
        WHERE plan IN ('base', 'premium')
          AND plan_expires_at IS NOT NULL
          AND plan_expires_at < NOW()`
    );
    await dbExecute(
      `UPDATE profiles
         SET plan = 'free', updated_at = NOW()
       WHERE plan IN ('base', 'premium')
         AND plan_expires_at IS NOT NULL
         AND plan_expires_at < NOW()`
    );
    downgraded = rows.length;

    // #RENEWAL-SILENCE-0822 — un abbonamento che NON si rinnova era muto.
    // Se il rinnovo arriva e il grant fallisce, `shopify-reconcile` ri-tenta ogni
    // 10 minuti e avvisa. Ma se l'ordine di rinnovo NON ARRIVA affatto (contratto
    // disdetto, carta rifiutata, contratto mai creato) nessun webhook parte:
    // niente si rompe, e alle 06:00 questo cron declassava a `free` in silenzio.
    // Un cliente PAGANTE che decade non deve essere una scoperta casuale.
    // Le concessioni non a pagamento (manual, referral) scadono per disegno e
    // restano fuori dall'avviso, altrimenti diventa rumore e nessuno lo guarda.
    const CANALI_A_PAGAMENTO = new Set(["shopify", "shopify_oneoff", "paygate", "paypal", "stripe"]);
    const paganti = rows.filter((r) => CANALI_A_PAGAMENTO.has(r.plan_source ?? ""));
    if (paganti.length > 0) {
      await opsAlert(
        "abbonamento-scaduto",
        paganti.map((r) => `${r.identifier}: piano ${r.plan} da ${r.plan_source} scaduto senza rinnovo → declassato a free`)
      );
    }
  } catch (e) {
    console.error("[cron/subscriptions] downgrade failed:", String(e));
    return NextResponse.json({ error: "downgrade failed" }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, downgraded },
    { headers: { "cache-control": "no-store" } }
  );
}

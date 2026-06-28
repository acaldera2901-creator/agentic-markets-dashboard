import { NextResponse } from "next/server";
import { dbExecute } from "@/lib/db";
import { verifyBearer } from "@/lib/admin-auth";

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
    const rows = await dbExecute<{ identifier: string; language: string | null }>(
      `UPDATE profiles
         SET plan = 'free', updated_at = NOW()
       WHERE plan IN ('base', 'premium')
         AND plan_expires_at IS NOT NULL
         AND plan_expires_at < NOW()
       RETURNING identifier, language`
    );
    downgraded = rows.length;
  } catch (e) {
    console.error("[cron/subscriptions] downgrade failed:", String(e));
    return NextResponse.json({ error: "downgrade failed" }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, downgraded },
    { headers: { "cache-control": "no-store" } }
  );
}

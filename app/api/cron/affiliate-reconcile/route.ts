// /api/cron/affiliate-reconcile — #AFFILIATE-RECONCILE-1022
// Giornaliera, CRON_SECRET. Ripassa dal ledger i pagamenti concessi di referiti
// rimasti senza commissione (lib/affiliate/reconcile.ts). Gira in shadow e in
// live (il ledger scrive righe shadow o pending come sempre); off = niente DB.
// Un recupero è un segnale che il ledger ha perso qualcosa: va in alert ops.
import { NextResponse } from "next/server";
import { verifyBearer } from "@/lib/admin-auth";
import { affiliateMode } from "@/lib/affiliate/config";
import { reconcileAffiliateLedger } from "@/lib/affiliate/reconcile";
import { opsAlert } from "@/lib/ops-alert";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!verifyBearer(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (affiliateMode() === "off") return NextResponse.json({ ok: true, skipped: true });
  try {
    const r = await reconcileAffiliateLedger();
    if (r.written > 0 || (r.reasons.error ?? 0) > 0) {
      await opsAlert("affiliate-reconcile", [
        `commissioni recuperate: ${r.written} su ${r.checked} pagamenti senza riga; esiti ${JSON.stringify(r.reasons)}`,
      ]);
    }
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("[affiliate/reconcile] failed:", String(e));
    return NextResponse.json({ error: "reconcile unavailable" }, { status: 503 });
  }
}

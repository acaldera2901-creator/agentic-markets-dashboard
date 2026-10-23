// /api/cron/affiliate-reconcile — #AFFILIATE-RECONCILE-1022
// Giornaliera, CRON_SECRET. Ripassa dal ledger i pagamenti concessi di referiti
// rimasti senza commissione (lib/affiliate/reconcile.ts). Gira in shadow e in
// live (il ledger scrive righe shadow o pending come sempre); off = niente DB.
// Un recupero è un segnale che il ledger ha perso qualcosa: va in alert ops.
import { NextResponse } from "next/server";
import { verifyBearer } from "@/lib/admin-auth";
import { affiliateMode } from "@/lib/affiliate/config";
import { reconcileAffiliateLedger } from "@/lib/affiliate/reconcile";
import { affiliateRpc } from "@/lib/affiliate/rpc";
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
    const refunds = await affiliateRpc<{ ok: boolean; processed: number }>("affiliate_replay_reversals", {});
    if (!refunds.ok) throw new Error("refund replay rejected");
    const lines: string[] = [];
    if (refunds.processed > 0) lines.push(`storni differiti elaborati: ${refunds.processed}`);
    if (r.written > 0 || (r.reasons.error ?? 0) > 0 || r.truncated) {
      lines.push(
        `commissioni recuperate: ${r.written} su ${r.checked} pagamenti senza riga; esiti ${JSON.stringify(r.reasons)}${r.truncated ? " (troncato: riprende al prossimo giro)" : ""}`
      );
    }
    if (r.shopify_manual.length > 0) {
      lines.push(`ordini Shopify di referiti senza commissione, da verificare a mano: ${r.shopify_manual.join(", ")}`);
    }
    if (lines.length > 0) await opsAlert("affiliate-reconcile", lines);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("[affiliate/reconcile] failed:", String(e));
    return NextResponse.json({ error: "reconcile unavailable" }, { status: 503 });
  }
}

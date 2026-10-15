// /api/admin/affiliate/payouts/[id] — #AFFILIATE-V2-CRYPTO-1007 PR-9 (SPEC-ui §4.2).
// GET → il payout per il pannello «Invia e registra hash»: importo, indirizzo di
// destinazione INTERO (copiato alla creazione), intestatario, stato, hash,
// wallet di uscita pubblico. Solo admin.

import { NextResponse, type NextRequest } from "next/server";
import { payoutConfig } from "@/lib/affiliate/config";
import { adminGuard, adminPayoutView, loadPayout, parsePayoutId } from "@/lib/affiliate/payouts";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard(req, false);
  if (denied) return denied;
  const id = parsePayoutId((await ctx.params).id);
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  try {
    const p = await loadPayout(id);
    if (!p) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ payout: adminPayoutView(p), payout_from: payoutConfig().payoutFrom });
  } catch (e) {
    console.error("[admin/affiliate/payouts/id] read failed:", String(e));
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
}

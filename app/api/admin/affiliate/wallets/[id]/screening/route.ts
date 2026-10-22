// /api/admin/affiliate/wallets/[id]/screening — #AFFILIATE-OPS-1022 (B1)
// POST { result: "clear"|"blocked", reason } → affiliate_screen_wallet.
// Nessun provider di screening è integrato: la decisione la prende l'operatore
// (controllo manuale dell'indirizzo sulle liste sanzioni), con motivo e nome.
// Vale 30 giorni per creare un payout. blocked annulla i payout in
// preparazione non marcati. Ammesso con AFFILIATE_PAYOUTS=off (si può
// preparare prima di accendere i pagamenti).
import { NextResponse, type NextRequest } from "next/server";
import { adminOp, positiveId, reasonOf } from "@/lib/affiliate/admin-ops";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const id = positiveId((await ctx.params).id);
  return adminOp(req, "screening", async (b, actor) => {
    if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });
    if (b.result !== "clear" && b.result !== "blocked") return NextResponse.json({ error: "invalid_result" }, { status: 400 });
    const reason = reasonOf(b.reason);
    if (!reason) return NextResponse.json({ error: "reason_required" }, { status: 400 });
    return { fn: "affiliate_screen_wallet", args: { p_wallet_id: id, p_result: b.result, p_reason: reason, p_by: actor } };
  });
}

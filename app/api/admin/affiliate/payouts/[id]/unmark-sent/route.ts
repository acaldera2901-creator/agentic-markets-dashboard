// /api/admin/affiliate/payouts/[id]/unmark-sent — #AFFILIATE-OPS-1022 (R-C)
// POST { reason } → affiliate_payout_unmark_sent. Solo se NESSUN fondo è
// partito (dichiarazione a registro): il payout torna annullabile.
import { NextResponse, type NextRequest } from "next/server";
import { adminOp, positiveId, reasonOf } from "@/lib/affiliate/admin-ops";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const id = positiveId((await ctx.params).id);
  return adminOp(req, "unmark-sent", async (b, actor) => {
    if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });
    const reason = reasonOf(b.reason);
    if (!reason) return NextResponse.json({ error: "reason_required" }, { status: 400 });
    return { fn: "affiliate_payout_unmark_sent", args: { p_id: id, p_reason: reason, p_by: actor } };
  });
}

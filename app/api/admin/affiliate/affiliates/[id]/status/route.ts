// /api/admin/affiliate/affiliates/[id]/status — #AFFILIATE-OPS-1022 (B2)
// POST { status: "active"|"suspended"|"terminated", reason } → affiliate_set_status.
// Uscire da active annulla i payout in preparazione NON marcati «fondi in
// uscita» (trigger); terminated è definitivo. Ammesso con AFFILIATE_PAYOUTS=off.
import { NextResponse, type NextRequest } from "next/server";
import { adminOp, positiveId, reasonOf } from "@/lib/affiliate/admin-ops";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const id = positiveId((await ctx.params).id);
  return adminOp(req, "status", async (b, actor) => {
    if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });
    if (!["active", "suspended", "terminated"].includes(String(b.status))) {
      return NextResponse.json({ error: "invalid_status" }, { status: 400 });
    }
    const reason = reasonOf(b.reason);
    if (!reason) return NextResponse.json({ error: "reason_required" }, { status: 400 });
    return { fn: "affiliate_set_status", args: { p_affiliate_id: id, p_status: b.status, p_reason: reason, p_by: actor } };
  });
}

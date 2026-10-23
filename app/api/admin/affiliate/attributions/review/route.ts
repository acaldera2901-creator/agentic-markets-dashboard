// /api/admin/affiliate/attributions/review — #AFFILIATE-OPS-1022 (B2)
// POST { referred_identifier, decision: "valid"|"void", reason } →
// affiliate_review_attribution. Solo attribuzioni in fraud_review: valid → le
// commissioni maturano al prossimo cron; void → righe pending/shadow → void.
import { NextResponse, type NextRequest } from "next/server";
import { adminOp, reasonOf } from "@/lib/affiliate/admin-ops";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return adminOp(req, "review", async (b, actor) => {
    const who = typeof b.referred_identifier === "string" ? b.referred_identifier.trim().toLowerCase() : "";
    if (who.length < 3 || who.length > 320) return NextResponse.json({ error: "invalid referred_identifier" }, { status: 400 });
    if (b.decision !== "valid" && b.decision !== "void") return NextResponse.json({ error: "invalid_decision" }, { status: 400 });
    const reason = reasonOf(b.reason);
    if (!reason) return NextResponse.json({ error: "reason_required" }, { status: 400 });
    return { fn: "affiliate_review_attribution", args: { p_referred: who, p_decision: b.decision, p_reason: reason, p_by: actor } };
  });
}

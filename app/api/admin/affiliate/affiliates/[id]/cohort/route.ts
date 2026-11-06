// /api/admin/affiliate/affiliates/[id]/cohort — #CREATOR-OFFERS-1031 (B)
// POST { cohort: "standard"|"creator_human"|"creator_agent" } → affiliate_set_cohort.
// Solo admin: la coorte separa umani e agenti nei KPI (GET /api/admin/affiliate/creators).
import { NextResponse, type NextRequest } from "next/server";
import { adminOp, positiveId } from "@/lib/affiliate/admin-ops";
import { COHORTS } from "@/lib/affiliate/creators";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const id = positiveId((await ctx.params).id);
  return adminOp(req, "cohort", async (b, actor) => {
    if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });
    if (!COHORTS.includes(String(b.cohort) as never)) {
      return NextResponse.json({ error: "invalid_cohort" }, { status: 400 });
    }
    return { fn: "affiliate_set_cohort", args: { p_affiliate_id: id, p_cohort: b.cohort, p_by: actor } };
  });
}

// /api/admin/affiliate/offers/deliverables — #CREATOR-OFFERS-1031
// POST { affiliate_id, slot: "YYYY-MM" | "YYYY-MM-1" | "YYYY-MM-2", counts: {"video":2,…}, reason }
//      → affiliate_admin_confirm_deliverables: riga `deliverables_confirmed` in
//      affiliate_admin_actions. È la condizione del fisso (lib/affiliate/manual-due.ts).

import { NextResponse, type NextRequest } from "next/server";
import { adminOp, positiveId, reasonOf } from "@/lib/affiliate/admin-ops";

export const dynamic = "force-dynamic";

const SLOT = /^20[2-9][0-9]-(0[1-9]|1[0-2])(-[12])?$/;
const KEY = /^[a-z][a-z0-9_]{0,31}$/;

export async function POST(req: NextRequest) {
  return adminOp(req, "deliverables", async (b, actor) => {
    const id = positiveId(String(b.affiliate_id ?? ""));
    if (!id) return NextResponse.json({ error: "invalid affiliate_id" }, { status: 400 });
    const slot = typeof b.slot === "string" ? b.slot.trim() : "";
    if (!SLOT.test(slot)) return NextResponse.json({ error: "invalid_slot" }, { status: 400 });
    const c = b.counts;
    const entries = c && typeof c === "object" && !Array.isArray(c) ? Object.entries(c as Record<string, unknown>) : [];
    if (
      entries.length === 0 ||
      entries.length > 20 ||
      entries.some(([k, n]) => !KEY.test(k) || !Number.isInteger(n) || (n as number) < 1 || (n as number) > 1000)
    ) {
      return NextResponse.json({ error: "invalid_counts" }, { status: 400 });
    }
    const reason = reasonOf(b.reason);
    if (!reason) return NextResponse.json({ error: "reason_required" }, { status: 400 });
    return {
      fn: "affiliate_admin_confirm_deliverables",
      args: { p_actor: actor, p_affiliate_id: id, p_slot: slot, p_counts: Object.fromEntries(entries), p_reason: reason },
    };
  });
}

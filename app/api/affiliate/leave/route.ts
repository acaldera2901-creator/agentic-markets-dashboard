// /api/affiliate/leave — #AFFILIATE-COMPLETE-1023 (SPEC-ui §3.2 «Lascia il programma», Terms §8).
//
// POST → the logged-in affiliate leaves the program, one click after a neutral
// confirm. Sets affiliates.left_at: from now on their referred users' payments
// earn nothing (lib/affiliate/ledger.ts standingBlock). What was already earned is
// NOT forfeited: the status stays 'active', so it keeps maturing and is paid out
// to the saved wallet as usual. They can come back with /api/affiliate/join.
// Anti-IDOR: the affiliate comes from the session, nothing from the body.

import { NextResponse } from "next/server";
import { getSessionPlan } from "@/lib/auth";
import { dbExecute } from "@/lib/db";
import { loadAffiliateBySession } from "@/lib/affiliate/account";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "cross-site request blocked" }, { status: 403 });
  }
  let ctx;
  try {
    ctx = await getSessionPlan(req);
  } catch (e) {
    console.error("[affiliate/leave] session lookup failed:", String(e));
    return NextResponse.json({ error: "session unavailable" }, { status: 503 });
  }
  if (!ctx) return NextResponse.json({ error: "login required" }, { status: 401 });
  try {
    const aff = await loadAffiliateBySession(ctx.identifier);
    if (!aff) return NextResponse.json({ error: "not_enrolled" }, { status: 404 });
    if (aff.status === "terminated") return NextResponse.json({ error: "terminated" }, { status: 403 });
    if (aff.left_at) return NextResponse.json({ ok: true, already: true, left_at: aff.left_at });
    // One statement (atomic): open the absence interval and mirror it on the affiliate.
    await dbExecute(
      `WITH x AS (
         INSERT INTO affiliate_absences (affiliate_id, left_at)
         SELECT id, clock_timestamp() FROM affiliates WHERE id = $1 AND left_at IS NULL
         ON CONFLICT (affiliate_id) WHERE rejoined_at IS NULL DO NOTHING RETURNING left_at)
       UPDATE affiliates SET left_at = (SELECT left_at FROM x), updated_at = NOW()
        WHERE id = $1 AND left_at IS NULL AND EXISTS (SELECT 1 FROM x)`,
      [aff.id],
    );
    const after = await loadAffiliateBySession(ctx.identifier);
    if (!after?.left_at) return NextResponse.json({ error: "leave failed" }, { status: 500 });
    console.log(`[affiliate/leave] affiliate ${aff.id} left the program`);
    return NextResponse.json({ ok: true, already: false, left_at: after.left_at });
  } catch (e) {
    console.error("[affiliate/leave] failed:", String(e));
    return NextResponse.json({ error: "leave failed" }, { status: 500 });
  }
}

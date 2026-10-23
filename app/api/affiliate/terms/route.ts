// /api/affiliate/terms — #AFFILIATE-COMPLETE-1023 (Terms v3: «section 7A applies 30 days
// after we notify them of this version, or earlier if they accept it»).
//
// POST { terms_version, onerous_ack: true } → the logged-in affiliate accepts the
// Terms in force from the «Terms updated» banner. The version must be the one in
// force (409 terms_outdated otherwise) and the onerous clauses are approved again,
// separately (artt. 1341-1342 c.c.), as at enrollment. Recorded in
// affiliate_terms_acceptances (history) and on the affiliate row (latest).
// Anti-IDOR: the affiliate comes from the session.

import { NextResponse } from "next/server";
import { getSessionPlan } from "@/lib/auth";
import { dbExecute } from "@/lib/db";
import { affiliateTermsVersion } from "@/lib/affiliate/config";
import { loadAffiliateBySession, recordAcceptance } from "@/lib/affiliate/account";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "cross-site request blocked" }, { status: 403 });
  }
  let ctx;
  try {
    ctx = await getSessionPlan(req);
  } catch (e) {
    console.error("[affiliate/terms] session lookup failed:", String(e));
    return NextResponse.json({ error: "session unavailable" }, { status: 503 });
  }
  if (!ctx) return NextResponse.json({ error: "login required" }, { status: 401 });

  const termsVersion = affiliateTermsVersion();
  if (!termsVersion) return NextResponse.json({ error: "terms_not_published" }, { status: 503 });
  let body: { terms_version?: unknown; onerous_ack?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (body.onerous_ack !== true) return NextResponse.json({ error: "onerous_ack_required" }, { status: 400 });
  if (body.terms_version !== termsVersion) {
    return NextResponse.json({ error: "terms_outdated", terms_version: termsVersion }, { status: 409 });
  }
  try {
    const aff = await loadAffiliateBySession(ctx.identifier);
    if (!aff) return NextResponse.json({ error: "not_enrolled" }, { status: 404 });
    if (aff.status === "terminated") return NextResponse.json({ error: "terminated" }, { status: 403 });
    if (aff.terms_version === termsVersion) return NextResponse.json({ ok: true, already: true, terms_version: termsVersion });
    await recordAcceptance(aff.id, termsVersion, "update");
    await dbExecute(
      `UPDATE affiliates
          SET terms_version = $2, terms_accepted_at = NOW(), onerous_ack_at = NOW(), onerous_ack_version = $2, updated_at = NOW()
        WHERE id = $1`,
      [aff.id, termsVersion],
    );
    return NextResponse.json({ ok: true, already: false, terms_version: termsVersion });
  } catch (e) {
    console.error("[affiliate/terms] failed:", String(e));
    return NextResponse.json({ error: "accept failed" }, { status: 500 });
  }
}

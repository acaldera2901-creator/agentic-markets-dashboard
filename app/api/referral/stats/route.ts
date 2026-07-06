// /api/referral/stats — #REFERRAL-PANEL (item 3) + #REFERRAL-HARDENING (#4).
// Read-only conversion counter for the creator referral program decided in
// #PRICING-CREATORS-0706. Returns aggregates ONLY for the caller's OWN claimed
// referral_code (migration 013 + /api/referral/claim): the previous ?code=
// parameter let any logged-in user enumerate any creator's numbers — closed.
// No claimed code yet → 403 with an explicit reason so the panel can route the
// user to the claim step first. No PII, just two integers + the caller's code.

import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { getSessionPlan } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await getSessionPlan(req);
  } catch (e) {
    console.error("[referral/stats] session lookup failed:", String(e));
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx) return NextResponse.json({ error: "login required" }, { status: 401 });

  const [me] = await dbQuery<{ referral_code: string | null }>(
    "SELECT referral_code FROM profiles WHERE identifier = $1",
    [ctx.identifier]
  );
  const code = (me?.referral_code ?? "").trim().toUpperCase();
  if (!code) {
    // Nessun codice claimato: niente numeri altrui da guardare (anti-enumerazione).
    return NextResponse.json({ error: "no referral code claimed" }, { status: 403 });
  }

  // Case-insensitive: /r/ uppercasa, ma referred_by può contenere codici
  // catturati prima della normalizzazione.
  const rows = await dbQuery<{ signups: number | string; paid: number | string }>(
    `SELECT COUNT(*)::int AS signups,
            COUNT(*) FILTER (WHERE plan IN ('base','premium'))::int AS paid
     FROM profiles
     WHERE UPPER(referred_by) = $1
       AND identifier <> $2`,
    [code, ctx.identifier]
  );
  const r = rows[0] ?? { signups: 0, paid: 0 };
  return NextResponse.json({
    code,
    signups: Number(r.signups) || 0,
    paid: Number(r.paid) || 0,
  });
}

// /api/referral/stats — #REFERRAL-PANEL (item 3).
// Read-only conversion counter for the creator referral program decided in
// #PRICING-CREATORS-0706: a creator's code (free-text, first-touch) is attributed
// via /r/CODE → profiles.referred_by. This returns the aggregate count for a code
// so the Account "Invita" panel can show "sign-ups with your code" + how many are
// paid subscribers. No PII, just two integers. Login required (any plan).
//
// NOTE: today codes are self-declared (no official code→profile mapping yet, see
// council follow-up). Persisting a referral_code on the profile is a gated
// follow-up; until then any logged-in user can query a code's count.

import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { resolveAccessState } from "@/lib/auth";

export const dynamic = "force-dynamic";

const CODE_RE = /^[A-Z0-9_-]{2,20}$/;

export async function GET(req: Request) {
  const { state } = await resolveAccessState(req);
  if (state === "anonymous") {
    return NextResponse.json({ error: "login required" }, { status: 401 });
  }
  const code = (new URL(req.url).searchParams.get("code") ?? "").trim().toUpperCase();
  if (!CODE_RE.test(code)) {
    return NextResponse.json({ error: "invalid code" }, { status: 400 });
  }
  // Compare case-insensitively: the /r/ link uppercases, but referred_by may hold
  // codes captured before that normalization.
  const rows = await dbQuery<{ signups: number | string; paid: number | string }>(
    `SELECT COUNT(*)::int AS signups,
            COUNT(*) FILTER (WHERE plan IN ('base','premium'))::int AS paid
     FROM profiles
     WHERE UPPER(referred_by) = $1`,
    [code]
  );
  const r = rows[0] ?? { signups: 0, paid: 0 };
  return NextResponse.json({ signups: Number(r.signups) || 0, paid: Number(r.paid) || 0 });
}

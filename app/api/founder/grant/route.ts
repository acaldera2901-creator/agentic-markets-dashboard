import { NextResponse } from "next/server";
import { dbExecute } from "@/lib/db";
import { signSession, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/session";
import { ADMIN_IDENTIFIER, ADMIN_PROFILE_PLAN } from "@/lib/admin-profile-policy";
import { safeEqual } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// Founder/team access: validates FOUNDER_ACCESS_KEY, then establishes a server-side
// admin_full session (upsert profile + signed cookie) so the server gate grants full
// data access. This endpoint stays public (it IS the entry point).
export async function POST(req: Request) {
  let body: { secret?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const expected = process.env.FOUNDER_ACCESS_KEY;
  if (!expected || !body.secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (!safeEqual(body.secret, expected)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // Upsert the admin profile and force plan = admin_full. Fail-loud: a swallowed
  // write here would set the session cookie while the plan was never granted.
  try {
    await dbExecute(
      `INSERT INTO profiles (identifier, name, plan)
         VALUES ($1, 'Andrea', $2)
       ON CONFLICT (identifier) DO UPDATE
         SET plan = $2, updated_at = NOW()`,
      [ADMIN_IDENTIFIER, ADMIN_PROFILE_PLAN]
    );
  } catch (e) {
    console.error("[founder] grant write failed:", String(e));
    return NextResponse.json({ ok: false, error: "grant persistence failed" }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, signSession(ADMIN_IDENTIFIER), SESSION_COOKIE_OPTIONS);
  return res;
}

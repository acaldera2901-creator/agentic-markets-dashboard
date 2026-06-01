import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { signSession, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/session";

export const dynamic = "force-dynamic";

// Founder/team access: validates FOUNDER_ACCESS_KEY, then establishes a server-side
// admin_full session (upsert profile + signed cookie) so the server gate grants full
// data access. This endpoint stays public (it IS the entry point).
const FOUNDER_IDENTIFIER = "admin@agentic-markets.internal";

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

  if (body.secret !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // Upsert the admin profile and force plan = admin_full.
  await dbQuery(
    `INSERT INTO profiles (identifier, name, plan)
       VALUES ($1, 'Andrea', 'admin_full')
     ON CONFLICT (identifier) DO UPDATE
       SET plan = 'admin_full', updated_at = NOW()`,
    [FOUNDER_IDENTIFIER]
  );

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, signSession(FOUNDER_IDENTIFIER), SESSION_COOKIE_OPTIONS);
  return res;
}

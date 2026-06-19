import { NextResponse } from "next/server";
import { dbQuery, dbExecute } from "@/lib/db";
import { hashActivationToken, tokenHashMatches } from "@/lib/activation";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/password";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Password reset (companion to /api/auth forgot_password). The user lands on
// /reset-password from the email link and POSTs { token, id, password }. We
// verify the one-time token (only its SHA-256 hash is stored), set the new
// password, drop the token, mark the profile activated (proving inbox control +
// setting a password is at least as strong as activation), and bump
// sessions_valid_from so ANY pre-existing session (e.g. an attacker's) is
// revoked. We deliberately do NOT issue a session here: the user logs in fresh
// with the new password. (Issuing one would race the just-set sessions_valid_from
// — iat is floored to the second, so a sub-second-fresh cookie would be rejected
// by the iat < valid_from check in lib/auth.ts — and logging in after reset is
// the safer, standard behaviour anyway.)

type Row = {
  identifier: string;
  plan: string;
  reset_token_hash: string | null;
  reset_token_expires: string | null;
};

export async function POST(req: Request) {
  if (rateLimit(`auth-reset:${clientIp(req)}`, 20, 60_000)) {
    return NextResponse.json({ error: "too many requests, slow down" }, { status: 429 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  const id = (typeof body.id === "string" ? body.id : "").trim().toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  if (!token || !id) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ error: `password must be at least ${MIN_PASSWORD_LENGTH} characters` }, { status: 400 });
  }

  const rows = await dbQuery<Row>(
    "SELECT identifier, plan, reset_token_hash, reset_token_expires FROM profiles WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1 LIMIT 1",
    [id]
  );
  const row = rows[0];
  // Same generic error for missing row / no token / mismatch — never reveal which.
  if (!row || !row.reset_token_hash || !row.reset_token_expires) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }
  // admin_full never gets a public session via this path (mirrors /api/auth).
  if (row.plan === "admin_full") {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }
  if (new Date(row.reset_token_expires).getTime() < Date.now()) {
    return NextResponse.json({ error: "expired_token" }, { status: 400 });
  }
  if (!tokenHashMatches(hashActivationToken(token), row.reset_token_hash)) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }

  try {
    await dbExecute(
      `UPDATE profiles
         SET password_hash = $2,
             reset_token_hash = NULL,
             reset_token_expires = NULL,
             activated_at = COALESCE(activated_at, NOW()),
             sessions_valid_from = NOW(),
             updated_at = NOW()
       WHERE identifier = $1`,
      [row.identifier, hashPassword(password)]
    );
  } catch (e) {
    console.error("[auth/reset] password reset write failed:", String(e));
    return NextResponse.json({ error: "reset failed" }, { status: 500 });
  }

  // No session issued — the client redirects to login so the user signs in with
  // the new password (old sessions are already revoked via sessions_valid_from).
  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}

import { NextResponse } from "next/server";
import { dbQuery, dbExecute } from "@/lib/db";
import { signSession, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/session";
import { getSessionPlan, type Plan } from "@/lib/auth";
import { normalizeIdentifier } from "@/lib/admin-profile-policy";
import { normalizeCheckoutPlan } from "@/lib/commercial-plan";
import {
  generateCode, hashCode, codeMatches,
  OTP_TTL_SECONDS, OTP_RESEND_COOLDOWN_SECONDS, OTP_MAX_ATTEMPTS,
} from "@/lib/otp";
import { sendEmail, otpEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Server-authoritative auth endpoint.
// Email-only login was too weak (anyone knowing an email logged in as them), so
// the session cookie is now gated by a one-time code emailed to that address:
// - POST { action: "request_code" } -> email a 6-digit code (cooldown-limited). No cookie.
// - POST { action: "verify_code" }  -> validate code, upsert profile, set signed cookie.
// - POST { action: "checkout" }     -> mark plan='pending_payment' + requested_plan/tx_hash. Never unlocks.
// - POST { action: "logout" }       -> clear cookie.
// - GET                              -> current session profile (fresh plan from DB) or 401.

type ProfileRow = { identifier: string; plan: Plan; name: string | null };

async function loadProfile(identifier: string): Promise<ProfileRow | null> {
  const rows = await dbQuery<ProfileRow>(
    "SELECT identifier, plan, name FROM profiles WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1 LIMIT 1",
    [identifier]
  );
  return rows[0] ?? null;
}

export async function GET(req: Request) {
  const ctx = await getSessionPlan(req);
  if (!ctx) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }
  return NextResponse.json(
    { identifier: ctx.identifier, plan: ctx.plan, name: ctx.name },
    { headers: { "cache-control": "no-store" } }
  );
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "login";

  if (action === "logout") {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
    return res;
  }

  if (action === "checkout") {
    // Requires an authenticated session; flags the requested upgrade. Does NOT grant access.
    const ctx = await getSessionPlan(req);
    if (!ctx) {
      return NextResponse.json({ error: "authentication required" }, { status: 401 });
    }
    const requested = normalizeCheckoutPlan(body.requested_plan);
    if (!requested) {
      return NextResponse.json({ error: "invalid requested_plan" }, { status: 400 });
    }
    const txHash = typeof body.tx_hash === "string" ? body.tx_hash.trim() : null;
    // Fail-loud write: a swallowed UPDATE here would tell the client the checkout
    // was registered while the DB never changed (silent payment loss).
    try {
      await dbExecute(
        `UPDATE profiles
           SET plan = 'pending_payment',
               requested_plan = $2,
               tx_hash = $3,
               updated_at = NOW()
         WHERE identifier = $1
            OR LOWER(TRIM(identifier)) = $1`,
        [ctx.identifier, requested, txHash]
      );
    } catch (e) {
      console.error("[auth] checkout write failed:", String(e));
      return NextResponse.json({ error: "checkout persistence failed" }, { status: 500 });
    }
    const updated = await loadProfile(ctx.identifier);
    if (!updated || updated.plan !== "pending_payment") {
      return NextResponse.json({ error: "checkout not persisted" }, { status: 500 });
    }
    return NextResponse.json(
      {
        identifier: ctx.identifier,
        plan: updated.plan,
        name: updated.name ?? ctx.name,
        requested_plan: requested,
      },
      { headers: { "cache-control": "no-store" } }
    );
  }

  const identifier = normalizeIdentifier(body.identifier ?? body.email);
  if (!identifier || !identifier.includes("@")) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }
  const lang = body.language === "en" ? "en" : "it";

  // ── Step 1: request a one-time code ────────────────────────────────────────
  if (action === "request_code") {
    // Cooldown: one send per identity per OTP_RESEND_COOLDOWN_SECONDS (anti-spam
    // / anti-mailbomb). Checked against the current row's last_sent_at.
    const existing = await dbQuery<{ last_sent_at: string }>(
      "SELECT last_sent_at FROM login_codes WHERE identifier = $1 LIMIT 1",
      [identifier]
    );
    if (existing[0]) {
      const elapsed = (Date.now() - new Date(existing[0].last_sent_at).getTime()) / 1000;
      if (elapsed < OTP_RESEND_COOLDOWN_SECONDS) {
        return NextResponse.json(
          { error: "code already sent", retry_after: Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsed) },
          { status: 429 }
        );
      }
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString();
    try {
      await dbExecute(
        `INSERT INTO login_codes (identifier, code_hash, expires_at, attempts, last_sent_at)
           VALUES ($1, $2, $3, 0, NOW())
         ON CONFLICT (identifier) DO UPDATE
           SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at,
               attempts = 0, last_sent_at = NOW()`,
        [identifier, hashCode(code), expiresAt]
      );
    } catch (e) {
      console.error("[auth] login_code persistence failed:", String(e));
      return NextResponse.json({ error: "could not issue code" }, { status: 500 });
    }

    try {
      const mail = otpEmail(code, lang);
      await sendEmail({ to: identifier, subject: mail.subject, html: mail.html, text: mail.text });
    } catch (e) {
      console.error("[auth] OTP email send failed:", String(e));
      return NextResponse.json({ error: "could not send code" }, { status: 502 });
    }
    // Never echo the code or whether the email exists — neutral response.
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  }

  // ── Step 2: verify the code → upsert profile + issue session cookie ────────
  if (action === "verify_code") {
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "invalid code format" }, { status: 400 });
    }
    const rows = await dbQuery<{ code_hash: string; expires_at: string; attempts: number }>(
      "SELECT code_hash, expires_at, attempts FROM login_codes WHERE identifier = $1 LIMIT 1",
      [identifier]
    );
    const rec = rows[0];
    if (!rec) return NextResponse.json({ error: "no code requested" }, { status: 400 });
    if (new Date(rec.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "code expired" }, { status: 400 });
    }
    if (rec.attempts >= OTP_MAX_ATTEMPTS) {
      return NextResponse.json({ error: "too many attempts — request a new code" }, { status: 429 });
    }
    if (!codeMatches(code, rec.code_hash)) {
      await dbExecute("UPDATE login_codes SET attempts = attempts + 1 WHERE identifier = $1", [identifier]);
      return NextResponse.json({ error: "wrong code" }, { status: 401 });
    }

    // Correct: burn the code (single-use) before issuing the session.
    await dbExecute("DELETE FROM login_codes WHERE identifier = $1", [identifier]);

    const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : null;
    const language = typeof body.language === "string" ? body.language.slice(0, 16) : null;
    const timezone = typeof body.timezone === "string" ? body.timezone.slice(0, 64) : null;

    // Upsert: new profile ALWAYS starts on 'free'; never escalate/downgrade an
    // existing plan here. Elevated plans come only from /api/founder/grant.
    try {
      await dbExecute(
        `INSERT INTO profiles (identifier, name, language, timezone, plan)
         VALUES ($1, $2, $3, $4, 'free')
       ON CONFLICT (identifier) DO UPDATE
         SET name = COALESCE(EXCLUDED.name, profiles.name),
             language = COALESCE(EXCLUDED.language, profiles.language),
             timezone = COALESCE(EXCLUDED.timezone, profiles.timezone),
             updated_at = NOW()`,
        [identifier, name, language, timezone]
      );
    } catch (e) {
      console.error("[auth] profile upsert failed:", String(e));
      return NextResponse.json({ error: "profile persistence failed" }, { status: 500 });
    }

    const profile = await loadProfile(identifier);
    if (!profile) {
      return NextResponse.json({ error: "profile persistence failed" }, { status: 500 });
    }
    // An admin_full profile must never get a session via the public OTP path —
    // even with mailbox access. Admin sessions come only from /api/founder/grant.
    if (profile.plan === "admin_full") {
      return NextResponse.json({ error: "this profile requires founder access" }, { status: 403 });
    }

    const token = signSession(identifier);
    const res = NextResponse.json(
      { identifier: profile.identifier, plan: profile.plan, name: profile.name },
      { headers: { "cache-control": "no-store" } }
    );
    res.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
    return res;
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

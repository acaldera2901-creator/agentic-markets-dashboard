import { NextResponse } from "next/server";
import { dbQuery, dbExecute } from "@/lib/db";
import { signSession, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/session";
import { getSessionPlan, type Plan } from "@/lib/auth";
import { normalizeIdentifier } from "@/lib/admin-profile-policy";
import { normalizeCheckoutPlan } from "@/lib/commercial-plan";
import { sendEmail, paymentReceivedEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Server-authoritative auth endpoint (P0 #1).
// - POST { action: "login" }    -> upsert profile (new = free), set signed cookie, return profile.
// - POST { action: "checkout" } -> mark plan='pending_payment' + requested_plan/tx_hash. Never unlocks.
// - POST { action: "logout" }   -> clear cookie.
// - GET                          -> current session profile (fresh plan from DB) or 401.

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
    // GAP4: confirm receipt to the customer (best-effort — never fails checkout).
    if (ctx.identifier.includes("@")) {
      const lang = typeof body.language === "string" && body.language === "en" ? "en" : "it";
      const mail = paymentReceivedEmail(lang);
      sendEmail({ to: ctx.identifier, subject: mail.subject, html: mail.html, text: mail.text })
        .catch((e) => console.error("[auth] payment-received email failed:", String(e)));
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

  // Default: login / create-profile (passwordless, identifier-only).
  const identifier = normalizeIdentifier(body.identifier ?? body.email);
  if (!identifier) {
    return NextResponse.json({ error: "identifier required" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : null;
  const language = typeof body.language === "string" ? body.language.slice(0, 16) : null;
  const timezone = typeof body.timezone === "string" ? body.timezone.slice(0, 64) : null;

  // Upsert: new profile ALWAYS starts on 'free'; never escalate, downgrade, or reset
  // an existing plan here. Admin/elevated plans are granted ONLY via the secret-gated
  // /api/founder/grant or the admin console — never inferred from a (claimable,
  // passwordless) email identifier, which would let anyone self-grant admin_full.
  // COALESCE keeps existing name/language/timezone when the new value is null.
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

  // Passwordless login must never hand out an elevated session: anyone who
  // knows the admin identifier would otherwise get admin_full data access.
  // Admin sessions are established only via the secret-gated /api/founder/grant.
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

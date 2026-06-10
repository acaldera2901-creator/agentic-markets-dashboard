import { NextResponse } from "next/server";
import { dbQuery, dbExecute } from "@/lib/db";
import { signSession, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/session";
import { getSessionPlan, type Plan } from "@/lib/auth";
import { normalizeIdentifier } from "@/lib/admin-profile-policy";
import { normalizeCheckoutPlan } from "@/lib/commercial-plan";
import { sendEmail, paymentReceivedEmail, activationEmail } from "@/lib/email";
import { hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from "@/lib/password";
import { siteOrigin, newActivationToken } from "@/lib/activation";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Issue + persist a fresh activation token and email the activation link.
// Throws if the email send fails so the caller surfaces a real error.
async function sendActivation(req: Request, identifier: string, lang: "it" | "en"): Promise<void> {
  const { token, hash, expiresIso } = newActivationToken();
  await dbExecute(
    "UPDATE profiles SET activation_token_hash = $2, activation_token_expires = $3, updated_at = NOW() WHERE identifier = $1",
    [identifier, hash, expiresIso]
  );
  const url = `${siteOrigin(req)}/api/auth/activate?token=${token}&id=${encodeURIComponent(identifier)}`;
  const mail = activationEmail(url, lang);
  await sendEmail({ to: identifier, subject: mail.subject, html: mail.html, text: mail.text, from: mail.from, replyTo: mail.replyTo });
}

// Server-authoritative auth endpoint. Email-only login was too weak (anyone
// knowing an email logged in as them); the session cookie is now gated by a
// password (no email/domain dependency, unlike the OTP path).
// - POST { action: "register" } -> create/claim profile with a password, set cookie.
// - POST { action: "login" }    -> verify password, set cookie.
// - POST { action: "checkout" } -> mark plan='pending_payment' + requested_plan/tx_hash. Never unlocks.
// - POST { action: "logout" }   -> clear cookie.
// - GET                          -> current session profile (fresh plan from DB) or 401.

type ProfileRow = { identifier: string; plan: Plan; name: string | null };

// LOW-16: deterministic resolution when an identifier could match more than one
// row — prefer the exact match, then the oldest — instead of an arbitrary LIMIT 1.
async function loadProfile(identifier: string): Promise<ProfileRow | null> {
  const rows = await dbQuery<ProfileRow>(
    "SELECT identifier, plan, name FROM profiles WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1 ORDER BY (identifier = $1) DESC, created_at ASC LIMIT 1",
    [identifier]
  );
  return rows[0] ?? null;
}

type AuthRow = { identifier: string; plan: Plan; name: string | null; password_hash: string | null; activated_at: string | null };

async function loadAuthRow(identifier: string): Promise<AuthRow | null> {
  const rows = await dbQuery<AuthRow>(
    "SELECT identifier, plan, name, password_hash, activated_at FROM profiles WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1 ORDER BY (identifier = $1) DESC, created_at ASC LIMIT 1",
    [identifier]
  );
  return rows[0] ?? null;
}

function issueSession(profile: ProfileRow): NextResponse {
  const res = NextResponse.json(
    { identifier: profile.identifier, plan: profile.plan, name: profile.name },
    { headers: { "cache-control": "no-store" } }
  );
  res.cookies.set(SESSION_COOKIE, signSession(profile.identifier), SESSION_COOKIE_OPTIONS);
  return res;
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
  // MEDIUM-13: brute-force / credential-stuffing limiter on the auth surface
  // (best-effort per serverless instance).
  if (rateLimit(`auth:${clientIp(req)}`, 20, 60_000)) {
    return NextResponse.json({ error: "too many requests, slow down" }, { status: 429 });
  }
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

  // ── Password auth (register / login) ──────────────────────────────────────
  const identifier = normalizeIdentifier(body.identifier ?? body.email);
  if (!identifier || !identifier.includes("@")) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ error: `password must be at least ${MIN_PASSWORD_LENGTH} characters` }, { status: 400 });
  }

  const existing = await loadAuthRow(identifier);

  // An admin_full profile never gets a session via the public path — even with
  // the right password. Admin sessions come only from /api/founder/grant.
  if (existing?.plan === "admin_full") {
    return NextResponse.json({ error: "this profile requires founder access" }, { status: 403 });
  }

  const lang: "it" | "en" = typeof body.language === "string" && body.language === "en" ? "en" : "it";

  // "resend_activation": re-send the activation email for a not-yet-activated
  // account. Never reveals whether the email exists (always 200).
  if (action === "resend_activation") {
    // admin_full already returned 403 above; only resend for not-yet-activated.
    if (existing && !existing.activated_at) {
      try { await sendActivation(req, existing.identifier, lang); }
      catch (e) { console.error("[auth] resend activation failed:", String(e)); }
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "register") {
    // Already a usable (activated) account → tell them to log in.
    if (existing?.password_hash && existing.activated_at) {
      return NextResponse.json({ error: "account already exists — please log in" }, { status: 409 });
    }
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : null;
    const language = typeof body.language === "string" ? body.language.slice(0, 16) : null;
    const timezone = typeof body.timezone === "string" ? body.timezone.slice(0, 64) : null;
    // #MB-1 influencer attribution: optional ref code from a Match Builder
    // share link (first-touch — never overwrites an existing referred_by).
    const rawRef = typeof body.ref === "string" ? body.ref.trim().toUpperCase().slice(0, 20) : "";
    const referredBy = /^[A-Z0-9_-]{2,20}$/.test(rawRef) ? rawRef : null;
    // HIGH-3: set the password but DO NOT activate or issue a session here. The
    // profile becomes usable only after the email-activation link is clicked —
    // this is what prevents a legacy (passwordless) profile from being claimed
    // by anyone who simply knows the email. activated_at is left untouched
    // (NULL for new/legacy rows; a real activated account never reaches here).
    try {
      await dbExecute(
        `INSERT INTO profiles (identifier, name, language, timezone, plan, password_hash, referred_by)
         VALUES ($1, $2, $3, $4, 'free', $5, $6)
       ON CONFLICT (identifier) DO UPDATE
         SET name = COALESCE(EXCLUDED.name, profiles.name),
             language = COALESCE(EXCLUDED.language, profiles.language),
             timezone = COALESCE(EXCLUDED.timezone, profiles.timezone),
             password_hash = EXCLUDED.password_hash,
             referred_by = COALESCE(profiles.referred_by, EXCLUDED.referred_by),
             updated_at = NOW()`,
        [identifier, name, language, timezone, hashPassword(password), referredBy]
      );
    } catch (e) {
      console.error("[auth] register failed:", String(e));
      return NextResponse.json({ error: "registration failed" }, { status: 500 });
    }
    try {
      await sendActivation(req, identifier, lang);
    } catch (e) {
      console.error("[auth] activation email failed:", String(e));
      return NextResponse.json({ error: "activation email failed" }, { status: 502 });
    }
    return NextResponse.json({ pending_activation: true, identifier }, { status: 202 });
  }

  // action === "login" (default)
  // MEDIUM-13: don't enumerate accounts — "no account" and "wrong password"
  // return the SAME generic 401 (new users use the register tab).
  if (!existing) {
    return NextResponse.json({ error: "wrong email or password" }, { status: 401 });
  }
  // No password set, or password set but never activated → cannot log in. This
  // closes the legacy-claim takeover: there is no path that turns a known email
  // into a session without clicking the activation link sent to that inbox.
  if (!existing.password_hash || !existing.activated_at) {
    return NextResponse.json(
      { error: "activation_required", message: "Conferma il tuo indirizzo email per attivare il profilo." },
      { status: 403 }
    );
  }
  if (!verifyPassword(password, existing.password_hash)) {
    return NextResponse.json({ error: "wrong email or password" }, { status: 401 });
  }

  const profile = await loadProfile(identifier);
  if (!profile) {
    return NextResponse.json({ error: "login failed" }, { status: 500 });
  }
  return issueSession(profile);
}

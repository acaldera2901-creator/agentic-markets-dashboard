import { NextResponse } from "next/server";
import { dbQuery, dbExecute } from "@/lib/db";
import { signSession, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/session";
import { getSessionPlan, type Plan } from "@/lib/auth";
import { normalizeIdentifier } from "@/lib/admin-profile-policy";
import { normalizeCheckoutPlan } from "@/lib/commercial-plan";
import { paymentReceivedEmail, activationEmail, passwordResetEmail } from "@/lib/email";
import { sendTransactional } from "@/lib/notify";
import { hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from "@/lib/password";
import { siteOrigin, newActivationToken, newResetToken } from "@/lib/activation";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { assertConsent, ConsentError } from "./consent";
import { CURRENT_CONSENT_VERSION } from "@/lib/legal-version";

export const dynamic = "force-dynamic";

// #PRELAUNCH-AUDIT: hash scrypt costante per equalizzare il timing del login quando
// l'account NON esiste (verifyPassword su questo esegue lo stesso scrypt ~50ms di un
// account reale → niente oracolo di enumerazione via timing). Calcolato una volta.
const TIMING_DUMMY_HASH = hashPassword("timing-equalizer-not-a-real-account");

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
  // throwOnError: registration must fail loud if the activation email can't be
  // delivered (otherwise the account is unreachable). The send is still recorded.
  await sendTransactional({
    type: "activation",
    to: identifier,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    from: mail.from,
    replyTo: mail.replyTo,
    throwOnError: true,
  });
}

// Email-confirmation gate (HIGH-3). Required ONLY when we can actually send mail
// (RESEND_API_KEY present) and it isn't explicitly disabled. Without a mail
// provider we cannot confirm by email, so register/login auto-activate to keep
// signup→login→checkout usable. Setting RESEND_API_KEY (+ a verified RESEND_FROM
// domain) re-enables the gate automatically — no code change needed.
function emailActivationRequired(): boolean {
  return process.env.AUTH_REQUIRE_EMAIL_ACTIVATION !== "false" && !!process.env.RESEND_API_KEY;
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
    { identifier: ctx.identifier, plan: ctx.plan, name: ctx.name, plan_expires_at: ctx.plan_expires_at },
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
    // MEDIUM-11: revoke server-side too — bump sessions_valid_from so a copy of
    // this cookie (iat < now) is rejected on its next use, not just cleared in
    // this browser. Best-effort: never block logout on the write.
    const ctx = await getSessionPlan(req).catch(() => null);
    if (ctx) {
      try {
        await dbExecute(
          "UPDATE profiles SET sessions_valid_from = NOW(), updated_at = NOW() WHERE identifier = $1",
          [ctx.identifier]
        );
      } catch (e) { console.error("[auth] logout revoke failed:", String(e)); }
    }
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
      await sendTransactional({
        type: "payment_received",
        to: ctx.identifier,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        meta: { requested_plan: requested },
      });
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

  // "forgot_password": email a one-time reset link. Handled BEFORE the password
  // checks below (the user has no password to type). Never enumerates accounts —
  // always returns 200, and only a real account with a password set (and not an
  // admin) actually receives a link.
  if (action === "forgot_password") {
    const id = normalizeIdentifier(body.identifier ?? body.email);
    const resetLang: "it" | "en" = typeof body.language === "string" && body.language === "en" ? "en" : "it";
    if (id && id.includes("@")) {
      const row = await loadAuthRow(id);
      if (row && row.password_hash && row.plan !== "admin_full") {
        try {
          const { token, hash, expiresIso } = newResetToken();
          await dbExecute(
            "UPDATE profiles SET reset_token_hash = $2, reset_token_expires = $3, updated_at = NOW() WHERE identifier = $1",
            [row.identifier, hash, expiresIso]
          );
          const url = `${siteOrigin(req)}/reset-password?token=${token}&id=${encodeURIComponent(row.identifier)}`;
          const mail = passwordResetEmail(url, resetLang);
          // Best-effort: a non-deliverable reset email must not reveal (via a 500)
          // that the account exists. The attempt is still recorded in notifications.
          await sendTransactional({
            type: "password_reset", to: row.identifier,
            subject: mail.subject, html: mail.html, text: mail.text,
            from: mail.from, replyTo: mail.replyTo,
          });
        } catch (e) { console.error("[auth] forgot_password failed:", String(e)); }
      }
    }
    return NextResponse.json({ ok: true });
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
    // #SP3-2 compliance gate: +18/ToS consent is enforced server-side, not just
    // in the UI — a direct API call must not be able to skip it. No profile is
    // created/touched until both flags are confirmed true.
    try {
      assertConsent(body);
    } catch (e) {
      if (e instanceof ConsentError) {
        return NextResponse.json({ error: "consent_required" }, { status: 400 });
      }
      throw e;
    }
    // Already a usable (activated) account → tell them to log in.
    if (existing?.password_hash && existing.activated_at) {
      return NextResponse.json({ error: "account already exists — please log in" }, { status: 409 });
    }
    // #PRELAUNCH-AUDIT HIGH-5 (account takeover): se una riga ESISTE già per questa
    // email (legacy passwordless / mai attivata / piano impostato da backoffice), il
    // register NON deve sovrascrivere la password né aprire una sessione — altrimenti
    // chiunque conosca l'email potrebbe rivendicare la riga (soprattutto a email-gate
    // OFF: register auto-sessione, e login gate-off logga con password_hash anche senza
    // activated_at). Richiediamo la prova del possesso della inbox: mandiamo il link di
    // attivazione, senza toccare password/piano. Solo un INSERT genuinamente NUOVO (else
    // sotto) può ottenere sessione immediata / setup password.
    if (existing) {
      // GDPR A1-B1 (accountability, Art. 7(1)/5(2)): assertConsent() above already
      // confirmed age_confirmed/tos_accepted === true for THIS request, so consent
      // was genuinely given — but for a legacy/existing row we must still persist
      // the proof (timestamp + version), otherwise it's unrecoverable later. COALESCE
      // never overwrites an earlier consent record; this only fills gaps.
      try {
        await dbExecute(
          `UPDATE profiles SET
             age_confirmed_at = COALESCE(age_confirmed_at, NOW()),
             tos_accepted_at = COALESCE(tos_accepted_at, NOW()),
             consent_version = COALESCE(consent_version, $2)
           WHERE identifier = $1`,
          [identifier, CURRENT_CONSENT_VERSION]
        );
      } catch (e) {
        console.error("[auth] register(existing-row) consent persist failed:", String(e));
      }
      try {
        await sendActivation(req, identifier, lang);
      } catch (e) {
        console.error("[auth] register(existing-row) activation email failed:", String(e));
      }
      // 202 identico al ramo new+gate-on → nessuna enumerazione di account esistenti.
      return NextResponse.json({ pending_activation: true, identifier }, { status: 202 });
    }
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : null;
    const language = typeof body.language === "string" ? body.language.slice(0, 16) : null;
    const timezone = typeof body.timezone === "string" ? body.timezone.slice(0, 64) : null;
    // #MB-1 influencer attribution: optional ref code from a Match Builder
    // share link (first-touch — never overwrites an existing referred_by).
    const rawRef = typeof body.ref === "string" ? body.ref.trim().toUpperCase().slice(0, 20) : "";
    const referredBy = /^[A-Z0-9_-]{2,20}$/.test(rawRef) ? rawRef : null;
    // Consenso marketing FACOLTATIVO dal signup (#CRM-LIFECYCLE): sblocca i flussi
    // CRM acquisition. Si registra anche il timestamp come prova del consenso.
    const marketingOptIn = body.marketing_opt_in === true;
    // HIGH-3: set the password but DO NOT activate or issue a session here. The
    // profile becomes usable only after the email-activation link is clicked —
    // this is what prevents a legacy (passwordless) profile from being claimed
    // by anyone who simply knows the email. activated_at is left untouched
    // (NULL for new/legacy rows; a real activated account never reaches here).
    try {
      await dbExecute(
        // Solo account NUOVI arrivano qui (le righe esistenti sono già gestite sopra
        // con il link di attivazione, senza toccare la password). ON CONFLICT DO NOTHING
        // è puro race-guard: in caso di doppia submit concorrente NON si sovrascrive mai
        // una riga esistente (niente takeover via race).
        `INSERT INTO profiles (identifier, name, language, timezone, plan, password_hash, referred_by, marketing_opt_in, marketing_opt_in_at, age_confirmed_at, tos_accepted_at, consent_version)
         VALUES ($1, $2, $3, $4, 'free', $5, $6, $7, CASE WHEN $7 THEN NOW() ELSE NULL END, NOW(), NOW(), $8)
       ON CONFLICT (identifier) DO NOTHING`,
        [identifier, name, language, timezone, hashPassword(password), referredBy, marketingOptIn, CURRENT_CONSENT_VERSION]
      );
    } catch (e) {
      console.error("[auth] register failed:", String(e));
      return NextResponse.json({ error: "registration failed" }, { status: 500 });
    }
    // When email confirmation isn't available, auto-activate + sign in (the
    // pre-HIGH-3 behavior) so signup→login→checkout work without a mail provider.
    if (!emailActivationRequired()) {
      await dbExecute(
        "UPDATE profiles SET activated_at = NOW(), updated_at = NOW() WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1",
        [identifier]
      );
      const profile = await loadProfile(identifier);
      if (!profile) return NextResponse.json({ error: "registration failed" }, { status: 500 });
      return issueSession(profile);
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
    // #PRELAUNCH-AUDIT: equalizza il timing — un account reale esegue scrypt (~50ms)
    // in verifyPassword; senza questo, il ramo "nessun account" tornava istantaneo e
    // rivelava (per timing) quali email sono registrate. Dummy verify su hash costante.
    verifyPassword(password, TIMING_DUMMY_HASH);
    return NextResponse.json({ error: "wrong email or password" }, { status: 401 });
  }
  // No password set, or password set but never activated → cannot log in. This
  // closes the legacy-claim takeover: there is no path that turns a known email
  // into a session without clicking the activation link sent to that inbox.
  // No password set → cannot log in (must register). When the email gate is on,
  // an unconfirmed account also can't log in until the activation link is clicked.
  if (!existing.password_hash || (!existing.activated_at && emailActivationRequired())) {
    return NextResponse.json(
      { error: "activation_required", message: "Conferma il tuo indirizzo email per attivare il profilo." },
      { status: 403 }
    );
  }
  if (!verifyPassword(password, existing.password_hash)) {
    return NextResponse.json({ error: "wrong email or password" }, { status: 401 });
  }
  // Email gate off: lazily activate a never-confirmed row on first valid login
  // (heals rows created during the no-email window, e.g. failed registrations).
  if (!existing.activated_at) {
    await dbExecute(
      "UPDATE profiles SET activated_at = NOW(), updated_at = NOW() WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1",
      [identifier]
    );
  }

  const profile = await loadProfile(identifier);
  if (!profile) {
    return NextResponse.json({ error: "login failed" }, { status: 500 });
  }
  return issueSession(profile);
}

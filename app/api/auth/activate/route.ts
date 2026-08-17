import { NextResponse } from "next/server";
import { dbQuery, dbExecute } from "@/lib/db";
import { signSession, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/session";
import { siteOrigin, hashActivationToken, tokenHashMatches } from "@/lib/activation";
import { welcomeEmail } from "@/lib/email";
import { sendTransactional } from "@/lib/notify";
import { grantInviteeBonus } from "@/lib/referral-rewards";
import { enterResendOnboarding } from "@/lib/resend-contacts";

export const dynamic = "force-dynamic";

// HIGH-3: account activation. The user lands here from the link in the
// activation email. We verify the token (only its SHA-256 hash is stored),
// mark the profile activated, drop the token, issue the session cookie, and
// redirect into the app. An expired/invalid/missing token never activates.

type Row = {
  identifier: string;
  activated_at: string | null;
  activation_token_hash: string | null;
  activation_token_expires: string | null;
  language: string | null;
  marketing_opt_in: boolean | null;
};

function redirect(req: Request, query: string): NextResponse {
  return NextResponse.redirect(`${siteOrigin(req)}/${query}`);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const id = (url.searchParams.get("id") ?? "").trim().toLowerCase();
  if (!token || !id) return redirect(req, "?activation=invalid");

  const rows = await dbQuery<Row>(
    "SELECT identifier, activated_at, activation_token_hash, activation_token_expires, language, marketing_opt_in FROM profiles WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1 LIMIT 1",
    [id]
  );
  const row = rows[0];
  if (!row) return redirect(req, "?activation=invalid");

  // Already activated → just send them in to log in normally.
  if (row.activated_at) return redirect(req, "?activation=already");

  if (!row.activation_token_hash || !row.activation_token_expires) {
    return redirect(req, "?activation=invalid");
  }
  if (new Date(row.activation_token_expires).getTime() < Date.now()) {
    return redirect(req, "?activation=expired");
  }

  if (!tokenHashMatches(hashActivationToken(token), row.activation_token_hash)) {
    return redirect(req, "?activation=invalid");
  }

  try {
    await dbExecute(
      "UPDATE profiles SET activated_at = NOW(), activation_token_hash = NULL, activation_token_expires = NULL, updated_at = NOW() WHERE identifier = $1",
      [row.identifier]
    );
  } catch (e) {
    console.error("[auth/activate] activation write failed:", String(e));
    return redirect(req, "?activation=error");
  }

  // #REFERRAL-V2-0808 — i 7 giorni di PRO all'invitato: questo è il percorso di
  // attivazione normale (link email). Si concede QUI e non all'INSERT del
  // profilo, che nasce plan='free' e non è usabile fino a questo click: un
  // regalo concesso alla registrazione scadrebbe prima che l'utente entri.
  // L'helper valida `referred_by` contro un `profiles.referral_code` reale (alla
  // registrazione passa solo la regex) e lo concede una volta sola.
  // Best-effort: un bonus mancato non deve costare l'attivazione dell'account.
  try {
    await grantInviteeBonus(row.identifier);
  } catch (e) {
    console.error("[auth/activate] bonus invitato fallito:", String(e));
  }

  // Welcome email — first email after a successful signup→activation. Best-effort
  // (recorded in `notifications`); never blocks the redirect / session.
  if (row.identifier.includes("@")) {
    // Lingua reale del profilo: welcomeEmail copre it/en/es/fr/ru e normalizza da sé
    // (prima qualsiasi lingua diversa da "en" veniva schiacciata su italiano).
    const mail = welcomeEmail((row.language ?? "it").slice(0, 2).toLowerCase());
    await sendTransactional({
      type: "welcome",
      to: row.identifier,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });

    // #CRM-RESEND-ENGINE-0817 — innesca l'automation `Onboarding_Automation` su
    // Resend, che da qui in avanti possiede la sequenza di acquisition (g2/g4/g7
    // i testi di Steve, g10/g21/g28 le offerte, g35 il congedo). Senza questo
    // evento l'automation resta a zero run: le Automations si innescano SOLO su
    // `POST /events/send`, mai su un invio transazionale.
    //
    // Il consenso si verifica QUI e non su Resend: l'evento crea il contatto in
    // Audience, quindi è già trattamento marketing, e la sequenza è conversione
    // verso free mai paganti — che il soft opt-in non copre (verdetto
    // legale-compliance 2026-06-28). Chi non ha spuntato la casella al signup
    // riceve attivazione e welcome (servizio) e nient'altro: è una decisione di
    // Andrea del 17/08, non una dimenticanza.
    //
    // Fail-closed sul dato mancante: solo `=== true` spara. Best-effort come la
    // welcome sopra — un errore di Resend non deve costare l'attivazione.
    if (row.marketing_opt_in === true) {
      try {
        // #CRM-RESEND-CONTACT-FIRST-0817 — contatto con le properties prima,
        // evento dopo: l'ordine vive in `enterResendOnboarding` proprio perché è
        // la cosa che si rompe se qualcuno riordina due righe qui.
        await enterResendOnboarding(row.identifier);
      } catch (e) {
        console.error("[auth/activate] ingresso automation Resend fallito:", String(e));
      }
    }
  }

  // Activated → issue the session cookie and land on the board.
  const res = redirect(req, "?activated=1");
  res.cookies.set(SESSION_COOKIE, signSession(row.identifier), SESSION_COOKIE_OPTIONS);
  return res;
}

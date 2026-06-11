// Transactional email via the Resend REST API (no SDK dependency — one fetch).
// Used for customer OTP login codes. Fails loud to the caller so the auth route
// can return a real error instead of silently "sending" nothing.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

// Contact / sender identity for account emails. Andrea: le mail di attivazione
// passano da questa casella. Resend richiede un dominio verificato per il `from`:
// se ACTIVATION_FROM punta a un mittente verificato (es. il dominio collegato a
// questa Gmail) lo usa; altrimenti invia dal RESEND_FROM verificato e mette
// comunque la Gmail come reply-to + contatto nel corpo.
export const ACCOUNT_CONTACT_EMAIL = "agenticmarketscb@gmail.com";

function fromAddress(): string {
  // e.g. "BetRedge <login@agenticmarkets.com>"
  return process.env.RESEND_FROM || "BetRedge <onboarding@resend.dev>";
}

function activationFromAddress(): string {
  // Verified sender for activation mail; defaults to the gmail contact name but
  // falls back to the verified RESEND_FROM domain so a send never hard-fails.
  return process.env.ACTIVATION_FROM || fromAddress();
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not configured");

  const resp = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: opts.from || fromAddress(),
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
    }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Resend send failed: ${resp.status} ${body.slice(0, 200)}`);
  }
}

// Account activation (HIGH-3): the link the user must click to activate their
// profile and set a usable session. Sent from the account contact mailbox.
export function activationEmail(activateUrl: string, lang: "it" | "en" = "it"): {
  subject: string; html: string; text: string; from: string; replyTo: string;
} {
  const it = lang === "it";
  const subject = it ? "Attiva il tuo profilo BetRedge" : "Activate your BetRedge profile";
  const intro = it
    ? "Per completare la registrazione e proteggere il tuo account, conferma il tuo indirizzo email. Il link scade tra 1 ora."
    : "To finish signing up and secure your account, confirm your email address. The link expires in 1 hour.";
  const cta = it ? "Attiva il profilo" : "Activate profile";
  const ignore = it
    ? `Se non hai creato un account, ignora questa email o scrivici a ${ACCOUNT_CONTACT_EMAIL}.`
    : `If you didn't create an account, ignore this email or write to us at ${ACCOUNT_CONTACT_EMAIL}.`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#0f172a">
  <p style="font-size:13px;color:#64748b;letter-spacing:.08em;text-transform:uppercase;margin:0 0 8px">BetRedge</p>
  <p style="font-size:14px;line-height:1.5;margin:0 0 16px">${intro}</p>
  <a href="${activateUrl}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#0f172a;color:#fff;text-decoration:none;font-size:14px;font-weight:600">${cta}</a>
  <p style="font-size:12px;color:#94a3b8;margin:18px 0 0;word-break:break-all">${activateUrl}</p>
  <p style="font-size:12px;color:#94a3b8;margin:12px 0 0">${ignore}</p>
</div>`;
  const text = `${intro}\n\n${cta}: ${activateUrl}\n\n${ignore}`;
  return { subject, html, text, from: activationFromAddress(), replyTo: ACCOUNT_CONTACT_EMAIL };
}

function shell(bodyHtml: string): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#0f172a">
  <p style="font-size:13px;color:#64748b;letter-spacing:.08em;text-transform:uppercase;margin:0 0 8px">BetRedge</p>
  ${bodyHtml}
</div>`;
}

// Payment received → plan in review (GAP4).
export function paymentReceivedEmail(lang = "it"): { subject: string; html: string; text: string } {
  const it = lang !== "en";
  const subject = it ? "Pagamento ricevuto — in verifica" : "Payment received — under review";
  const body = it
    ? "Abbiamo ricevuto la tua richiesta di Signal Desk Pro. Verifichiamo la transazione on-chain e attiviamo il piano entro 12 ore. Ti avvisiamo appena è attivo."
    : "We received your Signal Desk Pro request. We're verifying the on-chain transaction and will activate your plan within 12 hours. We'll email you when it's live.";
  return { subject, html: shell(`<p style="font-size:14px;line-height:1.5">${body}</p>`), text: body };
}

// Plan activated (GAP4).
export function planActivatedEmail(expiresAtISO: string | null, lang = "it"): { subject: string; html: string; text: string } {
  const it = lang !== "en";
  const until = expiresAtISO ? new Date(expiresAtISO).toLocaleDateString(it ? "it-IT" : "en-GB") : null;
  const subject = it ? "Signal Desk Pro attivato ✅" : "Signal Desk Pro activated ✅";
  const body = it
    ? `Il tuo Signal Desk Pro è attivo${until ? ` fino al ${until}` : ""}. Hai accesso completo a segnali e probabilità calibrate.`
    : `Your Signal Desk Pro is active${until ? ` until ${until}` : ""}. You now have full access to the signals and calibrated probabilities.`;
  const cta = it ? "Apri il desk" : "Open the desk";
  return {
    subject,
    html: shell(`<p style="font-size:14px;line-height:1.5">${body}</p><a href="https://agentic-markets-roan.vercel.app/" style="display:inline-block;margin-top:12px;padding:10px 18px;border-radius:8px;background:#0f172a;color:#fff;text-decoration:none;font-size:13px">${cta}</a>`),
    text: body,
  };
}

export function otpEmail(code: string, lang: "it" | "en" = "it"): { subject: string; html: string; text: string } {
  const it = lang === "it";
  const subject = it
    ? `${code} — il tuo codice di accesso BetRedge`
    : `${code} — your BetRedge login code`;
  const intro = it
    ? "Usa questo codice per accedere al tuo Signal Desk. Scade tra 10 minuti."
    : "Use this code to sign in to your Signal Desk. It expires in 10 minutes.";
  const ignore = it
    ? "Se non hai richiesto questo codice, ignora questa email."
    : "If you didn't request this code, you can ignore this email.";
  const html = `<div style="font-family:system-ui,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#0f172a">
  <p style="font-size:13px;color:#64748b;letter-spacing:.08em;text-transform:uppercase;margin:0 0 8px">BetRedge</p>
  <p style="font-size:14px;margin:0 0 16px">${intro}</p>
  <div style="font-size:34px;font-weight:800;letter-spacing:.3em;font-family:ui-monospace,monospace;background:#f1f5f9;border-radius:10px;padding:18px;text-align:center;color:#0f172a">${code}</div>
  <p style="font-size:12px;color:#94a3b8;margin:16px 0 0">${ignore}</p>
</div>`;
  const text = `${code}\n\n${intro}\n\n${ignore}`;
  return { subject, html, text };
}

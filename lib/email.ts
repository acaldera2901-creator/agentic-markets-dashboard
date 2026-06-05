// Transactional email via the Resend REST API (no SDK dependency — one fetch).
// Used for customer OTP login codes. Fails loud to the caller so the auth route
// can return a real error instead of silently "sending" nothing.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function fromAddress(): string {
  // e.g. "Agentic Markets <login@agenticmarkets.com>"
  return process.env.RESEND_FROM || "Agentic Markets <onboarding@resend.dev>";
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not configured");

  const resp = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromAddress(),
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Resend send failed: ${resp.status} ${body.slice(0, 200)}`);
  }
}

function shell(bodyHtml: string): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#0f172a">
  <p style="font-size:13px;color:#64748b;letter-spacing:.08em;text-transform:uppercase;margin:0 0 8px">Agentic Markets</p>
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
    ? `${code} — il tuo codice di accesso Agentic Markets`
    : `${code} — your Agentic Markets login code`;
  const intro = it
    ? "Usa questo codice per accedere al tuo Signal Desk. Scade tra 10 minuti."
    : "Use this code to sign in to your Signal Desk. It expires in 10 minutes.";
  const ignore = it
    ? "Se non hai richiesto questo codice, ignora questa email."
    : "If you didn't request this code, you can ignore this email.";
  const html = `<div style="font-family:system-ui,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#0f172a">
  <p style="font-size:13px;color:#64748b;letter-spacing:.08em;text-transform:uppercase;margin:0 0 8px">Agentic Markets</p>
  <p style="font-size:14px;margin:0 0 16px">${intro}</p>
  <div style="font-size:34px;font-weight:800;letter-spacing:.3em;font-family:ui-monospace,monospace;background:#f1f5f9;border-radius:10px;padding:18px;text-align:center;color:#0f172a">${code}</div>
  <p style="font-size:12px;color:#94a3b8;margin:16px 0 0">${ignore}</p>
</div>`;
  const text = `${code}\n\n${intro}\n\n${ignore}`;
  return { subject, html, text };
}

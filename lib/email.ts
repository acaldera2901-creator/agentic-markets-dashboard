// Transactional email via the Resend REST API (no SDK dependency — one fetch).
// Used for customer OTP login codes. Fails loud to the caller so the auth route
// can return a real error instead of silently "sending" nothing.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

// Contact / sender identity for account emails. Andrea: le mail di attivazione
// passano da questa casella. Resend richiede un dominio verificato per il `from`:
// se ACTIVATION_FROM punta a un mittente verificato (es. il dominio collegato a
// questa Gmail) lo usa; altrimenti invia dal RESEND_FROM verificato e mette
// comunque la Gmail come reply-to + contatto nel corpo.
export const ACCOUNT_CONTACT_EMAIL =
  process.env.ACCOUNT_CONTACT_EMAIL || "agenticmarketscb@gmail.com";

function fromAddress(): string {
  // e.g. "BetRedge <noreply@betredge.com>". Set RESEND_FROM to a verified domain
  // in prod; the resend.dev sandbox default only works for test sends.
  return process.env.RESEND_FROM || "BetRedge <onboarding@resend.dev>";
}

function activationFromAddress(): string {
  // Verified sender for activation mail; defaults to the gmail contact name but
  // falls back to the verified RESEND_FROM domain so a send never hard-fails.
  return process.env.ACTIVATION_FROM || fromAddress();
}

// Public site origin used for email CTA links. Defaults to the production domain
// so links never point at a stale preview deploy.
function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://betredge.com").replace(/\/$/, "");
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
  headers?: Record<string, string>;
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
      ...(opts.headers ? { headers: opts.headers } : {}),
    }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Resend send failed: ${resp.status} ${body.slice(0, 200)}`);
  }
}

// ── Branded shell (#EMAIL-BRAND-0701) ────────────────────────────────────────
// Porta nel codice il design del template Resend "Welcome to BETREDGE": header
// col logo su fondo scuro, container 600px table-based (email-safe, regge Outlook),
// accento verde. Le immagini sono nostre, servite da betredge.com/banners/email/.
// `hero:true` mostra in più il banner "Your first edge is ready" (mail welcome).
const BRAND = { bg: "#060708", card: "#0e1417", green: "#23A559", head: "#ffffff", text: "#cdd6dd", muted: "#8b98a4" };
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function logoUrl(): string { return `${siteUrl()}/banners/email/logo.jpg`; }
function heroUrl(): string { return `${siteUrl()}/banners/email/hero.jpg`; }

// CTA verde, leggibile su fondo scuro. Sostituisce i vecchi bottoni #0f172a
// (invisibili su sfondo scuro).
export function brandCta(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:18px;padding:13px 24px;border-radius:8px;background:${BRAND.green};color:#04140b;text-decoration:none;font-size:14px;font-weight:700;font-family:${FONT}">${label}</a>`;
}
// Helper testo/titolo dentro la card (colori chiari su scuro).
export function brandHeading(t: string): string {
  return `<p style="margin:0 0 12px;color:${BRAND.head};font-size:20px;font-weight:700;font-family:${FONT}">${t}</p>`;
}
export function brandText(t: string): string {
  return `<p style="margin:0 0 14px;color:${BRAND.text};font-size:14px;line-height:1.6;font-family:${FONT}">${t}</p>`;
}

function defaultFooter(lang: "it" | "en"): string {
  const it = lang !== "en";
  const tagline = it ? "Il tuo vantaggio in ogni scommessa" : "Your edge in every bet";
  const year = new Date().getFullYear();
  return `<p style="margin:0 0 4px;color:#c7d0d8;font-weight:600">The BetRedge Team</p>
  <p style="margin:0">${tagline}</p>
  <p style="margin:8px 0 0">© ${year} BetRedge · <a href="mailto:${ACCOUNT_CONTACT_EMAIL}" style="color:${BRAND.muted};text-decoration:underline">${ACCOUNT_CONTACT_EMAIL}</a></p>`;
}

// Wrapper condiviso da tutte le email. `footerHtml` permette al CRM di passare il
// footer legale conforme (mittente/disclaimer/unsubscribe); se assente usa il
// footer transazionale minimale (le mail account non sono marketing).
export function brandedShell(
  bodyHtml: string,
  opts: { hero?: boolean; footerHtml?: string; lang?: "it" | "en" | "es" | "fr" | "ru" } = {}
): string {
  const { hero = false, footerHtml, lang = "it" } = opts;
  // defaultFooter resta it/en (mail transazionali account); il CRM 5-lingue passa sempre footerHtml.
  const footer = footerHtml ?? defaultFooter(lang === "en" ? "en" : "it");
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:0;background:${BRAND.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.bg};padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;">
      <tr><td align="center" style="padding:6px 0 18px;">
        <img src="${logoUrl()}" alt="BetRedge" width="176" style="display:block;width:176px;max-width:58%;height:auto;border:0;" />
      </td></tr>
      ${hero ? `<tr><td style="padding:0 0 14px;"><img src="${heroUrl()}" alt="" width="600" style="display:block;width:100%;height:auto;border-radius:12px;border:0;" /></td></tr>` : ``}
      <tr><td style="background:${BRAND.card};border-radius:14px;padding:28px 26px;">
        ${bodyHtml}
      </td></tr>
      <tr><td style="padding:20px 10px 6px;color:${BRAND.muted};font-size:12px;line-height:1.5;text-align:center;font-family:${FONT}">
        ${footer}
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
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
  const body = `${brandText(intro)}${brandCta(cta, activateUrl)}
  <p style="font-size:12px;color:${BRAND.muted};margin:18px 0 0;word-break:break-all;font-family:${FONT}">${activateUrl}</p>
  <p style="font-size:12px;color:${BRAND.muted};margin:12px 0 0;font-family:${FONT}">${ignore}</p>`;
  const html = brandedShell(body, { hero: true, lang });
  const text = `${intro}\n\n${cta}: ${activateUrl}\n\n${ignore}`;
  return { subject, html, text, from: activationFromAddress(), replyTo: ACCOUNT_CONTACT_EMAIL };
}

// Password reset: the link the user clicks to set a new password. Like
// activation, sent from the account contact mailbox; the link carries a one-time
// token (only its hash is stored) and expires in 1 hour.
export function passwordResetEmail(resetUrl: string, lang: "it" | "en" = "it"): {
  subject: string; html: string; text: string; from: string; replyTo: string;
} {
  const it = lang === "it";
  const subject = it ? "Reimposta la tua password BetRedge" : "Reset your BetRedge password";
  const intro = it
    ? "Hai chiesto di reimpostare la password. Clicca qui sotto per sceglierne una nuova. Il link scade tra 1 ora."
    : "You asked to reset your password. Click below to choose a new one. The link expires in 1 hour.";
  const cta = it ? "Reimposta la password" : "Reset password";
  const ignore = it
    ? `Se non hai richiesto tu il reset, ignora questa email: la password resta invariata. Per dubbi scrivici a ${ACCOUNT_CONTACT_EMAIL}.`
    : `If you didn't request this, ignore this email — your password stays unchanged. Questions? Write to us at ${ACCOUNT_CONTACT_EMAIL}.`;
  const body = `${brandText(intro)}${brandCta(cta, resetUrl)}
  <p style="font-size:12px;color:${BRAND.muted};margin:18px 0 0;word-break:break-all;font-family:${FONT}">${resetUrl}</p>
  <p style="font-size:12px;color:${BRAND.muted};margin:12px 0 0;font-family:${FONT}">${ignore}</p>`;
  const html = brandedShell(body, { lang });
  const text = `${intro}\n\n${cta}: ${resetUrl}\n\n${ignore}`;
  return { subject, html, text, from: activationFromAddress(), replyTo: ACCOUNT_CONTACT_EMAIL };
}

export function otpEmail(code: string, lang: "it" | "en" = "it"): { subject: string; html: string; text: string } {
  const it = lang === "it";
  const subject = it
    ? `${code} — il tuo codice di accesso BetRedge`
    : `${code} — your BetRedge login code`;
  const intro = it
    ? "Usa questo codice per accedere al tuo BetRedge. Scade tra 10 minuti."
    : "Use this code to sign in to your BetRedge. It expires in 10 minutes.";
  const ignore = it
    ? "Se non hai richiesto questo codice, ignora questa email."
    : "If you didn't request this code, you can ignore this email.";
  const body = `${brandText(intro)}
  <div style="font-size:32px;font-weight:800;letter-spacing:.3em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#0a0f12;border:1px solid rgba(35,165,89,.35);border-radius:10px;padding:18px;text-align:center;color:#ffffff">${code}</div>
  <p style="font-size:12px;color:${BRAND.muted};margin:16px 0 0;font-family:${FONT}">${ignore}</p>`;
  const html = brandedShell(body, { lang });
  const text = `${code}\n\n${intro}\n\n${ignore}`;
  return { subject, html, text };
}

// ── Lifecycle / account emails ───────────────────────────────────────────────
// All bilingual (it default / en), share brandedShell(), and are sent via
// sendTransactional() (lib/notify.ts) so each send is recorded in `notifications`.

// Payment received → plan in review (GAP4).
export function paymentReceivedEmail(lang = "it"): { subject: string; html: string; text: string } {
  const it = lang !== "en";
  const subject = it ? "Pagamento ricevuto — in verifica" : "Payment received — under review";
  const body = it
    ? "Abbiamo ricevuto la tua richiesta di BetRedge Pro. Verifichiamo la transazione on-chain e attiviamo il piano entro 12 ore. Ti avvisiamo appena è attivo."
    : "We received your BetRedge Pro request. We're verifying the on-chain transaction and will activate your plan within 12 hours. We'll email you when it's live.";
  return {
    subject,
    html: brandedShell(brandText(body), { lang: it ? "it" : "en" }),
    text: body,
  };
}

// Plan activated (GAP4). #CRYPTO-RECEIPTS-1: portata a 5 lingue — è la conferma che
// riceve ANCHE chi paga in crypto (la manda notifyPlanActivated in lib/plan-grant,
// condivisa da tutti i rail) e usciva sempre in italiano.
const ACTIVATED: Record<MailLang, {
  subject: string;
  body: (until: string | null) => string;
  cta: string;
}> = {
  it: {
    subject: "BetRedge Pro attivato ✅",
    body: (u) => `Il tuo BetRedge Pro è attivo${u ? ` fino al ${u}` : ""}. Hai accesso completo a segnali e probabilità calibrate.`,
    cta: "Apri il desk",
  },
  en: {
    subject: "BetRedge Pro activated ✅",
    body: (u) => `Your BetRedge Pro is active${u ? ` until ${u}` : ""}. You now have full access to the signals and calibrated probabilities.`,
    cta: "Open the desk",
  },
  es: {
    subject: "BetRedge Pro activado ✅",
    body: (u) => `Tu BetRedge Pro está activo${u ? ` hasta el ${u}` : ""}. Tienes acceso completo a las señales y a las probabilidades calibradas.`,
    cta: "Abrir el desk",
  },
  fr: {
    subject: "BetRedge Pro activé ✅",
    body: (u) => `Votre BetRedge Pro est actif${u ? ` jusqu'au ${u}` : ""}. Vous avez un accès complet aux signaux et aux probabilités calibrées.`,
    cta: "Ouvrir le desk",
  },
  ru: {
    subject: "BetRedge Pro активирован ✅",
    body: (u) => `Ваш BetRedge Pro активен${u ? ` до ${u}` : ""}. У вас полный доступ к сигналам и калиброванным вероятностям.`,
    cta: "Открыть деск",
  },
};

export function planActivatedEmail(expiresAtISO: string | null, lang = "it"): { subject: string; html: string; text: string } {
  const l = resolveMailLang(lang);
  const t = ACTIVATED[l];
  const until = expiresAtISO ? new Date(expiresAtISO).toLocaleDateString(MAIL_LOCALE[l]) : null;
  const body = t.body(until);
  return {
    subject: t.subject,
    html: brandedShell(`${brandText(body)}${brandCta(t.cta, `${siteUrl()}/app`)}`, { lang: l }),
    text: `${body}\n\n${t.cta}: ${siteUrl()}/app`,
  };
}

// Welcome — sent once the user clicks the activation link and the profile goes live.
// È il giorno 0 della scala post-registrazione (#CRM-MERGE-0727): resta qui, nel path
// transazionale, perché un benvenuto è comunicazione di servizio e non richiede il
// consenso marketing che invece governa i touchpoint acquisition. Il testo viene da
// Email_1 di Steve, con una correzione: il Free dà 1 pick PER SPORT a settimana
// (lib/access-projection.ts), non "una pick a settimana".
// #CRYPTO-RECEIPTS-1 — lingua delle email: le stesse 5 del sito, risolte come fa
// `resolveCrmLang` in lib/crm-content.ts (2 caratteri, fallback italiano) così le
// mail di pagamento e quelle del CRM non possono uscire in lingue diverse per lo
// stesso cliente. NON importo quella: crm-content importa da QUI e sarebbe un ciclo.
export type MailLang = "it" | "en" | "es" | "fr" | "ru";
const MAIL_LANGS: readonly MailLang[] = ["it", "en", "es", "fr", "ru"];
export function resolveMailLang(raw: string | null | undefined): MailLang {
  const two = (raw || "").trim().toLowerCase().slice(0, 2);
  return (MAIL_LANGS as readonly string[]).includes(two) ? (two as MailLang) : "it";
}
const MAIL_LOCALE: Record<MailLang, string> = {
  it: "it-IT", en: "en-GB", es: "es-ES", fr: "fr-FR", ru: "ru-RU",
};

type WelcomeLang = MailLang;
const WELCOME: Record<WelcomeLang, { subject: string; body1: string; body2: string; plans: string; cta: string }> = {
  it: {
    subject: "Il tuo account gratuito è attivo",
    body1: "Ogni settimana ricevi 1 pick per sport, con lo storico reale delle performance dove disponibile.",
    body2: "Due passi e hai visto il cuore di BetRedge: apri il desk, poi apri la prima pick per capire come inquadriamo un edge.",
    plans: "Quando vorrai di più, BetRedge Base sblocca più predizioni di calcio e tennis con edge e stake completi, e BetRedge Pro aggiunge predizioni illimitate, Deep Analysis e la Weekly Pick. Senza fretta: il piano gratuito resta tuo.",
    cta: "Apri il desk",
  },
  en: {
    subject: "Your free account is live",
    body1: "Every week you'll get 1 pick per sport, plus real historical performance where available.",
    body2: "Two steps and you've seen the core of BetRedge: open the desk, then open your first pick to see how we frame an edge.",
    plans: "When you're ready for more, BetRedge Base unlocks more football and tennis predictions with full edge and stake data, and BetRedge Pro adds unlimited predictions, Deep Analysis and the Weekly Pick. No rush — your free plan isn't going anywhere.",
    cta: "Open the desk",
  },
  es: {
    subject: "Tu cuenta gratuita está activa",
    body1: "Cada semana recibes 1 pick por deporte, con el historial real de rendimiento donde esté disponible.",
    body2: "Dos pasos y ya has visto el núcleo de BetRedge: abre el desk y luego abre tu primer pick para ver cómo planteamos un edge.",
    plans: "Cuando quieras más, BetRedge Base desbloquea más predicciones de fútbol y tenis con edge y stake completos, y BetRedge Pro añade predicciones ilimitadas, Deep Analysis y la Weekly Pick. Sin prisa: tu plan gratuito sigue siendo tuyo.",
    cta: "Abrir el desk",
  },
  fr: {
    subject: "Votre compte gratuit est actif",
    body1: "Chaque semaine, vous recevez 1 pick par sport, avec l'historique réel des performances lorsqu'il est disponible.",
    body2: "Deux étapes et vous avez vu l'essentiel de BetRedge : ouvrez le desk, puis ouvrez votre premier pick pour voir comment nous cadrons un edge.",
    plans: "Quand vous voudrez aller plus loin, BetRedge Base débloque davantage de pronostics football et tennis avec edge et mise complets, et BetRedge Pro ajoute les pronostics illimités, la Deep Analysis et la Weekly Pick. Sans précipitation : votre plan gratuit reste le vôtre.",
    cta: "Ouvrir le desk",
  },
  ru: {
    subject: "Ваш бесплатный аккаунт активен",
    body1: "Каждую неделю вы получаете 1 пик по каждому виду спорта, а также реальную историю результатов, где она доступна.",
    body2: "Два шага — и вы увидели суть BetRedge: откройте деск, затем откройте свой первый пик, чтобы понять, как мы находим edge.",
    plans: "Когда захотите большего, BetRedge Base открывает больше прогнозов по футболу и теннису с полными edge и ставкой, а BetRedge Pro добавляет неограниченные прогнозы, Deep Analysis и Weekly Pick. Без спешки: бесплатный план остаётся вашим.",
    cta: "Открыть деск",
  },
};

export function welcomeEmail(lang = "it"): { subject: string; html: string; text: string } {
  const l: WelcomeLang = lang in WELCOME ? (lang as WelcomeLang) : "it";
  const t = WELCOME[l];
  const url = `${siteUrl()}/app`;
  return {
    subject: t.subject,
    html: brandedShell(
      `${brandHeading(t.subject)}${brandText(t.body1)}${brandText(t.body2)}${brandCta(t.cta, url)}${brandText(t.plans)}`,
      { hero: true, lang: l }
    ),
    text: `${t.body1}\n\n${t.body2}\n\n${t.cta}: ${url}\n\n${t.plans}`,
  };
}

// Receipt — sent on Stripe invoice.paid with the real amount. Distinct from the
// plan-activated notice. Guard duplicate sends with Stripe event-id idempotency.
// #CRYPTO-RECEIPTS-1: 5 lingue (erano it/en, e i chiamanti non passavano `lang` →
// una ricevuta italiana ai 13 profili `en` su 17). La lingua è quella con cui il
// cliente si è iscritto (`profiles.language`).
const RECEIPT: Record<MailLang, {
  subject: string;
  recorded: (p: string) => string;
  amount: (a: string) => string;
  until: (u: string) => string;
}> = {
  it: {
    subject: "Ricevuta di pagamento BetRedge",
    recorded: (p) => `Grazie. Abbiamo registrato il tuo pagamento per ${p}.`,
    amount: (a) => `Importo: ${a}.`,
    until: (u) => `Rinnovo / scadenza: ${u}.`,
  },
  en: {
    subject: "Your BetRedge payment receipt",
    recorded: (p) => `Thank you. We've recorded your payment for ${p}.`,
    amount: (a) => `Amount: ${a}.`,
    until: (u) => `Renews / expires: ${u}.`,
  },
  es: {
    subject: "Recibo de pago BetRedge",
    recorded: (p) => `Gracias. Hemos registrado tu pago de ${p}.`,
    amount: (a) => `Importe: ${a}.`,
    until: (u) => `Renovación / vencimiento: ${u}.`,
  },
  fr: {
    subject: "Votre reçu de paiement BetRedge",
    recorded: (p) => `Merci. Nous avons enregistré votre paiement pour ${p}.`,
    amount: (a) => `Montant : ${a}.`,
    until: (u) => `Renouvellement / échéance : ${u}.`,
  },
  ru: {
    subject: "Квитанция об оплате BetRedge",
    recorded: (p) => `Спасибо. Мы зафиксировали ваш платёж за ${p}.`,
    amount: (a) => `Сумма: ${a}.`,
    until: (u) => `Продление / окончание: ${u}.`,
  },
};

// Receipt — sent on Stripe invoice.paid and on every successful PayGate/crypto
// payment, with the real amount. Distinct from the plan-activated notice.
export function receiptEmail(
  amountMinor: number | null,
  currency: string | null,
  plan: string,
  periodEndISO: string | null,
  lang = "it"
): { subject: string; html: string; text: string } {
  const l = resolveMailLang(lang);
  const t = RECEIPT[l];
  const amount =
    amountMinor != null && currency
      ? new Intl.NumberFormat(MAIL_LOCALE[l], {
          style: "currency",
          currency: currency.toUpperCase(),
        }).format(amountMinor / 100)
      : null;
  const until = periodEndISO ? new Date(periodEndISO).toLocaleDateString(MAIL_LOCALE[l]) : null;
  const planLabel = plan === "premium" ? "BetRedge Pro (Premium)" : "BetRedge Pro (Base)";
  const lines = [
    t.recorded(planLabel),
    amount ? t.amount(amount) : null,
    until ? t.until(until) : null,
  ];
  const text = lines.filter(Boolean).join(" ");
  return { subject: t.subject, html: brandedShell(brandText(text), { lang: l }), text };
}

// #CRYPTO-RECEIPTS-1 — ricevuta della Weekly Pick. Builder separato da receiptEmail
// di proposito: quello dice "BetRedge Pro (Base/Premium)" e parla di rinnovo, che su
// un acquisto singolo di UNA settimana sarebbe una ricevuta falsa. Qui si nomina la
// settimana comprata e si dichiara che non si rinnova.
const WP_RECEIPT: Record<MailLang, {
  subject: string;
  recorded: (w: string) => string;
  amount: (a: string) => string;
  oneOff: string;
  cta: string;
}> = {
  it: {
    subject: "Ricevuta — Weekly Pick",
    recorded: (w) => `Grazie. Abbiamo registrato il tuo pagamento per la Weekly Pick della settimana del ${w}.`,
    amount: (a) => `Importo: ${a}.`,
    oneOff: "È un acquisto singolo: sblocca la schedina di questa settimana e non si rinnova.",
    cta: "Apri la Weekly Pick",
  },
  en: {
    subject: "Your Weekly Pick receipt",
    recorded: (w) => `Thank you. We've recorded your payment for the Weekly Pick of the week of ${w}.`,
    amount: (a) => `Amount: ${a}.`,
    oneOff: "This is a one-time purchase: it unlocks this week's slip and does not renew.",
    cta: "Open the Weekly Pick",
  },
  es: {
    subject: "Recibo — Weekly Pick",
    recorded: (w) => `Gracias. Hemos registrado tu pago de la Weekly Pick de la semana del ${w}.`,
    amount: (a) => `Importe: ${a}.`,
    oneOff: "Es una compra única: desbloquea la combinada de esta semana y no se renueva.",
    cta: "Abrir la Weekly Pick",
  },
  fr: {
    subject: "Votre reçu — Weekly Pick",
    recorded: (w) => `Merci. Nous avons enregistré votre paiement pour le Weekly Pick de la semaine du ${w}.`,
    amount: (a) => `Montant : ${a}.`,
    oneOff: "Il s'agit d'un achat unique : il débloque le combiné de cette semaine et ne se renouvelle pas.",
    cta: "Ouvrir le Weekly Pick",
  },
  ru: {
    subject: "Квитанция — Weekly Pick",
    recorded: (w) => `Спасибо. Мы зафиксировали ваш платёж за Weekly Pick на неделю от ${w}.`,
    amount: (a) => `Сумма: ${a}.`,
    oneOff: "Это разовая покупка: она открывает экспресс этой недели и не продлевается.",
    cta: "Открыть Weekly Pick",
  },
};

export function weeklyPickReceiptEmail(
  amountMinor: number | null,
  currency: string | null,
  weekStartISO: string,
  lang = "it"
): { subject: string; html: string; text: string } {
  const l = resolveMailLang(lang);
  const t = WP_RECEIPT[l];
  const amount =
    amountMinor != null && currency
      ? new Intl.NumberFormat(MAIL_LOCALE[l], {
          style: "currency",
          currency: currency.toUpperCase(),
        }).format(amountMinor / 100)
      : null;
  const week = new Date(weekStartISO).toLocaleDateString(MAIL_LOCALE[l]);
  const url = `${siteUrl()}/weekly-pick`;
  const lines = [t.recorded(week), amount ? t.amount(amount) : null, t.oneOff];
  const text = lines.filter(Boolean).join(" ");
  return {
    subject: t.subject,
    html: brandedShell(`${brandText(text)}${brandCta(t.cta, url)}`, { lang: l }),
    text: `${text}\n\n${t.cta}: ${url}`,
  };
}

// Cancellation — sent when a subscription is deleted; the plan drops to free.
export function cancellationEmail(lang = "it"): { subject: string; html: string; text: string } {
  const it = lang !== "en";
  const subject = it ? "Abbonamento annullato" : "Subscription cancelled";
  const body = it
    ? "Il tuo BetRedge Pro è stato annullato e il profilo è tornato al piano gratuito. Puoi riattivarlo quando vuoi dal desk — nessun dato perso."
    : "Your BetRedge Pro has been cancelled and your profile is back on the free plan. You can reactivate any time from the desk — nothing is lost.";
  const cta = it ? "Riattiva" : "Reactivate";
  return {
    subject,
    html: brandedShell(`${brandText(body)}${brandCta(cta, `${siteUrl()}/app?tab=account`)}`, { lang: it ? "it" : "en" }),
    text: `${body}\n\n${cta}: ${siteUrl()}/app?tab=account`,
  };
}

// Win-back — sent (cron) to users whose plan has expired, to invite them back.
export function winBackEmail(lang = "it"): { subject: string; html: string; text: string } {
  const it = lang !== "en";
  const subject = it ? "Ti riapriamo il desk?" : "Want your desk back?";
  const body = it
    ? "Il tuo BetRedge Pro è scaduto. Le probabilità calibrate e il track record verificabile sono sempre lì — riattiva per tornare a vederli in pieno."
    : "Your BetRedge Pro has expired. The calibrated probabilities and verifiable track record are still here — reactivate to get full access again.";
  const cta = it ? "Riattiva il desk" : "Reactivate the desk";
  return {
    subject,
    html: brandedShell(`${brandText(body)}${brandCta(cta, `${siteUrl()}/app?tab=account`)}`, { lang: it ? "it" : "en" }),
    text: `${body}\n\n${cta}: ${siteUrl()}/app?tab=account`,
  };
}

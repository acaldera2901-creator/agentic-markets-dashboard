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
// #MAIL-I18N-5LANG-0805 — le mail di ACCOUNT parlavano solo it/en, e la rotta auth
// collassava la lingua (`body.language === "en" ? "en" : "it"`): chi si registrava
// in spagnolo, francese o russo riceveva l'attivazione IN ITALIANO — la prima email
// che un cliente riceve, sul percorso senza il quale non può nemmeno entrare. Il
// resto del prodotto (sito, CRM, ricevute) parla 5 lingue da settimane.
// Peggio: i fallback non erano nemmeno coerenti fra loro — activation/reset/
// payment cadevano su italiano, l'OTP su inglese, quindi lo stesso utente spagnolo
// poteva ricevere l'attivazione in italiano e il codice di accesso in inglese.
const ACTIVATION: Record<MailLang, { subject: string; intro: string; cta: string; ignore: (m: string) => string }> = {
  it: {
    subject: "Attiva il tuo profilo BetRedge",
    intro: "Per completare la registrazione e proteggere il tuo account, conferma il tuo indirizzo email. Il link scade tra 1 ora.",
    cta: "Attiva il profilo",
    ignore: (m) => `Se non hai creato un account, ignora questa email o scrivici a ${m}.`,
  },
  en: {
    subject: "Activate your BetRedge profile",
    intro: "To finish signing up and secure your account, confirm your email address. The link expires in 1 hour.",
    cta: "Activate profile",
    ignore: (m) => `If you didn't create an account, ignore this email or write to us at ${m}.`,
  },
  es: {
    subject: "Activa tu perfil de BetRedge",
    intro: "Para completar el registro y proteger tu cuenta, confirma tu dirección de correo. El enlace caduca en 1 hora.",
    cta: "Activar el perfil",
    ignore: (m) => `Si no has creado ninguna cuenta, ignora este correo o escríbenos a ${m}.`,
  },
  fr: {
    subject: "Activez votre profil BetRedge",
    intro: "Pour terminer votre inscription et sécuriser votre compte, confirmez votre adresse e-mail. Le lien expire dans 1 heure.",
    cta: "Activer le profil",
    ignore: (m) => `Si vous n'avez pas créé de compte, ignorez cet e-mail ou écrivez-nous à ${m}.`,
  },
  ru: {
    subject: "Активируйте профиль BetRedge",
    intro: "Чтобы завершить регистрацию и защитить аккаунт, подтвердите адрес электронной почты. Ссылка действует 1 час.",
    cta: "Активировать профиль",
    ignore: (m) => `Если вы не создавали аккаунт, просто проигнорируйте это письмо или напишите нам на ${m}.`,
  },
};

export function activationEmail(activateUrl: string, lang: string = "it"): {
  subject: string; html: string; text: string; from: string; replyTo: string;
} {
  const l = resolveMailLang(lang);
  const t = ACTIVATION[l];
  const subject = t.subject;
  const intro = t.intro;
  const cta = t.cta;
  const ignore = t.ignore(ACCOUNT_CONTACT_EMAIL);
  const body = `${brandText(intro)}${brandCta(cta, activateUrl)}
  <p style="font-size:12px;color:${BRAND.muted};margin:18px 0 0;word-break:break-all;font-family:${FONT}">${activateUrl}</p>
  <p style="font-size:12px;color:${BRAND.muted};margin:12px 0 0;font-family:${FONT}">${ignore}</p>`;
  const html = brandedShell(body, { hero: true, lang: l });
  const text = `${intro}\n\n${cta}: ${activateUrl}\n\n${ignore}`;
  return { subject, html, text, from: activationFromAddress(), replyTo: ACCOUNT_CONTACT_EMAIL };
}

// Password reset: the link the user clicks to set a new password. Like
// activation, sent from the account contact mailbox; the link carries a one-time
// token (only its hash is stored) and expires in 1 hour.
const PWRESET: Record<MailLang, { subject: string; intro: string; cta: string; ignore: (m: string) => string }> = {
  it: {
    subject: "Reimposta la tua password BetRedge",
    intro: "Hai chiesto di reimpostare la password. Clicca qui sotto per sceglierne una nuova. Il link scade tra 1 ora.",
    cta: "Reimposta la password",
    ignore: (m) => `Se non hai richiesto tu il reset, ignora questa email: la password resta invariata. Per dubbi scrivici a ${m}.`,
  },
  en: {
    subject: "Reset your BetRedge password",
    intro: "You asked to reset your password. Click below to choose a new one. The link expires in 1 hour.",
    cta: "Reset password",
    ignore: (m) => `If you didn't request this, ignore this email — your password stays unchanged. Questions? Write to us at ${m}.`,
  },
  es: {
    subject: "Restablece tu contraseña de BetRedge",
    intro: "Has pedido restablecer tu contraseña. Pulsa abajo para elegir una nueva. El enlace caduca en 1 hora.",
    cta: "Restablecer la contraseña",
    ignore: (m) => `Si no has sido tú, ignora este correo: tu contraseña no cambia. Si tienes dudas, escríbenos a ${m}.`,
  },
  fr: {
    subject: "Réinitialisez votre mot de passe BetRedge",
    intro: "Vous avez demandé à réinitialiser votre mot de passe. Cliquez ci-dessous pour en choisir un nouveau. Le lien expire dans 1 heure.",
    cta: "Réinitialiser le mot de passe",
    ignore: (m) => `Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé. Une question ? Écrivez-nous à ${m}.`,
  },
  ru: {
    subject: "Сброс пароля BetRedge",
    intro: "Вы запросили сброс пароля. Нажмите кнопку ниже, чтобы задать новый. Ссылка действует 1 час.",
    cta: "Сбросить пароль",
    ignore: (m) => `Если запрос отправляли не вы, просто проигнорируйте письмо — пароль останется прежним. Вопросы: ${m}.`,
  },
};

export function passwordResetEmail(resetUrl: string, lang: string = "it"): {
  subject: string; html: string; text: string; from: string; replyTo: string;
} {
  const l = resolveMailLang(lang);
  const t = PWRESET[l];
  const subject = t.subject;
  const intro = t.intro;
  const cta = t.cta;
  const ignore = t.ignore(ACCOUNT_CONTACT_EMAIL);
  const body = `${brandText(intro)}${brandCta(cta, resetUrl)}
  <p style="font-size:12px;color:${BRAND.muted};margin:18px 0 0;word-break:break-all;font-family:${FONT}">${resetUrl}</p>
  <p style="font-size:12px;color:${BRAND.muted};margin:12px 0 0;font-family:${FONT}">${ignore}</p>`;
  const html = brandedShell(body, { lang: l });
  const text = `${intro}\n\n${cta}: ${resetUrl}\n\n${ignore}`;
  return { subject, html, text, from: activationFromAddress(), replyTo: ACCOUNT_CONTACT_EMAIL };
}

const OTP: Record<MailLang, { subject: (c: string) => string; intro: string; ignore: string }> = {
  it: {
    subject: (c) => `${c} — il tuo codice di accesso BetRedge`,
    intro: "Usa questo codice per accedere al tuo BetRedge. Scade tra 10 minuti.",
    ignore: "Se non hai richiesto questo codice, ignora questa email.",
  },
  en: {
    subject: (c) => `${c} — your BetRedge login code`,
    intro: "Use this code to sign in to your BetRedge. It expires in 10 minutes.",
    ignore: "If you didn't request this code, you can ignore this email.",
  },
  es: {
    subject: (c) => `${c} — tu código de acceso a BetRedge`,
    intro: "Usa este código para entrar en tu BetRedge. Caduca en 10 minutos.",
    ignore: "Si no has pedido este código, ignora este correo.",
  },
  fr: {
    subject: (c) => `${c} — votre code de connexion BetRedge`,
    intro: "Utilisez ce code pour vous connecter à votre BetRedge. Il expire dans 10 minutes.",
    ignore: "Si vous n'avez pas demandé ce code, ignorez cet e-mail.",
  },
  ru: {
    subject: (c) => `${c} — код для входа в BetRedge`,
    intro: "Используйте этот код, чтобы войти в BetRedge. Он действует 10 минут.",
    ignore: "Если вы не запрашивали код, просто проигнорируйте это письмо.",
  },
};

export function otpEmail(code: string, lang: string = "it"): { subject: string; html: string; text: string } {
  const l = resolveMailLang(lang);
  const t = OTP[l];
  const subject = t.subject(code);
  const intro = t.intro;
  const ignore = t.ignore;
  const body = `${brandText(intro)}
  <div style="font-size:32px;font-weight:800;letter-spacing:.3em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#0a0f12;border:1px solid rgba(35,165,89,.35);border-radius:10px;padding:18px;text-align:center;color:#ffffff">${code}</div>
  <p style="font-size:12px;color:${BRAND.muted};margin:16px 0 0;font-family:${FONT}">${ignore}</p>`;
  const html = brandedShell(body, { lang: l });
  const text = `${code}\n\n${intro}\n\n${ignore}`;
  return { subject, html, text };
}

// ── Lifecycle / account emails ───────────────────────────────────────────────
// #MAIL-I18N-5LANG-0805: tutte a 5 lingue, come sito, CRM e ricevute. Prima
// `lang !== "en"` significava che spagnolo, francese e russo ricevevano l'ITALIANO.
// Condividono brandedShell() e passano da sendTransactional() (lib/notify.ts), che
// registra ogni invio in `notifications`.

// Payment received → plan in review (GAP4).
const PAYMENT_RECEIVED: Record<MailLang, { subject: string; body: string }> = {
  it: {
    subject: "Pagamento ricevuto — in verifica",
    body: "Abbiamo ricevuto la tua richiesta di BetRedge Pro. Verifichiamo la transazione on-chain e attiviamo il piano entro 12 ore. Ti avvisiamo appena è attivo.",
  },
  en: {
    subject: "Payment received — under review",
    body: "We received your BetRedge Pro request. We're verifying the on-chain transaction and will activate your plan within 12 hours. We'll email you when it's live.",
  },
  es: {
    subject: "Pago recibido — en verificación",
    body: "Hemos recibido tu solicitud de BetRedge Pro. Estamos verificando la transacción on-chain y activaremos el plan en un plazo de 12 horas. Te avisamos en cuanto esté activo.",
  },
  fr: {
    subject: "Paiement reçu — en vérification",
    body: "Nous avons bien reçu votre demande BetRedge Pro. Nous vérifions la transaction on-chain et activerons le plan sous 12 heures. Nous vous écrivons dès qu'il est actif.",
  },
  ru: {
    subject: "Платёж получен — на проверке",
    body: "Мы получили ваш запрос на BetRedge Pro. Проверяем транзакцию в блокчейне и активируем план в течение 12 часов. Сообщим, как только всё будет готово.",
  },
};

export function paymentReceivedEmail(lang = "it"): { subject: string; html: string; text: string } {
  const l = resolveMailLang(lang);
  const t = PAYMENT_RECEIVED[l];
  return {
    subject: t.subject,
    html: brandedShell(brandText(t.body), { lang: l }),
    text: t.body,
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
const CANCELLATION: Record<MailLang, { subject: string; body: string; cta: string }> = {
  it: {
    subject: "Abbonamento annullato",
    body: "Il tuo BetRedge Pro è stato annullato e il profilo è tornato al piano gratuito. Puoi riattivarlo quando vuoi dal desk — nessun dato perso.",
    cta: "Riattiva",
  },
  en: {
    subject: "Subscription cancelled",
    body: "Your BetRedge Pro has been cancelled and your profile is back on the free plan. You can reactivate any time from the desk — nothing is lost.",
    cta: "Reactivate",
  },
  es: {
    subject: "Suscripción cancelada",
    body: "Tu BetRedge Pro se ha cancelado y tu perfil ha vuelto al plan gratuito. Puedes reactivarlo cuando quieras desde el desk — no se pierde nada.",
    cta: "Reactivar",
  },
  fr: {
    subject: "Abonnement annulé",
    body: "Votre BetRedge Pro a été annulé et votre profil est revenu au plan gratuit. Vous pouvez le réactiver quand vous voulez depuis le desk — rien n'est perdu.",
    cta: "Réactiver",
  },
  ru: {
    subject: "Подписка отменена",
    body: "Ваш BetRedge Pro отменён, профиль вернулся на бесплатный план. Вы можете возобновить его в любой момент из деска — ничего не потеряно.",
    cta: "Возобновить",
  },
};

export function cancellationEmail(lang = "it"): { subject: string; html: string; text: string } {
  const l = resolveMailLang(lang);
  const t = CANCELLATION[l];
  return {
    subject: t.subject,
    html: brandedShell(`${brandText(t.body)}${brandCta(t.cta, `${siteUrl()}/plans`)}`, { lang: l }),
    text: `${t.body}\n\n${t.cta}: ${siteUrl()}/plans`,
  };
}

// Win-back — sent (cron) to users whose plan has expired, to invite them back.
const WINBACK: Record<MailLang, { subject: string; body: string; cta: string }> = {
  it: {
    subject: "Ti riapriamo il desk?",
    body: "Il tuo BetRedge Pro è scaduto. Le probabilità calibrate e il track record verificabile sono sempre lì — riattiva per tornare a vederli in pieno.",
    cta: "Riattiva il desk",
  },
  en: {
    subject: "Want your desk back?",
    body: "Your BetRedge Pro has expired. The calibrated probabilities and verifiable track record are still here — reactivate to get full access again.",
    cta: "Reactivate the desk",
  },
  es: {
    subject: "¿Te reabrimos el desk?",
    body: "Tu BetRedge Pro ha caducado. Las probabilidades calibradas y el track record verificable siguen ahí — reactiva para volver a verlos por completo.",
    cta: "Reactivar el desk",
  },
  fr: {
    subject: "On vous rouvre le desk ?",
    body: "Votre BetRedge Pro a expiré. Les probabilités calibrées et le track record vérifiable sont toujours là — réactivez pour les retrouver en entier.",
    cta: "Réactiver le desk",
  },
  ru: {
    subject: "Вернуть вам доступ к деску?",
    body: "Срок действия BetRedge Pro истёк. Откалиброванные вероятности и проверяемый трек-рекорд на месте — возобновите доступ, чтобы снова видеть всё полностью.",
    cta: "Открыть деск снова",
  },
};

export function winBackEmail(lang = "it"): { subject: string; html: string; text: string } {
  const l = resolveMailLang(lang);
  const t = WINBACK[l];
  return {
    subject: t.subject,
    html: brandedShell(`${brandText(t.body)}${brandCta(t.cta, `${siteUrl()}/plans`)}`, { lang: l }),
    text: `${t.body}\n\n${t.cta}: ${siteUrl()}/plans`,
  };
}

// lib/crm-content.ts
// Touchpoint email del CRM (#CRM-LIFECYCLE). Copy bilingue, tono doc.
import type { Touchpoint } from "./crm";
import { unsubToken } from "./crm-unsub";
import { brandedShell, brandCta } from "./email";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://betredge.com").replace(/\/$/, "");

// Footer legale conforme (legale-compliance 2026-06-28): mittente identificabile
// (dati Maven via env, [DA COMPILARE] finché non impostati), disclaimer +18 /
// non-gambling, link di disiscrizione one-click. Niente affiliate bookmaker.
function footer(identifier: string, lang: "it" | "en"): string {
  const co = process.env.COMPANY_LEGAL_NAME || "Maven Agency";
  const addr = process.env.COMPANY_ADDRESS || "";
  const vat = process.env.COMPANY_VAT || "";
  const contact = process.env.COMPANY_CONTACT_EMAIL || "info@betredge.com";
  const unsub = `${SITE}/api/crm/unsubscribe?t=${unsubToken(identifier)}`;
  const it = lang === "it";
  const disc = it
    ? "BetRedge è un servizio di analisi statistica e informativa sportiva, non un operatore di gioco. Contenuto 18+. Il gioco può causare dipendenza. Gioca responsabilmente."
    : "BetRedge is a statistical analysis and sports information service, not a gambling operator. 18+. Gambling can be addictive. Play responsibly.";
  const unl = it ? "Disiscriviti" : "Unsubscribe";
  const idline = [co, addr, vat ? `P.IVA ${vat}` : ""].filter(Boolean).join(" · ");
  // Footer legale renderizzato nell'area footer scura del brandedShell.
  return `<p style="font-size:11px;color:#8b98a4;line-height:1.5;margin:0">${idline}<br>${contact} · <a href="${unsub}" style="color:#8b98a4;text-decoration:underline">${unl}</a><br>${disc}</p>`;
}

type CrmTouchpoint = Touchpoint & { subject: { it: string; en: string }; body: { it: string; en: string } };

// day: per onboarding/acquisition/winback = giorni dall'ancora; per retention = giorni ALLA scadenza.
export const CRM_TOUCHPOINTS: CrmTouchpoint[] = [
  { key: "onb_activate", flow: "onboarding", day: 2,
    subject: { it: "Attiva il tuo BetRedge", en: "Activate your BetRedge" },
    body: { it: "Sei a un passo: accedi e guarda il primo pronostico del modello. È gratis e ti mostra subito come ragiona.", en: "You're one step away: log in and see the model's first pick. It's free and shows how it reasons." } },
  { key: "acq_day7_offer", flow: "acquisition", day: 7,
    subject: { it: "Il tuo primo upgrade BetRedge", en: "Your first BetRedge upgrade" },
    body: { it: "Nel Free vedi 2 pick a settimana. Con Plus sblocchi l'intero board, edge e spiegazioni. Da 14,99 USD/mese.", en: "Free shows 2 picks/week. Plus unlocks the full board, edge and explanations. From $14.99/mo." } },
  { key: "acq_day14_welcome_offer", flow: "acquisition", day: 14,
    subject: { it: "Offerta benvenuto: −20% per 72h", en: "Welcome offer: −20% for 72h" },
    body: { it: "Solo per te, 72 ore: Plus a −20%. Probabilità calibrate e track record verificabile, tutto sbloccato.", en: "Just for you, 72 hours: Plus at −20%. Calibrated probabilities and verifiable track record, all unlocked." } },
  { key: "acq_day21_last_chance", flow: "acquisition", day: 21,
    subject: { it: "Ultima occasione — angolo nuovo", en: "Last chance — a fresh angle" },
    body: { it: "Non i soliti pronostici: una opinione sola, calibrata, misurata. Sblocca il board completo a −30% per 48h.", en: "Not the usual tips: one calibrated, measured opinion. Unlock the full board at −30% for 48h." } },
  { key: "acq_day28_final", flow: "acquisition", day: 28,
    subject: { it: "Offerta finale + 3 giorni VIP", en: "Final offer + 3-day VIP" },
    body: { it: "Ultima spinta: Plus a −30% con 3 giorni di prova VIP (analisi più profonda). Poi si torna a prezzo pieno.", en: "Final push: Plus at −30% with a 3-day VIP trial (deeper analysis). Then back to full price." } },
  { key: "ret_7d_before", flow: "retention", day: 7,
    subject: { it: "Il tuo accesso scade tra 7 giorni", en: "Your access expires in 7 days" },
    body: { it: "Riepilogo del mese e cosa stai per perdere. L'accesso non si rinnova da solo: paga di nuovo per continuare.", en: "Your monthly recap and what you'd lose. Access doesn't auto-renew: pay again to continue." } },
  { key: "ret_3d_before", flow: "retention", day: 3,
    subject: { it: "Rinnova: 3 giorni alla scadenza", en: "Renew: 3 days to expiry" },
    body: { it: "Continua da dove sei. Rinnovo rapido, nessuna interruzione del board.", en: "Continue where you left off. Quick renewal, no break in the board." } },
  { key: "ret_1d_before", flow: "retention", day: 1,
    subject: { it: "Ultimo promemoria + bonus fedeltà", en: "Final reminder + loyalty bonus" },
    body: { it: "Domani scade. Rinnova ora e mantieni la streak: bonus fedeltà (early access), non sconti.", en: "Expires tomorrow. Renew now and keep your streak: loyalty bonus (early access), not discounts." } },
  { key: "wb_day1_expired", flow: "winback", day: 1,
    subject: { it: "Il tuo accesso è scaduto", en: "Your access has expired" },
    body: { it: "Il tuo storico e i risultati sono salvati. Riattiva per riprendere da dove avevi lasciato.", en: "Your history and results are saved. Reactivate to pick up where you left off." } },
  { key: "wb_day7_renew", flow: "winback", day: 7,
    subject: { it: "Riprendi da dove eri", en: "Continue from where you stopped" },
    body: { it: "Il board continua a girare. Rientra quando vuoi: i tuoi dati ti aspettano.", en: "The board keeps running. Come back anytime: your data is waiting." } },
  { key: "wb_day14_offer", flow: "winback", day: 14,
    subject: { it: "Offerta di riattivazione privata", en: "Private reactivation offer" },
    body: { it: "Un'offerta riservata per tornare. Mai migliore degli sconti di ingresso — ma pensata per te.", en: "A private offer to return. Never better than joining offers — but made for you." } },
  { key: "wb_day21_final", flow: "winback", day: 21,
    subject: { it: "Ultimo promemoria", en: "Last reminder" },
    body: { it: "Ultimo richiamo prima di tornare al flusso Free. Riattiva per non perdere lo storico.", en: "Last call before returning to the Free flow. Reactivate to keep your history." } },
];

export function renderCrm(key: string, lang: "it" | "en", identifier: string): { subject: string; html: string; text: string; unsubUrl: string } | null {
  const t = CRM_TOUCHPOINTS.find((x) => x.key === key);
  if (!t) return null;
  const href = `${SITE}/app?tab=plans&crm=${encodeURIComponent(t.key)}`;
  const label = lang === "it" ? "Apri BetRedge" : "Open BetRedge";
  const body = t.body[lang];
  const unsub = `${SITE}/api/crm/unsubscribe?t=${unsubToken(identifier)}`;
  const unl = lang === "it" ? "Disiscriviti" : "Unsubscribe";
  const inner = `<p style="font-size:14px;line-height:1.6;margin:0;color:#cdd6dd;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">${body}</p>${brandCta(label, href)}`;
  return {
    subject: t.subject[lang],
    html: brandedShell(inner, { lang, footerHtml: footer(identifier, lang) }),
    text: `${body}\n\n${label}: ${href}\n\n— ${unl}: ${unsub}`,
    unsubUrl: unsub,
  };
}

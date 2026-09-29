// lib/signup-popup.ts — #SIGNUP-POPUP-D-0928
//
// Gancio D del giro «attenzione → pagante» (28/09): il pop-up d'iscrizione
// DIFFERITO. Trigger e cadenza sono il design di psicologia-persuasione
// (scratchpad `popup-design.md`, sez. 2 e 4), qui resi in numeri e in una
// funzione di eleggibilità che si può testare senza aspettare 90 secondi.
//
// #SESSION-POPUP-0929 (direttiva Andrea, 29/09): compare al primo caricamento
// della sessione su qualunque tab del desk, anche a Base (invito verso Pro), e
// torna a ogni sessione nuova. Sostituisce il trigger differito (90 s attivi +
// engagement + pausa) e il cooldown «14 giorni / mai dopo due» del 28/09.
//
// Perché sta fuori dal componente: la regola «una volta per sessione, mai
// dopo «Non mostrarlo più»» è la parte che DSA art. 25(3)(b)
// guarda (richiedere ripetutamente una scelta già fatta). Se vive dentro un
// useEffect nessuno la rilegge; qui è una tabella di verità con i suoi test.
//
// I numeri dei piani NON vivono qui: importi da lib/commercial-plan.ts
// (PUBLIC_PAID_PLANS), quote da lib/access-projection.ts (showcaseAllowance:
// free 3 / base 7 per sport al giorno, premium = tutto). Il «14» del brief
// originale non esiste nel codice: Pro non ha un tetto.

import type { Lang } from "@/lib/house-banners";
import { PUBLIC_PAID_PLANS } from "@/lib/commercial-plan";
import { showcaseAllowance } from "@/lib/access-projection";

// ── Trigger ─────────────────────────────────────────────────────────────
/** Ogni quanto, dal caricamento, si ricontrolla se può comparire (overlay
 *  chiuso, banner cookie risposto, scheda visibile). Il primo controllo è a
 *  un tick, non sincrono: così i blocker scritti dagli effetti della pagina
 *  nello stesso render (es. atterraggio su /plans) arrivano prima. */
export const SIGNUP_POPUP_POLL_MS = 500;

export type SignupPopupAudience = "anon" | "free" | "base";

/** Memoria per-browser (localStorage). Una convenienza: va in try/catch e
 *  se manca il pop-up si comporta come alla prima visita. */
export type SignupPopupMemory = {
  /** Chiusure registrate (X, Esc, «Non ora», o una CTA cliccata). */
  dismissals: number;
  /** Epoch ms dell'ultima chiusura, o null. */
  lastDismissedAt: number | null;
  /** «Non mostrarlo più»: stop definitivo, dal primo passaggio. */
  never: boolean;
};

/** Cose successe in QUESTA sessione (sessionStorage, per scheda) che spengono
 *  il pop-up: non si somma a ciò che l'utente ha già scelto o già visto.
 *  `panel_b` è riservato al pannello B (non ancora costruito il 28/09): il
 *  check esiste, lo scrittore arriverà con quel pannello. */
export type SignupPopupBlocker = "panel_b" | "plans" | "plan_cta" | "auth";

export type SignupPopupSession = {
  shown: boolean;
  blockers: SignupPopupBlocker[];
};

const MEMORY_KEY = "br_signup_popup";
const SESSION_KEY = "br_signup_popup_s";

export const EMPTY_MEMORY: SignupPopupMemory = { dismissals: 0, lastDismissedAt: null, never: false };
export const EMPTY_SESSION: SignupPopupSession = { shown: false, blockers: [] };

export function readSignupPopupMemory(): SignupPopupMemory {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    if (!raw) return EMPTY_MEMORY;
    const j = JSON.parse(raw) as Partial<SignupPopupMemory>;
    return {
      dismissals: Number.isFinite(j.dismissals) ? Math.max(0, Math.floor(j.dismissals as number)) : 0,
      lastDismissedAt: Number.isFinite(j.lastDismissedAt) ? (j.lastDismissedAt as number) : null,
      never: j.never === true,
    };
  } catch {
    return EMPTY_MEMORY;
  }
}

function writeMemory(m: SignupPopupMemory) {
  try { localStorage.setItem(MEMORY_KEY, JSON.stringify(m)); } catch { /* no-storage */ }
}

/** Registra una chiusura. Dopo la seconda il pop-up non torna più. */
export function recordSignupPopupDismissal(now = Date.now()): SignupPopupMemory {
  const m = readSignupPopupMemory();
  const next: SignupPopupMemory = { ...m, dismissals: m.dismissals + 1, lastDismissedAt: now };
  writeMemory(next);
  return next;
}

/** «Non mostrarlo più»: effetto immediato e permanente. */
export function recordSignupPopupNever(): SignupPopupMemory {
  const next: SignupPopupMemory = { ...readSignupPopupMemory(), never: true };
  writeMemory(next);
  return next;
}

export function readSignupPopupSession(): SignupPopupSession {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return EMPTY_SESSION;
    const j = JSON.parse(raw) as Partial<SignupPopupSession>;
    return {
      shown: j.shown === true,
      blockers: Array.isArray(j.blockers) ? (j.blockers.filter((b) => typeof b === "string") as SignupPopupBlocker[]) : [],
    };
  } catch {
    return EMPTY_SESSION;
  }
}

function writeSession(s: SignupPopupSession) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* no-storage */ }
}

/** Da chiamare dove succede la cosa: PlansTab montata, CTA di piano cliccata,
 *  modale di registrazione aperta, pannello B visto. Idempotente. */
export function noteSignupPopupBlocker(b: SignupPopupBlocker) {
  const s = readSignupPopupSession();
  if (s.blockers.includes(b)) return;
  writeSession({ ...s, blockers: [...s.blockers, b] });
}

export function markSignupPopupShown() {
  writeSession({ ...readSignupPopupSession(), shown: true });
}

// ── Eleggibilità ────────────────────────────────────────────────────────

/** A chi si rivolge: anonimo (nessuna sessione, nessun profilo), Free o Base
 *  (#SESSION-POPUP-0929: invito all'upgrade). Pro, pending_payment, unpaid,
 *  admin: mai. Finché la sessione non è
 *  stata verificata (`authChecked` false) non si decide: null. */
export function signupPopupAudience(input: {
  authChecked: boolean;
  hasSession: boolean;
  plan: string | null | undefined;
}): SignupPopupAudience | null {
  if (!input.authChecked) return null;
  if (!input.hasSession && !input.plan) return "anon";
  if (input.plan === "free") return "free";
  if (input.plan === "base") return "base";
  return null;
}

/** La tabella di verità completa. Fra una sessione e l'altra conta solo
 *  «Non mostrarlo più» (#SESSION-POPUP-0929): le chiusure semplici restano
 *  scritte in memoria ma non spengono la sessione successiva. */
export function signupPopupEligible(input: {
  audience: SignupPopupAudience | null;
  memory: SignupPopupMemory;
  session: SignupPopupSession;
  /** Il banner cookie ha avuto una risposta: non si sommano due strisce. */
  consentDecided: boolean;
}): boolean {
  if (!input.audience) return false;
  if (!input.consentDecided) return false;
  if (input.session.shown) return false;
  if (input.session.blockers.length > 0) return false;
  return !input.memory.never;
}

/** Il consenso cookie ha una risposta (accettato o rifiutato). Senza, il
 *  banner GDPR è ancora a schermo e il pop-up aspetta. */
export function gdprConsentDecided(): boolean {
  try { return localStorage.getItem("gdpr_consent") != null; } catch { return false; }
}

// ── Prezzi: un solo posto per il conto «al giorno» ──────────────────────
// Stesso pattern di /plans (#PLANS-HOOK-C-0928): mensile grande, giorno
// accessorio, mai uno senza l'altro. 30 giorni: 14.99 → 0,50 · 29.99 → 1.

export function perDayAmount(monthly: number): number {
  return Math.round((monthly / 30) * 100) / 100;
}

function decimalSep(lang: Lang): string {
  return lang === "en" ? "." : ",";
}

function fmtAmount(n: number, lang: Lang): string {
  const s = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return s.replace(".", decimalSep(lang));
}

/** «$14.99» — l'importo in USD (display, #UI-USD-DISPLAY-0623). Il francese
 *  mette la valuta dopo, come già su /plans. */
export function usdLabel(amount: number, lang: Lang): string {
  const n = fmtAmount(amount, lang);
  return lang === "fr" ? `${n} $` : `$${n}`;
}

const PER_MONTH: Record<Lang, string> = { it: "/mese", en: "/month", es: "/mes", fr: "/mois", ru: "/мес" };
// U+00A0 dentro l'unità («al giorno»): in una cella stretta va a capo DOPO
// l'importo, mai in mezzo alle parole.
const PER_DAY: Record<Lang, (n: string) => string> = {
  it: (n) => `≈\u00a0${n} al\u00a0giorno`,
  en: (n) => `≈\u00a0${n} a\u00a0day`,
  es: (n) => `≈\u00a0${n} al\u00a0día`,
  fr: (n) => `≈\u00a0${n} par\u00a0jour`,
  ru: (n) => `≈\u00a0${n} в\u00a0день`,
};

export type SignupPopupPlanRow = {
  key: "free" | "base" | "pro";
  name: string;
  /** Prezzo mensile, il più visibile. */
  price: string;
  /** Suffisso del mensile («/mese»), vuoto per Free. */
  per: string;
  /** L'equivalente al giorno, accessorio. Vuoto per Free. */
  perDay: string;
  /** Cosa apre. */
  allowance: string;
};

const ALLOWANCE: Record<Lang, { perSport: (n: number) => string; all: string }> = {
  it: { perSport: (n) => `${n} letture/giorno per sport`, all: "Tutto il board" },
  en: { perSport: (n) => `${n} readings/day per sport`, all: "The whole board" },
  es: { perSport: (n) => `${n} lecturas/día por deporte`, all: "Todo el board" },
  fr: { perSport: (n) => `${n} lectures/jour par sport`, all: "Tout le board" },
  ru: { perSport: (n) => `${n} прогнозов/день на вид спорта`, all: "Весь борд" },
};

export function signupPopupPlanRows(lang: Lang): SignupPopupPlanRow[] {
  const a = ALLOWANCE[lang];
  const base = PUBLIC_PAID_PLANS.base.amountUsdt;
  const pro = PUBLIC_PAID_PLANS.premium.amountUsdt;
  return [
    { key: "free", name: "Free", price: usdLabel(0, lang), per: "", perDay: "", allowance: a.perSport(showcaseAllowance("free")) },
    { key: "base", name: "Base", price: usdLabel(base, lang), per: PER_MONTH[lang], perDay: PER_DAY[lang](usdLabel(perDayAmount(base), lang)), allowance: a.perSport(showcaseAllowance("base")) },
    { key: "pro", name: "Pro", price: usdLabel(pro, lang), per: PER_MONTH[lang], perDay: PER_DAY[lang](usdLabel(perDayAmount(pro), lang)), allowance: a.all },
  ];
}

// ── Copy (sez. 3 del design) ────────────────────────────────────────────
// #EDGE-COPY-0928: niente «edge» nel corpo — nessuna card mostra un numero di
// edge per nessun piano; si promette ciò che si vede (probabilità + perché).

export type SignupPopupCopy = {
  eyebrowAnon: string;
  eyebrowFree: string;
  eyebrowBase: string;
  titleAnon: string;
  bodyAnon: string;
  titleFree: string;
  /** Con N = righe coperte reali; senza N la frase resta vera. */
  bodyFree: (lockedToday: number | null, baseAllowance: number) => string;
  /** #SESSION-POPUP-0929: Base → Pro. Con N = righe coperte reali. */
  titleBase: string;
  bodyBase: (lockedToday: number | null) => string;
  /** Solo con un numero vero dal DB. */
  proof: (settled: number) => string;
  ctaAnon: string;
  ctaFree: string;
  ctaBase: string;
  notNow: string;
  compare: string;
  never: string;
  close: string;
  legal: string;
  legalLink: string;
};

export const SIGNUP_POPUP_COPY: Record<Lang, SignupPopupCopy> = {
  it: {
    eyebrowAnon: "Profilo gratuito",
    eyebrowFree: "Il tuo piano",
    titleAnon: "3 letture complete al giorno, gratis",
    bodyAnon: "Con un profilo gratuito ogni giorno si aprono le 3 analisi migliori per sport: la probabilità del modello e il perché. Se ne vuoi di più ci sono Base e Pro.",
    titleFree: "Le tue 3 letture di oggi sono aperte",
    bodyFree: (n, b) => n && n > 0
      ? `Il board ne ha altre ${n} oggi. Base ne apre ${b} per sport, Pro tutto il board.`
      : `Domani si ricaricano. Base ne apre ${b} per sport, Pro tutto il board.`,
    proof: (n) => `${n.toLocaleString("it-IT")} letture chiuse, ognuna registrata prima del fischio`,
    ctaAnon: "Crea il profilo gratuito",
    ctaFree: "Vedi Base",
    ctaBase: "Vedi Pro",
    eyebrowBase: "Il tuo piano",
    titleBase: "Le tue 7 letture per sport di oggi sono aperte",
    bodyBase: (n) => n && n > 0
      ? `Il board ne ha altre ${n} oggi. Pro apre tutto il board, ogni giorno.`
      : `Domani si ricaricano. Pro apre tutto il board, ogni giorno.`,
    notNow: "Non ora",
    compare: "Confronta i piani",
    never: "Non mostrarlo più",
    close: "Chiudi",
    legal: "Analisi statistiche, non consigli di scommessa",
    legalLink: "Gioco responsabile",
  },
  en: {
    eyebrowAnon: "Free profile",
    eyebrowFree: "Your plan",
    titleAnon: "3 full readings a day, free",
    bodyAnon: "With a free profile, the model's 3 best analyses per sport open every day: the model's probability and the why. Want more? There are Base and Pro.",
    titleFree: "Your 3 readings for today are open",
    bodyFree: (n, b) => n && n > 0
      ? `The board has ${n} more today. Base opens ${b} per sport, Pro the whole board.`
      : `They reload tomorrow. Base opens ${b} per sport, Pro the whole board.`,
    proof: (n) => `${n.toLocaleString("en-US")} settled readings, each logged before kick-off`,
    ctaAnon: "Create a free profile",
    ctaFree: "See Base",
    ctaBase: "See Pro",
    eyebrowBase: "Your plan",
    titleBase: "Your 7 readings per sport for today are open",
    bodyBase: (n) => n && n > 0
      ? `The board has ${n} more today. Pro opens the whole board, every day.`
      : `They reload tomorrow. Pro opens the whole board, every day.`,
    notNow: "Not now",
    compare: "Compare plans",
    never: "Don't show this again",
    close: "Close",
    legal: "Statistical analysis, not betting advice",
    legalLink: "Responsible gambling",
  },
  es: {
    eyebrowAnon: "Perfil gratuito",
    eyebrowFree: "Tu plan",
    titleAnon: "3 lecturas completas al día, gratis",
    bodyAnon: "Con un perfil gratuito cada día se abren los 3 mejores análisis por deporte: la probabilidad del modelo y el porqué. Si quieres más, están Base y Pro.",
    titleFree: "Tus 3 lecturas de hoy están abiertas",
    bodyFree: (n, b) => n && n > 0
      ? `El board tiene ${n} más hoy. Base abre ${b} por deporte, Pro todo el board.`
      : `Mañana se recargan. Base abre ${b} por deporte, Pro todo el board.`,
    proof: (n) => `${n.toLocaleString("es-ES")} lecturas cerradas, cada una registrada antes del inicio`,
    ctaAnon: "Crea el perfil gratuito",
    ctaFree: "Ver Base",
    ctaBase: "Ver Pro",
    eyebrowBase: "Tu plan",
    titleBase: "Tus 7 lecturas por deporte de hoy están abiertas",
    bodyBase: (n) => n && n > 0
      ? `El board tiene ${n} más hoy. Pro abre todo el board, cada día.`
      : `Mañana se recargan. Pro abre todo el board, cada día.`,
    notNow: "Ahora no",
    compare: "Comparar planes",
    never: "No volver a mostrar",
    close: "Cerrar",
    legal: "Análisis estadístico, no consejos de apuestas",
    legalLink: "Juego responsable",
  },
  fr: {
    eyebrowAnon: "Profil gratuit",
    eyebrowFree: "Votre offre",
    titleAnon: "3 lectures complètes par jour, gratuites",
    bodyAnon: "Avec un profil gratuit, les 3 meilleures analyses par sport s'ouvrent chaque jour : la probabilité du modèle et le pourquoi. Pour aller plus loin, il y a Base et Pro.",
    titleFree: "Vos 3 lectures du jour sont ouvertes",
    bodyFree: (n, b) => n && n > 0
      ? `Le board en a ${n} de plus aujourd'hui. Base en ouvre ${b} par sport, Pro tout le board.`
      : `Elles se rechargent demain. Base en ouvre ${b} par sport, Pro tout le board.`,
    proof: (n) => `${n.toLocaleString("fr-FR")} lectures réglées, chacune enregistrée avant le coup d'envoi`,
    ctaAnon: "Créer le profil gratuit",
    ctaFree: "Voir Base",
    ctaBase: "Voir Pro",
    eyebrowBase: "Votre offre",
    titleBase: "Vos 7 lectures par sport du jour sont ouvertes",
    bodyBase: (n) => n && n > 0
      ? `Le board en a ${n} de plus aujourd'hui. Pro ouvre tout le board, chaque jour.`
      : `Elles se rechargent demain. Pro ouvre tout le board, chaque jour.`,
    notNow: "Pas maintenant",
    compare: "Comparer les offres",
    never: "Ne plus afficher",
    close: "Fermer",
    legal: "Analyse statistique, pas de conseil de pari",
    legalLink: "Jeu responsable",
  },
  ru: {
    eyebrowAnon: "Бесплатный профиль",
    eyebrowFree: "Ваш тариф",
    titleAnon: "3 полных прогноза в день, бесплатно",
    bodyAnon: "С бесплатным профилем каждый день открываются 3 лучших анализа на вид спорта: вероятность модели и почему. Нужно больше — есть Base и Pro.",
    titleFree: "Ваши 3 прогноза на сегодня открыты",
    bodyFree: (n, b) => n && n > 0
      ? `На борде сегодня ещё ${n}. Base открывает ${b} на вид спорта, Pro — весь борд.`
      : `Завтра они обновятся. Base открывает ${b} на вид спорта, Pro — весь борд.`,
    proof: (n) => `${n.toLocaleString("ru-RU")} закрытых прогнозов, каждый записан до начала матча`,
    ctaAnon: "Создать бесплатный профиль",
    ctaFree: "Смотреть Base",
    ctaBase: "Смотреть Pro",
    eyebrowBase: "Ваш тариф",
    titleBase: "Ваши 7 прогнозов на вид спорта на сегодня открыты",
    bodyBase: (n) => n && n > 0
      ? `На борде сегодня ещё ${n}. Pro открывает весь борд, каждый день.`
      : `Завтра они обновятся. Pro открывает весь борд, каждый день.`,
    notNow: "Не сейчас",
    compare: "Сравнить тарифы",
    never: "Больше не показывать",
    close: "Закрыть",
    legal: "Статистический анализ, не советы по ставкам",
    legalLink: "Ответственная игра",
  },
};

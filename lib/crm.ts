// lib/crm.ts
// Logica lifecycle CRM (#CRM-LIFECYCLE) — PURA e testabile. Determina il flow di
// un profilo (uno solo alla volta) e i trigger dovuti oggi.

export type CrmFlow = "onboarding" | "acquisition" | "retention" | "winback" | "none";

export type CrmProfile = {
  identifier: string;
  plan: string;
  language: string | null;
  created_at: string;
  activated_at: string | null;
  plan_expires_at: string | null;
  marketing_opt_out?: boolean;
  marketing_opt_in?: boolean;
};

export type Touchpoint = { key: string; flow: Exclude<CrmFlow, "none">; day: number };

// Consenso per-flow (legale-compliance 2026-06-28): l'acquisition (sconti marketing
// a utenti free MAI paganti) richiede OPT-IN ESPLICITO; retention/win-back/onboarding
// stanno sul soft opt-in clienti (già filtrato da isEligible). Finché non esiste la
// checkbox al signup, marketing_opt_in=false → nessuna email di acquisition.
//
// #CRM-RESEND-ENGINE-0817 — l'acquisition NON la manda più questo motore: la manda
// l'automation `Onboarding_Automation` su Resend (g2/g4/g7 = i testi di Steve, g10/
// g21/g28 = le tre offerte, g35 = il congedo), innescata da `Account_Activated` che
// `app/api/auth/activate/route.ts` spara SOLO con marketing_opt_in=true. Lasciare
// vivi anche i touchpoint di acquisition qui significherebbe due sequenze sulle
// stesse persone negli stessi giorni.
// Il copy dei 7 touchpoint resta in `lib/crm-content.ts` di proposito: se un giorno
// il motore torna nel codice basta togliere questa riga, e le chiavi invariate +
// `crm_trigger_sends` garantiscono che nessuno riceva due volte la stessa mail.
// Retention, win-back e `onb_activate` restano di questo motore.
export function flowAllowed(flow: CrmFlow, _p: CrmProfile): boolean {
  if (flow === "acquisition") return false;
  return true;
}

const DAY = 86_400_000;
const WINBACK_WINDOW_DAYS = 30;

function daysSince(fromISO: string, nowMs: number): number {
  return Math.floor((nowMs - new Date(fromISO).getTime()) / DAY);
}
function daysUntil(toISO: string, nowMs: number): number {
  return Math.floor((new Date(toISO).getTime() - nowMs) / DAY);
}

export function isEligible(p: CrmProfile): boolean {
  if (p.plan === "admin_full") return false;
  if (p.marketing_opt_out) return false;
  if (!p.identifier.includes("@")) return false;
  // Consenso = SOFT OPT-IN CLIENTI (decisione Andrea 2026-06-28, opzione A):
  // si contattano solo i clienti (base/premium) e gli utenti attivati. I profili
  // non attivati sono esclusi (niente marketing senza attivazione).
  return p.plan === "base" || p.plan === "premium" || p.activated_at != null;
}

export function resolveFlow(p: CrmProfile, nowISO: string): { flow: CrmFlow; dayInFlow: number } {
  const now = new Date(nowISO).getTime();
  if (p.plan === "admin_full") return { flow: "none", dayInFlow: 0 };

  // Retention: pagante non ancora scaduto. dayInFlow = giorni ALLA scadenza.
  if ((p.plan === "base" || p.plan === "premium") && p.plan_expires_at && new Date(p.plan_expires_at).getTime() > now) {
    return { flow: "retention", dayInFlow: Math.max(0, daysUntil(p.plan_expires_at, now)) };
  }

  // Onboarding: registrato ma non attivato. dayInFlow = giorni da created_at.
  if (!p.activated_at) {
    return { flow: "onboarding", dayInFlow: daysSince(p.created_at, now) };
  }

  // Win-back: ha una scadenza passata entro 30gg (ex-pagante). dayInFlow = giorni dalla scadenza.
  if (p.plan_expires_at) {
    const exp = new Date(p.plan_expires_at).getTime();
    if (exp <= now) {
      const since = daysSince(p.plan_expires_at, now);
      if (since <= WINBACK_WINDOW_DAYS) return { flow: "winback", dayInFlow: since };
    }
  }

  // Difesa: un cliente pagante (base/premium) non deve MAI finire in acquisition
  // (niente email di conversione "passa a Plus" a chi già paga). Se non è retention
  // né winback — es. dato anomalo: pagante senza plan_expires_at — → nessun flow.
  if (p.plan === "base" || p.plan === "premium") return { flow: "none", dayInFlow: 0 };

  // Acquisition: free attivato (default). dayInFlow = giorni da activated_at.
  return { flow: "acquisition", dayInFlow: daysSince(p.activated_at, now) };
}

export function dueTriggers(
  flow: CrmFlow,
  dayInFlow: number,
  touchpoints: Touchpoint[],
  alreadySent: Set<string>
): Touchpoint[] {
  const inFlow = touchpoints.filter((t) => t.flow === flow && !alreadySent.has(t.key));
  // Retention: `day` = giorni ALLA scadenza (decrescente) → match esatto (un `<=`
  // spammerebbe ogni giorno dell'ultima settimana).
  if (flow === "retention") return inFlow.filter((t) => t.day === dayInFlow);
  // Flussi ascendenti (day = giorni dall'ancora): includi tutti i dovuti (<=),
  // ordinati per day crescente. Il cron invia SOLO l'ultimo (il più recente) e
  // segna i precedenti come consumati → recupero senza burst né replay.
  return inFlow.filter((t) => t.day <= dayInFlow).sort((a, b) => a.day - b.day);
}

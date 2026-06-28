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
};

export type Touchpoint = { key: string; flow: Exclude<CrmFlow, "none">; day: number };

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

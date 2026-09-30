// lib/affiliate/config.ts — #AFFILIATE-V2-0930
// Parametri e flag del programma affiliati a commissione. Unico posto che li
// conosce: valori da env, default nel codice (PROPOSAL-tecnica §4.1, §4.5).
//
// Letti a OGNI chiamata (non congelati all'import): cambiare una env su Vercel e
// ridistribuire basta, e i test possono pilotarli senza ricaricare il modulo.
//
// Fail-safe: una env malformata ricade sul default, mai su un valore inventato.
// Per AFFILIATE_MODE il default è `off`, quindi un refuso spegne il ledger invece
// di accenderlo.

export type AffiliateMode = "off" | "shadow" | "live";

export const AFFILIATE_DEFAULTS = {
  /** Commissione sul primo acquisto netto dell'utente portato. */
  FIRST_RATE: 0.2,
  /** Commissione su ogni rinnovo netto, dal secondo mese. */
  RENEWAL_RATE: 0.07,
  /** Quanti rinnovi pagano. `null` = illimitato (decisione di Andrea, 2026-09-30;
   *  il legale consiglia 12). */
  RENEWAL_MAX_MONTHS: null as number | null,
  /** Giorni fra l'incasso e il momento in cui la commissione diventa pagabile. */
  HOLD_DAYS: 60,
  /** Entro quanti giorni dall'incasso un rimborso genera un clawback. */
  CLAWBACK_DAYS: 120,
  /** Soglia minima di payout in USD (decisione di Andrea: 50 $, mensile). */
  MIN_PAYOUT_USD: 50,
  /** Stessa finestra di oggi, che resta anche in lib/referral-code.ts. */
  ATTRIBUTION_WINDOW_DAYS: 60,
  MODE: "off" as AffiliateMode,
} as const;

export type AffiliateConfig = {
  firstRate: number;
  renewalRate: number;
  renewalMaxMonths: number | null;
  holdDays: number;
  clawbackDays: number;
  minPayoutUsd: number;
  attributionWindowDays: number;
  mode: AffiliateMode;
};

type Env = Record<string, string | undefined>;

/** Un tasso valido sta in [0, 1]. */
function rate(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : fallback;
}

/** Intero ≥ 0. */
function days(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

/** Importo ≥ 0. */
function usd(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Vuoto, assente o "null" = illimitato; altrimenti un intero ≥ 0. */
function maxMonths(raw: string | undefined, fallback: number | null): number | null {
  if (raw == null) return fallback;
  const t = raw.trim().toLowerCase();
  if (t === "" || t === "null") return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

export function affiliateMode(env: Env = process.env): AffiliateMode {
  const m = (env.AFFILIATE_MODE ?? "").trim().toLowerCase();
  return m === "shadow" || m === "live" ? m : "off";
}

export function affiliateConfig(env: Env = process.env): AffiliateConfig {
  const d = AFFILIATE_DEFAULTS;
  return {
    firstRate: rate(env.AFFILIATE_FIRST_RATE, d.FIRST_RATE),
    renewalRate: rate(env.AFFILIATE_RENEWAL_RATE, d.RENEWAL_RATE),
    renewalMaxMonths: maxMonths(env.AFFILIATE_RENEWAL_MAX_MONTHS, d.RENEWAL_MAX_MONTHS),
    holdDays: days(env.AFFILIATE_HOLD_DAYS, d.HOLD_DAYS),
    clawbackDays: days(env.AFFILIATE_CLAWBACK_DAYS, d.CLAWBACK_DAYS),
    minPayoutUsd: usd(env.AFFILIATE_MIN_PAYOUT_USD, d.MIN_PAYOUT_USD),
    attributionWindowDays: days(env.AFFILIATE_ATTRIBUTION_WINDOW_DAYS, d.ATTRIBUTION_WINDOW_DAYS),
    mode: affiliateMode(env),
  };
}

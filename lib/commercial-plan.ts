// #RETIRE-BASE-1031 (Andrea, 31/10): Base non si vende più. Pubblicamente esiste
// un solo piano pagato, Pro. `CheckoutPlanKey` resta "base" | "premium" perché è
// il formato che il backend sa ancora LEGGERE (rinnovo di chi è già su Base,
// ordini/webhook/grant esistenti): "non acquistabile" ≠ "non gestibile". Chi
// decide se un acquisto 'base' passa è `blocksRetiredPlanPurchase`, sotto.
export type PublicPlanKey = "premium";
export type CheckoutPlanKey = "base" | "premium";
export type SupportedLang = "it" | "en" | "es" | "fr" | "ru";

// I due piani pagati pubblici (#PLANS-3TIER-1).
// base = BetRedge Base (vetrina 7/sport al giorno); premium = BetRedge Pro (tutto).
// I numeri veri stanno in lib/access-projection.ts (showcaseAllowance): qui è
// solo un promemoria, non una seconda fonte.
export const PUBLIC_PAID_PLANS = {
  // #UI-USD-DISPLAY-0623: prezzi presentati in USD ($) lato pubblico. SOLO display:
  // `amountUsdt` (l'importo addebitato in USDT) NON cambia, così la logica di
  // checkout/pricing resta identica. Il rail crypto (USDT TRC20) resta indicato a
  // parte nella PlansTab.
  base: {
    key: "base" as const,
    amountUsdt: 14.99,
    label: { it: "BetRedge Base", en: "BetRedge Base" },
    priceLabel: { it: "$14.99/mese", en: "$14.99/month" },
  },
  premium: {
    key: "premium" as const,
    amountUsdt: 29.99,
    label: { it: "BetRedge Pro", en: "BetRedge Pro" },
    priceLabel: { it: "$29.99/mese", en: "$29.99/month" },
  },
} as const;

// Il "piano pagato di default": Pro (#RETIRE-BASE-1031 — era Base, l'entry).
// L'entry `base` sopra resta come record del listino storico (abbonati
// esistenti), ma non è più fra le chiavi pubbliche.
export const PUBLIC_PAID_PLAN = PUBLIC_PAID_PLANS.premium;

export const PUBLIC_PLAN_KEYS: PublicPlanKey[] = ["premium"];

function planDef(plan: PublicPlanKey) {
  return PUBLIC_PAID_PLANS[plan] ?? PUBLIC_PAID_PLANS.premium;
}

export function planPriceCopy(plan: PublicPlanKey, lang: SupportedLang): string {
  const p = planDef(plan);
  return lang === "it" ? p.priceLabel.it : p.priceLabel.en;
}

export function planAmountUsdt(plan: PublicPlanKey): number {
  return planDef(plan).amountUsdt;
}

export function planLabel(plan: PublicPlanKey, lang: SupportedLang): string {
  const p = planDef(plan);
  return lang === "it" ? p.label.it : p.label.en;
}

export function normalizeCheckoutPlan(value: unknown): CheckoutPlanKey | null {
  if (value === "base") return "base";
  if (value === "premium") return "premium";
  return null;
}

// ── #RETIRE-BASE-1031: piani ritirati ────────────────────────────────────────
// Un piano ritirato non si può più COMPRARE da nuovi clienti, ma resta GESTITO:
// webhook, capture, callback, cron di scadenza, grant e admin continuano a
// leggerlo e rinnovarlo. L'unico acquisto ancora ammesso è il rinnovo di chi
// ha già quel piano attivo (currentPlan = piano effettivo, expiry-adjusted).
export const RETIRED_PLAN_KEYS: readonly string[] = ["base"];

export function isRetiredPlan(plan: unknown): boolean {
  return typeof plan === "string" && RETIRED_PLAN_KEYS.includes(plan);
}

export function blocksRetiredPlanPurchase(requested: unknown, currentPlan: string | null | undefined): boolean {
  return isRetiredPlan(requested) && currentPlan !== requested;
}

// Status + corpo del rifiuto, identici su ogni rail.
export const RETIRED_PLAN_STATUS = 409;
export const RETIRED_PLAN_BODY = {
  error: "plan_retired",
  message:
    "BetRedge Base is no longer available for new purchases. Choose BetRedge Pro ($29.99/month or $329.99/year). Existing Base subscriptions are not affected.",
} as const;

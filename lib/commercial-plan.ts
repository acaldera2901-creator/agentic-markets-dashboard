export type PublicPlanKey = "base" | "premium";
export type CheckoutPlanKey = "base" | "premium";
export type SupportedLang = "it" | "en" | "es" | "fr" | "ru";

// I due piani pagati pubblici (#PLANS-3TIER-1).
// base = BetRedge Base (vetrina top 5/sport); premium = BetRedge Pro (tutto).
export const PUBLIC_PAID_PLANS = {
  base: {
    key: "base" as const,
    amountUsdt: 19.9,
    label: { it: "BetRedge Base", en: "BetRedge Base" },
    priceLabel: { it: "19.90 USDT/mese", en: "19.90 USDT/month" },
  },
  premium: {
    key: "premium" as const,
    amountUsdt: 49.9,
    label: { it: "BetRedge Pro", en: "BetRedge Pro" },
    priceLabel: { it: "49.90 USDT/mese", en: "49.90 USDT/month" },
  },
} as const;

// Compat: alcuni call-site usano ancora il "piano pagato di default" (= base, l'entry).
export const PUBLIC_PAID_PLAN = PUBLIC_PAID_PLANS.base;

export const PUBLIC_PLAN_KEYS: PublicPlanKey[] = ["base", "premium"];

function planDef(plan: PublicPlanKey) {
  return PUBLIC_PAID_PLANS[plan] ?? PUBLIC_PAID_PLANS.base;
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

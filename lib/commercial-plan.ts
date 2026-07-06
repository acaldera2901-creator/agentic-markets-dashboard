export type PublicPlanKey = "base" | "premium";
export type CheckoutPlanKey = "base" | "premium";
export type SupportedLang = "it" | "en" | "es" | "fr" | "ru";

// I due piani pagati pubblici (#PLANS-3TIER-1).
// base = BetRedge Base (vetrina top 5/sport); premium = BetRedge Pro (tutto).
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

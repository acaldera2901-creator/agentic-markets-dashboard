export type PublicPlanKey = "base";
export type CheckoutPlanKey = "base" | "premium";
export type SupportedLang = "it" | "en" | "es" | "fr" | "ru";

export const PUBLIC_PAID_PLAN = {
  key: "base" as const,
  amountUsdt: 49.5,
  label: {
    it: "Signal Desk Pro",
    en: "Signal Desk Pro",
  },
  priceLabel: {
    it: "49.50 USDT/mese",
    en: "49.50 USDT/month",
  },
};

export const PUBLIC_PLAN_KEYS: PublicPlanKey[] = [PUBLIC_PAID_PLAN.key];

export function planPriceCopy(plan: PublicPlanKey, lang: SupportedLang): string {
  void plan;
  return lang === "it" ? PUBLIC_PAID_PLAN.priceLabel.it : PUBLIC_PAID_PLAN.priceLabel.en;
}

export function planAmountUsdt(plan: PublicPlanKey): number {
  void plan;
  return PUBLIC_PAID_PLAN.amountUsdt;
}

export function normalizeCheckoutPlan(value: unknown): PublicPlanKey | null {
  if (value === "base" || value === "premium") return "base";
  return null;
}

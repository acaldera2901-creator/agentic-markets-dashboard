import Stripe from "stripe";
import type { Plan } from "./auth";

// Lazily-built singleton: env può non essere configurato (USDT-only) e in quel
// caso il modulo è "spento" — i route handler rispondono 503 senza crashare.
let _client: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_BASE &&
      process.env.STRIPE_PRICE_PREMIUM
  );
}

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("[stripe] STRIPE_SECRET_KEY not configured");
  }
  if (!_client) _client = new Stripe(process.env.STRIPE_SECRET_KEY);
  return _client;
}

// Solo i due piani pagati pubblici hanno un Price Stripe.
export type StripePlan = Extract<Plan, "base" | "premium">;

export function planToPriceId(plan: StripePlan): string {
  const id =
    plan === "premium" ? process.env.STRIPE_PRICE_PREMIUM : process.env.STRIPE_PRICE_BASE;
  if (!id) throw new Error(`[stripe] missing price id for plan ${plan}`);
  return id;
}

export function resolvePlanFromPriceId(priceId: string | undefined | null): StripePlan | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_BASE) return "base";
  if (priceId === process.env.STRIPE_PRICE_PREMIUM) return "premium";
  return null;
}

export function periodEndToIso(periodEndUnixSeconds: number | null | undefined): string | null {
  if (!periodEndUnixSeconds) return null;
  return new Date(periodEndUnixSeconds * 1000).toISOString();
}

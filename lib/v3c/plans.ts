// lib/v3c/plans.ts (#REDESIGN-V3C F8-UI · filone pages)
// Free + Pro, lato presentazione. Regola di Andrea (05/10): solo DUE piani; Pro è
// l'attuale «premium», al suo prezzo. Qui nessun numero è scritto a mano:
//   · il prezzo mensile viene da lib/commercial-plan.ts (la stessa fonte del checkout);
//   · l'annuale da lib/paygate.ts (PAYGATE_PRICES, server-side del rail carta),
//     e si mostra SOLO se quel rail è acceso (NEXT_PUBLIC_PAYGATE_ENABLED), perché
//     il toggle annuale esiste solo lì dentro il checkout;
//   · i rail di pagamento si leggono dalle STESSE variabili che accendono i bottoni
//     nel CheckoutModal di app/app/page.tsx — la pagina prezzi non promette un
//     metodo che il checkout non mostra.
// SOLO SERVER: importa lib/paygate (node:crypto). Il client usa ./checkout-link.
// Il piano «base» resta nel DB e nel checkout (migrazione base→Pro = altro filone,
// PROPOSAL): qui semplicemente non esiste.
import { PUBLIC_PAID_PLANS } from "@/lib/commercial-plan";
import { PAYGATE_PRICES } from "@/lib/paygate";

export type ProPlan = {
  /** chiave di checkout esistente: Pro = premium */
  key: "premium";
  monthly: number;
  /** null quando il rail annuale non è acceso */
  annual: number | null;
};

type Env = Record<string, string | undefined>;

/** Il piano Pro come lo vende oggi il checkout. */
export function proPlan(env: Env): ProPlan {
  const annualOn = env.NEXT_PUBLIC_PAYGATE_ENABLED === "true";
  return {
    key: "premium",
    monthly: PUBLIC_PAID_PLANS.premium.amountUsdt,
    annual: annualOn ? PAYGATE_PRICES.premium.annual : null,
  };
}

export type Rail = "card" | "crypto" | "paypal" | "usdt";

/**
 * I metodi che il checkout mostra davvero, nello stesso ordine e con le stesse
 * condizioni del CheckoutModal: carta (PayGate/Shopify, abbonamento che si
 * rinnova), crypto Shopify (una volta, 30 giorni), PayPal, e — solo a PayGate
 * spento — il bonifico USDT con tx hash.
 */
export function checkoutRails(env: Env): Rail[] {
  const out: Rail[] = [];
  if (env.NEXT_PUBLIC_PAYGATE_ENABLED === "true") out.push("card");
  if (env.NEXT_PUBLIC_PAYGATE_ENABLED === "true" && env.NEXT_PUBLIC_SHOPIFY_CRYPTO_ENABLED === "true") out.push("crypto");
  if (env.NEXT_PUBLIC_PAYPAL_CLIENT_ID) out.push("paypal");
  // il bonifico USDT con tx hash il modale lo mostra solo quando PayGate è spento
  if (env.NEXT_PUBLIC_PAYGATE_ENABLED !== "true") out.push("usdt");
  return out;
}

/**
 * La promo di lancio, se è accesa e ha una scadenza VERA: la data, mai un
 * countdown (nessun timer nella pagina prezzi, DIRECTION + POSITIONING §4).
 */
export function launchPromo(env: Env, now: Date): { until: string } | null {
  if (env.NEXT_PUBLIC_LAUNCH_PROMO_ENABLED !== "true") return null;
  const d = new Date(env.NEXT_PUBLIC_LAUNCH_PROMO_DEADLINE ?? "");
  if (!Number.isFinite(d.getTime()) || now >= d) return null;
  return { until: d.toISOString().slice(0, 10) };
}

export { usd } from "./paywall";
export { CHECKOUT_PARAM, PRO_CHECKOUT_HREF, FREE_SIGNUP_HREF, SIGN_IN_HREF, checkoutDeepLink } from "./checkout-link";

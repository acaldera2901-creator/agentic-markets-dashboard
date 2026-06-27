// lib/paygate.ts
// Client PayGate.to (#PAYGATE-PAY). REST, no SDK, no API key (stile lib/email.ts).
// Due step: wallet.php (genera address_in cifrato + callback unico) → pay.php
// (redirect multi-provider). Il callback di pagamento NON è firmato: la verifica
// anti-spoof vive in evaluateCallback (token monouso + importo).

import crypto from "node:crypto";

const WALLET_ENDPOINT = "https://api.paygate.to/control/wallet.php";
const PAY_ENDPOINT = "https://checkout.paygate.to/pay.php";
const DEFAULT_FEE_TOLERANCE = 0.02; // 2%: copre lo scostamento fee/cambio sul value_coin

export type PlanKey = "base" | "premium";
export type Period = "monthly" | "annual";

// Prezzi server-side (USD). Mai dal client. Annuali arrotondati (decisione Andrea).
export const PAYGATE_PRICES: Record<PlanKey, Record<Period, number>> = {
  base: { monthly: 19.9, annual: 169 },
  premium: { monthly: 49.9, annual: 419 },
};

export function amountFor(plan: PlanKey, period: Period): number {
  const byPeriod = PAYGATE_PRICES[plan];
  if (!byPeriod) throw new Error(`invalid plan: ${String(plan)}`);
  const amt = byPeriod[period];
  if (amt == null) throw new Error(`invalid period: ${String(period)}`);
  return amt;
}

export function periodDays(period: Period): number {
  if (period === "monthly") return 30;
  if (period === "annual") return 365;
  throw new Error(`invalid period: ${String(period)}`);
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function newOrderToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

// Decisione di concessione — PURA (testabile). Strati (a) token già risolto dal
// caller (qui riceve l'ordine trovato per token_hash) e (b) importo.
export function evaluateCallback(opts: {
  order: { status: string; amount_usd: number } | null;
  valueCoin: number | null;
  feeTolerance?: number;
}): { grant: boolean; reason: string } {
  const tol = opts.feeTolerance ?? DEFAULT_FEE_TOLERANCE;
  if (!opts.order) return { grant: false, reason: "order not found" };
  if (opts.order.status !== "pending") return { grant: false, reason: "order not pending" };
  if (opts.valueCoin == null || !Number.isFinite(opts.valueCoin)) return { grant: false, reason: "missing value_coin" };
  if (opts.valueCoin < opts.order.amount_usd * (1 - tol)) return { grant: false, reason: "amount below threshold" };
  return { grant: true, reason: "ok" };
}

export async function createReceivingWallet(
  payoutAddress: string,
  callbackUrl: string
): Promise<{ addressIn: string; polygonAddressIn: string; ipnToken: string }> {
  const url = `${WALLET_ENDPOINT}?address=${encodeURIComponent(payoutAddress)}&callback=${encodeURIComponent(callbackUrl)}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`paygate wallet.php failed: ${resp.status}`);
  const data = (await resp.json()) as { address_in?: string; polygon_address_in?: string; ipn_token?: string };
  if (!data.address_in) throw new Error("paygate wallet.php: missing address_in");
  return {
    addressIn: data.address_in,
    polygonAddressIn: data.polygon_address_in ?? "",
    ipnToken: data.ipn_token ?? "",
  };
}

export function buildPayUrl(opts: { addressIn: string; amount: number; email: string }): string {
  // URLSearchParams ri-encoda il valore address_in (che contiene già %2F/%3D)
  // una volta, come richiede PayGate (es. %2F -> %252F).
  const p = new URLSearchParams({
    address: opts.addressIn,
    amount: String(opts.amount),
    email: opts.email,
    currency: "USD",
  });
  return `${PAY_ENDPOINT}?${p.toString()}`;
}


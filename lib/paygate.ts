// lib/paygate.ts
// Client PayGate.to (#PAYGATE-PAY). REST, no SDK, no API key (stile lib/email.ts).
// Due step: wallet.php (genera address_in cifrato + callback unico) → pay.php
// (redirect multi-provider). Il callback di pagamento NON è firmato: la verifica
// anti-spoof vive in evaluateCallback (token monouso + importo).

import crypto from "node:crypto";

// Host configurabili per il white-label (dominio custom su Cloudflare Worker).
// Default = domini PayGate → comportamento invariato finché le env NON sono settate.
// Il blocco DNS/VPN colpisce SOLO la pagina hosted vista dall'utente (checkout host);
// le chiamate API (wallet/status) sono server-side dal nostro backend → non bloccate,
// quindi basta proxare il SOLO checkout host. Quando il checkout host è custom,
// passiamo `domain=<host>` a wallet.php/pay.php: è il meccanismo white-label ufficiale
// (replica ciò che il Cloudflare Worker fa sulle richieste API) → PayGate genera la
// pagina hosted e i link interni (process-payment.php) sul nostro dominio.
const API_HOST = process.env.PAYGATE_API_HOST || "api.paygate.to";
const CHECKOUT_HOST = process.env.PAYGATE_CHECKOUT_HOST || "checkout.paygate.to";
const WHITE_LABEL = CHECKOUT_HOST !== "checkout.paygate.to";

const WALLET_ENDPOINT = `https://${API_HOST}/control/wallet.php`;
const PAY_ENDPOINT = `https://${CHECKOUT_HOST}/pay.php`;
const STATUS_ENDPOINT = `https://${API_HOST}/control/payment-status.php`;
// PayGate accredita gli USDC AL NETTO delle sue fee (card→crypto), quindi il
// `value_coin` del callback è sensibilmente < importo richiesto. L'autenticità
// vera è il token monouso; l'importo è fisso nel link (l'utente non può pagare
// meno), perciò qui teniamo solo un FLOOR di sanità generoso (accetta fino a
// -50%) per scartare callback a zero/malformati senza falsi rifiuti sulle fee.
const DEFAULT_FEE_TOLERANCE = 0.5;

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
  // white-label: domain=<checkout host> → PayGate genera la pagina hosted sul nostro dominio
  const domainParam = WHITE_LABEL ? `&domain=${encodeURIComponent(CHECKOUT_HOST)}` : "";
  const url = `${WALLET_ENDPOINT}?address=${encodeURIComponent(payoutAddress)}&callback=${encodeURIComponent(callbackUrl)}${domainParam}`;
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

// Branding della pagina hosted PayGate (pay.php): logo + tema verde BetRedge.
const PAY_LOGO = "https://www.betredge.com/logos/betredge-logo-black.png";
const PAY_THEME = "#23A559"; // verde BetRedge (rebrand)

export function buildPayUrl(opts: { addressIn: string; amount: number; email: string }): string {
  // URLSearchParams ri-encoda il valore address_in (che contiene già %2F/%3D)
  // una volta, come richiede PayGate (es. %2F -> %252F).
  const p = new URLSearchParams({
    address: opts.addressIn,
    amount: String(opts.amount),
    email: opts.email,
    currency: "USD",
    logo: PAY_LOGO,
    theme: PAY_THEME,
    button: PAY_THEME,
  });
  // white-label: rende i link interni della pagina hosted sul nostro dominio
  if (WHITE_LABEL) p.set("domain", CHECKOUT_HOST);
  return `${PAY_ENDPOINT}?${p.toString()}`;
}

// #PAYGATE-PREFLIGHT-0629 finding #1: verifica server-side dell'esito reale presso
// PayGate (non fidarsi del callback non firmato). GET payment-status.php?ipn_token=…
// → { status:'paid'|'unpaid', value_coin, txid_out, coin }. Doc: uso "casual" (1
// chiamata per callback). Ritorna null se la chiamata fallisce (→ il caller NON concede).
export async function checkPaymentStatus(
  ipnToken: string
): Promise<{ status: string; valueCoin: number | null; txidOut: string | null } | null> {
  if (!ipnToken) return null;
  let resp: Response;
  try {
    resp = await fetch(`${STATUS_ENDPOINT}?ipn_token=${encodeURIComponent(ipnToken)}`);
  } catch {
    return null;
  }
  if (!resp.ok) return null;
  const d = (await resp.json().catch(() => null)) as
    | { status?: string; value_coin?: string | number; txid_out?: string }
    | null;
  if (!d) return null;
  const v = d.value_coin;
  return {
    status: typeof d.status === "string" ? d.status : "",
    valueCoin: v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null,
    txidOut: typeof d.txid_out === "string" ? d.txid_out : null,
  };
}


// lib/paygate.ts
// Client PayGate.to (#PAYGATE-PAY). REST, no SDK, no API key (stile lib/email.ts).
// Due step: wallet.php (genera address_in cifrato + callback unico) → pay.php
// (redirect multi-provider). Il callback di pagamento NON è firmato: la verifica
// anti-spoof vive in evaluateCallback (token monouso + importo).

import crypto from "node:crypto";

// Host configurabili per il white-label (#PAYGATE-WL-DOMAIN, Cloudflare Worker
// su checkout.betredge.com). Default = domini PayGate → comportamento invariato
// finché PAYGATE_CHECKOUT_HOST non è settata. Solo l'host del checkout hosted
// (visto dall'utente) va white-labeled: le chiamate wallet.php/payment-status.php
// sono server-side dal nostro backend, non toccate da blocchi VPN/DNS lato client.
const CHECKOUT_HOST = process.env.PAYGATE_CHECKOUT_HOST || "checkout.paygate.to";
const WHITE_LABEL = CHECKOUT_HOST !== "checkout.paygate.to";

const WALLET_ENDPOINT = "https://api.paygate.to/control/wallet.php";
const PAY_ENDPOINT = `https://${CHECKOUT_HOST}/pay.php`;
const STATUS_ENDPOINT = "https://api.paygate.to/control/payment-status.php";
// PayGate accredita gli USDC AL NETTO delle sue fee (card→crypto), quindi il
// `value_coin` del callback è sensibilmente < importo richiesto. L'autenticità
// vera è il token monouso; l'importo è fisso nel link (l'utente non può pagare
// meno), perciò qui teniamo solo un FLOOR di sanità generoso (accetta fino a
// -50%) per scartare callback a zero/malformati senza falsi rifiuti sulle fee.
const DEFAULT_FEE_TOLERANCE = 0.5;

export type PlanKey = "base" | "premium";
export type Period = "monthly" | "annual";

// Prezzi server-side (USD). Mai dal client.
// #PRICING-CREATORS-0706: mensili 14.99/29.99 (decisione Andrea, council
// 06/07); annuali = 11 MENSILITA arrotondate al numero psicologico (decisione
// Michele 06/07): 14.99x11=164.89->164.99 - 29.99x11=329.89->329.99. Lo sconto
// annunciato in UI e' "1 mese gratis" (vs 12x: -14.89/-29.87, ~1 mensilita).
export const PAYGATE_PRICES: Record<PlanKey, Record<Period, number>> = {
  base: { monthly: 14.99, annual: 164.99 },
  premium: { monthly: 29.99, annual: 329.99 },
};

// ── #PRICING-CREATORS-0706 (rev. Michele): promo di LANCIO -50% primo mese ──
// Vale per TUTTI (non è legata ai creator — il link creator fa SOLO
// attribuzione). Sconto SOLO server-side, mai dal client. DARK finché
// LAUNCH_PROMO_ENABLED non è "true" (attivazione al gate, dopo la conferma T1
// di Tommy sugli importi variabili PayGate). La deadline è REALE e unica per
// la campagna di lancio (~1 mese; A4 FTC: niente countdown per-utente che si
// resetta); scaduta la data, lo sconto si spegne da solo anche lato server.
export const LAUNCH_PROMO_DISCOUNT = 0.5; // -50% sul primo ciclo mensile

export function launchPromoActive(now: Date = new Date()): boolean {
  if (process.env.LAUNCH_PROMO_ENABLED !== "true") return false;
  const deadline = process.env.LAUNCH_PROMO_DEADLINE;
  if (!deadline) return false; // niente deadline reale = niente promo (A4)
  const d = new Date(deadline);
  return Number.isFinite(d.getTime()) && now < d;
}

// Importo effettivo al checkout. Lo sconto si applica SOLO se: promo attiva
// (flag + deadline reale) e PRIMO ordine pagato dell'utente. Vale su OGNI
// periodo (rev. Michele: durante il lancio anche il primo acquisto ANNUALE e'
// a meta' prezzo; il rinnovo torna pieno). Nessuna condizione referral.
export function discountedAmountFor(
  plan: PlanKey,
  period: Period,
  opts: { firstPaidOrder: boolean; now?: Date }
): { amount: number; discounted: boolean } {
  const full = amountFor(plan, period);
  if (!opts.firstPaidOrder || !launchPromoActive(opts.now)) {
    return { amount: full, discounted: false };
  }
  const amount = Math.round(full * (1 - LAUNCH_PROMO_DISCOUNT) * 100) / 100;
  return { amount, discounted: true };
}

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
  // white-label: domain=<checkout host> → PayGate genera la pagina hosted E i
  // link interni (process-payment.php) sul nostro dominio invece di checkout.paygate.to.
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
  // #PAYGATE-ENCODE-FIX: address_in da wallet.php è GIÀ url-encoded (contiene
  // %2F/%2B/%3D) → va passato COSÌ COM'È, concatenato direttamente (come l'esempio
  // ufficiale PHP di PayGate). Passarlo dentro URLSearchParams lo doppio-encodava
  // (%2F→%252F) e PayGate rifiutava con "Provided wallet address is not allowed".
  // Gli ALTRI parametri vanno invece encodati normalmente.
  const rest = new URLSearchParams({
    amount: String(opts.amount),
    email: opts.email,
    currency: "USD",
    logo: PAY_LOGO,
    theme: PAY_THEME,
    button: PAY_THEME,
  });
  return `${PAY_ENDPOINT}?address=${opts.addressIn}&${rest.toString()}`;
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


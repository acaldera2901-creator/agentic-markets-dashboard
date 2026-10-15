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

import { catalogContracts } from "@/lib/crypto-coins";
import { PAYOUT_COINS, PAYOUT_NETWORKS, type PayoutCoin, type PayoutNetwork } from "./wallet";

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

/**
 * AFFILIATE_MODE governa il LEDGER e l'iscrizione, NON i payout (QA F12):
 *  · off    → nessuna riga nel ledger; /join e PUT /wallet chiusi (403).
 *  · shadow → righe `shadow`; /join e PUT /wallet APERTI, ma solo se c'è anche
 *             AFFILIATE_TERMS_VERSION (senza T&C pubblicati l'iscrizione resta
 *             chiusa: è quello il secondo interruttore, voluto, non un altro flag).
 *  · live   → righe `pending` che maturano.
 * I payout admin li accende/spegne SOLO AFFILIATE_PAYOUTS (affiliatePayoutsMode):
 * con AFFILIATE_MODE=off e AFFILIATE_PAYOUTS=live un payout già maturato si può
 * ancora creare e registrare. Per fermare i soldi in uscita: AFFILIATE_PAYOUTS=off.
 */
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

// ── Payout crypto: D1–D5 (PROPOSAL-crypto-payout.md §8) ──────────────────────
// I default sono le RACCOMANDAZIONI della PROPOSAL, NON decisioni: Andrea ha
// chiesto di rivederle (15/10/2026). Per questo stanno in env e non nel codice:
// cambiare una scelta = cambiare una env, non una migration. Lo schema
// (affiliate_wallets / affiliate_payouts) ammette già tutte le alternative.
// Separato da affiliateConfig: i payout non esistono finché PR-9 non è live.

export type NetworkFeePayer = "betredge" | "affiliate";

export const PAYOUT_DEFAULTS = {
  /** D1 — reti accese al lancio. Raccomandato: solo Polygon (Tron solo col suo verificatore). */
  NETWORKS: ["polygon"] as PayoutNetwork[],
  /** D5 — coin accese. Raccomandato: solo USDT (USDC per chi è in UE/MiCA, su richiesta). */
  COINS: ["USDT"] as PayoutCoin[],
  /** D4 — chi paga la fee di rete. Raccomandato: BetRedge (su Polygon sono centesimi). */
  NETWORK_FEE_PAYER: "betredge" as NetworkFeePayer,
  /** D3 — KYC minimo (nome legale + paese + autodichiarazione) alla registrazione del wallet. */
  KYC_AT_WALLET: true,
} as const;

export type PayoutConfig = {
  networks: PayoutNetwork[];
  coins: PayoutCoin[];
  networkFeePayer: NetworkFeePayer;
  kycAtWallet: boolean;
  /** D2 — indirizzo PUBBLICO del wallet di uscita (mai chiavi). `null` = non configurato. */
  payoutFrom: string | null;
};

/** CSV filtrato sulla lista ammessa dallo schema; vuoto o tutto invalido = default. */
function csvList<T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
  fallback: readonly T[],
  norm: (s: string) => string,
): T[] {
  if (raw == null || raw.trim() === "") return [...fallback];
  const picked = raw
    .split(",")
    .map((s) => norm(s.trim()))
    .filter((s): s is T => (allowed as readonly string[]).includes(s));
  const unique = [...new Set(picked)];
  return unique.length > 0 ? unique : [...fallback];
}

/** Fail-safe verso il più prudente: solo "0"/"false"/"off" spengono il KYC. */
function kycFlag(raw: string | undefined, fallback: boolean): boolean {
  if (raw == null || raw.trim() === "") return fallback;
  const t = raw.trim().toLowerCase();
  if (t === "0" || t === "false" || t === "off") return false;
  if (t === "1" || t === "true" || t === "on") return true;
  return fallback;
}

/**
 * D2 — il default raccomandato è un wallet DEDICATO ai payout: se
 * AFFILIATE_PAYOUT_FROM coincide col wallet degli incassi PayGate (che
 * esporrebbe agli affiliati tutti gli incassi on-chain) vale come non
 * configurato. Se Andrea decide di riusarlo, si toglie questo controllo.
 * Solo formato EVM: è l'unica rete con un verificatore on-chain nel repo.
 */
function payoutFromAddress(env: Env): string | null {
  const raw = (env.AFFILIATE_PAYOUT_FROM ?? "").trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(raw)) return null;
  if (/^0x0{40}$/i.test(raw)) return null;
  const treasury = (env.PAYGATE_PAYOUT_WALLET ?? "").trim().toLowerCase();
  if (treasury !== "" && raw.toLowerCase() === treasury) return null;
  return raw;
}

export function payoutConfig(env: Env = process.env): PayoutConfig {
  const d = PAYOUT_DEFAULTS;
  let coins = csvList(env.AFFILIATE_PAYOUT_COINS, PAYOUT_COINS, d.COINS, (s) => s.toUpperCase());
  const networks = csvList(env.AFFILIATE_PAYOUT_NETWORKS, PAYOUT_NETWORKS, d.NETWORKS, (s) => s.toLowerCase());
  // USDC esiste solo su Polygon: con Tron unica rete accesa resta solo USDT.
  if (!networks.includes("polygon")) coins = coins.filter((c) => c !== "USDC");
  if (coins.length === 0) coins = ["USDT"];
  const fee = (env.AFFILIATE_NETWORK_FEE_PAYER ?? "").trim().toLowerCase();
  return {
    networks,
    coins,
    networkFeePayer: fee === "betredge" || fee === "affiliate" ? fee : d.NETWORK_FEE_PAYER,
    kycAtWallet: kycFlag(env.AFFILIATE_KYC_AT_WALLET, d.KYC_AT_WALLET),
    payoutFrom: payoutFromAddress(env),
  };
}

// ── T&C affiliati (PR-5) ──────────────────────────────────────────────────────
/**
 * Versione dei T&C affiliati in vigore, da `AFFILIATE_TERMS_VERSION`. Nessun
 * default: i T&C non sono pubblicati e una versione inventata registrerebbe un
 * consenso a un testo che non esiste. Senza env l'iscrizione è chiusa (null).
 * La stessa versione copre la terza spunta (clausole onerose) e le
 * autodichiarazioni D3 al wallet: è un solo documento.
 */
export function affiliateTermsVersion(env: Env = process.env): string | null {
  const v = (env.AFFILIATE_TERMS_VERSION ?? "").trim();
  return /^[A-Za-z0-9._-]{1,40}$/.test(v) ? v : null;
}

// ── Payout admin (PR-9) ───────────────────────────────────────────────────────
export type PayoutsMode = "off" | "live";

/** AFFILIATE_PAYOUTS: solo "live" accende creazione e registrazione dei payout.
 *  Default e qualsiasi refuso = "off" (il rollback senza toccare i dati). */
export function affiliatePayoutsMode(env: Env = process.env): PayoutsMode {
  return (env.AFFILIATE_PAYOUTS ?? "").trim().toLowerCase() === "live" ? "live" : "off";
}

/**
 * QA F3 — tolleranza al RIBASSO sull'importo ricevuto on-chain: paid se
 * ricevuto ≥ dovuto × ratio. Default 0.99 (la stessa di lib/crypto-verify.ts,
 * nata per chi incolla l'importo a mano). Andrea valuta se portarla a 1 (≥100 %):
 * per questo è una env e non una costante. Ammessi solo valori in [0.9, 1];
 * fuori range o malformato → 0.99.
 */
export const DEFAULT_PAYOUT_MIN_RATIO = 0.99;
export function affiliatePayoutMinRatio(env: Env = process.env): number {
  const raw = (env.AFFILIATE_PAYOUT_MIN_RATIO ?? "").trim();
  if (raw === "") return DEFAULT_PAYOUT_MIN_RATIO;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0.9 && n <= 1 ? n : DEFAULT_PAYOUT_MIN_RATIO;
}

/** QA F3 — oltre questo rapporto il pagamento è comunque `paid` (i fondi sono
 *  partiti) ma segnalato come `overpaid`, con alert ops: è un errore di invio. */
export const PAYOUT_OVERPAY_RATIO = 1.01;

/** RPC JSON di Polygon per la verifica dei payout PER HASH (eth_getTransactionReceipt).
 *  Default publicnode: misurato il 15/10/2026, risponde a receipt e blockNumber
 *  senza key (Blockscout era dietro una challenge Cloudflare dalla nostra rete).
 *  Solo https. Un RPC che mente può solo far segnare `paid` per errore, non
 *  muovere fondi: il server non firma niente. */
export const DEFAULT_POLYGON_RPC_URL = "https://polygon-bor-rpc.publicnode.com";

export function affiliatePolygonRpcUrl(env: Env = process.env): string {
  const raw = (env.AFFILIATE_POLYGON_RPC_URL ?? "").trim();
  try {
    if (raw && new URL(raw).protocol === "https:") return raw;
  } catch {
    /* malformato → default */
  }
  return DEFAULT_POLYGON_RPC_URL;
}

// ── Denylist dei destinatari (QA F6) ─────────────────────────────────────────
/** Indirizzi che non possono MAI ricevere un payout: i nostri wallet (uscita e
 *  incassi: un payout verso di loro è un giro a vuoto o un errore), i contratti
 *  dei token del catalogo e l'indirizzo di burn 0x…dEaD (fondi persi). L'indirizzo
 *  zero lo rifiuta già validatePayoutWallet. Letti GREZZI dalle env: vale anche se
 *  AFFILIATE_PAYOUT_FROM è stato scartato da payoutConfig. Minuscoli. */
export function payoutDeniedAddresses(env: Env = process.env): Set<string> {
  const out = new Set<string>(catalogContracts());
  out.add("0x000000000000000000000000000000000000dead");
  for (const k of ["AFFILIATE_PAYOUT_FROM", "PAYGATE_PAYOUT_WALLET"]) {
    const v = (env[k] ?? "").trim().toLowerCase();
    if (/^0x[0-9a-f]{40}$/.test(v)) out.add(v);
  }
  return out;
}

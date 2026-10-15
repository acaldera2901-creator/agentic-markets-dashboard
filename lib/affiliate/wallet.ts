// lib/affiliate/wallet.ts — #AFFILIATE-V2-0930 (payout solo crypto, 2026-10-07)
// Validazione del wallet di payout e del tx hash, per rete. Pura, senza I/O.
//
// Le liste PAYOUT_COINS / PAYOUT_NETWORKS devono restare uguali ai CHECK di
// `affiliate_wallets` e `affiliate_payouts` (migration 20261007120000): il DB
// rifiuta comunque un valore fuori lista, qui si dà un errore leggibile prima.
//
// Limite dichiarato: per Polygon (EVM) si controlla solo il formato, NON il
// checksum EIP-55, perché richiede keccak-256 e né Node (misurato: OpenSSL 3.5
// non lo espone) né le dipendenze del repo lo hanno. Un refuso in un indirizzo
// tutto minuscolo passa. Upgrade: aggiungere `@noble/hashes` (keccak_256) e
// verificare EIP-55 quando l'indirizzo è a maiuscole miste. Mitigazione già
// prevista nel flusso: doppia digitazione nel pannello + verifica on-chain.

import { createHash } from "node:crypto";
import { EXPLORER_BASE } from "@/lib/crypto-coins";

export const PAYOUT_COINS = ["USDT", "USDC"] as const;
export const PAYOUT_NETWORKS = ["polygon", "tron"] as const;

export type PayoutCoin = (typeof PAYOUT_COINS)[number];
export type PayoutNetwork = (typeof PAYOUT_NETWORKS)[number];

export type WalletInput = { coin: unknown; network: unknown; address: unknown };

export type WalletVerdict =
  | { ok: true; coin: PayoutCoin; network: PayoutNetwork; address: string }
  | {
      ok: false;
      reason:
        | "unsupported_coin"
        | "unsupported_network"
        | "unsupported_pair"
        | "invalid_format"
        | "invalid_checksum"
        | "zero_address";
    };

const TRON_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const EVM_RE = /^0x[0-9a-fA-F]{40}$/;
const EVM_ZERO = "0x0000000000000000000000000000000000000000";
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function sha256(b: Uint8Array): Buffer {
  return createHash("sha256").update(b).digest();
}

/** Base58 → byte. `null` su un carattere fuori alfabeto. */
export function base58Decode(s: string): Uint8Array | null {
  let n = BigInt(0);
  for (const ch of s) {
    const v = B58.indexOf(ch);
    if (v < 0) return null;
    n = n * BigInt(58) + BigInt(v);
  }
  const bytes: number[] = [];
  while (n > BigInt(0)) {
    bytes.unshift(Number(n & BigInt(0xff)));
    n >>= BigInt(8);
  }
  for (const ch of s) {
    if (ch !== "1") break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}

/** Indirizzo Tron: 25 byte = 0x41 + 20 byte + 4 byte di checksum (doppio sha256). */
export function isValidTronAddress(address: string): boolean {
  if (!TRON_RE.test(address)) return false;
  const raw = base58Decode(address);
  if (!raw || raw.length !== 25 || raw[0] !== 0x41) return false;
  const payload = raw.subarray(0, 21);
  const check = sha256(sha256(payload)).subarray(0, 4);
  return Buffer.from(raw.subarray(21)).equals(check);
}

export function validatePayoutWallet(input: WalletInput): WalletVerdict {
  const coin = typeof input.coin === "string" ? input.coin.trim().toUpperCase() : "";
  const network = typeof input.network === "string" ? input.network.trim().toLowerCase() : "";
  const address = typeof input.address === "string" ? input.address.trim() : "";

  if (!(PAYOUT_COINS as readonly string[]).includes(coin)) return { ok: false, reason: "unsupported_coin" };
  if (!(PAYOUT_NETWORKS as readonly string[]).includes(network)) return { ok: false, reason: "unsupported_network" };
  // Circle ha ritirato USDC da Tron.
  if (coin === "USDC" && network === "tron") return { ok: false, reason: "unsupported_pair" };

  if (network === "tron") {
    if (!TRON_RE.test(address)) return { ok: false, reason: "invalid_format" };
    if (!isValidTronAddress(address)) return { ok: false, reason: "invalid_checksum" };
  } else {
    if (!EVM_RE.test(address)) return { ok: false, reason: "invalid_format" };
    if (address.toLowerCase() === EVM_ZERO) return { ok: false, reason: "zero_address" };
  }
  return { ok: true, coin: coin as PayoutCoin, network: network as PayoutNetwork, address };
}

/** Tx hash normalizzato come lo vuole il CHECK (minuscolo; `0x` su EVM). `null` se non valido. */
export function normalizeTxHash(network: PayoutNetwork, raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const h = raw.trim().toLowerCase();
  if (network === "tron") {
    const bare = h.startsWith("0x") ? h.slice(2) : h;
    return /^[0-9a-f]{64}$/.test(bare) ? bare : null;
  }
  const pref = h.startsWith("0x") ? h : `0x${h}`;
  return /^0x[0-9a-f]{64}$/.test(pref) ? pref : null;
}

export function explorerTxUrl(network: PayoutNetwork, txHash: string): string {
  return network === "tron"
    ? `https://tronscan.org/#/transaction/${txHash}`
    : `${EXPLORER_BASE.polygon}/tx/${txHash}`;
}

/** `0x12ab…9f3c` / `TR7NHq…Lj6t`: per pannello e email, mai l'indirizzo intero nei log. */
export function maskAddress(address: string): string {
  return address.length <= 12 ? address : `${address.slice(0, 6)}…${address.slice(-4)}`;
}

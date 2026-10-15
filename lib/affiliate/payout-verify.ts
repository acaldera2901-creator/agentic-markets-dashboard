// lib/affiliate/payout-verify.ts — #AFFILIATE-V2-CRYPTO-1007 PR-9
// Verifica on-chain di un payout affiliato in USCITA, PER HASH.
//
// Perché non `checkIncoming` (lib/crypto-verify.ts): quella legge `tokentx`
// dell'indirizzo, che restituisce la prima pagina — un indirizzo di exchange ha
// migliaia di tx e la nostra potrebbe non esserci. Qui si chiede la ricevuta
// della tx indicata (eth_getTransactionReceipt) e si leggono i suoi log
// `Transfer`: nessuna paginazione, nessuna ambiguità.
//
// Cosa deve essere vero per `paid` (PROPOSAL-crypto-payout §3.4):
//  · tx riuscita (status 0x1) sulla catena giusta (chainId 137);
//  · log Transfer del contratto del token atteso (USDT Polygon dal catalogo);
//  · mittente del Transfer = wallet di uscita (AFFILIATE_PAYOUT_FROM, D2);
//  · destinatario = `to_address` copiato alla creazione del payout;
//  · importo ≥ dovuto × AFFILIATE_PAYOUT_MIN_RATIO (default 0.99, QA F3); oltre
//    il 101 % resta `paid` ma con `overpaid: true` (alert a valle);
//  · conferme ≥ MIN_CONFIRMATIONS.polygon (30) E blocco ≤ `finalized` (QA F9:
//    un riorg sotto il blocco finalizzato non è più possibile). Altrimenti
//    `submitted`, si riverifica. `finalized` non disponibile → fail-closed.
// Fail-closed: un RPC che non risponde, risponde con un errore o sulla catena
// sbagliata → VerifierUnavailableError, e il payout non cambia stato. Nota
// misurata: publicnode risponde con un ERRORE (non `null`) a un hash che non
// conosce, quindi lì «hash inesistente» e «RPC giù» si vedono uguali — entrambi
// lasciano il payout com'è.

import { catalogCoin, MIN_CONFIRMATIONS } from "@/lib/crypto-coins";
import { DEFAULT_PAYOUT_MIN_RATIO, PAYOUT_OVERPAY_RATIO } from "./config";
import type { PayoutCoin, PayoutNetwork } from "./wallet";

export const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const POLYGON_CHAIN_ID = BigInt(137);

export type RejectReason =
  | "network_not_supported"
  | "not_found"
  | "tx_failed"
  | "wrong_token"
  | "wrong_recipient"
  | "wrong_sender"
  | "amount_too_low";

export type PayoutTxVerdict =
  | { outcome: "paid"; amountCoin: string; confirmations: number; overpaid: boolean; nonce: number | null; block: number; txFromMismatch: boolean }
  | { outcome: "submitted"; amountCoin: string; confirmations: number; required: number; overpaid: boolean; nonce: number | null; block: number; txFromMismatch: boolean }
  | { outcome: "rejected"; reason: RejectReason };

export class VerifierUnavailableError extends Error {}

export type Rpc = (method: string, params: unknown[]) => Promise<unknown>;

/** Client JSON-RPC minimale. Ogni anomalia → VerifierUnavailableError. */
export function jsonRpc(url: string, fetchImpl: typeof fetch = fetch, timeoutMs = 15_000): Rpc {
  let id = 0;
  return async (method, params) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
        signal: ctrl.signal,
        cache: "no-store",
      });
      if (!res.ok) throw new VerifierUnavailableError(`rpc ${method} http ${res.status}`);
      const body = (await res.json()) as { result?: unknown; error?: { message?: string } };
      if (body.error) throw new VerifierUnavailableError(`rpc ${method} error: ${body.error.message ?? "?"}`);
      if (!("result" in body)) throw new VerifierUnavailableError(`rpc ${method} malformed response`);
      return body.result;
    } catch (e) {
      if (e instanceof VerifierUnavailableError) throw e;
      throw new VerifierUnavailableError(`rpc ${method} unreachable: ${String(e)}`);
    } finally {
      clearTimeout(timer);
    }
  };
}

type Log = { address?: string; topics?: string[]; data?: string; removed?: boolean };
type Receipt = { status?: string; blockNumber?: string; logs?: Log[] };

function hexToBig(h: unknown): bigint {
  if (typeof h !== "string" || !/^0x[0-9a-fA-F]*$/.test(h)) {
    throw new VerifierUnavailableError(`malformed hex ${String(h).slice(0, 20)}`);
  }
  return h === "0x" ? BigInt(0) : BigInt(h);
}

/** Topic indicizzato (32 byte) → indirizzo minuscolo 0x + 40 hex. */
function topicAddress(t: string | undefined): string {
  return typeof t === "string" && t.length === 66 ? `0x${t.slice(26).toLowerCase()}` : "";
}

/** Unità minime → stringa decimale esatta (niente float). */
export function formatUnits(raw: bigint, decimals: number): string {
  const s = raw.toString().padStart(decimals + 1, "0");
  return decimals === 0 ? s : `${s.slice(0, -decimals)}.${s.slice(-decimals)}`;
}

export type PayoutTxCheck = {
  network: PayoutNetwork;
  coin: PayoutCoin;
  txHash: string;
  /** Wallet di uscita (AFFILIATE_PAYOUT_FROM). */
  from: string;
  /** `affiliate_payouts.to_address`. */
  to: string;
  amountUsd: number;
};

export async function verifyPayoutTx(
  c: PayoutTxCheck,
  rpc: Rpc,
  opts: { minRatio?: number } = {},
): Promise<PayoutTxVerdict> {
  const minRatio = opts.minRatio ?? DEFAULT_PAYOUT_MIN_RATIO;
  // Unica rete con un verificatore (D1). Tron resta nello schema, non qui.
  if (c.network !== "polygon") return { outcome: "rejected", reason: "network_not_supported" };
  const token = catalogCoin(`polygon-${c.coin.toLowerCase()}`);
  if (!token) return { outcome: "rejected", reason: "network_not_supported" };

  // Un RPC configurato sulla catena sbagliata darebbe «non trovato» a ogni hash
  // vero, o peggio confermerebbe tx di un'altra catena: si controlla sempre.
  if (hexToBig(await rpc("eth_chainId", [])) !== POLYGON_CHAIN_ID) {
    throw new VerifierUnavailableError("rpc is not Polygon PoS (chainId != 137)");
  }

  const receipt = (await rpc("eth_getTransactionReceipt", [c.txHash])) as Receipt | null;
  if (receipt == null) return { outcome: "rejected", reason: "not_found" };
  if (typeof receipt !== "object" || !Array.isArray(receipt.logs)) {
    throw new VerifierUnavailableError("malformed receipt");
  }
  // QA R2: solo "0x0" è fallita e solo "0x1" è riuscita; altro → non si decide.
  if (receipt.status === "0x0") return { outcome: "rejected", reason: "tx_failed" };
  if (receipt.status !== "0x1") throw new VerifierUnavailableError("receipt status not 0x0/0x1");

  const contract = token.contract.toLowerCase();
  const from = c.from.toLowerCase();
  const to = c.to.toLowerCase();
  const transfers = receipt.logs.filter(
    (l) => !l.removed && Array.isArray(l.topics) && l.topics.length === 3 && String(l.topics[0]).toLowerCase() === TRANSFER_TOPIC,
  );
  const ofToken = transfers.filter((l) => String(l.address ?? "").toLowerCase() === contract);
  if (ofToken.length === 0) return { outcome: "rejected", reason: "wrong_token" };
  const toRecipient = ofToken.filter((l) => topicAddress(l.topics![2]) === to);
  if (toRecipient.length === 0) return { outcome: "rejected", reason: "wrong_recipient" };
  const fromUs = toRecipient.filter((l) => topicAddress(l.topics![1]) === from);
  if (fromUs.length === 0) return { outcome: "rejected", reason: "wrong_sender" };

  const raw = fromUs.reduce((acc, l) => acc + hexToBig(l.data), BigInt(0));
  const amountCoin = formatUnits(raw, token.decimals);
  // Confronto in unità minime (interi): niente errori di virgola mobile ai bordi.
  const unit = BigInt(10) ** BigInt(token.decimals);
  const dueUnits = BigInt(Math.round(c.amountUsd * 100)) * unit / BigInt(100);
  const minUnits = (dueUnits * BigInt(Math.round(minRatio * 10_000))) / BigInt(10_000);
  const maxUnits = (dueUnits * BigInt(Math.round(PAYOUT_OVERPAY_RATIO * 10_000))) / BigInt(10_000);
  if (!(c.amountUsd > 0) || raw < minUnits) return { outcome: "rejected", reason: "amount_too_low" };
  const overpaid = raw > maxUnits;

  // QA N1: il nonce della tx si registra, serve a un eventuale drop futuro.
  const tx = (await rpc("eth_getTransactionByHash", [c.txHash])) as { nonce?: unknown; from?: unknown } | null;
  if (!tx || typeof tx !== "object") throw new VerifierUnavailableError("tx not readable for its nonce");
  const txNonce = Number(hexToBig(tx.nonce));
  // QA R1: il nonce vale solo se la tx l'ha firmata il wallet di uscita. Una tx
  // di un altro mittente (Safe, relayer, transferFrom) col Transfer dal nostro
  // wallet ha il nonce di QUEL mittente: salvarlo renderebbe possibile un drop
  // sbagliato. Allora nonce = null → drop impossibile (fail-closed), segnalato.
  const txFromMismatch = String(tx.from ?? "").toLowerCase() !== from;
  const nonce = txFromMismatch ? null : txNonce;

  const head = hexToBig(await rpc("eth_blockNumber", []));
  const block = hexToBig(receipt.blockNumber);
  const confirmations = head >= block ? Number(head - block) + 1 : 0;
  const fin = (await rpc("eth_getBlockByNumber", ["finalized", false])) as { number?: unknown } | null;
  if (!fin || typeof fin !== "object") throw new VerifierUnavailableError("finalized block not available");
  const finalized = hexToBig(fin.number);
  const required = MIN_CONFIRMATIONS.polygon;
  return confirmations >= required && block <= finalized
    ? { outcome: "paid", amountCoin, confirmations, overpaid, nonce, block: Number(block), txFromMismatch }
    : { outcome: "submitted", amountCoin, confirmations, required, overpaid, nonce, block: Number(block), txFromMismatch };
}

// ── Drop di una tx sparita (QA N1, R1–R3) ────────────────────────────────────

export type DropVerdict =
  | { droppable: true; onchain: "not_found" | "tx_failed" }
  | { droppable: false; reason: "tx_on_chain" | "tx_pending" | "nonce_not_consumed" | "not_finalized" | "transfer_found" };

async function finalizedBlock(rpc: Rpc): Promise<bigint> {
  const fin = (await rpc("eth_getBlockByNumber", ["finalized", false])) as { number?: unknown } | null;
  if (!fin || typeof fin !== "object") throw new VerifierUnavailableError("finalized block not available");
  return hexToBig(fin.number);
}

/** Finestre di eth_getLogs: i provider limitano l'intervallo per chiamata. Oltre
 *  MAX_LOG_WINDOWS × LOG_WINDOW blocchi (~23 giorni su Polygon a ~2 s/blocco) il
 *  drop si rifiuta (fail-closed): oltre quella distanza va fatto a mano. */
const LOG_WINDOW = BigInt(10_000);
const MAX_LOG_WINDOWS = 100;

/**
 * Una tx `submitted` si può annullare SOLO se non potrà più essere minata:
 *  · fallita (status "0x0", nient'altro: QA R2) in un blocco già finalizzato; oppure
 *  · sconosciuta (ricevuta e tx entrambe null) E nessun Transfer del token dal
 *    wallet di uscita al destinatario nei log, dal blocco di registrazione al
 *    `finalized` (QA R3: un nodo con l'indice delle tx potato risponde null anche
 *    per una tx minata, e il suo nonce risulta «consumato» dalla tx stessa: i log
 *    del contratto invece restano) E il nonce registrato del wallet di uscita
 *    risulta consumato al blocco `finalized`.
 * Nonce null (tx non firmata dal wallet di uscita, QA R1), blocco di
 * registrazione assente, getLogs che non risponde o intervallo troppo lungo →
 * VerifierUnavailableError (fail-closed).
 * Regola operativa: prima di un drop si sostituisce/consuma il nonce bloccato.
 */
export async function checkDroppable(
  c: { txHash: string; from: string; to: string; coin: PayoutCoin; nonce: number | null; block: number | null },
  rpc: Rpc,
): Promise<DropVerdict> {
  if (c.nonce == null) throw new VerifierUnavailableError("no trusted nonce for this tx (not sent by the payout wallet)");
  if (c.block == null) throw new VerifierUnavailableError("registration block unknown");
  const token = catalogCoin(`polygon-${c.coin.toLowerCase()}`);
  if (!token) throw new VerifierUnavailableError("token not in catalog");
  if (hexToBig(await rpc("eth_chainId", [])) !== POLYGON_CHAIN_ID) {
    throw new VerifierUnavailableError("rpc is not Polygon PoS (chainId != 137)");
  }
  const receipt = (await rpc("eth_getTransactionReceipt", [c.txHash])) as Receipt | null;
  if (receipt != null) {
    if (typeof receipt !== "object") throw new VerifierUnavailableError("malformed receipt");
    if (receipt.status === "0x1") return { droppable: false, reason: "tx_on_chain" };
    if (receipt.status !== "0x0") throw new VerifierUnavailableError("receipt status not 0x0/0x1");
    return hexToBig(receipt.blockNumber) <= (await finalizedBlock(rpc))
      ? { droppable: true, onchain: "tx_failed" }
      : { droppable: false, reason: "not_finalized" };
  }
  const tx = await rpc("eth_getTransactionByHash", [c.txHash]);
  if (tx != null) return { droppable: false, reason: "tx_pending" };

  const fin = await finalizedBlock(rpc);
  const pad = (a: string) => `0x${"0".repeat(24)}${a.slice(2).toLowerCase()}`;
  let start = BigInt(c.block);
  for (let i = 0; start <= fin; i++) {
    if (i >= MAX_LOG_WINDOWS) throw new VerifierUnavailableError("log range too large for an automatic drop");
    const end = start + LOG_WINDOW - BigInt(1) < fin ? start + LOG_WINDOW - BigInt(1) : fin;
    const logs = await rpc("eth_getLogs", [{
      address: token.contract,
      topics: [TRANSFER_TOPIC, pad(c.from), pad(c.to)],
      fromBlock: `0x${start.toString(16)}`,
      toBlock: `0x${end.toString(16)}`,
    }]);
    if (!Array.isArray(logs)) throw new VerifierUnavailableError("malformed getLogs response");
    if (logs.length > 0) return { droppable: false, reason: "transfer_found" };
    start = end + BigInt(1);
  }

  const used = hexToBig(await rpc("eth_getTransactionCount", [c.from, "finalized"]));
  return used > BigInt(c.nonce) ? { droppable: true, onchain: "not_found" } : { droppable: false, reason: "nonce_not_consumed" };
}

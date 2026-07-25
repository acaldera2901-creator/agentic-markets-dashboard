// #CRYPTO-DIRECT-1 — verifica ON-CHAIN del pagamento. È il pezzo che regge tutto:
// il callback di PayGate è in chiaro e senza firma, e sul processore crypto non
// esiste un endpoint di stato da interrogare (404). Quindi l'unica fonte di verità
// è la blockchain: nessun grant senza un trasferimento confermato verso
// l'indirizzo di deposito di QUELL'ordine.
//
// Metodo: indexer Blockscout (API compatibile Etherscan, nessuna key). Non si usa
// `eth_getLogs` su RPC pubblici perché — misurato — publicnode rifiuta ogni
// getLogs come "archive request" e 1rpc.io lo limita a 50 blocchi: inutilizzabile.

import { EXPLORER_BASE, MIN_CONFIRMATIONS, type CryptoCoin } from "./crypto-coins";

type TokenTx = {
  to?: string;
  from?: string;
  value?: string;
  contractAddress?: string;
  tokenDecimal?: string;
  confirmations?: string;
  hash?: string;
};

// Tolleranza sull'importo: l'utente digita/incolla l'importo a mano e i wallet
// arrotondano, quindi accettiamo un filo meno del richiesto. NON di più: la
// tolleranza larga del rail carte (≥50%, che assorbe le fee dell'on-ramp) qui
// sarebbe un buco — chi manda metà otterrebbe il piano intero.
const TOLERANCE = 0.99;

export function isPaidEnough(received: number, expected: number): boolean {
  if (!Number.isFinite(received) || !Number.isFinite(expected) || expected <= 0) return false;
  return received >= expected * TOLERANCE;
}

export type ChainCheck = {
  received: number; // somma confermata in entrata
  pending: number; // visto on-chain ma sotto le conferme richieste
  txHash: string | null;
};

// Somma i trasferimenti IN ENTRATA verso `address`, del solo contratto della
// moneta attesa (un token diverso inviato per errore non deve contare: PayGate
// lo inoltra comunque, ma il valore non è quello dell'ordine) e solo se hanno
// abbastanza conferme.
export async function checkIncoming(coin: CryptoCoin, address: string): Promise<ChainCheck> {
  const base = EXPLORER_BASE[coin.chain];
  const url = `${base}/api?module=account&action=tokentx&address=${encodeURIComponent(address)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  let rows: TokenTx[] = [];
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`blockscout ${res.status}`);
    const d = (await res.json()) as { status?: string; result?: TokenTx[] | string };
    // status "0" con result vuoto = nessuna transazione: è un esito valido, non un errore.
    rows = Array.isArray(d.result) ? d.result : [];
  } finally {
    clearTimeout(timer);
  }

  const want = address.toLowerCase();
  const contract = coin.contract.toLowerCase();
  const need = MIN_CONFIRMATIONS[coin.chain];
  let received = 0;
  let pending = 0;
  let txHash: string | null = null;

  for (const t of rows) {
    if (String(t.to ?? "").toLowerCase() !== want) continue; // solo entrate
    if (String(t.contractAddress ?? "").toLowerCase() !== contract) continue; // solo la moneta attesa
    const dec = Number.parseInt(t.tokenDecimal ?? String(coin.decimals), 10);
    const raw = Number(t.value ?? "0");
    if (!Number.isFinite(raw) || raw <= 0) continue;
    const amount = raw / 10 ** (Number.isFinite(dec) ? dec : coin.decimals);
    const conf = Number.parseInt(t.confirmations ?? "0", 10);
    if (Number.isFinite(conf) && conf >= need) {
      received += amount;
      txHash = txHash ?? t.hash ?? null;
    } else {
      pending += amount;
    }
  }

  return { received, pending, txHash };
}

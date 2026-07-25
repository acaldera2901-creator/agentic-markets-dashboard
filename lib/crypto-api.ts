// #CRYPTO-DIRECT-1 — chiamate al Crypto Payment Processor di PayGate.
// È un'API DIVERSA dal gateway carte già in uso (lib/paygate.ts): quella vende
// crypto all'utente con carta/Revolut, questa genera un indirizzo di deposito per
// moneta e attende un invio on-chain. Nessuna API key: si passa il nostro wallet.
//
// ⚠️ Differenza che conta per la sicurezza: qui NON esiste `payment-status.php`
// (verificato: 404 sotto /crypto/). Quindi l'esito NON è verificabile presso
// PayGate e il callback, che è in chiaro e senza firma, non fa fede: la verifica
// è on-chain (lib/crypto-verify.ts).

import type { CryptoCoin } from "./crypto-coins";

const API = "https://api.paygate.to/crypto";

async function getJson<T>(url: string, timeoutMs = 15_000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`paygate crypto ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

// Quanto deve inviare il cliente, nella sua moneta, per coprire l'ordine in USD.
// L'importo lo decide PayGate (stesso tasso che userà per il forward), non noi:
// così non c'è disallineamento fra quello che chiediamo e quello che loro attendono.
export async function convertUsdToCoin(coin: CryptoCoin, usd: number): Promise<number> {
  const d = await getJson<{ status?: string; value_coin?: string }>(
    `${API}/${coin.ticker}/convert.php?value=${encodeURIComponent(usd.toFixed(2))}&from=USD`
  );
  const v = Number.parseFloat(String(d.value_coin ?? ""));
  if (!Number.isFinite(v) || v <= 0) throw new Error("paygate convert: value_coin non valido");
  return v;
}

// Minimo di rete della moneta. Sotto quella soglia PayGate NON inoltra: l'utente
// pagherebbe e i soldi resterebbero bloccati. Va controllato PRIMA di offrire la
// moneta (es. USDT TRC20 ha minimo 13.3, che taglierebbe fuori la Weekly Pick).
export async function coinMinimum(coin: CryptoCoin): Promise<number> {
  const d = await getJson<{ minimum?: number | string }>(`${API}/${coin.ticker}/info.php`);
  const m = Number.parseFloat(String(d.minimum ?? ""));
  if (!Number.isFinite(m) || m < 0) throw new Error("paygate info: minimum non valido");
  return m;
}

// Indirizzo di deposito dedicato all'ordine. PayGate inoltra automaticamente al
// nostro wallet trattenendo la sua fee (~4% misurato on-chain sul pagamento reale
// del 15/07: 5.712327 in entrata → 5.490075 a noi).
export async function createCryptoDeposit(
  coin: CryptoCoin,
  payoutWallet: string,
  callbackUrl: string
): Promise<{ addressIn: string; ipnToken: string }> {
  const d = await getJson<{ address_in?: string; ipn_token?: string }>(
    `${API}/${coin.ticker}/wallet.php?address=${encodeURIComponent(payoutWallet)}&callback=${encodeURIComponent(callbackUrl)}`
  );
  if (!d.address_in) throw new Error("paygate wallet.php: address_in mancante");
  return { addressIn: d.address_in, ipnToken: d.ipn_token ?? "" };
}

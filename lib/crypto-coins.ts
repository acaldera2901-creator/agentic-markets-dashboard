// #CRYPTO-DIRECT-1 — registro delle monete accettate in pagamento diretto.
// L'utente che ha già crypto le invia da solo: niente acquisto con carta/Revolut.
//
// Il vincolo che decide questo file: l'indirizzo di payout deve stare sulla STESSA
// rete della moneta incassata ("it must be compatible with the network and coin
// selected") e PayGate non converte tra famiglie. Il wallet che abbiamo è un EOA
// EVM (`PAYGATE_PAYOUT_WALLET`), quindi qui ci sono solo monete EVM: un solo `0x`
// vale su Polygon, Ethereum, BSC, Optimism, Avalanche, Base.
// Tron (USDT TRC20), BTC e SOL richiedono un indirizzo dedicato: si aggiungono
// qui con la loro chain quando esiste il wallet.

export type CryptoChain = "polygon" | "ethereum" | "bsc" | "optimism" | "avalanche" | "base";

export type CryptoCoin = {
  id: string; // chiave stabile usata in DB e nelle API
  label: string; // mostrata all'utente
  ticker: string; // path PayGate: /crypto/<ticker>/wallet.php
  chain: CryptoChain;
  contract: string; // contratto del token (serve alla verifica on-chain)
  decimals: number;
  // Le stablecoin non hanno finestra di quote: 1 USDT ≈ 1 USD anche fra 20 minuti.
  // Una moneta volatile richiederebbe quote a scadenza + tolleranza, che qui NON
  // c'è: per questo il registro parte con sole stable (vedi PROPOSAL).
  stable: boolean;
};

// Explorer per catena: Blockscout, API compatibile Etherscan e **senza API key**.
// Perché non `eth_getLogs` su un RPC pubblico: misurato, non si può — publicnode
// rifiuta ogni getLogs come "archive request" e 1rpc.io lo limita a 50 blocchi.
// Un indexer non ha né limiti di range né bisogno di conoscere il blocco iniziale.
export const EXPLORER_BASE: Record<CryptoChain, string> = {
  polygon: "https://polygon.blockscout.com",
  ethereum: "https://eth.blockscout.com",
  bsc: "https://bsc.blockscout.com",
  optimism: "https://optimism.blockscout.com",
  avalanche: "https://avalanche.blockscout.com",
  base: "https://base.blockscout.com",
};

// Conferme richieste prima di concedere il piano. Polygon fa ~2s per blocco:
// 30 conferme ≈ 1 minuto, abbastanza per non farsi ingannare da un riorg e
// abbastanza poco da restare un'attesa accettabile in checkout.
export const MIN_CONFIRMATIONS: Record<CryptoChain, number> = {
  polygon: 30,
  ethereum: 6,
  bsc: 15,
  optimism: 10,
  avalanche: 10,
  base: 10,
};

const CATALOG: CryptoCoin[] = [
  { id: "polygon-usdc", label: "USDC · Polygon", ticker: "polygon/usdc", chain: "polygon", contract: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", decimals: 6, stable: true },
  { id: "polygon-usdt", label: "USDT · Polygon", ticker: "polygon/usdt", chain: "polygon", contract: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f", decimals: 6, stable: true },
  { id: "ethereum-usdt", label: "USDT · Ethereum", ticker: "erc20/usdt", chain: "ethereum", contract: "0xdac17f958d2ee523a2206206994597c13d831ec7", decimals: 6, stable: true },
  { id: "ethereum-usdc", label: "USDC · Ethereum", ticker: "erc20/usdc", chain: "ethereum", contract: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", decimals: 6, stable: true },
  { id: "bsc-usdt", label: "USDT · BNB Chain", ticker: "bep20/usdt", chain: "bsc", contract: "0x55d398326f99059ff775485246999027b3197955", decimals: 18, stable: true },
  { id: "optimism-usdt", label: "USDT · Optimism", ticker: "optimism/usdt", chain: "optimism", contract: "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58", decimals: 6, stable: true },
  { id: "base-usdc", label: "USDC · Base", ticker: "base/usdc", chain: "base", contract: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", decimals: 6, stable: true },
];

// Allowlist runtime: si accendono monete senza deploy, e si spegne una catena
// se il suo explorer o il suo rail dà problemi. Default = solo Polygon, la
// catena su cui SAPPIAMO che i payout arrivano (provato dal rail carte) e con i
// minimi PayGate più bassi ($0.66, quindi copre anche la Weekly Pick da $12.99).
export function enabledCoins(): CryptoCoin[] {
  const raw = process.env.CRYPTO_COINS_ENABLED ?? "polygon-usdc,polygon-usdt";
  const wanted = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return CATALOG.filter((c) => wanted.includes(c.id));
}

export function findCoin(id: unknown): CryptoCoin | null {
  if (typeof id !== "string") return null;
  return enabledCoins().find((c) => c.id === id) ?? null;
}

// Il rail si apre solo se c'è il wallet di payout: senza, PayGate genererebbe
// indirizzi che inoltrano a nessuno.
export function isCryptoDirectConfigured(): boolean {
  return Boolean(process.env.PAYGATE_PAYOUT_WALLET) && enabledCoins().length > 0;
}

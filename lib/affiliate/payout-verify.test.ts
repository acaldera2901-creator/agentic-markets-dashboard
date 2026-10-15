// #AFFILIATE-V2-CRYPTO-1007 PR-9 — verifica per hash, nessuna chiamata di rete:
// l'RPC è un fake che risponde con la forma REALE di una ricevuta Polygon
// (rilevata il 15/10/2026 su publicnode: status, blockNumber, logs con
// address/topics/data/removed).
import { describe, expect, it, vi } from "vitest";
import { formatUnits, jsonRpc, TRANSFER_TOPIC, verifyPayoutTx, VerifierUnavailableError, type Rpc } from "./payout-verify";

const USDT = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
const USDC = "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359";
const FROM = "0x1111111111111111111111111111111111111111";
const TO = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
const OTHER = "0x2222222222222222222222222222222222222222";
const HASH = `0x${"ab".repeat(32)}`;

const pad = (a: string) => `0x${"0".repeat(24)}${a.slice(2).toLowerCase()}`;
const units = (usdt: number) => `0x${BigInt(Math.round(usdt * 1e6)).toString(16).padStart(64, "0")}`;
const transfer = (o: { token?: string; from?: string; to?: string; amount?: number; removed?: boolean } = {}) => ({
  address: o.token ?? USDT,
  topics: [TRANSFER_TOPIC, pad(o.from ?? FROM), pad(o.to ?? TO)],
  data: units(o.amount ?? 60),
  removed: o.removed ?? false,
});
// Il log di fee che Polygon aggiunge a ogni tx (contratto 0x…1010): va ignorato.
const FEE_LOG = { address: "0x0000000000000000000000000000000000001010", topics: ["0x4dfe1bbbcf077ddc3e01291eea2d5c70c2b422b415d95645b9adcfd678cb1d63", pad(FROM), pad(OTHER)], data: "0x" + "0".repeat(64) };

function fakeRpc(o: { receipt?: unknown; head?: number; block?: number; chainId?: string } = {}): Rpc & { calls: string[] } {
  const calls: string[] = [];
  const fn = (async (method: string) => {
    calls.push(method);
    if (method === "eth_chainId") return o.chainId ?? "0x89";
    if (method === "eth_blockNumber") return `0x${(o.head ?? 1_000_100).toString(16)}`;
    if (method === "eth_getTransactionReceipt") {
      return o.receipt === undefined
        ? { status: "0x1", blockNumber: `0x${(o.block ?? 1_000_000).toString(16)}`, logs: [FEE_LOG, transfer()] }
        : o.receipt;
    }
    throw new Error(`unexpected ${method}`);
  }) as Rpc & { calls: string[] };
  fn.calls = calls;
  return fn;
}

const check = { network: "polygon" as const, coin: "USDT" as const, txHash: HASH, from: FROM, to: TO, amountUsd: 60 };
const receipt = (logs: unknown[], status = "0x1") => ({ status, blockNumber: "0xf4240", logs });

describe("verifyPayoutTx", () => {
  it("tutto giusto, ≥30 conferme → paid con l'importo letto dalla catena", async () => {
    const rpc = fakeRpc();
    await expect(verifyPayoutTx(check, rpc)).resolves.toEqual({ outcome: "paid", amountCoin: "60.000000", confirmations: 101 });
    // Per hash: nessuna chiamata a liste/tokentx paginati.
    expect(rpc.calls).toEqual(["eth_chainId", "eth_getTransactionReceipt", "eth_blockNumber"]);
  });

  it("indirizzo in maiuscole/minuscole diverse: confronto case-insensitive", async () => {
    await expect(verifyPayoutTx({ ...check, to: TO.toLowerCase(), from: FROM.toUpperCase().replace("0X", "0x") }, fakeRpc())).resolves.toMatchObject({ outcome: "paid" });
  });

  it("poche conferme → submitted (12 su 30), si riverifica", async () => {
    await expect(verifyPayoutTx(check, fakeRpc({ head: 1_000_011 }))).resolves.toEqual({
      outcome: "submitted",
      amountCoin: "60.000000",
      confirmations: 12,
      required: 30,
    });
  });

  const rejects: [string, unknown, string][] = [
    ["hash non trovato", null, "not_found"],
    ["tx fallita", receipt([transfer()], "0x0"), "tx_failed"],
    ["token diverso (USDC al posto di USDT)", receipt([transfer({ token: USDC })]), "wrong_token"],
    ["nessun Transfer (invio di MATIC)", receipt([FEE_LOG]), "wrong_token"],
    ["destinatario diverso", receipt([transfer({ to: OTHER })]), "wrong_recipient"],
    ["mittente ≠ wallet di uscita", receipt([transfer({ from: OTHER })]), "wrong_sender"],
    ["importo sotto il 99 %", receipt([transfer({ amount: 59.39 })]), "amount_too_low"],
    ["log rimosso da un riorg non conta", receipt([transfer({ removed: true })]), "wrong_token"],
  ];
  for (const [name, r, reason] of rejects) {
    it(`${name} → rejected ${reason}`, async () => {
      await expect(verifyPayoutTx(check, fakeRpc({ receipt: r }))).resolves.toEqual({ outcome: "rejected", reason });
    });
  }

  it("99 % esatto passa; più Transfer verso lo stesso destinatario si sommano", async () => {
    await expect(verifyPayoutTx(check, fakeRpc({ receipt: receipt([transfer({ amount: 59.4 })]) }))).resolves.toMatchObject({ outcome: "paid" });
    await expect(
      verifyPayoutTx(check, fakeRpc({ receipt: receipt([transfer({ amount: 30 }), transfer({ amount: 30 }), transfer({ to: OTHER, amount: 500 })]) })),
    ).resolves.toMatchObject({ outcome: "paid", amountCoin: "60.000000" });
  });

  it("Tron: nessun verificatore → rejected, nessuna chiamata", async () => {
    const rpc = fakeRpc();
    await expect(verifyPayoutTx({ ...check, network: "tron" }, rpc)).resolves.toEqual({ outcome: "rejected", reason: "network_not_supported" });
    expect(rpc.calls).toEqual([]);
  });

  it("fail-closed: catena sbagliata o ricevuta malformata → VerifierUnavailableError", async () => {
    await expect(verifyPayoutTx(check, fakeRpc({ chainId: "0x1" }))).rejects.toBeInstanceOf(VerifierUnavailableError);
    await expect(verifyPayoutTx(check, fakeRpc({ receipt: { status: "0x1" } }))).rejects.toBeInstanceOf(VerifierUnavailableError);
    await expect(verifyPayoutTx(check, fakeRpc({ receipt: receipt([{ ...transfer(), data: "zz" }]) }))).rejects.toBeInstanceOf(VerifierUnavailableError);
  });
});

describe("jsonRpc (fetch finto)", () => {
  const ok = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));
  it("restituisce result", async () => {
    const f = ok({ jsonrpc: "2.0", id: 1, result: "0x89" });
    await expect(jsonRpc("https://rpc", f as unknown as typeof fetch)("eth_chainId", [])).resolves.toBe("0x89");
    const sent = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(sent).toMatchObject({ jsonrpc: "2.0", method: "eth_chainId", params: [] });
  });
  it("errore JSON-RPC, HTTP 5xx, rete giù, risposta senza result → VerifierUnavailableError", async () => {
    const cases = [
      ok({ jsonrpc: "2.0", id: 1, error: { code: -32602, message: "Archive requests require a personal token" } }),
      ok({}, 503),
      vi.fn(async () => { throw new TypeError("fetch failed"); }),
      ok({ jsonrpc: "2.0", id: 1 }),
    ];
    for (const f of cases) {
      await expect(jsonRpc("https://rpc", f as unknown as typeof fetch)("eth_blockNumber", [])).rejects.toBeInstanceOf(VerifierUnavailableError);
    }
  });
  it("timeout → VerifierUnavailableError", async () => {
    const hang = vi.fn((_u: string, init: RequestInit) => new Promise<Response>((_, rej) => init.signal!.addEventListener("abort", () => rej(new Error("aborted")))));
    await expect(jsonRpc("https://rpc", hang as unknown as typeof fetch, 20)("eth_blockNumber", [])).rejects.toBeInstanceOf(VerifierUnavailableError);
  });
});

describe("formatUnits", () => {
  it("esatto, senza float", () => {
    expect(formatUnits(BigInt(60_000_000), 6)).toBe("60.000000");
    expect(formatUnits(BigInt(1), 6)).toBe("0.000001");
    expect(formatUnits(BigInt("123456789012345678901"), 18)).toBe("123.456789012345678901");
  });
});

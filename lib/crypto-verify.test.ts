import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkIncoming, isPaidEnough } from "./crypto-verify";
import type { CryptoCoin } from "./crypto-coins";

const USDC: CryptoCoin = {
  id: "polygon-usdc",
  label: "USDC · Polygon",
  ticker: "polygon/usdc",
  chain: "polygon",
  contract: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
  decimals: 6,
  stable: true,
};
const DEP = "0xd8d2c6c796BdAcd5fC52Ee1CE7bE7A76669E6Bc6";

function tx(over: Record<string, unknown> = {}) {
  return {
    to: DEP,
    from: "0x4d8336bda6b9c6c2b4f9d5e1a2b3c4d5e6f70000",
    value: "5712327", // 5.712327 USDC (6 decimali)
    contractAddress: USDC.contract,
    tokenDecimal: "6",
    confirmations: "500",
    hash: "0xabc",
    ...over,
  };
}
function api(rows: unknown[]) {
  return { ok: true, json: async () => ({ status: "1", result: rows }) } as unknown as Response;
}

beforeEach(() => vi.restoreAllMocks());

describe("isPaidEnough", () => {
  // La tolleranza larga del rail carte (≥50%, che assorbe le fee dell'on-ramp)
  // qui sarebbe un buco: chi manda metà otterrebbe il piano intero.
  it("accetta l'importo giusto e un filo meno, RIFIUTA la metà", () => {
    expect(isPaidEnough(14.99, 14.99)).toBe(true);
    expect(isPaidEnough(14.9, 14.99)).toBe(true); // -0.6%: arrotondamento wallet
    expect(isPaidEnough(14.0, 14.99)).toBe(false); // -6.6%
    expect(isPaidEnough(7.5, 14.99)).toBe(false); // metà
    expect(isPaidEnough(0, 14.99)).toBe(false);
  });

  it("rifiuta valori non finiti o attesa non positiva", () => {
    expect(isPaidEnough(Number.NaN, 10)).toBe(false);
    expect(isPaidEnough(10, 0)).toBe(false);
  });
});

describe("checkIncoming", () => {
  // Caso reale del 15/07: il DB aveva value_coin 5.712327 e on-chain
  // l'entrata sul deposito è esattamente quella.
  it("somma le entrate confermate della moneta attesa", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(api([tx()])));
    const r = await checkIncoming(USDC, DEP);
    expect(r.received).toBeCloseTo(5.712327, 6);
    expect(r.pending).toBe(0);
    expect(r.txHash).toBe("0xabc");
  });

  // Il deposito PayGate INOLTRA: le uscite verso il nostro wallet non sono
  // pagamenti del cliente e contarle raddoppierebbe l'importo.
  it("ignora le uscite", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(api([tx({ to: "0x72e348d948e984c7d57d8ccb93fdd52710e47fa2" })])));
    expect((await checkIncoming(USDC, DEP)).received).toBe(0);
  });

  // Un token diverso inviato per errore vale un altro prezzo: PayGate lo inoltra
  // comunque, ma non copre l'ordine.
  it("ignora un token che non è quello atteso", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(api([tx({ contractAddress: "0xdead" })])));
    expect((await checkIncoming(USDC, DEP)).received).toBe(0);
  });

  // Sotto le conferme richieste il pagamento esiste ma non è definitivo: va
  // mostrato come "in attesa", non concesso.
  it("mette sotto 'pending' ciò che non ha abbastanza conferme", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(api([tx({ confirmations: "3" })])));
    const r = await checkIncoming(USDC, DEP);
    expect(r.received).toBe(0);
    expect(r.pending).toBeCloseTo(5.712327, 6);
  });

  it("somma più invii parziali confermati", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(api([tx({ value: "5000000" }), tx({ value: "10000000" })])));
    expect((await checkIncoming(USDC, DEP)).received).toBeCloseTo(15, 6);
  });

  it("rispetta i decimali dichiarati dall'explorer (18 su BNB Chain)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(api([tx({ value: "1000000000000000000", tokenDecimal: "18" })])));
    expect((await checkIncoming(USDC, DEP)).received).toBeCloseTo(1, 9);
  });

  it("nessuna transazione → zero, non errore", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "0", result: "No transactions found" }) } as unknown as Response));
    expect((await checkIncoming(USDC, DEP)).received).toBe(0);
  });

  // Fail-loud: un explorer giù NON è "non pagato". Chi chiama deve poter
  // ritentare invece di chiudere l'ordine.
  it("propaga l'errore se l'explorer risponde male", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502 } as unknown as Response));
    await expect(checkIncoming(USDC, DEP)).rejects.toThrow(/502/);
  });
});

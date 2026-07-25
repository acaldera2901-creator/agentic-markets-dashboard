import { it, expect, vi, beforeEach } from "vitest";

const dbExecute = vi.fn();
const rpc = vi.fn();
const activatePaygatePlan = vi.fn();
const createMirroredPaidOrder = vi.fn();
const checkIncoming = vi.fn();

vi.mock("@/lib/db", () => ({
  dbExecute,
  dbQuery: vi.fn(),
  dbQueryStrict: vi.fn(),
  getSupabaseAdminClient: () => ({ rpc }),
}));
vi.mock("@/lib/plan-grant", () => ({ activatePaygatePlan }));
vi.mock("@/lib/shopify-admin", () => ({ createMirroredPaidOrder }));
vi.mock("@/lib/crypto-verify", async () => {
  const real = await vi.importActual<typeof import("./crypto-verify")>("./crypto-verify");
  return { ...real, checkIncoming };
});

const ORDER = {
  id: "ord-1",
  identifier: "u@t.com",
  plan: "base" as const,
  period: "monthly" as const,
  amount_usd: 14.99,
  status: "pending",
  coin: "polygon-usdc",
  expected_value_coin: 15.01,
  crypto_address_in: "0xdep",
  shopify_order_id: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRYPTO_COINS_ENABLED = "polygon-usdc,polygon-usdt";
  rpc.mockResolvedValue({ data: true, error: null });
  activatePaygatePlan.mockResolvedValue({ identifier: "u@t.com", name: null, plan: "base" });
  createMirroredPaidOrder.mockResolvedValue("gid://shopify/Order/1");
  checkIncoming.mockResolvedValue({ received: 15.01, pending: 0, txHash: "0xtx" });
});

it("pagato e confermato: claim → grant → ordine specchiato", async () => {
  const { settleCryptoOrder } = await import("./crypto-settle");
  const r = await settleCryptoOrder(ORDER);
  expect(r.granted).toBe(true);
  expect(rpc).toHaveBeenCalledWith("claim_paygate_order", { p_id: "ord-1", p_value: 15.01, p_txid: "0xtx" });
  expect(activatePaygatePlan).toHaveBeenCalledWith("u@t.com", "base", "monthly");
  expect(createMirroredPaidOrder).toHaveBeenCalledWith(expect.objectContaining({ amountUsd: 14.99, paygateOrderId: "ord-1" }));
});

// LA regola che protegge il prodotto: meno del dovuto = niente piano.
it("importo insufficiente: nessun claim, nessun grant", async () => {
  checkIncoming.mockResolvedValue({ received: 7.5, pending: 0, txHash: null });
  const { settleCryptoOrder } = await import("./crypto-settle");
  const r = await settleCryptoOrder(ORDER);
  expect(r.granted).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
  expect(activatePaygatePlan).not.toHaveBeenCalled();
});

it("visto ma senza conferme: 'in attesa', non un errore", async () => {
  checkIncoming.mockResolvedValue({ received: 0, pending: 15.01, txHash: null });
  const { settleCryptoOrder } = await import("./crypto-settle");
  const r = await settleCryptoOrder(ORDER);
  expect(r).toMatchObject({ granted: false, reason: "in attesa di conferme" });
});

// Callback, polling della pagina e cron possono scattare insieme: solo il
// vincitore del claim atomico concede il piano.
it("claim perso (già saldato da un altro percorso): nessun secondo grant", async () => {
  rpc.mockResolvedValue({ data: false, error: null });
  const { settleCryptoOrder } = await import("./crypto-settle");
  const r = await settleCryptoOrder(ORDER);
  expect(r.granted).toBe(false);
  expect(activatePaygatePlan).not.toHaveBeenCalled();
});

// Un explorer giù non è "non pagato": si ritenta, non si chiude l'ordine.
it("explorer irraggiungibile: non concede e lo dice", async () => {
  checkIncoming.mockRejectedValue(new Error("blockscout 502"));
  const { settleCryptoOrder } = await import("./crypto-settle");
  const r = await settleCryptoOrder(ORDER);
  expect(r.granted).toBe(false);
  expect(r.reason).toMatch(/explorer non raggiungibile/);
  expect(rpc).not.toHaveBeenCalled();
});

// I soldi sono arrivati e il piano è concesso: Shopify è contabilità, non pagamento.
it("mirror Shopify fallito: il piano resta concesso", async () => {
  createMirroredPaidOrder.mockResolvedValue(null);
  const { settleCryptoOrder } = await import("./crypto-settle");
  expect((await settleCryptoOrder(ORDER)).granted).toBe(true);
});

it("moneta non più abilitata: si ferma prima di toccare la catena", async () => {
  process.env.CRYPTO_COINS_ENABLED = "polygon-usdt";
  const { settleCryptoOrder } = await import("./crypto-settle");
  const r = await settleCryptoOrder(ORDER);
  expect(r.granted).toBe(false);
  expect(checkIncoming).not.toHaveBeenCalled();
});

it("ordine non più pending: nessuna azione", async () => {
  const { settleCryptoOrder } = await import("./crypto-settle");
  expect(await settleCryptoOrder({ ...ORDER, status: "paid" })).toMatchObject({ granted: false, reason: "not pending" });
});

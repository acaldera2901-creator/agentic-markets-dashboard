import { it, expect, vi, beforeEach } from "vitest";

const dbExecute = vi.fn();
const rpc = vi.fn();
const activatePaygatePlan = vi.fn();
const sendPlanReceipt = vi.fn();
const grantWeeklyPick = vi.fn();
const notifyWeeklyPickGranted = vi.fn();
const createMirroredPaidOrder = vi.fn();
const checkIncoming = vi.fn();

vi.mock("@/lib/db", () => ({
  dbExecute,
  dbQuery: vi.fn(),
  dbQueryStrict: vi.fn(),
  getSupabaseAdminClient: () => ({ rpc }),
}));
vi.mock("@/lib/plan-grant", () => ({ activatePaygatePlan, sendPlanReceipt }));
vi.mock("@/lib/weekly-pick-server", () => ({ grantWeeklyPick, notifyWeeklyPickGranted }));
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

// #WEEKLY-CRYPTO-DIRECT-1 — ordine crypto della Weekly Pick: altra tabella, altro
// claim, altro entitlement. Nessun plan/period: non è un abbonamento.
const WEEKLY = {
  id: "wp-1",
  identifier: "u@t.com",
  week_start: "2026-07-27",
  amount_usd: 12.99,
  status: "pending",
  coin: "polygon-usdc",
  expected_value_coin: 13.01,
  crypto_address_in: "0xdep",
  shopify_order_id: null,
  token_hash: "hash-1",
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRYPTO_COINS_ENABLED = "polygon-usdc,polygon-usdt";
  rpc.mockResolvedValue({ data: true, error: null });
  activatePaygatePlan.mockResolvedValue({ identifier: "u@t.com", name: null, plan: "base" });
  sendPlanReceipt.mockResolvedValue(undefined);
  grantWeeklyPick.mockResolvedValue(undefined);
  notifyWeeklyPickGranted.mockResolvedValue(undefined);
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

// ───────── Weekly Pick sul rail crypto (#WEEKLY-CRYPTO-DIRECT-1) ─────────

it("weekly pagata: claim weekly → entitlement della settimana → ordine specchiato", async () => {
  checkIncoming.mockResolvedValue({ received: 13.01, pending: 0, txHash: "0xwtx" });
  const { settleWeeklyCryptoOrder } = await import("./crypto-settle");
  const r = await settleWeeklyCryptoOrder(WEEKLY);

  expect(r.granted).toBe(true);
  // Claim della tabella GIUSTA: claim_paygate_order su un ordine weekly non
  // esisterebbe come riga e il grant partirebbe senza aver bloccato nulla.
  expect(rpc).toHaveBeenCalledWith("claim_weekly_pick_order", { p_id: "wp-1", p_value: 13.01, p_txid: "0xwtx" });
  expect(grantWeeklyPick).toHaveBeenCalledWith("u@t.com", "2026-07-27", "hash-1");
  // Nessun piano concesso: una schedina non è un abbonamento.
  expect(activatePaygatePlan).not.toHaveBeenCalled();
  expect(createMirroredPaidOrder).toHaveBeenCalledWith(
    expect.objectContaining({ amountUsd: 12.99, line: { kind: "weekly", weekStart: "2026-07-27" } })
  );
});

// La settimana viene dall'ORDINE. Se la prendessimo da "oggi", un pagamento che
// arriva a cavallo del lunedì consegnerebbe la pick della settimana sbagliata.
it("weekly: concede la settimana dell'ordine, non quella corrente", async () => {
  const { settleWeeklyCryptoOrder } = await import("./crypto-settle");
  await settleWeeklyCryptoOrder({ ...WEEKLY, week_start: "2026-07-20", expected_value_coin: 13.01 });
  expect(grantWeeklyPick).toHaveBeenCalledWith("u@t.com", "2026-07-20", "hash-1");
});

it("weekly, importo insufficiente: nessun claim, nessun entitlement", async () => {
  checkIncoming.mockResolvedValue({ received: 6, pending: 0, txHash: null });
  const { settleWeeklyCryptoOrder } = await import("./crypto-settle");
  const r = await settleWeeklyCryptoOrder(WEEKLY);
  expect(r.granted).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
  expect(grantWeeklyPick).not.toHaveBeenCalled();
});

it("weekly, claim perso: nessun secondo entitlement", async () => {
  rpc.mockResolvedValue({ data: false, error: null });
  const { settleWeeklyCryptoOrder } = await import("./crypto-settle");
  expect((await settleWeeklyCryptoOrder(WEEKLY)).granted).toBe(false);
  expect(grantWeeklyPick).not.toHaveBeenCalled();
});

// Pagata ma grant fallito (DB giù): NON si dichiara concessa. È il caso che il
// cron ri-tenta, e può farlo perché grantWeeklyPick è idempotente.
it("weekly, grant fallito: granted=false e motivo esplicito, mai un successo finto", async () => {
  grantWeeklyPick.mockRejectedValue(new Error("db down"));
  const { settleWeeklyCryptoOrder } = await import("./crypto-settle");
  const r = await settleWeeklyCryptoOrder(WEEKLY);
  expect(r.granted).toBe(false);
  expect(r.reason).toMatch(/paid but grant failed/);
  // granted_at NON deve essere scritto: è ciò che fa ripescare l'ordine al cron.
  expect(dbExecute).not.toHaveBeenCalledWith(
    expect.stringContaining("granted_at"),
    expect.anything()
  );
});

it("weekly, mirror Shopify fallito: l'entitlement resta concesso", async () => {
  createMirroredPaidOrder.mockResolvedValue(null);
  const { settleWeeklyCryptoOrder } = await import("./crypto-settle");
  expect((await settleWeeklyCryptoOrder(WEEKLY)).granted).toBe(true);
});

// ───────── Ricevute (#CRYPTO-RECEIPTS-1) ─────────

// Prima di questo, chi pagava un PIANO in crypto non riceveva nessuna ricevuta:
// solo la mail "piano attivo", senza l'importo pagato.
it("piano in crypto: manda la ricevuta con l'importo e il rail della moneta", async () => {
  const { settleCryptoOrder } = await import("./crypto-settle");
  await settleCryptoOrder(ORDER);
  expect(sendPlanReceipt).toHaveBeenCalledTimes(1);
  expect(sendPlanReceipt).toHaveBeenCalledWith(
    expect.objectContaining({ identifier: "u@t.com", plan: "base", amountUsd: 14.99, rail: "crypto:polygon-usdc", orderId: "ord-1" })
  );
});

// La ricevuta non deve MAI partire senza un pagamento confermato.
it("piano in crypto non pagato: nessuna ricevuta", async () => {
  checkIncoming.mockResolvedValue({ received: 1, pending: 0, txHash: null });
  const { settleCryptoOrder } = await import("./crypto-settle");
  await settleCryptoOrder(ORDER);
  expect(sendPlanReceipt).not.toHaveBeenCalled();
});

// Né se il claim è stato perso: chi ha vinto la race l'ha già mandata.
it("claim perso: nessuna ricevuta (l'ha già mandata il vincitore)", async () => {
  rpc.mockResolvedValue({ data: false, error: null });
  const { settleCryptoOrder } = await import("./crypto-settle");
  await settleCryptoOrder(ORDER);
  expect(sendPlanReceipt).not.toHaveBeenCalled();
});

it("weekly: manda ricevuta + evento con settimana, importo e rail", async () => {
  checkIncoming.mockResolvedValue({ received: 13.01, pending: 0, txHash: "0xwtx" });
  const { settleWeeklyCryptoOrder } = await import("./crypto-settle");
  await settleWeeklyCryptoOrder(WEEKLY);
  expect(notifyWeeklyPickGranted).toHaveBeenCalledTimes(1);
  expect(notifyWeeklyPickGranted).toHaveBeenCalledWith(
    expect.objectContaining({ identifier: "u@t.com", weekStart: "2026-07-27", amountUsd: 12.99, rail: "crypto:polygon-usdc", orderId: "wp-1" })
  );
});

it("weekly non pagata: nessuna ricevuta", async () => {
  checkIncoming.mockResolvedValue({ received: 0, pending: 0, txHash: null });
  const { settleWeeklyCryptoOrder } = await import("./crypto-settle");
  await settleWeeklyCryptoOrder(WEEKLY);
  expect(notifyWeeklyPickGranted).not.toHaveBeenCalled();
});

// Il grant è il prodotto, la ricevuta è contabilità: se il grant fallisce non si
// manda una ricevuta di qualcosa che il cliente non ha ricevuto.
it("weekly, grant fallito: nessuna ricevuta", async () => {
  grantWeeklyPick.mockRejectedValue(new Error("db down"));
  const { settleWeeklyCryptoOrder } = await import("./crypto-settle");
  await settleWeeklyCryptoOrder(WEEKLY);
  expect(notifyWeeklyPickGranted).not.toHaveBeenCalled();
});

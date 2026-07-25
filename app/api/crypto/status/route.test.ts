import { it, expect, vi, beforeEach } from "vitest";

const getSessionPlan = vi.fn();
const dbQueryStrict = vi.fn();
const settleCryptoOrder = vi.fn();

vi.mock("@/lib/auth", () => ({ getSessionPlan }));
vi.mock("@/lib/db", () => ({ dbQueryStrict, dbQuery: vi.fn(), dbExecute: vi.fn() }));
vi.mock("@/lib/crypto-settle", () => ({ settleCryptoOrder }));

const ID = "11111111-2222-3333-4444-555555555555";
function req(id = ID) {
  return new Request(`https://x/api/crypto/status?order=${id}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionPlan.mockResolvedValue({ identifier: "u@t.com", plan: "free", name: null, plan_expires_at: null });
  dbQueryStrict.mockResolvedValue([
    { id: ID, identifier: "u@t.com", plan: "base", period: "monthly", amount_usd: 14.99,
      status: "pending", coin: "polygon-usdc", expected_value_coin: 15.01,
      crypto_address_in: "0xdep", shopify_order_id: null, granted_at: null },
  ]);
  settleCryptoOrder.mockResolvedValue({ granted: false, reason: "nessun pagamento confermato", received: 0, pending: 0 });
});

// Il polling non legge solo: prova a saldare. Così l'attivazione non dipende dal
// callback di PayGate, che può perdersi.
it("ri-verifica on-chain a ogni giro e riporta l'attesa", async () => {
  const { GET } = await import("./route");
  const body = await (await GET(req())).json();
  expect(settleCryptoOrder).toHaveBeenCalledTimes(1);
  expect(body).toMatchObject({ status: "pending", granted: false, expected: 15.01 });
});

it("appena il pagamento è confermato risponde paid", async () => {
  settleCryptoOrder.mockResolvedValue({ granted: true, reason: "ok", received: 15.01 });
  const { GET } = await import("./route");
  expect(await (await GET(req())).json()).toMatchObject({ status: "paid", granted: true });
});

// SICUREZZA: la query filtra per identifier di sessione. Con l'id di un altro
// non si deve poter né leggere né far attivare il suo ordine.
it("la lettura è vincolata all'identifier della sessione", async () => {
  const { GET } = await import("./route");
  await GET(req());
  const [sql, params] = dbQueryStrict.mock.calls[0];
  expect(String(sql)).toMatch(/identifier = \$2 OR LOWER\(TRIM\(identifier\)\) = \$2/);
  expect(params).toEqual([ID, "u@t.com"]);
});

it("404 se l'ordine non è dell'utente (o non esiste)", async () => {
  dbQueryStrict.mockResolvedValue([]);
  const { GET } = await import("./route");
  expect((await GET(req())).status).toBe(404);
  expect(settleCryptoOrder).not.toHaveBeenCalled();
});

it("401 senza sessione", async () => {
  getSessionPlan.mockResolvedValue(null);
  const { GET } = await import("./route");
  expect((await GET(req())).status).toBe(401);
});

// Un id non-uuid non deve nemmeno arrivare al DB.
it("400 su id malformato", async () => {
  const { GET } = await import("./route");
  expect((await GET(req("not-a-uuid"))).status).toBe(400);
  expect(dbQueryStrict).not.toHaveBeenCalled();
});

// Ordine già saldato: si risponde dallo stato, senza ri-interrogare la catena.
it("ordine già paid: nessuna nuova verifica", async () => {
  dbQueryStrict.mockResolvedValue([
    { id: ID, identifier: "u@t.com", plan: "base", period: "monthly", amount_usd: 14.99,
      status: "paid", coin: "polygon-usdc", expected_value_coin: 15.01,
      crypto_address_in: "0xdep", shopify_order_id: null, granted_at: "2026-07-25T20:00:00Z" },
  ]);
  const { GET } = await import("./route");
  expect(await (await GET(req())).json()).toMatchObject({ status: "paid", granted: true });
  expect(settleCryptoOrder).not.toHaveBeenCalled();
});

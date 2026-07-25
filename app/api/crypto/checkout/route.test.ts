import { it, expect, vi, beforeEach } from "vitest";

const getSessionPlan = vi.fn();
const dbExecute = vi.fn();
const promoEligibility = vi.fn();
const convertUsdToCoin = vi.fn();
const coinMinimum = vi.fn();
const createCryptoDeposit = vi.fn();

vi.mock("@/lib/auth", () => ({ getSessionPlan }));
vi.mock("@/lib/db", () => ({ dbExecute, dbQuery: vi.fn(), dbQueryStrict: vi.fn() }));
vi.mock("@/lib/creator-promo", () => ({ promoEligibility }));
vi.mock("@/lib/crypto-api", () => ({ convertUsdToCoin, coinMinimum, createCryptoDeposit }));
vi.mock("@/lib/activation", () => ({ siteOrigin: () => "https://www.betredge.com" }));

function req(body: unknown) {
  return new Request("https://x/api/crypto/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.PAYGATE_PAYOUT_WALLET = "0x72e348d948e984c7d57d8ccb93fdd52710e47fa2";
  process.env.CRYPTO_COINS_ENABLED = "polygon-usdc,polygon-usdt";
  delete process.env.LAUNCH_PROMO_ENABLED;
  getSessionPlan.mockResolvedValue({ identifier: "u@t.com", plan: "free", name: null, plan_expires_at: null });
  promoEligibility.mockResolvedValue({ firstPaidOrder: false });
  convertUsdToCoin.mockResolvedValue(15.01);
  coinMinimum.mockResolvedValue(0.665);
  createCryptoDeposit.mockResolvedValue({ addressIn: "0xdeposit", ipnToken: "ipn" });
});

it("crea l'ordine con moneta, importo atteso e indirizzo di deposito", async () => {
  const { POST } = await import("./route");
  const res = await POST(req({ requested_plan: "base", period: "monthly", coin: "polygon-usdc" }));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toMatchObject({ coin: "polygon-usdc", address: "0xdeposit", amount_coin: 15.01, amount_usd: 14.99 });

  const ins = dbExecute.mock.calls.find((c) => String(c[0]).includes("INSERT INTO paygate_orders"));
  // expected_value_coin e crypto_address_in sono ciò con cui si verificherà il
  // pagamento: se non finiscono in DB, l'ordine non è verificabile.
  expect(ins?.[1]).toEqual([
    expect.any(String), "u@t.com", "base", "monthly", 14.99, expect.any(String), "ipn",
    "polygon-usdc", 15.01, "0xdeposit",
  ]);
});

// Sotto il minimo di rete PayGate non inoltra: l'utente pagherebbe e i fondi
// resterebbero bloccati. Va rifiutato PRIMA di dare un indirizzo.
it("409 se l'importo è sotto il minimo della moneta, senza creare nulla", async () => {
  coinMinimum.mockResolvedValue(13.3); // il minimo di USDT TRC20
  convertUsdToCoin.mockResolvedValue(12.99); // Weekly Pick
  const { POST } = await import("./route");
  const res = await POST(req({ requested_plan: "base", period: "monthly", coin: "polygon-usdt" }));
  expect(res.status).toBe(409);
  expect(await res.json()).toMatchObject({ error: "amount below coin minimum", minimum: 13.3 });
  expect(createCryptoDeposit).not.toHaveBeenCalled();
  expect(dbExecute).not.toHaveBeenCalled();
});

it("400 su moneta non abilitata (o inventata)", async () => {
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "base", period: "monthly", coin: "trc20-usdt" }))).status).toBe(400);
  expect((await POST(req({ requested_plan: "base", period: "monthly", coin: "../etc/passwd" }))).status).toBe(400);
});

it("401 senza sessione: l'ordine è legato all'account", async () => {
  getSessionPlan.mockResolvedValue(null);
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "base", period: "monthly", coin: "polygon-usdc" }))).status).toBe(401);
});

// Stessa tier-guard del rail carte: rinnovare Pro al prezzo di Base è arbitraggio.
it("409 se un premium attivo tenta di comprare base", async () => {
  getSessionPlan.mockResolvedValue({ identifier: "u@t.com", plan: "premium", name: null, plan_expires_at: null });
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "base", period: "monthly", coin: "polygon-usdc" }))).status).toBe(409);
});

it("503 senza wallet di payout: PayGate inoltrerebbe a nessuno", async () => {
  delete process.env.PAYGATE_PAYOUT_WALLET;
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "base", period: "monthly", coin: "polygon-usdc" }))).status).toBe(503);
});

// Se non sappiamo quanto far inviare, non si apre un ordine "a occhio".
it("502 se la quote PayGate non risponde", async () => {
  convertUsdToCoin.mockRejectedValue(new Error("timeout"));
  const { POST } = await import("./route");
  expect((await POST(req({ requested_plan: "base", period: "monthly", coin: "polygon-usdc" }))).status).toBe(502);
  expect(dbExecute).not.toHaveBeenCalled();
});

it("GET elenca solo le monete abilitate", async () => {
  process.env.CRYPTO_COINS_ENABLED = "polygon-usdc";
  const { GET } = await import("./route");
  const body = await (await GET()).json();
  expect(body.coins).toEqual([{ id: "polygon-usdc", label: "USDC · Polygon" }]);
});

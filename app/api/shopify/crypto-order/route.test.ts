import { it, expect, vi, beforeEach } from "vitest";

const getSessionPlan = vi.fn();
const dbQueryStrict = vi.fn();
const dbExecute = vi.fn();
const findPendingCryptoOrder = vi.fn();
const createReceivingWallet = vi.fn();

vi.mock("@/lib/auth", () => ({ getSessionPlan }));
vi.mock("@/lib/db", () => ({ dbQuery: vi.fn(), dbQueryStrict, dbExecute }));
vi.mock("@/lib/shopify-admin", () => ({
  findPendingCryptoOrder,
  isShopifyAdminConfigured: () => Boolean(process.env.SHOPIFY_ADMIN_TOKEN),
}));
vi.mock("@/lib/paygate", () => ({
  newOrderToken: () => ({ token: "tok", tokenHash: "hash" }),
  createReceivingWallet,
  buildPayUrl: ({ addressIn, amount }: { addressIn: string; amount: number }) =>
    `https://pay.test/?a=${addressIn}&amt=${amount}`,
}));
vi.mock("@/lib/activation", () => ({ siteOrigin: () => "https://www.betredge.com" }));

function req() {
  return new Request("https://x/api/shopify/crypto-order", { method: "POST" });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SHOPIFY_SHOP_DOMAIN = "gvfgra-sp.myshopify.com";
  process.env.SHOPIFY_ADMIN_TOKEN = "shpat_test";
  process.env.SHOPIFY_CRYPTO_GATEWAY_NAME = "Crypto (USDT, BTC, ETH)";
  process.env.SHOPIFY_VARIANT_BASE_ONEOFF = "9111";
  process.env.SHOPIFY_VARIANT_PREMIUM_ONEOFF = "9222";
  process.env.PAYGATE_PAYOUT_WALLET = "0xwallet";
  getSessionPlan.mockResolvedValue({ identifier: "u@t.com", plan: "free", name: null, plan_expires_at: null });
  findPendingCryptoOrder.mockResolvedValue({
    id: "gid://shopify/Order/555",
    name: "#1001",
    amountUsd: 14.99,
    variantId: "9111",
  });
  dbQueryStrict.mockResolvedValue([]); // nessun ordine PayGate già aperto
  createReceivingWallet.mockResolvedValue({
    addressIn: "0xin",
    polygonAddressIn: "0xpoly",
    ipnToken: "ipn",
  });
});

it("apre l'ordine PayGate legato all'ordine Shopify pendente", async () => {
  const { POST } = await import("./route");
  const res = await POST(req());
  expect(res.status).toBe(200);
  const body = (await res.json()) as { url: string; order: string; amount: number };
  expect(body.order).toBe("#1001");

  const insert = dbExecute.mock.calls.find((c) => String(c[0]).includes("INSERT INTO paygate_orders"));
  // L'importo viene dall'ORDINE SHOPIFY (l'unico che il cliente ha accettato) e
  // shopify_order_id è ciò che permette al callback di marcarlo pagato.
  expect(insert?.[1]).toEqual([
    expect.any(String), "u@t.com", "base", "monthly", 14.99, "hash", "gid://shopify/Order/555",
  ]);
});

it("401 senza sessione: l'ordine è legato all'account, non all'email del checkout", async () => {
  getSessionPlan.mockResolvedValue(null);
  const { POST } = await import("./route");
  expect((await POST(req())).status).toBe(401);
});

it("404 se non c'è nessun ordine crypto in attesa", async () => {
  findPendingCryptoOrder.mockResolvedValue(null);
  const { POST } = await import("./route");
  expect((await POST(req())).status).toBe(404);
  expect(dbExecute).not.toHaveBeenCalled();
});

// Se l'Admin API non risponde NON si apre un ordine crypto alla cieca: sapremmo
// di aver incassato, ma non su quale ordine Shopify.
it("502 se il lookup Shopify fallisce, senza creare ordini", async () => {
  findPendingCryptoOrder.mockRejectedValue(new Error("admin down"));
  const { POST } = await import("./route");
  expect((await POST(req())).status).toBe(502);
  expect(dbExecute).not.toHaveBeenCalled();
});

// Ricaricare la pagina di pagamento non deve generare un secondo indirizzo:
// due indirizzi per lo stesso ordine = un pagamento che nessuno riconcilia.
it("riusa l'ordine PayGate già aperto per lo stesso ordine Shopify", async () => {
  dbQueryStrict.mockResolvedValue([{ id: "old", polygon_address_in: "0xold", amount_usd: 14.99 }]);
  const { POST } = await import("./route");
  const res = await POST(req());
  expect(res.status).toBe(200);
  expect((await res.json()).url).toContain("0xold");
  expect(createReceivingWallet).not.toHaveBeenCalled();
  expect(dbExecute).not.toHaveBeenCalled();
});

it("503 se il rail crypto non è configurato", async () => {
  delete process.env.SHOPIFY_CRYPTO_GATEWAY_NAME;
  const { POST } = await import("./route");
  expect((await POST(req())).status).toBe(503);
});

it("409 se la variant dell'ordine non è una nostra SKU", async () => {
  findPendingCryptoOrder.mockResolvedValue({ id: "gid://shopify/Order/9", name: "#9", amountUsd: 5, variantId: "666" });
  const { POST } = await import("./route");
  expect((await POST(req())).status).toBe(409);
});

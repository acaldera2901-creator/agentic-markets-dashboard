import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { findPendingCryptoOrder, markShopifyOrderPaid, isShopifyAdminConfigured } from "./shopify-admin";

const GATEWAY = "Crypto (USDT, BTC, ETH)";

function gqlOk(data: unknown) {
  return { ok: true, json: async () => ({ data }) } as unknown as Response;
}

function orderNode(over: Record<string, unknown> = {}) {
  return {
    id: "gid://shopify/Order/555",
    name: "#1001",
    paymentGatewayNames: [GATEWAY],
    customAttributes: [{ key: "identifier", value: "u@t.com" }],
    currentTotalPriceSet: { shopMoney: { amount: "14.99" } },
    lineItems: { nodes: [{ variant: { id: "gid://shopify/ProductVariant/9111" } }] },
    ...over,
  };
}

beforeEach(() => {
  process.env.SHOPIFY_SHOP_DOMAIN = "betredge.myshopify.com";
  process.env.SHOPIFY_ADMIN_TOKEN = "shpat_test";
  vi.restoreAllMocks();
});

afterEach(() => {
  delete process.env.SHOPIFY_ADMIN_TOKEN;
});

describe("isShopifyAdminConfigured", () => {
  it("false senza token: il rail crypto resta inerte invece di rompersi", () => {
    delete process.env.SHOPIFY_ADMIN_TOKEN;
    expect(isShopifyAdminConfigured()).toBe(false);
  });
});

describe("findPendingCryptoOrder", () => {
  it("trova l'ordine dell'utente e ne legge importo e variant", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(gqlOk({ orders: { nodes: [orderNode()] } })));
    const o = await findPendingCryptoOrder("u@t.com", GATEWAY);
    expect(o).toEqual({ id: "gid://shopify/Order/555", name: "#1001", amountUsd: 14.99, variantId: "9111" });
  });

  // Il match è sull'identifier di SESSIONE, non sull'email digitata al checkout:
  // altrimenti si potrebbe pagare (e sbloccare) l'ordine di un altro account.
  it("ignora l'ordine di un altro identifier", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        gqlOk({ orders: { nodes: [orderNode({ customAttributes: [{ key: "identifier", value: "altro@t.com" }] })] } })
      )
    );
    expect(await findPendingCryptoOrder("u@t.com", GATEWAY)).toBe(null);
  });

  // Un pendente pagato con bonifico/COD non è roba nostra: toccarlo vorrebbe
  // dire incassare crypto per un ordine che aspetta un altro pagamento.
  it("ignora i pendenti di un altro metodo di pagamento", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(gqlOk({ orders: { nodes: [orderNode({ paymentGatewayNames: ["Bank Deposit"] })] } }))
    );
    expect(await findPendingCryptoOrder("u@t.com", GATEWAY)).toBe(null);
  });

  it("scarta un ordine con totale non leggibile invece di aprire un ordine a 0", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        gqlOk({ orders: { nodes: [orderNode({ currentTotalPriceSet: { shopMoney: { amount: "0.00" } } })] } })
      )
    );
    expect(await findPendingCryptoOrder("u@t.com", GATEWAY)).toBe(null);
  });

  // Fail-loud: chi chiama deve poter rispondere 502 e NON inventare un ordine.
  it("propaga l'errore GraphQL invece di degradare a 'non trovato'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ errors: [{ message: "boom" }] }) } as unknown as Response)
    );
    await expect(findPendingCryptoOrder("u@t.com", GATEWAY)).rejects.toThrow(/boom/);
  });
});

describe("markShopifyOrderPaid", () => {
  it("true quando Shopify marca l'ordine", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        gqlOk({ orderMarkAsPaid: { order: { id: "gid://shopify/Order/555", displayFinancialStatus: "PAID" }, userErrors: [] } })
      )
    );
    expect(await markShopifyOrderPaid("gid://shopify/Order/555")).toBe(true);
  });

  // Un retry del callback non deve sembrare un fallimento: l'ordine è già pagato,
  // cioè lo stato che volevamo.
  it("tratta 'già pagato' come successo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        gqlOk({ orderMarkAsPaid: { order: null, userErrors: [{ message: "Order has already been paid" }] } })
      )
    );
    expect(await markShopifyOrderPaid("gid://shopify/Order/555")).toBe(true);
  });

  it("false su un errore diverso, così resta nei log come anomalia", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        gqlOk({ orderMarkAsPaid: { order: null, userErrors: [{ message: "Order is cancelled" }] } })
      )
    );
    expect(await markShopifyOrderPaid("gid://shopify/Order/555")).toBe(false);
  });
});

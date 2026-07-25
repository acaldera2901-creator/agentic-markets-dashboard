import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMirroredPaidOrder, mirrorLineTitle, isShopifyAdminConfigured } from "./shopify-admin";

function gqlOk(data: unknown) {
  return { ok: true, json: async () => ({ data }) } as unknown as Response;
}

const MIRROR = {
  identifier: "u@t.com",
  plan: "base" as const,
  period: "monthly" as const,
  amountUsd: 14.99,
  paygateOrderId: "pg-1",
  txid: "0xabc",
};

function created() {
  return gqlOk({
    orderCreate: {
      order: { id: "gid://shopify/Order/777", name: "#1003", displayFinancialStatus: "PAID" },
      userErrors: [],
    },
  });
}

beforeEach(() => {
  process.env.SHOPIFY_SHOP_DOMAIN = "betredge.myshopify.com";
  process.env.SHOPIFY_ADMIN_TOKEN = "shpat_test";
  vi.restoreAllMocks();
});

afterEach(() => {
  delete process.env.SHOPIFY_ADMIN_TOKEN;
});

describe("mirrorLineTitle", () => {
  // Il crypto non si rinnova mai: una riga "Annual subscription" su un pagamento
  // one-off sarebbe una ricevuta falsa.
  it("dichiara durata e natura one-time, senza parlare di abbonamento", () => {
    expect(mirrorLineTitle("base", "monthly")).toBe("BetRedge Base — 30 days (one-time, crypto)");
    expect(mirrorLineTitle("premium", "annual")).toBe("BetRedge Premium — 365 days (one-time, crypto)");
  });
});

describe("createMirroredPaidOrder", () => {
  it("crea l'ordine già PAGATO con importo, identifier e transazione", async () => {
    const fetchMock = vi.fn().mockResolvedValue(created());
    vi.stubGlobal("fetch", fetchMock);

    expect(await createMirroredPaidOrder(MIRROR)).toBe("gid://shopify/Order/777");

    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    const o = body.variables.order;
    expect(o.financialStatus).toBe("PAID");
    expect(o.email).toBe("u@t.com");
    expect(o.lineItems[0]).toMatchObject({
      title: "BetRedge Base — 30 days (one-time, crypto)",
      quantity: 1,
      requiresShipping: false,
      priceSet: { shopMoney: { amount: "14.99", currencyCode: "USD" } },
    });
    // L'identifier è la chiave con cui il webhook dei rimborsi ritrova l'utente.
    expect(o.customAttributes).toEqual(
      expect.arrayContaining([{ key: "identifier", value: "u@t.com" }])
    );
    // La transazione rende l'incasso visibile in Finanze col suo gateway.
    expect(o.transactions[0]).toMatchObject({
      kind: "SALE",
      status: "SUCCESS",
      gateway: "PayGate (crypto)",
      authorizationCode: "0xabc",
    });
    // Ricevuta nostra, non di Shopify: due ricevute per un pagamento = reclamo.
    expect(body.variables.options).toEqual({ sendReceipt: false });
  });

  // I soldi sono già arrivati e il piano è già concesso: il mirror non deve MAI
  // propagare un errore nel callback.
  it("null (mai throw) se Shopify risponde con userErrors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(gqlOk({ orderCreate: { order: null, userErrors: [{ message: "boom" }] } }))
    );
    expect(await createMirroredPaidOrder(MIRROR)).toBe(null);
  });

  it("null (mai throw) se la rete cade", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect(await createMirroredPaidOrder(MIRROR)).toBe(null);
  });

  it("null senza token, senza nemmeno chiamare Shopify", async () => {
    delete process.env.SHOPIFY_ADMIN_TOKEN;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await createMirroredPaidOrder(MIRROR)).toBe(null);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(isShopifyAdminConfigured()).toBe(false);
  });

  it("identifier non-email: nessun campo email, ma l'attributo resta", async () => {
    const fetchMock = vi.fn().mockResolvedValue(created());
    vi.stubGlobal("fetch", fetchMock);
    await createMirroredPaidOrder({ ...MIRROR, identifier: "wallet-user-42" });
    const o = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body).variables.order;
    expect(o.email).toBeUndefined();
    expect(o.customAttributes).toEqual(
      expect.arrayContaining([{ key: "identifier", value: "wallet-user-42" }])
    );
  });
});

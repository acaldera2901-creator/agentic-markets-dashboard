import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMirroredPaidOrder, mirrorLineTitle, isShopifyAdminConfigured } from "./shopify-admin";

function gqlOk(data: unknown) {
  return { ok: true, json: async () => ({ data }) } as unknown as Response;
}

const MIRROR = {
  identifier: "u@t.com",
  line: { kind: "plan", plan: "base", period: "monthly" } as const,
  amountUsd: 14.99,
  paygateOrderId: "pg-1",
  txid: "0xabc",
};

const MIRROR_WEEKLY = {
  identifier: "u@t.com",
  line: { kind: "weekly", weekStart: "2026-07-27" } as const,
  amountUsd: 12.99,
  paygateOrderId: "wp-1",
  txid: "0xdef",
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
    expect(mirrorLineTitle({ kind: "plan", plan: "base", period: "monthly" }))
      .toBe("BetRedge Base — 30 days (one-time, crypto)");
    expect(mirrorLineTitle({ kind: "plan", plan: "premium", period: "annual" }))
      .toBe("BetRedge Premium — 365 days (one-time, crypto)");
  });

  // La Weekly Pick non è un accesso a giorni: senza la settimana nel titolo, dalla
  // ricevuta non si capisce QUALE pick è stata comprata.
  it("weekly: nomina la settimana e non parla né di giorni né di piano", () => {
    const title = mirrorLineTitle({ kind: "weekly", weekStart: "2026-07-27" });
    expect(title).toBe("BetRedge Weekly Pick — week of 2026-07-27 (one-time, crypto)");
    expect(title).not.toMatch(/days|Base|Premium/);
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

  // #WEEKLY-RAILS-1: l'ordine specchiato della Weekly Pick deve essere
  // distinguibile dall'abbonamento — hanno rimborsi diversi — e portare la
  // settimana comprata.
  it("weekly: importo, tag weekly-pick e attributo week_start", async () => {
    const fetchMock = vi.fn().mockResolvedValue(created());
    vi.stubGlobal("fetch", fetchMock);

    expect(await createMirroredPaidOrder(MIRROR_WEEKLY)).toBe("gid://shopify/Order/777");

    const o = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body).variables.order;
    expect(o.financialStatus).toBe("PAID");
    expect(o.tags).toEqual(["crypto", "paygate", "weekly-pick"]);
    expect(o.lineItems[0]).toMatchObject({
      title: "BetRedge Weekly Pick — week of 2026-07-27 (one-time, crypto)",
      priceSet: { shopMoney: { amount: "12.99", currencyCode: "USD" } },
    });
    expect(o.customAttributes).toEqual(
      expect.arrayContaining([
        { key: "identifier", value: "u@t.com" },
        { key: "week_start", value: "2026-07-27" },
      ])
    );
  });

  // L'ordine di un piano NON deve portare il tag/attributo della weekly, o i
  // filtri d'ordine in Shopify mescolerebbero i due prodotti.
  it("piano: nessun tag weekly-pick, nessun week_start", async () => {
    const fetchMock = vi.fn().mockResolvedValue(created());
    vi.stubGlobal("fetch", fetchMock);
    await createMirroredPaidOrder(MIRROR);
    const o = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body).variables.order;
    expect(o.tags).toEqual(["crypto", "paygate"]);
    expect(JSON.stringify(o.customAttributes)).not.toContain("week_start");
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

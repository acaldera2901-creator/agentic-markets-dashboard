import { describe, it, expect, beforeEach } from "vitest";
import crypto from "node:crypto";
import {
  verifyShopifyHmac,
  shopifyLocalePrefix,
  resolveOrderFromVariant,
  extractOrder,
  extractRefund,
  isFullRefund,
  buildShopifyCheckoutUrl,
} from "./shopify";

const SECRET = "whsec_test_123";
beforeEach(() => {
  process.env.SHOPIFY_WEBHOOK_SECRET = SECRET;
  process.env.SHOPIFY_VARIANT_BASE = "111";
  process.env.SHOPIFY_VARIANT_PREMIUM = "222";
  process.env.SHOPIFY_VARIANT_BASE_ANNUAL = "333";
  process.env.SHOPIFY_VARIANT_PREMIUM_ANNUAL = "444";
  process.env.SHOPIFY_SHOP_DOMAIN = "betredge.myshopify.com";
  // I selling plan sono ora OBBLIGATORI per base/premium: senza, un ordine
  // sarebbe un addebito unico travestito da abbonamento.
  process.env.SHOPIFY_SELLING_PLAN_BASE = "777";
  process.env.SHOPIFY_SELLING_PLAN_PREMIUM = "778";
  process.env.SHOPIFY_SELLING_PLAN_ANNUAL = "888";
});
function sign(body: string) {
  return crypto.createHmac("sha256", SECRET).update(body, "utf8").digest("base64");
}

describe("verifyShopifyHmac", () => {
  it("accetta una firma valida", () => {
    const body = '{"id":1}';
    expect(verifyShopifyHmac(body, sign(body))).toBe(true);
  });
  it("rifiuta firma errata o header mancante", () => {
    expect(verifyShopifyHmac('{"id":1}', "deadbeef")).toBe(false);
    expect(verifyShopifyHmac('{"id":1}', null)).toBe(false);
  });
});

describe("resolveOrderFromVariant", () => {
  it("mappa i variant mensili", () => {
    expect(resolveOrderFromVariant("111")).toEqual({ plan: "base", period: "monthly" });
    expect(resolveOrderFromVariant(222)).toEqual({ plan: "premium", period: "monthly" });
  });
  it("mappa i variant annuali col periodo giusto (365 giorni, non 30)", () => {
    expect(resolveOrderFromVariant("333")).toEqual({ plan: "base", period: "annual" });
    expect(resolveOrderFromVariant(444)).toEqual({ plan: "premium", period: "annual" });
  });
  it("ritorna null su variant sconosciuto", () => {
    expect(resolveOrderFromVariant("999")).toBe(null);
    expect(resolveOrderFromVariant(null)).toBe(null);
  });
});

describe("extractOrder", () => {
  it("estrae orderId, email, identifier e variant dal payload orders/paid", () => {
    const payload = {
      id: 5001,
      email: "User@Test.com",
      note_attributes: [{ name: "identifier", value: "user@test.com" }],
      line_items: [{ variant_id: 222 }],
    };
    const o = extractOrder(payload)!;
    expect(o.orderId).toBe("5001");
    expect(o.email).toBe("User@Test.com");
    expect(o.identifier).toBe("user@test.com");
    expect(o.variantId).toBe("222");
  });
  it("ritorna null se manca l'id ordine", () => {
    expect(extractOrder({ email: "x@y.com" })).toBe(null);
  });
});

describe("buildShopifyCheckoutUrl", () => {
  // Decodifica il return_to annidato per asserire sui parametri veri di /cart/add.
  function addParams(url: string): URLSearchParams {
    const outer = new URL(url).searchParams.get("return_to")!;
    return new URLSearchParams(outer.split("?")[1]);
  }

  it("passa per /cart/clear → /cart/add con identifier e email prefill", () => {
    const url = buildShopifyCheckoutUrl("premium", "User@Test.com")!;
    expect(url).toContain("https://betredge.myshopify.com/en/cart/clear?");
    const p = addParams(url);
    expect(p.get("id")).toBe("222");
    expect(p.get("quantity")).toBe("1");
    // identifier normalizzato lowercase come extractOrder; email prefill col case originale
    expect(p.get("attributes[identifier]")).toBe("user@test.com");
    expect(p.get("return_to")).toBe("/en/checkout?checkout%5Bemail%5D=User%40Test.com");
  });

  it("applica il selling_plan sui piani (altrimenti sarebbe un addebito una-tantum)", () => {
    const p = addParams(buildShopifyCheckoutUrl("base", "a@b.com")!);
    expect(p.get("id")).toBe("111");
    expect(p.get("selling_plan")).toBe("777");
  });

  it("NON usa il permalink /cart/{variant}:1, che ignora il selling plan", () => {
    expect(buildShopifyCheckoutUrl("base", "a@b.com")).not.toContain("/cart/111:1");
  });

  it("svuota il carrello prima di aggiungere (doppio click = due abbonamenti)", () => {
    const url = buildShopifyCheckoutUrl("base", "a@b.com")!;
    expect(new URL(url).pathname).toBe("/en/cart/clear");
  });

  it("annuale: usa il prodotto annuale e il selling plan annuale", () => {
    const p = addParams(buildShopifyCheckoutUrl("premium", "a@b.com", "annual")!);
    expect(p.get("id")).toBe("444"); // prodotto premium ANNUALE, non quello mensile
    expect(p.get("selling_plan")).toBe("888");
  });

  it("annuale: null se il prodotto annuale non è configurato (fallback PayGate)", () => {
    delete process.env.SHOPIFY_VARIANT_BASE_ANNUAL;
    expect(buildShopifyCheckoutUrl("base", "a@b.com", "annual")).toBe(null);
  });

  it("la weekly pick ignora il periodo e resta senza piano", () => {
    process.env.SHOPIFY_VARIANT_WEEKLY = "555";
    const p = addParams(buildShopifyCheckoutUrl("weekly", "a@b.com", "annual")!);
    expect(p.get("id")).toBe("555");
    expect(p.get("selling_plan")).toBe(null);
  });

  it("ritorna null se lo store non è configurato (fallback al flusso attuale)", () => {
    delete process.env.SHOPIFY_SHOP_DOMAIN;
    expect(buildShopifyCheckoutUrl("base", "a@b.com")).toBe(null);
  });

  // Il difetto: senza selling plan l'ordine passava come addebito UNICO e
  // nessuno se ne accorgeva. Meglio non offrire il rail.
  it("null se manca il selling plan del mensile", () => {
    delete process.env.SHOPIFY_SELLING_PLAN_BASE;
    expect(buildShopifyCheckoutUrl("base", "a@b.com")).toBe(null);
  });

  it("null se manca il selling plan annuale", () => {
    delete process.env.SHOPIFY_SELLING_PLAN_ANNUAL;
    expect(buildShopifyCheckoutUrl("premium", "a@b.com", "annual")).toBe(null);
  });
});

// Un rimborso parziale che passava per totale azzerava un annuale pagato.
describe("isFullRefund", () => {
  it("totale → true, parziale → false", () => {
    expect(isFullRefund(329.99, 329.99)).toBe(true);
    expect(isFullRefund(29.99, 329.99)).toBe(false);
  });
  it("tollera i centesimi di arrotondamento", () => {
    expect(isFullRefund(14.98, 14.99)).toBe(true);
  });
  it("importo ignoto → totale: meglio revocare che regalare il prodotto", () => {
    expect(isFullRefund(null, 14.99)).toBe(true);
    expect(isFullRefund(14.99, null)).toBe(true);
  });
});

describe("extractRefund", () => {
  it("somma solo le transazioni di rimborso riuscite", () => {
    const r = extractRefund({
      id: 1,
      order_id: 2,
      transactions: [
        { kind: "refund", status: "success", amount: "10.00" },
        { kind: "refund", status: "failure", amount: "99.00" },
        { kind: "sale", status: "success", amount: "50.00" },
      ],
    });
    expect(r).toMatchObject({ refundId: "1", orderId: "2", amount: 10 });
  });
  it("senza transazioni l'importo resta ignoto (null), non 0", () => {
    expect(extractRefund({ id: 1, order_id: 2 })?.amount).toBe(null);
  });
});

// Il difetto misurato: senza prefisso Shopify serve la lingua DEFAULT dello
// store (spagnolo), quindi un utente inglese o italiano pagava in castigliano.
describe("lingua del checkout", () => {
  beforeEach(() => {
    process.env.SHOPIFY_SHOP_DOMAIN = "betredge.myshopify.com";
    process.env.SHOPIFY_VARIANT_BASE = "111";
    process.env.SHOPIFY_SELLING_PLAN_BASE = "777";
  });

  it("mappa solo le lingue PUBBLICATE; il resto va in inglese, non in spagnolo", () => {
    expect(shopifyLocalePrefix("it")).toBe("/it");
    expect(shopifyLocalePrefix("en")).toBe("/en");
    expect(shopifyLocalePrefix("es")).toBe(""); // default dello store
    expect(shopifyLocalePrefix("fr")).toBe("/en");
    expect(shopifyLocalePrefix("ru")).toBe("/en");
    expect(shopifyLocalePrefix(null)).toBe("/en");
  });

  // Un hop senza prefisso riporta la sessione al default: vanno prefissati tutti.
  it("prefissa OGNI hop: /cart/clear, /cart/add e /checkout", () => {
    const url = buildShopifyCheckoutUrl("base", "a@b.com", "monthly", "it")!;
    expect(new URL(url).pathname).toBe("/it/cart/clear");
    const add = new URL(url).searchParams.get("return_to")!;
    expect(add.startsWith("/it/cart/add?")).toBe(true);
    const inner = new URLSearchParams(add.split("?")[1]).get("return_to")!;
    expect(inner.startsWith("/it/checkout?")).toBe(true);
  });

  it("spagnolo: nessun prefisso (è il default dello store)", () => {
    const url = buildShopifyCheckoutUrl("base", "a@b.com", "monthly", "es")!;
    expect(new URL(url).pathname).toBe("/cart/clear");
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import crypto from "node:crypto";
import { verifyShopifyHmac, resolvePlanFromVariant, extractOrder, buildShopifyCheckoutUrl } from "./shopify";

const SECRET = "whsec_test_123";
beforeEach(() => {
  process.env.SHOPIFY_WEBHOOK_SECRET = SECRET;
  process.env.SHOPIFY_VARIANT_BASE = "111";
  process.env.SHOPIFY_VARIANT_PREMIUM = "222";
  process.env.SHOPIFY_SHOP_DOMAIN = "betredge.myshopify.com";
  delete process.env.SHOPIFY_SELLING_PLAN_BASE;
  delete process.env.SHOPIFY_SELLING_PLAN_PREMIUM;
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

describe("resolvePlanFromVariant", () => {
  it("mappa i variant id configurati", () => {
    expect(resolvePlanFromVariant("111")).toBe("base");
    expect(resolvePlanFromVariant(222)).toBe("premium");
    expect(resolvePlanFromVariant("999")).toBe(null);
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
    expect(url).toContain("https://betredge.myshopify.com/cart/clear?");
    const p = addParams(url);
    expect(p.get("id")).toBe("222");
    expect(p.get("quantity")).toBe("1");
    // identifier normalizzato lowercase come extractOrder; email prefill col case originale
    expect(p.get("attributes[identifier]")).toBe("user@test.com");
    expect(p.get("return_to")).toBe("/checkout?checkout%5Bemail%5D=User%40Test.com");
  });

  it("applica il selling_plan sui piani (altrimenti sarebbe un addebito una-tantum)", () => {
    process.env.SHOPIFY_SELLING_PLAN_BASE = "777";
    const p = addParams(buildShopifyCheckoutUrl("base", "a@b.com")!);
    expect(p.get("id")).toBe("111");
    expect(p.get("selling_plan")).toBe("777");
  });

  it("NON usa il permalink /cart/{variant}:1, che ignora il selling plan", () => {
    process.env.SHOPIFY_SELLING_PLAN_BASE = "777";
    expect(buildShopifyCheckoutUrl("base", "a@b.com")).not.toContain("/cart/111:1");
  });

  it("svuota il carrello prima di aggiungere (doppio click = due abbonamenti)", () => {
    const url = buildShopifyCheckoutUrl("base", "a@b.com")!;
    expect(new URL(url).pathname).toBe("/cart/clear");
  });

  it("ritorna null se lo store non è configurato (fallback al flusso attuale)", () => {
    delete process.env.SHOPIFY_SHOP_DOMAIN;
    expect(buildShopifyCheckoutUrl("base", "a@b.com")).toBe(null);
  });
});

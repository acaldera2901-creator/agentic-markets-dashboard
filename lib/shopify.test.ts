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
  it("costruisce il permalink cart con email prefill + identifier in attributes", () => {
    const url = buildShopifyCheckoutUrl("premium", "User@Test.com")!;
    expect(url).toContain("https://betredge.myshopify.com/cart/222:1");
    // email prefill (case-insensitive: identifier normalizzato lowercase come extractOrder)
    expect(url).toContain("checkout%5Bemail%5D=User%40Test.com");
    expect(url).toContain("attributes%5Bidentifier%5D=user%40test.com");
  });

  it("aggiunge selling_plan quando configurato (abbonamento ricorrente)", () => {
    process.env.SHOPIFY_SELLING_PLAN_BASE = "777";
    const url = buildShopifyCheckoutUrl("base", "a@b.com")!;
    expect(url).toContain("/cart/111:1");
    expect(url).toContain("selling_plan=777");
  });

  it("ritorna null se lo store non è configurato (fallback al flusso attuale)", () => {
    delete process.env.SHOPIFY_SHOP_DOMAIN;
    expect(buildShopifyCheckoutUrl("base", "a@b.com")).toBe(null);
  });
});

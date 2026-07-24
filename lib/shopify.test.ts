import { describe, it, expect, beforeEach } from "vitest";
import crypto from "node:crypto";
import { verifyShopifyHmac, resolvePlanFromVariant, extractOrder } from "./shopify";

const SECRET = "whsec_test_123";
beforeEach(() => {
  process.env.SHOPIFY_WEBHOOK_SECRET = SECRET;
  process.env.SHOPIFY_VARIANT_BASE = "111";
  process.env.SHOPIFY_VARIANT_PREMIUM = "222";
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

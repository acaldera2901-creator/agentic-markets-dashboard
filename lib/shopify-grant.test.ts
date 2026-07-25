import { describe, it, expect } from "vitest";
import { shopifyGrantAllowed, hasActiveShopifySubscription } from "./plan-grant";

const future = new Date(Date.now() + 5 * 86_400_000).toISOString();
const past = new Date(Date.now() - 5 * 86_400_000).toISOString();

describe("shopifyGrantAllowed (grandfather)", () => {
  it("BLOCCA un abbonato PayGate ancora attivo", () => {
    expect(shopifyGrantAllowed("base", "paygate", future)).toBe(false);
    expect(shopifyGrantAllowed("premium", "paygate", future)).toBe(false);
  });

  it("PERMETTE se il PayGate è scaduto", () => {
    expect(shopifyGrantAllowed("premium", "paygate", past)).toBe(true);
  });

  it("PERMETTE per sorgente shopify o nulla", () => {
    expect(shopifyGrantAllowed("premium", "shopify", future)).toBe(true);
    expect(shopifyGrantAllowed("free", null, null)).toBe(true);
  });

  // Il bug reale: profilo 'free' con plan_source/scadenza RESIDUI restava
  // grandfathered per sempre e ogni acquisto carta cadeva su PayGate.
  it("PERMETTE a un free con plan_source e scadenza residui (bug #SHOPIFY-GF-1)", () => {
    expect(shopifyGrantAllowed("free", "paygate", future)).toBe(true);
  });

  it("PERMETTE a un admin_full: non è un abbonamento PayGate", () => {
    expect(shopifyGrantAllowed("admin_full", "paygate", future)).toBe(true);
  });

  it("PERMETTE a chi è in pending_payment", () => {
    expect(shopifyGrantAllowed("pending_payment", "paygate", future)).toBe(true);
  });
});

describe("hasActiveShopifySubscription", () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  const past = new Date(Date.now() - 86400000).toISOString();

  it("blocca solo un abbonamento Shopify vivo", () => {
    expect(hasActiveShopifySubscription("base", "shopify", future)).toBe(true);
    expect(hasActiveShopifySubscription("premium", "shopify", future)).toBe(true);
  });
  it("non blocca lo scaduto, l'altro rail o il free", () => {
    expect(hasActiveShopifySubscription("base", "shopify", past)).toBe(false);
    expect(hasActiveShopifySubscription("base", "paygate", future)).toBe(false);
    expect(hasActiveShopifySubscription("free", "shopify", future)).toBe(false);
    expect(hasActiveShopifySubscription("base", "shopify", null)).toBe(false);
  });
});

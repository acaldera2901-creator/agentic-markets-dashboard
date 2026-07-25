import { describe, it, expect } from "vitest";
import { shopifyGrantAllowed } from "./plan-grant";

const future = new Date(Date.now() + 5 * 86_400_000).toISOString();
const past = new Date(Date.now() - 5 * 86_400_000).toISOString();

describe("shopifyGrantAllowed (grandfather)", () => {
  it("BLOCCA se un abbonato PayGate è ancora attivo", () => {
    expect(shopifyGrantAllowed("paygate", future)).toBe(false);
  });
  it("PERMETTE se il PayGate è scaduto", () => {
    expect(shopifyGrantAllowed("paygate", past)).toBe(true);
  });
  it("PERMETTE per sorgente shopify o nulla (free/mai pagante)", () => {
    expect(shopifyGrantAllowed("shopify", future)).toBe(true);
    expect(shopifyGrantAllowed(null, null)).toBe(true);
  });
});

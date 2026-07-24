import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

const dbQueryStrict = vi.fn();
const dbExecute = vi.fn();
const activateShopifyPlan = vi.fn();
vi.mock("@/lib/db", () => ({ dbQuery: vi.fn(), dbQueryStrict, dbExecute }));
vi.mock("@/lib/plan-grant", () => ({ activateShopifyPlan }));

const SECRET = "whsec_test_123";
function sign(body: string) {
  return crypto.createHmac("sha256", SECRET).update(body, "utf8").digest("base64");
}
function req(body: string, hmac: string | null) {
  return new Request("https://x/api/shopify/webhook", {
    method: "POST",
    headers: hmac ? { "x-shopify-hmac-sha256": hmac } : {},
    body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SHOPIFY_WEBHOOK_SECRET = SECRET;
  process.env.SHOPIFY_VARIANT_BASE = "111";
  process.env.SHOPIFY_VARIANT_PREMIUM = "222";
  dbQueryStrict.mockResolvedValue([]); // non ancora visto
});

it("rifiuta firma non valida con 401", async () => {
  const { POST } = await import("./route");
  const res = await POST(req('{"id":1}', "bad"));
  expect(res.status).toBe(401);
  expect(activateShopifyPlan).not.toHaveBeenCalled();
});

it("concede il piano su orders/paid valido", async () => {
  activateShopifyPlan.mockResolvedValue({ identifier: "u@t.com", name: null, plan: "premium" });
  const body = JSON.stringify({ id: 900, email: "u@t.com", line_items: [{ variant_id: 222 }] });
  const { POST } = await import("./route");
  const res = await POST(req(body, sign(body)));
  expect(res.status).toBe(200);
  expect(activateShopifyPlan).toHaveBeenCalledWith("u@t.com", "premium", "monthly");
});

it("è idempotente: evento già visto → no grant", async () => {
  dbQueryStrict.mockResolvedValue([{ event_id: "900" }]);
  const body = JSON.stringify({ id: 900, email: "u@t.com", line_items: [{ variant_id: 222 }] });
  const { POST } = await import("./route");
  const res = await POST(req(body, sign(body)));
  expect(res.status).toBe(200);
  expect(activateShopifyPlan).not.toHaveBeenCalled();
});

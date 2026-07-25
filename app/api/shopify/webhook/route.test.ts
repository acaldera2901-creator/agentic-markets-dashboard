import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

const dbQueryStrict = vi.fn();
const dbExecute = vi.fn();
const activateShopifyPlan = vi.fn();
const grantWeeklyPick = vi.fn();
vi.mock("@/lib/db", () => ({ dbQuery: vi.fn(), dbQueryStrict, dbExecute }));
vi.mock("@/lib/plan-grant", () => ({ activateShopifyPlan }));
vi.mock("@/lib/weekly-pick-server", () => ({ grantWeeklyPick }));

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
  process.env.SHOPIFY_VARIANT_WEEKLY = "333";
  dbQueryStrict.mockResolvedValue([]); // non ancora visto
});

it("weekly pick: concede la settimana corrente, non un piano", async () => {
  const body = JSON.stringify({ id: 901, email: "u@t.com", line_items: [{ variant_id: 333 }] });
  const { POST } = await import("./route");
  const res = await POST(req(body, sign(body)));
  expect(res.status).toBe(200);
  expect(activateShopifyPlan).not.toHaveBeenCalled();
  expect(grantWeeklyPick).toHaveBeenCalledTimes(1);
  const [identifier, week, tokenHash] = grantWeeklyPick.mock.calls[0];
  expect(identifier).toBe("u@t.com");
  expect(week).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(tokenHash).toBeNull();
});

it("weekly pick: senza identifier non concede nulla", async () => {
  const body = JSON.stringify({ id: 902, line_items: [{ variant_id: 333 }] });
  const { POST } = await import("./route");
  const res = await POST(req(body, sign(body)));
  expect(res.status).toBe(200);
  expect(grantWeeklyPick).not.toHaveBeenCalled();
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

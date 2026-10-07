import { describe, expect, it } from "vitest";
import { validateInternal } from "../core/internal";
import { type OrderIn, type ProfileIn, classify } from "./internal-rules";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const p = (n: number, identifier: string, plan = "free", plan_source: string | null = null, stripe: string | null = null): ProfileIn => ({
  id: id(n),
  identifier,
  plan,
  plan_source,
  stripe_subscription_id: stripe,
});
const o = (n: number, identifier: string, amount_usd: number | null, paid: boolean, table: OrderIn["table"] = "paygate_orders"): OrderIn => ({
  table,
  id: table === "shopify_events" ? String(9000 + n) : id(500 + n),
  identifier,
  amount_usd,
  paid,
});

describe("internal account rules (local script)", () => {
  const profiles = [
    p(1, "someone@gmail.com", "admin_full"),
    p(2, "x@mavenagency.io", "premium", "manual"),
    p(3, "calde.test@gmail.com", "premium", "paygate"),
    p(4, "mavenagency+tommy@gmail.com", "premium", "paygate"),
    p(5, "buyer@example.org", "premium", "paygate"), // external, paid order below
    p(6, "ghost@example.org", "premium", "paygate"), // external, no order at all
    p(7, "tester@example.org", "free"), // ordered at a test price
    p(8, "shop@example.org", "base", "shopify"), // paid on Shopify
    p(9, "Tommy.R@Example.org", "free"),
    p(10, "stripe@example.org", "premium", "stripe", "sub_1"),
  ];
  const orders = [
    o(1, "calde.test@gmail.com", 5, true),
    o(2, "buyer@example.org", 14.99, true),
    o(3, "tester@example.org", 2, false),
    o(4, "nobody@example.org", 1, true), // test price, no profile
    o(5, "shop@example.org", null, true, "shopify_events"),
    o(6, "ghost@example.org", 29.99, false), // pending only: not a payment
  ];
  const f = classify(profiles, orders, "2026-10-07T08:00:00Z");
  const reason = Object.fromEntries(f.accounts.map((a) => [a.id, a.reason]));

  it("one reason per account, in order: plan, domain, handle, test orders", () => {
    expect(reason[id(1)]).toBe("team-plan");
    expect(reason[id(2)]).toBe("maven-domain");
    expect(reason[id(3)]).toBe("team-handle");
    expect(reason[id(4)]).toBe("team-handle");
    expect(reason[id(7)]).toBe("test-orders");
    expect(reason[id(9)]).toBe("team-handle"); // case-insensitive
    expect(reason[id(5)]).toBeUndefined();
    expect(reason[id(6)]).toBeUndefined();
  });

  it("orders of internal accounts and orders under list price are internal", () => {
    const byId = Object.fromEntries(f.orders.map((x) => [x.id, x.reason]));
    expect(byId[id(501)]).toBe("internal-account");
    expect(byId[id(503)]).toBe("internal-account");
    expect(byId[id(504)]).toBe("test-price");
    expect(byId[id(502)]).toBeUndefined();
    expect(byId["9005"]).toBeUndefined();
  });

  it("an external paid-channel plan with no paid order is listed apart, never as internal", () => {
    expect(f.paidPlanNoPayment.map((x) => x.id)).toEqual([id(6)]);
  });

  it("the output carries no identifier and passes the app's own validation", () => {
    expect(JSON.stringify(f)).not.toMatch(/@|example|gmail|tommy\.r/i);
    expect(() => validateInternal(f)).not.toThrow();
  });
});

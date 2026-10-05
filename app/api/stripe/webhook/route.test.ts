// @vitest-environment node
// #GROWTH-TRACKING-1006.4 — invoice.paid must record the amount on stripe_events,
// best-effort: a failing UPDATE never blocks the grant. Uses a REAL Stripe
// signature (generateTestHeaderString) so the branch runs as in production.
import { describe, it, expect, vi, beforeEach } from "vitest";
import Stripe from "stripe";

const SECRET = "whsec_test_revenue";
const stripe = new Stripe("sk_test_dummy");

const dbExecute = vi.fn();
const dbQuery = vi.fn();
const dbQueryStrict = vi.fn();
const activateStripePlan = vi.fn();
const subStatus = { value: "active" };

vi.mock("@/lib/db", () => ({
  dbExecute: (...a: unknown[]) => dbExecute(...a),
  dbQuery: (...a: unknown[]) => dbQuery(...a),
  dbQueryStrict: (...a: unknown[]) => dbQueryStrict(...a),
}));
vi.mock("@/lib/plan-grant", () => ({ activateStripePlan: (...a: unknown[]) => activateStripePlan(...a) }));
vi.mock("@/lib/notify", () => ({ sendTransactional: vi.fn() }));
vi.mock("@/lib/stripe", async (orig) => {
  const actual = await orig<typeof import("@/lib/stripe")>();
  return { ...actual, getStripe: () => stripe };
});

import { POST } from "./route";

function invoicePaid(id: string, line: { start: number; end: number }) {
  return {
    id,
    object: "event",
    type: "invoice.paid",
    data: {
      object: {
        id: "in_1",
        object: "invoice",
        amount_paid: 2999,
        currency: "usd",
        customer: "cus_1",
        parent: { subscription_details: { subscription: "sub_1" } },
        lines: { data: [{ period: line, pricing: { price_details: { price: "price_premium" } } }] },
      },
    },
  };
}

function signed(body: object) {
  const payload = JSON.stringify(body);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  return new Request("http://x/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": header },
    body: payload,
  });
}

const amountUpdate = () =>
  dbExecute.mock.calls.find((c) => String(c[0]).includes("SET amount = $2"));

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  process.env.STRIPE_PRICE_BASE = "price_base";
  process.env.STRIPE_PRICE_PREMIUM = "price_premium";
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  dbExecute.mockReset().mockResolvedValue([]);
  dbQuery.mockReset().mockResolvedValue([]);
  dbQueryStrict.mockReset().mockResolvedValue([]); // not seen before
  activateStripePlan.mockReset().mockResolvedValue({ plan: "premium" });
  subStatus.value = "active";
  vi.spyOn(stripe.subscriptions, "retrieve").mockImplementation(
    (async () => ({ status: subStatus.value, metadata: { identifier: "u-123" } })) as never
  );
});

describe("stripe webhook invoice.paid — amount recording", () => {
  it("stores amount/currency/identifier/plan/period and still grants", async () => {
    const res = await POST(signed(invoicePaid("evt_a", { start: 1_700_000_000, end: 1_700_000_000 + 30 * 86400 })));
    expect(res.status).toBe(200);
    expect(amountUpdate()?.[1]).toEqual(["evt_a", 29.99, "usd", "u-123", "premium", "monthly"]);
    expect(activateStripePlan).toHaveBeenCalledOnce();
  });

  it("annual span is recorded as annual", async () => {
    await POST(signed(invoicePaid("evt_b", { start: 1_700_000_000, end: 1_700_000_000 + 365 * 86400 })));
    expect(amountUpdate()?.[1][5]).toBe("annual");
  });

  it("a failing UPDATE (columns missing) never blocks the grant nor rolls back idempotency", async () => {
    dbExecute.mockImplementation(async (sql: string) => {
      if (sql.includes("SET amount = $2")) throw new Error('column "amount" does not exist');
      return [];
    });
    const res = await POST(signed(invoicePaid("evt_c", { start: 1, end: 1 + 30 * 86400 })));
    expect(res.status).toBe(200);
    expect(activateStripePlan).toHaveBeenCalledOnce();
    expect(dbExecute.mock.calls.some((c) => String(c[0]).includes("DELETE FROM stripe_events"))).toBe(false);
  });

  it("records the cash even when the subscription is not active (no grant)", async () => {
    subStatus.value = "canceled";
    const res = await POST(signed(invoicePaid("evt_d", { start: 1, end: 1 + 30 * 86400 })));
    expect(res.status).toBe(200);
    expect(amountUpdate()).toBeDefined();
    expect(activateStripePlan).not.toHaveBeenCalled();
  });
});

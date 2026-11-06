// #RETIRE-BASE-1031 — Base non si vende più su NESSUN rail di acquisto, ma chi è
// già su Base resta gestito. Questo file copre i rail senza una suite propria
// (PayGate, PayPal, Stripe, checkout manuale /api/auth); crypto diretto e Shopify
// hanno i casi equivalenti nei loro route.test.ts.
import { describe, it, expect, vi, beforeEach } from "vitest";

const getSessionPlan = vi.fn();
const dbQuery = vi.fn();
const dbQueryStrict = vi.fn();
const dbExecute = vi.fn();
const createReceivingWallet = vi.fn();
const createOrder = vi.fn();
const sessionsCreate = vi.fn();

vi.mock("@/lib/auth", () => ({ getSessionPlan }));
vi.mock("@/lib/db", () => ({ dbQuery, dbQueryStrict, dbExecute }));
vi.mock("@/lib/creator-promo", () => ({ promoEligibility: vi.fn(async () => ({ firstPaidOrder: false })) }));
vi.mock("@/lib/paygate", async (orig) => ({
  ...(await orig<typeof import("@/lib/paygate")>()),
  createReceivingWallet,
  buildPayUrl: () => "https://pay.example/checkout",
}));
vi.mock("@/lib/paypal", () => ({ createOrder }));
vi.mock("@/lib/stripe", () => ({
  isStripeConfigured: () => true,
  getStripe: () => ({ checkout: { sessions: { create: sessionsCreate } } }),
  planToPriceId: (p: string) => `price_${p}`,
}));

function req(path: string, body: unknown) {
  return new Request(`https://www.betredge.com${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const session = (plan: string) => ({ identifier: "u@t.com", plan, name: null, plan_expires_at: null });
const orderInserts = (table: string) =>
  dbExecute.mock.calls.filter((c) => String(c[0]).includes(`INSERT INTO ${table}`));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_PAYGATE_ENABLED = "true";
  process.env.PAYGATE_PAYOUT_WALLET = "0x72e348d948e984c7d57d8ccb93fdd52710e47fa2";
  process.env.PAYPAL_CLIENT_ID = "id";
  process.env.PAYPAL_CLIENT_SECRET = "secret";
  delete process.env.PAYGATE_TEST_ENABLED;
  delete process.env.LAUNCH_PROMO_ENABLED;
  getSessionPlan.mockResolvedValue(session("free"));
  dbQuery.mockResolvedValue([]);
  dbQueryStrict.mockResolvedValue([]);
  dbExecute.mockResolvedValue([]);
  createReceivingWallet.mockResolvedValue({ addressIn: "0xin", ipnToken: "ipn" });
  createOrder.mockResolvedValue({ id: "PP-1" });
  sessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.test/s" });
});

describe("PayGate /api/paygate/checkout", () => {
  it("free che chiede base: 409 plan_retired, nessun ordine né wallet", async () => {
    const { POST } = await import("./paygate/checkout/route");
    const res = await POST(req("/api/paygate/checkout", { requested_plan: "base", period: "monthly" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "plan_retired" });
    expect(orderInserts("paygate_orders")).toHaveLength(0);
    expect(createReceivingWallet).not.toHaveBeenCalled();
  });

  it("premium da free: invariato, ordine creato a 29.99", async () => {
    const { POST } = await import("./paygate/checkout/route");
    const res = await POST(req("/api/paygate/checkout", { requested_plan: "premium", period: "monthly" }));
    expect(res.status).toBe(200);
    expect(orderInserts("paygate_orders")[0][1]).toEqual(
      expect.arrayContaining(["u@t.com", "premium", "monthly", 29.99]),
    );
  });

  it("rinnovo: chi è già su Base attivo ricompra base (PayGate non si rinnova da solo)", async () => {
    getSessionPlan.mockResolvedValue(session("base"));
    const { POST } = await import("./paygate/checkout/route");
    const res = await POST(req("/api/paygate/checkout", { requested_plan: "base", period: "monthly" }));
    expect(res.status).toBe(200);
    expect(orderInserts("paygate_orders")[0][1]).toEqual(
      expect.arrayContaining(["u@t.com", "base", "monthly", 14.99]),
    );
  });
});

describe("PayPal /api/paypal/create-order", () => {
  it("free che chiede base: 409 plan_retired, nessun ordine PayPal", async () => {
    const { POST } = await import("./paypal/create-order/route");
    const res = await POST(req("/api/paypal/create-order", { requested_plan: "base", period: "annual" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "plan_retired" });
    expect(createOrder).not.toHaveBeenCalled();
    expect(orderInserts("paypal_orders")).toHaveLength(0);
  });

  it("rinnovo Base di un abbonato Base: passa", async () => {
    getSessionPlan.mockResolvedValue(session("base"));
    const { POST } = await import("./paypal/create-order/route");
    const res = await POST(req("/api/paypal/create-order", { requested_plan: "base", period: "monthly" }));
    expect(res.status).toBe(200);
    expect(createOrder).toHaveBeenCalledWith(expect.objectContaining({ plan: "base", amount: 14.99 }));
  });
});

describe("Stripe /api/stripe/checkout", () => {
  it("free che chiede base: 409 plan_retired, nessuna sessione né pending_payment", async () => {
    const { POST } = await import("./stripe/checkout/route");
    const res = await POST(req("/api/stripe/checkout", { requested_plan: "base" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "plan_retired" });
    expect(sessionsCreate).not.toHaveBeenCalled();
    expect(dbQuery).not.toHaveBeenCalled();
  });

  it("premium: invariato", async () => {
    const { POST } = await import("./stripe/checkout/route");
    const res = await POST(req("/api/stripe/checkout", { requested_plan: "premium" }));
    expect(res.status).toBe(200);
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ line_items: [{ price: "price_premium", quantity: 1 }] }),
    );
  });
});

describe("checkout manuale /api/auth (action=checkout)", () => {
  it("free che chiede base: 409 plan_retired, profilo non toccato", async () => {
    const { POST } = await import("./auth/route");
    const res = await POST(req("/api/auth", { action: "checkout", requested_plan: "base" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "plan_retired" });
    expect(dbExecute.mock.calls.some((c) => String(c[0]).includes("pending_payment"))).toBe(false);
  });
});

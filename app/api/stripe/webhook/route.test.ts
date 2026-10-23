// #AFFILIATE-STRIPE-REFUND-1023 — rimborsi e contestazioni Stripe stornano la
// commissione affiliata dell'invoice (ref = invoice.id, come in invoice.paid).
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbQuery = vi.fn();
const dbQueryStrict = vi.fn();
const dbExecute = vi.fn();
vi.mock("@/lib/db", () => ({ dbQuery, dbQueryStrict, dbExecute }));
vi.mock("@/lib/plan-grant", () => ({ activateStripePlan: vi.fn() }));
vi.mock("@/lib/email", () => ({ receiptEmail: vi.fn(), cancellationEmail: vi.fn() }));
vi.mock("@/lib/notify", () => ({ sendTransactional: vi.fn() }));
vi.mock("@/lib/business-events", () => ({ schedulePurchaseEvent: vi.fn() }));
vi.mock("@/lib/affiliate/ledger", () => ({ scheduleAffiliateCommission: vi.fn() }));
const scheduleAffiliateReversal = vi.fn();
vi.mock("@/lib/affiliate/reversal", () => ({ scheduleAffiliateReversal }));

const evt: { current: unknown } = { current: null };
const invoicePaymentsList = vi.fn();
const refundsList = vi.fn();
vi.mock("@/lib/stripe", () => ({
  isStripeConfigured: () => true,
  getStripe: () => ({
    webhooks: { constructEvent: () => evt.current },
    invoicePayments: { list: invoicePaymentsList },
    refunds: { list: refundsList },
  }),
  resolvePlanFromPriceId: () => "base",
  periodEndToIso: () => null,
}));

const post = async () => {
  const { POST } = await import("./route");
  return POST(new Request("https://x/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": "s" }, body: "{}" }));
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec";
  dbQueryStrict.mockResolvedValue([]); // evento mai visto
  dbExecute.mockResolvedValue([]);
  invoicePaymentsList.mockResolvedValue({ data: [{ invoice: "in_9" }] });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("Stripe → storno affiliato", () => {
  it("charge.refunded: uno storno per ogni rimborso riuscito in USD, event_ref = id del rimborso", async () => {
    evt.current = { id: "evt_r", type: "charge.refunded", data: { object: { id: "ch_1", payment_intent: "pi_1" } } };
    refundsList.mockResolvedValue({
      data: [
        { id: "re_1", status: "succeeded", currency: "usd", amount: 500 },
        { id: "re_2", status: "pending", currency: "usd", amount: 300 },
        { id: "re_3", status: "succeeded", currency: "usd", amount: 1 },
      ],
    });
    const res = await post();
    expect(res.status).toBe(200);
    expect(invoicePaymentsList).toHaveBeenCalledWith({ payment: { type: "payment_intent", payment_intent: "pi_1" }, limit: 1 });
    expect(refundsList).toHaveBeenCalledWith({ charge: "ch_1", limit: 100 });
    expect(scheduleAffiliateReversal.mock.calls.map((c) => c[0])).toEqual([
      { rail: "stripe", paymentRef: "in_9", eventRef: "refund:re_1", refundedGrossUsd: 5 },
      { rail: "stripe", paymentRef: "in_9", eventRef: "refund:re_3", refundedGrossUsd: 0.01 },
    ]);
  });

  it("charge.refund.updated → succeeded: stesso event_ref del rimborso", async () => {
    evt.current = { id: "evt_u", type: "charge.refund.updated", data: { object: { id: "re_2", status: "succeeded", currency: "usd", amount: 300, payment_intent: "pi_1" } } };
    await post();
    expect(scheduleAffiliateReversal).toHaveBeenCalledWith({ rail: "stripe", paymentRef: "in_9", eventRef: "refund:re_2", refundedGrossUsd: 3 });
  });

  it("charge.refund.updated ancora pending o non USD: nessuno storno", async () => {
    evt.current = { id: "evt_p", type: "charge.refund.updated", data: { object: { id: "re_2", status: "pending", currency: "usd", amount: 300, payment_intent: "pi_1" } } };
    await post();
    evt.current = { id: "evt_e", type: "charge.refund.updated", data: { object: { id: "re_4", status: "succeeded", currency: "eur", amount: 300, payment_intent: "pi_1" } } };
    await post();
    expect(scheduleAffiliateReversal).not.toHaveBeenCalled();
  });

  it("charge.dispute.created: storno totale", async () => {
    evt.current = { id: "evt_d", type: "charge.dispute.created", data: { object: { id: "dp_1", charge: "ch_1", payment_intent: "pi_1" } } };
    const res = await post();
    expect(res.status).toBe(200);
    expect(scheduleAffiliateReversal).toHaveBeenCalledWith({ rail: "stripe", paymentRef: "in_9", eventRef: "dispute:dp_1", refundedGrossUsd: null });
  });

  it("pagamento senza invoice: nessuno storno, ack 200", async () => {
    invoicePaymentsList.mockResolvedValue({ data: [] });
    evt.current = { id: "evt_n", type: "charge.dispute.created", data: { object: { id: "dp_2", charge: "ch_2", payment_intent: "pi_2" } } };
    const res = await post();
    expect(res.status).toBe(200);
    expect(scheduleAffiliateReversal).not.toHaveBeenCalled();
  });

  it("evento già processato: nessuno storno", async () => {
    dbQueryStrict.mockResolvedValue([{ event_id: "evt_d" }]);
    evt.current = { id: "evt_d", type: "charge.dispute.created", data: { object: { id: "dp_1", charge: "ch_1", payment_intent: "pi_1" } } };
    await post();
    expect(scheduleAffiliateReversal).not.toHaveBeenCalled();
  });

  it("Stripe API giù: 500 e marcatura dell'evento tolta (Stripe ritenta)", async () => {
    invoicePaymentsList.mockRejectedValue(new Error("stripe down"));
    evt.current = { id: "evt_x", type: "charge.refunded", data: { object: { id: "ch_1", payment_intent: "pi_1" } } };
    const res = await post();
    expect(res.status).toBe(500);
    expect(dbExecute).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM stripe_events"), ["evt_x"]);
    expect(scheduleAffiliateReversal).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, beforeAll } from "vitest";
import {
  buildRevenueRows,
  summarizeRevenue,
  computeRevenue,
  shopifyOrderNumericId,
  periodFromSpan,
  type RawSources,
} from "./revenue";

const NOW = new Date("2026-10-06T12:00:00Z");

function raw(over: Partial<RawSources> = {}): RawSources {
  return { paygate: [], paypal: [], shopify: [], weekly: [], stripe: [], profiles: [], ...over };
}
const pg = (o: Partial<RawSources["paygate"][number]>): RawSources["paygate"][number] => ({
  id: "pg1", identifier: "a@x.com", period: "monthly", amount_usd: "14.99", status: "paid",
  paid_at: "2026-09-10T10:00:00.000Z", created_at: "2026-09-10T09:00:00.000Z", shopify_order_id: null, ...o,
});
const sh = (o: Partial<RawSources["shopify"][number]>): RawSources["shopify"][number] => ({
  event_id: "111", identifier: "b@x.com", variant_id: "V_BASE", amount: "14.99", status: "granted",
  processed_at: "2026-09-12T10:00:00.000Z", ...o,
});
const prof = (o: Partial<RawSources["profiles"][number]>): RawSources["profiles"][number] => ({
  identifier: "a@x.com", plan: "base", plan_source: "paygate", plan_expires_at: "2026-11-01T00:00:00.000Z", ...o,
});

beforeAll(() => {
  process.env.SHOPIFY_VARIANT_BASE = "V_BASE";
  process.env.SHOPIFY_VARIANT_PREMIUM = "V_PREM";
  process.env.SHOPIFY_VARIANT_BASE_ANNUAL = "V_BASE_Y";
  process.env.SHOPIFY_VARIANT_PREMIUM_ANNUAL = "V_PREM_Y";
  process.env.SHOPIFY_VARIANT_BASE_ONEOFF = "V_BASE_1";
  process.env.SHOPIFY_VARIANT_PREMIUM_ONEOFF = "V_PREM_1";
  process.env.SHOPIFY_VARIANT_WEEKLY = "V_WEEKLY";
});

describe("helpers", () => {
  it("normalises Shopify gid and numeric ids to the same key", () => {
    expect(shopifyOrderNumericId("gid://shopify/Order/7964071526737")).toBe("7964071526737");
    expect(shopifyOrderNumericId("7964071526737")).toBe("7964071526737");
    expect(shopifyOrderNumericId(null)).toBeNull();
  });
  it("derives the Stripe period from the billed span", () => {
    expect(periodFromSpan(0 + 1, 1 + 30 * 86400)).toBe("monthly");
    expect(periodFromSpan(1, 1 + 365 * 86400)).toBe("annual");
    expect(periodFromSpan(null, 10)).toBeNull();
  });
});

describe("double counting of crypto payments mirrored in Shopify", () => {
  it("excludes Shopify rows with status crypto-paygate: the cash is the PayGate row", () => {
    const b = buildRevenueRows(raw({
      paygate: [pg({ shopify_order_id: "222" })],
      shopify: [sh({ event_id: "222", status: "crypto-paygate" })],
    }));
    expect(b.rows.map((r) => r.rail)).toEqual(["paygate"]);
    expect(b.excluded.shopify_crypto_paygate.count).toBe(1);
  });
  it("excludes the mirror order created by the PayGate callback (gid match, any status)", () => {
    const b = buildRevenueRows(raw({
      paygate: [pg({ shopify_order_id: "gid://shopify/Order/333" })],
      shopify: [sh({ event_id: "333", variant_id: null, status: "unresolved", amount: "14.99" })],
    }));
    expect(b.rows).toHaveLength(1);
    expect(b.rows[0].rail).toBe("paygate");
    expect(b.excluded.shopify_mirror).toEqual({ count: 1, amount_usd: 14.99 });
  });
  it("also excludes Weekly Pick mirrors", () => {
    const b = buildRevenueRows(raw({
      weekly: [{ id: "w1", identifier: "a@x.com", amount_usd: "12.99", status: "paid", paid_at: "2026-09-01T00:00:00.000Z", created_at: "2026-09-01T00:00:00.000Z", shopify_order_id: "gid://shopify/Order/444" }],
      shopify: [sh({ event_id: "444", variant_id: null })],
    }));
    expect(b.rows.map((r) => [r.rail, r.kind])).toEqual([["weekly_pick", "weekly"]]);
    expect(b.excluded.shopify_mirror.count).toBe(1);
  });
  it("keeps a genuine card order with the same customer", () => {
    const b = buildRevenueRows(raw({ paygate: [pg({})], shopify: [sh({ identifier: "a@x.com" })] }));
    expect(b.rows).toHaveLength(2);
  });
});

describe("Shopify period from variant_id", () => {
  it("maps annual, monthly, one-off and weekly SKUs", () => {
    const b = buildRevenueRows(raw({
      shopify: [
        sh({ event_id: "1", variant_id: "V_PREM_Y", amount: "329.99" }),
        sh({ event_id: "2", variant_id: "V_BASE" }),
        sh({ event_id: "3", variant_id: "V_BASE_1" }),
        sh({ event_id: "4", variant_id: "V_WEEKLY", amount: "12.99" }),
        sh({ event_id: "5", variant_id: "UNKNOWN" }),
      ],
    }));
    const by = Object.fromEntries(b.rows.map((r) => [r.ref, [r.kind, r.period, r.recurring]]));
    expect(by["1"]).toEqual(["plan", "annual", true]);
    expect(by["2"]).toEqual(["plan", "monthly", true]);
    expect(by["3"]).toEqual(["plan", "monthly", false]);
    expect(by["4"]).toEqual(["weekly", null, false]);
    expect(by["5"]).toEqual(["plan", null, false]);
  });
  it("legacy rows without amount are excluded and counted, not summed as 0", () => {
    const b = buildRevenueRows(raw({ shopify: [sh({ amount: null })] }));
    expect(b.rows).toHaveLength(0);
    expect(b.excluded.amount_unknown.count).toBe(1);
  });
});

describe("refunds and comps", () => {
  it("excludes a refunded PayPal order from cash", () => {
    const b = buildRevenueRows(raw({
      paypal: [
        { id: "p1", identifier: "a@x.com", period: "monthly", amount_usd: "14.99", status: "refunded", paid_at: "2026-09-01T00:00:00.000Z", created_at: "2026-09-01T00:00:00.000Z" },
        { id: "p2", identifier: "a@x.com", period: "monthly", amount_usd: "14.99", status: "paid", paid_at: "2026-09-02T00:00:00.000Z", created_at: "2026-09-02T00:00:00.000Z" },
      ],
    }));
    expect(b.rows.map((r) => r.ref)).toEqual(["p2"]);
    expect(b.excluded.refunded).toEqual({ count: 1, amount_usd: 14.99 });
  });
  it("excludes zero-amount rows and payments by admin_full accounts", () => {
    const b = buildRevenueRows(raw({
      paygate: [pg({ id: "z", amount_usd: "0" }), pg({ id: "adm", identifier: "Boss@X.com" })],
      profiles: [prof({ identifier: "boss@x.com", plan: "admin_full", plan_source: null })],
    }));
    expect(b.rows).toHaveLength(0);
    expect(b.excluded.zero_amount.count).toBe(1);
    expect(b.excluded.admin_account.count).toBe(1);
  });
  it("manual/referral comps never enter MRR, even with an old payment", () => {
    const built = buildRevenueRows(raw({ paygate: [pg({})] }));
    const rep = summarizeRevenue(built, [prof({ plan_source: "manual" })], { now: NOW });
    expect(rep.mrr.total_usd).toBe(0);
    expect(rep.mrr.comps_active).toBe(1);
    expect(rep.cash.total_usd).toBe(14.99); // the cash itself was real
  });
});

describe("MRR, ARPU, annual share, window", () => {
  const built = () => buildRevenueRows(raw({
    paygate: [
      pg({ id: "old", paid_at: "2026-07-01T00:00:00.000Z", amount_usd: "5" }),
      pg({ id: "new", paid_at: "2026-09-10T00:00:00.000Z", amount_usd: "14.99" }),
    ],
    shopify: [sh({ event_id: "9", identifier: "B@x.com ", variant_id: "V_PREM_Y", amount: "329.99" })],
    stripe: [
      { event_id: "evt_1", identifier: "c@x.com", amount: "29.99", currency: "usd", period: "monthly", processed_at: "2026-09-20T00:00:00.000Z" },
      { event_id: "evt_2", identifier: "d@x.com", amount: "25", currency: "eur", period: "monthly", processed_at: "2026-09-21T00:00:00.000Z" },
    ],
  }));
  const profiles = [
    prof({ identifier: "a@x.com" }),
    prof({ identifier: "b@x.com", plan: "premium", plan_source: "shopify" }),
    prof({ identifier: "c@x.com", plan: "premium", plan_source: "stripe" }),
    prof({ identifier: "e@x.com", plan: "premium", plan_source: "paygate" }), // active, no payment
    prof({ identifier: "f@x.com", plan_expires_at: "2026-09-01T00:00:00.000Z" }), // expired
    prof({ identifier: "g@x.com", plan_expires_at: null }), // legacy: NULL expiry = active (effectivePlan)
  ];

  it("uses the LAST payment, annual/12, recurring split from non-recurring", () => {
    const rep = summarizeRevenue(built(), profiles, { now: NOW });
    expect(rep.mrr.non_recurring_usd).toBe(14.99); // paygate, last = 14.99 not 5
    expect(rep.mrr.recurring_usd).toBe(r2(329.99 / 12 + 29.99));
    expect(rep.mrr.active_paying).toBe(3);
    expect(rep.mrr.active_paid_without_payment).toBe(2); // e (no order) + g (legacy NULL expiry)
    expect(rep.arpu_usd).toBe(r2((14.99 + 329.99 / 12 + 29.99) / 3));
  });
  it("keeps non-USD Stripe visible and out of the USD sum", () => {
    const rep = summarizeRevenue(built(), profiles, { now: NOW });
    expect(rep.unconverted).toEqual([{ currency: "eur", amount: 25 }]);
    expect(rep.cash.total_usd).toBe(r2(5 + 14.99 + 329.99 + 29.99));
  });
  it("annual share by count and amount", () => {
    const rep = summarizeRevenue(built(), profiles, { now: NOW });
    expect(rep.annual_share.plan_payments_with_period).toBe(4);
    expect(rep.annual_share.by_count).toBe(0.25);
    expect(rep.annual_share.by_amount).toBe(Math.round((329.99 / (5 + 14.99 + 329.99 + 29.99)) * 10000) / 10000);
  });
  it("filters cash by inclusive day window and buckets by month", () => {
    const rep = summarizeRevenue(built(), profiles, { now: NOW, from: "2026-09-10", to: "2026-09-12" });
    expect(rep.cash.count).toBe(2);
    expect(rep.cash.total_usd).toBe(r2(14.99 + 329.99));
    expect(rep.cash.by_month).toEqual([{ month: "2026-09", count: 2, amount_usd: r2(14.99 + 329.99) }]);
  });
});

describe("computeRevenue I/O", () => {
  it("reports a failing source instead of throwing, and parses postgres ::text timestamps", async () => {
    const query = async <T,>(sql: string): Promise<T[]> => {
      if (sql.includes("stripe_events")) throw new Error('column "amount" does not exist');
      if (sql.includes("FROM paygate_orders"))
        return [{ id: "x", identifier: "a@x.com", period: "annual", amount_usd: "120", status: "paid", paid_at: "2026-09-30 23:30:00.5+00", created_at: "2026-09-30 23:00:00+00", shopify_order_id: null }] as T[];
      return [];
    };
    const rep = await computeRevenue(query, { now: NOW });
    expect(rep.source_errors).toHaveLength(1);
    expect(rep.source_errors[0]).toMatch(/^stripe:/);
    expect(rep.cash.by_month).toEqual([{ month: "2026-09", count: 1, amount_usd: 120 }]);
  });
});

function r2(n: number) {
  return Math.round(n * 100) / 100;
}

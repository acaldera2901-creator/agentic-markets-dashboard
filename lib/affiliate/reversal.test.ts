import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const dbQueryStrict = vi.fn();
const dbExecute = vi.fn();
vi.mock("@/lib/db", () => ({ dbQueryStrict, dbExecute, dbQuery: vi.fn() }));
const after = vi.fn();
vi.mock("next/server", () => ({ after }));
const opsAlert = vi.fn(async () => undefined);
vi.mock("@/lib/ops-alert", () => ({ opsAlert }));

const { planReversal, reverseAffiliateCommissionSafe, scheduleAffiliateReversal } = await import("./reversal");
type Original = Parameters<typeof planReversal>[0]["original"];

const PAID = "2026-10-01 12:00:00+00";
const orig = (over: Partial<NonNullable<Original>> = {}): NonNullable<Original> => ({
  id: 1,
  status: "pending",
  gross_usd: 14.99,
  net_usd: 14.99,
  rate: 0.2,
  amount_usd: 3,
  renewal_index: 0,
  affiliate_id: 7,
  referred_identifier: "u@t.com",
  paid_at: PAID,
  payable_after: "2026-11-30 12:00:00+00",
  ...over,
});
const NOW = new Date("2026-10-10T00:00:00Z");
const plan = (over: Partial<Parameters<typeof planReversal>[0]> = {}) =>
  planReversal({ original: orig(), alreadyReversedUsd: 0, refundedGrossUsd: null, now: NOW, clawbackDays: 120, ...over });

describe("planReversal (pura)", () => {
  it("nessuna commissione → nessuna azione", () => {
    expect(plan({ original: null })).toEqual({ action: "none", reason: "no_commission" });
  });

  it("totale dentro l'hold → reversal totale, nasce reversed", () => {
    expect(plan()).toMatchObject({ action: "reversal", amountUsd: -3, full: true, status: "reversed", grossUsd: -14.99, netUsd: -14.99 });
  });

  it("parziale dentro l'hold → reversal proporzionale, matura con l'originale", () => {
    const p = plan({ refundedGrossUsd: 7.495 });
    expect(p).toMatchObject({ action: "reversal", amountUsd: -1.5, full: false, status: "pending" });
    if (p.action !== "none") expect(p.payableAfterISO).toBe("2026-11-30T12:00:00.000Z");
  });

  it("shadow resta shadow su un parziale", () => {
    expect(plan({ original: orig({ status: "shadow" }), refundedGrossUsd: 5 })).toMatchObject({ status: "shadow", full: false });
  });

  it("mai oltre il residuo: dopo 2.5 già stornati un totale storna 0.5", () => {
    expect(plan({ alreadyReversedUsd: 2.5 })).toMatchObject({ amountUsd: -0.5, full: true });
    expect(plan({ alreadyReversedUsd: 3 })).toEqual({ action: "none", reason: "already_reversed" });
  });

  it("rimborso oltre il lordo = totale", () => {
    expect(plan({ refundedGrossUsd: 99 })).toMatchObject({ amountUsd: -3, full: true });
  });

  it("rimborso nullo o negativo → nessuna azione", () => {
    expect(plan({ refundedGrossUsd: 0 })).toEqual({ action: "none", reason: "zero_refund" });
    expect(plan({ refundedGrossUsd: -1 })).toEqual({ action: "none", reason: "zero_refund" });
  });

  it("dopo la maturazione, entro 120 gg → clawback payable", () => {
    for (const status of ["payable", "in_payout", "paid"]) {
      const p = plan({ original: orig({ status }), now: new Date("2026-12-30T00:00:00Z") });
      expect(p).toMatchObject({ action: "clawback", amountUsd: -3, status: "payable", full: true });
    }
  });

  it("a 121 giorni da paid_at → nessuna azione", () => {
    expect(plan({ original: orig({ status: "paid" }), now: new Date("2027-01-30T12:00:01Z") })).toEqual({
      action: "none",
      reason: "outside_clawback_window",
    });
  });

  it("originale già reversed/void → nessuna azione", () => {
    expect(plan({ original: orig({ status: "reversed" }) })).toEqual({ action: "none", reason: "original_reversed" });
    expect(plan({ original: orig({ status: "void" }) })).toEqual({ action: "none", reason: "original_void" });
  });
});

describe("reverseAffiliateCommissionSafe", () => {
  const saved = process.env.AFFILIATE_MODE;
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AFFILIATE_MODE = "shadow";
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.AFFILIATE_MODE;
    else process.env.AFFILIATE_MODE = saved;
  });

  const input = { rail: "shopify" as const, paymentRef: "o1", eventRef: "r1", refundedGrossUsd: null };

  it("off → no-op senza query, schedule non registra after()", async () => {
    process.env.AFFILIATE_MODE = "off";
    expect(await reverseAffiliateCommissionSafe(input)).toEqual({ written: false, reason: "mode_off" });
    scheduleAffiliateReversal(input);
    expect(after).not.toHaveBeenCalled();
    expect(dbQueryStrict).not.toHaveBeenCalled();
  });

  it("DB giù → non lancia, alert ops", async () => {
    dbQueryStrict.mockRejectedValue(new Error("db down"));
    expect(await reverseAffiliateCommissionSafe(input)).toEqual({ written: false, reason: "error" });
    expect(opsAlert).toHaveBeenCalledWith("affiliate-reversal", [expect.stringContaining("ref=o1")]);
  });

  it("stessa event_ref già scritta → duplicate, nessuna scrittura", async () => {
    dbQueryStrict.mockImplementation(async (sql: string) =>
      /kind IN \('first','renewal'\)/.test(sql) ? [orig()] : [{ amount_usd: -1, rail_event_ref: "r1" }]
    );
    expect(await reverseAffiliateCommissionSafe(input)).toEqual({ written: false, reason: "duplicate" });
    expect(dbExecute).not.toHaveBeenCalled();
  });
});

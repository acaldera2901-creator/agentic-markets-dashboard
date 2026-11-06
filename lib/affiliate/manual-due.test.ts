import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ dbQueryStrict: vi.fn() }));
const { bonusFor, computeManualDue, offerForPeriod } = await import("./manual-due");
import type { ManualDueInput } from "./manual-due";
import type { AffiliateOffer, BonusRule } from "./offers";

const offer = (over: Partial<AffiliateOffer> = {}): AffiliateOffer => ({
  id: 1, affiliateId: 7, validFrom: "2026-11-05T10:00:00Z", validTo: null,
  firstRateMonthly: 1, firstRateAnnual: 0.5, renewalRate: null, renewalTiers: null,
  fixedUsd: 200, fixedPeriod: "monthly", fixedMinDeliverables: { video: 2, story: 5 }, bonusRule: null,
  note: null, createdBy: "ops", createdAt: "2026-11-05T10:00:00Z", ...over,
});
const base = (over: Partial<ManualDueInput> = {}): ManualDueInput => ({
  affiliateId: 7, period: "2026-11", payoutChannel: "manual", offers: [offer()], confirmations: [],
  payersByMonth: {}, payableBalanceUsd: 0, accruedInPeriodUsd: 0, ...over,
});
const THRESHOLD: BonusRule = { type: "threshold", min_payers: 30, usd: 500, metric: "month3" };
const TIERS: BonusRule = { type: "tiers", tiers: [{ min_payers: 30, usd: 300 }, { min_payers: 50, usd: 500 }], metric: "avg_months_1_3" };

describe("fisso", () => {
  it("mensile: dovuto solo con i contenuti confermati (conferme sommate per slot)", () => {
    expect(computeManualDue(base()).fixed).toMatchObject({ total_usd: 0, slots: [{ slot: "2026-11", met: false }] });
    const due = computeManualDue(base({
      confirmations: [
        { slot: "2026-11", counts: { video: 1, story: 5 } },
        { slot: "2026-11", counts: { video: 1 } },
        { slot: "2026-10", counts: { video: 9, story: 9 } },
      ],
    }));
    expect(due.fixed).toMatchObject({ total_usd: 200, slots: [{ slot: "2026-11", met: true, confirmed: { video: 2, story: 5 } }] });
  });

  it("quindicinale: due slot, ognuno col suo minimo", () => {
    const o = offer({ fixedPeriod: "biweekly", fixedUsd: 100, fixedMinDeliverables: { video: 1 } });
    const due = computeManualDue(base({ offers: [o], confirmations: [{ slot: "2026-11-1", counts: { video: 1 } }] }));
    expect(due.fixed.slots.map((s) => [s.slot, s.usd])).toEqual([["2026-11-1", 100], ["2026-11-2", 0]]);
    expect(due.fixed.total_usd).toBe(100);
  });

  it("una tantum: solo nel primo mese con i contenuti confermati", () => {
    const o = offer({ fixedPeriod: "once", fixedMinDeliverables: { video: 1 } });
    const confirmations = [{ slot: "2026-12", counts: { video: 1 } }, { slot: "2027-01", counts: { video: 1 } }];
    const at = (period: string) => computeManualDue(base({ period, offers: [o], confirmations })).fixed.total_usd;
    expect([at("2026-11"), at("2026-12"), at("2027-01")]).toEqual([0, 200, 0]);
  });

  it("nessun fisso nell'offerta → 0, nessuno slot", () => {
    expect(computeManualDue(base({ offers: [offer({ fixedUsd: 0, fixedPeriod: null })] })).fixed).toMatchObject({ total_usd: 0, slots: [] });
  });
});

describe("bonus", () => {
  it("bonusFor: soglia unica e scaglioni (il più alto raggiunto)", () => {
    expect([29, 30, 80].map((v) => bonusFor(THRESHOLD, v))).toEqual([0, 500, 500]);
    expect([29, 30, 49.9, 50].map((v) => bonusFor(TIERS, v))).toEqual([0, 300, 300, 500]);
  });

  it("soglia unica sul mese 3: valutata solo nel 3° mese dalla PRIMA offerta", () => {
    const offers = [offer({ bonusRule: THRESHOLD })];
    const payersByMonth = { "2026-11": 5, "2026-12": 20, "2027-01": 31 };
    const m2 = computeManualDue(base({ period: "2026-12", offers, payersByMonth })).bonus!;
    expect(m2).toMatchObject({ month_index: 2, evaluated: false, usd: 0 });
    const m3 = computeManualDue(base({ period: "2027-01", offers, payersByMonth })).bonus!;
    expect(m3).toMatchObject({ start_month: "2026-11", month_index: 3, value: 31, evaluated: true, reached: true, usd: 500 });
    expect(m3.payers).toEqual([{ month: "2026-11", payers: 5 }, { month: "2026-12", payers: 20 }, { month: "2027-01", payers: 31 }]);
  });

  it("scaglioni sulla media dei mesi 1–3; cambiare offerta non azzera il conteggio", () => {
    const offers = [
      offer({ id: 1, validTo: "2026-12-10T00:00:00Z", bonusRule: TIERS }),
      offer({ id: 2, validFrom: "2026-12-10T00:00:00Z", bonusRule: TIERS, fixedUsd: 300 }),
    ];
    const due = computeManualDue(base({ period: "2027-01", offers, payersByMonth: { "2026-11": 40, "2026-12": 50, "2027-01": 60 } }));
    expect(due.offer_id).toBe(2);
    expect(due.bonus).toMatchObject({ start_month: "2026-11", value: 50, usd: 500 });
    const low = computeManualDue(base({ period: "2027-01", offers, payersByMonth: { "2026-11": 30, "2026-12": 30, "2027-01": 31 } }));
    expect(low.bonus).toMatchObject({ value: 30.33, usd: 300 });
  });
});

describe("totale e commissioni", () => {
  it("manual: fisso + bonus + saldo payable; crypto: le % le paga la coda USDT", () => {
    const i = base({
      period: "2027-01",
      offers: [offer({ bonusRule: THRESHOLD })],
      confirmations: [{ slot: "2027-01", counts: { video: 2, story: 5 } }],
      payersByMonth: { "2027-01": 30 },
      payableBalanceUsd: 123.456,
      accruedInPeriodUsd: 40,
    });
    expect(computeManualDue(i)).toMatchObject({ total_usd: 823.46, commissions: { included: true, payable_balance_usd: 123.46 } });
    expect(computeManualDue({ ...i, payoutChannel: "crypto" })).toMatchObject({ total_usd: 700, commissions: { included: false } });
  });

  it("nessuna offerta nel mese → solo commissioni (se manual)", () => {
    const due = computeManualDue(base({ offers: [], payableBalanceUsd: 10 }));
    expect(due).toMatchObject({ offer_id: null, bonus: null, total_usd: 10, fixed: { total_usd: 0 } });
  });

  it("offerForPeriod: l'ultima per valid_from che tocca il mese", () => {
    const a = offer({ id: 1, validFrom: "2026-10-01T00:00:00Z", validTo: "2026-11-20T00:00:00Z" });
    const b = offer({ id: 2, validFrom: "2026-11-20T00:00:00Z" });
    expect(offerForPeriod([a, b], "2026-10")?.id).toBe(1);
    expect(offerForPeriod([a, b], "2026-11")?.id).toBe(2);
    expect(offerForPeriod([a, b], "2026-09")).toBeNull();
  });
});

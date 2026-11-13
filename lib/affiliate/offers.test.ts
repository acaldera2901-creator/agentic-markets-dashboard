import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ dbQueryStrict: vi.fn() }));
const { applyOffer, offerNeedsPeriod, parseOfferInput } = await import("./offers");
import type { AffiliateOffer } from "./offers";
import type { AffiliateConfig } from "./config";

const CFG: AffiliateConfig = {
  firstRate: 0.2,
  renewalRate: 0.07,
  renewalTiers: [{ min: 5, rate: 0.1 }, { min: 15, rate: 0.15 }],
  renewalMaxMonths: null,
  holdDays: 60,
  clawbackDays: 120,
  minPayoutUsd: 50,
  attributionWindowDays: 60,
  mode: "live",
};
const offer = (over: Partial<AffiliateOffer> = {}): AffiliateOffer => ({
  id: 1, affiliateId: 7, validFrom: "2026-11-01T00:00:00Z", validTo: null,
  firstRateMonthly: null, firstRateAnnual: null, renewalRate: null, renewalTiers: null,
  fixedUsd: 0, fixedPeriod: null, fixedMinDeliverables: {}, bonusRule: null,
  note: null, createdBy: "ops", createdAt: "2026-11-01T00:00:00Z", ...over,
});

describe("applyOffer", () => {
  it("nessuna offerta → la config env identica (stesso oggetto)", () => {
    expect(applyOffer(CFG, null, "monthly")).toBe(CFG);
  });

  it("campi NULL → valori env", () => {
    expect(applyOffer(CFG, offer(), "monthly")).toEqual(CFG);
  });

  it("100% mensile / 50% annuale; periodo ignoto → il minore", () => {
    const o = offer({ firstRateMonthly: 1, firstRateAnnual: 0.5 });
    expect(applyOffer(CFG, o, "monthly").firstRate).toBe(1);
    expect(applyOffer(CFG, o, "annual").firstRate).toBe(0.5);
    expect(applyOffer(CFG, o, null).firstRate).toBe(0.5);
    // solo uno dei due impostato: l'altro è l'env
    expect(applyOffer(CFG, offer({ firstRateMonthly: 1 }), "annual").firstRate).toBe(0.2);
  });

  it("renewal_rate proprio: la scala env vale solo sopra la nuova base; scala propria se data", () => {
    expect(applyOffer(CFG, offer({ renewalRate: 0.12 }), null)).toMatchObject({ renewalRate: 0.12, renewalTiers: [{ min: 15, rate: 0.15 }] });
    expect(applyOffer(CFG, offer({ renewalTiers: [{ min: 3, rate: 0.2 }] }), null).renewalTiers).toEqual([{ min: 3, rate: 0.2 }]);
  });

  it("offerNeedsPeriod: solo se mensile e annuale differiscono", () => {
    expect(offerNeedsPeriod(offer({ firstRateMonthly: 1, firstRateAnnual: 0.5 }))).toBe(true);
    expect(offerNeedsPeriod(offer({ firstRateMonthly: 0.3, firstRateAnnual: 0.3 }))).toBe(false);
    expect(offerNeedsPeriod(offer())).toBe(false);
  });
});

describe("parseOfferInput", () => {
  const ok = {
    first_rate_monthly: 1,
    first_rate_annual: 0.5,
    fixed_usd: 200,
    fixed_period: "monthly",
    fixed_min_deliverables: { video: 2, story: 5 },
    bonus_rule: { type: "threshold", min_payers: 30, usd: 500, metric: "avg_months_1_3" },
  };

  it("offerta completa valida, default riempiti", () => {
    const r = parseOfferInput(ok);
    expect(r).toEqual({
      offer: {
        valid_from: null, first_rate_monthly: 1, first_rate_annual: 0.5, renewal_rate: null, renewal_tiers: null,
        fixed_usd: 200, fixed_period: "monthly", fixed_min_deliverables: { video: 2, story: 5 },
        bonus_rule: { type: "threshold", min_payers: 30, usd: 500, metric: "avg_months_1_3" }, note: null,
      },
    });
  });

  it("bonus a scaglioni crescenti ok; non crescenti → rifiutato", () => {
    const tiers = { type: "tiers", metric: "month3", tiers: [{ min_payers: 30, usd: 300 }, { min_payers: 50, usd: 500 }] };
    expect("offer" in parseOfferInput({ ...ok, bonus_rule: tiers })).toBe(true);
    const bad = { ...tiers, tiers: [{ min_payers: 50, usd: 500 }, { min_payers: 30, usd: 300 }] };
    expect(parseOfferInput({ ...ok, bonus_rule: bad })).toEqual({ error: "invalid_bonus_rule" });
  });

  it("rifiuta i valori fuori regola", () => {
    expect(parseOfferInput({ first_rate_monthly: 1.5 })).toEqual({ error: "invalid_first_rate_monthly" });
    expect(parseOfferInput({ first_rate_annual: 0.12345 })).toEqual({ error: "invalid_first_rate_annual" });
    expect(parseOfferInput({ fixed_usd: 200 })).toEqual({ error: "fixed_period_required" });
    expect(parseOfferInput({ fixed_usd: 200, fixed_period: "weekly" })).toEqual({ error: "invalid_fixed_period" });
    expect(parseOfferInput({ fixed_min_deliverables: { Video: 2 } })).toEqual({ error: "invalid_fixed_min_deliverables" });
    expect(parseOfferInput({ bonus_rule: { type: "threshold", min_payers: 30, usd: 500, metric: "month4" } })).toEqual({ error: "invalid_bonus_rule" });
    expect(parseOfferInput({ valid_from: "domani" })).toEqual({ error: "invalid_valid_from" });
    expect(parseOfferInput(null)).toEqual({ error: "invalid_offer" });
  });
});

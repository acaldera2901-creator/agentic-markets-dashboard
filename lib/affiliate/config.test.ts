import { describe, it, expect } from "vitest";
import { affiliateConfig, affiliateMode, AFFILIATE_DEFAULTS } from "./config";

describe("affiliate config: i default approvati (#AFFILIATE-V2-0930)", () => {
  it("senza env: 20% / 7% / hold 60 / clawback 120 / soglia 50 / rinnovi illimitati / off", () => {
    const c = affiliateConfig({});
    expect(c).toEqual({
      firstRate: 0.2,
      renewalRate: 0.07,
      renewalMaxMonths: null,
      holdDays: 60,
      clawbackDays: 120,
      minPayoutUsd: 50,
      attributionWindowDays: 60,
      mode: "off",
    });
    expect(AFFILIATE_DEFAULTS.RENEWAL_MAX_MONTHS).toBeNull();
  });

  it("le env valide sovrascrivono i default", () => {
    const c = affiliateConfig({
      AFFILIATE_FIRST_RATE: "0.25",
      AFFILIATE_RENEWAL_RATE: "0.05",
      AFFILIATE_RENEWAL_MAX_MONTHS: "12",
      AFFILIATE_HOLD_DAYS: "30",
      AFFILIATE_CLAWBACK_DAYS: "90",
      AFFILIATE_MIN_PAYOUT_USD: "100",
      AFFILIATE_MODE: "shadow",
    });
    expect(c.firstRate).toBe(0.25);
    expect(c.renewalRate).toBe(0.05);
    expect(c.renewalMaxMonths).toBe(12);
    expect(c.holdDays).toBe(30);
    expect(c.clawbackDays).toBe(90);
    expect(c.minPayoutUsd).toBe(100);
    expect(c.mode).toBe("shadow");
  });

  it("env malformate ricadono sul default, mai su un valore inventato", () => {
    const c = affiliateConfig({
      AFFILIATE_FIRST_RATE: "20", // percento invece di frazione: fuori [0,1]
      AFFILIATE_RENEWAL_RATE: "abc",
      AFFILIATE_RENEWAL_MAX_MONTHS: "-3",
      AFFILIATE_HOLD_DAYS: "1.5",
      AFFILIATE_MIN_PAYOUT_USD: "-1",
    });
    expect(c.firstRate).toBe(0.2);
    expect(c.renewalRate).toBe(0.07);
    expect(c.renewalMaxMonths).toBeNull();
    expect(c.holdDays).toBe(60);
    expect(c.minPayoutUsd).toBe(50);
  });

  it("RENEWAL_MAX_MONTHS vuoto o 'null' = illimitato", () => {
    expect(affiliateConfig({ AFFILIATE_RENEWAL_MAX_MONTHS: "" }).renewalMaxMonths).toBeNull();
    expect(affiliateConfig({ AFFILIATE_RENEWAL_MAX_MONTHS: "null" }).renewalMaxMonths).toBeNull();
  });

  it("AFFILIATE_MODE: solo shadow|live accendono, qualunque altro valore è off", () => {
    expect(affiliateMode({})).toBe("off");
    expect(affiliateMode({ AFFILIATE_MODE: "live" })).toBe("live");
    expect(affiliateMode({ AFFILIATE_MODE: " Shadow " })).toBe("shadow");
    expect(affiliateMode({ AFFILIATE_MODE: "on" })).toBe("off");
    expect(affiliateMode({ AFFILIATE_MODE: "true" })).toBe("off");
    expect(affiliateMode({ AFFILIATE_MODE: "" })).toBe("off");
  });
});

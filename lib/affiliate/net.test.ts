import { describe, it, expect } from "vitest";
import {
  isNonUsdMarked,
  shopifyOrderIsNonUsd,
  shopifyPaidAt,
  withNonUsdMark,
  netAmount,
  commissionAmount,
  round2,
  shopifyOrderAmounts,
  stripeInvoiceAmounts,
  withNotSinglePlanMark,
  isNotSinglePlanMarked,
} from "./net";

describe("marcatore Shopify non-monopiano", () => {
  it("si aggiunge solo quando serve e si riconosce", () => {
    expect(withNotSinglePlanMark("grant null", false)).toBe("grant null");
    const marked = withNotSinglePlanMark("grant null", true);
    expect(isNotSinglePlanMarked(marked)).toBe(true);
    expect(isNotSinglePlanMarked("grant null")).toBe(false);
    expect(isNotSinglePlanMarked(null)).toBe(false);
  });
});

describe("importi dai payload dei rail (#AFFILIATE-V2-0930 PR-2)", () => {
  it("Shopify: lordo = total_price, tasse = total_tax", () => {
    expect(shopifyOrderAmounts({ total_tax: "3.30", currency: "USD" }, 18.29)).toEqual({ grossUsd: 18.29, taxUsd: 3.3 });
  });

  it("Shopify: senza total_tax le tasse sono ignote (null)", () => {
    expect(shopifyOrderAmounts({}, 14.99)).toEqual({ grossUsd: 14.99, taxUsd: null });
  });

  it("Shopify: valuta non USD → lordo null (niente conversioni inventate)", () => {
    expect(shopifyOrderAmounts({ currency: "EUR", total_tax: "0" }, 14.99)).toEqual({ grossUsd: null, taxUsd: null });
  });

  it("Stripe: centesimi → dollari, tasse sommate da total_taxes", () => {
    expect(stripeInvoiceAmounts({ amount_paid: 1829, currency: "usd", total_taxes: [{ amount: 200 }, { amount: 130 }] })).toEqual({
      grossUsd: 18.29,
      taxUsd: 3.3,
    });
  });

  it("Stripe: valuta non USD o amount_paid assente → lordo null", () => {
    expect(stripeInvoiceAmounts({ amount_paid: 1499, currency: "eur" }).grossUsd).toBeNull();
    expect(stripeInvoiceAmounts({ amount_paid: null, currency: "usd" }).grossUsd).toBeNull();
  });
});

describe("netAmount (#AFFILIATE-V2-0930)", () => {
  it("senza tasse/rimborsi/fee il netto è il lordo", () => {
    expect(netAmount("paypal", 14.99)).toBe(14.99);
  });

  it("#AFFILIATE-TERMS-V3-1022 base lorda: le imposte NON si deducono", () => {
    expect(netAmount("shopify", 18.29, { taxUsd: 3.3 })).toBe(18.29);
  });

  it("rimborso parziale sottratto", () => {
    expect(netAmount("stripe", 29.99, { refundedUsd: 10 })).toBe(19.99);
  });

  it("#AFFILIATE-TERMS-V3-1022 base lorda: la fee del processore NON si deduce", () => {
    expect(netAmount("paypal", 14.99, { feeUsd: 0.99 })).toBe(14.99);
  });

  it("tutte le componenti insieme: si sottrae solo il già rimborsato", () => {
    expect(netAmount("stripe", 24.4, { taxUsd: 4.4, refundedUsd: 5, feeUsd: 1 })).toBe(19.4);
  });

  it("amount NULL → null: mai commissione su un importo inventato", () => {
    expect(netAmount("shopify", null)).toBeNull();
    expect(netAmount("shopify", undefined)).toBeNull();
  });

  it("lordo o componenti non validi → null", () => {
    expect(netAmount("paypal", NaN)).toBeNull();
    expect(netAmount("paypal", -1)).toBeNull();
    expect(netAmount("paypal", 10, { taxUsd: -1 })).toBeNull();
    expect(netAmount("paypal", 10, { feeUsd: Number.POSITIVE_INFINITY })).toBeNull();
  });

  it("rail admin (USDT manuale) → null: nessuna commissione", () => {
    expect(netAmount("admin", 14.99)).toBeNull();
  });

  it("rimborso totale o oltre → 0, mai negativo", () => {
    expect(netAmount("paypal", 14.99, { refundedUsd: 14.99 })).toBe(0);
    expect(netAmount("paypal", 14.99, { refundedUsd: 20 })).toBe(0);
  });

  it("arrotondamento a 2 decimali", () => {
    expect(netAmount("paygate", 10.005)).toBe(10.01);
    expect(netAmount("paygate", 0.1 + 0.2)).toBe(0.3);
  });
});

describe("commissionAmount / round2", () => {
  it("20% di 14.99 = 3.00, 7% di 14.99 = 1.05", () => {
    expect(commissionAmount(14.99, 0.2)).toBe(3);
    expect(commissionAmount(14.99, 0.07)).toBe(1.05);
  });

  it("round2 non cade nel tranello di 1.005", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
  });
});

// #SHOPIFY-RECONCILE-USD-1022
describe("Shopify: valuta e data dell'incasso", () => {
  const now = new Date("2026-10-22T12:00:00Z");
  it("processed_at valido e passato vince; assente, illeggibile o futuro → now", () => {
    expect(shopifyPaidAt({ processed_at: "2026-10-21T09:00:00-04:00" }, now).toISOString()).toBe("2026-10-21T13:00:00.000Z");
    expect(shopifyPaidAt({}, now)).toBe(now);
    expect(shopifyPaidAt({ processed_at: "ieri" }, now)).toBe(now);
    expect(shopifyPaidAt({ processed_at: "2026-10-23T00:00:00Z" }, now)).toBe(now);
  });
  it("non USD solo con valuta dichiarata diversa da USD; marcatore reversibile in lettura", () => {
    expect(shopifyOrderIsNonUsd({ currency: "eur" })).toBe(true);
    expect(shopifyOrderIsNonUsd({ currency: "USD" })).toBe(false);
    expect(shopifyOrderIsNonUsd({})).toBe(false);
    expect(isNonUsdMarked(withNonUsdMark("x", true))).toBe(true);
    expect(withNonUsdMark("x", false)).toBe("x");
  });
});

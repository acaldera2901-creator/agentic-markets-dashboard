import { describe, it, expect, afterEach } from "vitest";
import {
  currentWeekStart,
  buildHouseMultipla,
  weeklyPickIncludedInPlan,
  weeklyPickAmount,
  WEEKLY_PICK_MAX_LEGS,
  WEEKLY_PICK_PRICE_USD,
  type WeeklyPickLeg,
} from "./weekly-pick";
import { evaluateCallback } from "./paygate";

describe("currentWeekStart", () => {
  it("returns the Monday (UTC) for a mid-week date", () => {
    // 2026-07-08 è mercoledì → lunedì della settimana = 2026-07-06
    expect(currentWeekStart(new Date("2026-07-08T15:00:00Z"))).toBe("2026-07-06");
  });
  it("returns the same day when it is already Monday", () => {
    expect(currentWeekStart(new Date("2026-07-06T00:00:00Z"))).toBe("2026-07-06");
  });
  it("maps Sunday to the Monday that started its week", () => {
    // 2026-07-12 è domenica → lunedì = 2026-07-06
    expect(currentWeekStart(new Date("2026-07-12T23:59:00Z"))).toBe("2026-07-06");
  });
});

describe("buildHouseMultipla", () => {
  const legs: WeeklyPickLeg[] = [
    { id: "a", label: "A vs B", market: "A", sport: "football", prob: 0.7 },
    { id: "b", label: "C vs D", market: "C", sport: "tennis", prob: 0.6 },
    { id: "c", label: "E vs F", market: "E", sport: "football", prob: 0.55 },
  ];

  it("picks the highest-prob legs and multiplies the probabilities", () => {
    const r = buildHouseMultipla(legs, 2)!;
    expect(r.selections.map((s) => s.id)).toEqual(["a", "b"]);
    expect(r.combinedProb).toBeCloseTo(0.42, 5); // 0.7 * 0.6
  });

  it("caps at maxLegs but takes all when fewer are available", () => {
    expect(buildHouseMultipla(legs, WEEKLY_PICK_MAX_LEGS)!.selections.length).toBe(3);
    expect(buildHouseMultipla(legs, 2)!.selections.length).toBe(2);
  });

  it("returns null with fewer than 2 valid legs", () => {
    expect(buildHouseMultipla([legs[0]])).toBeNull();
    expect(
      buildHouseMultipla([
        { ...legs[0], prob: 0 },
        { ...legs[1], prob: 1.4 },
      ])
    ).toBeNull();
  });

  it("is deterministic on ties (stable by id)", () => {
    const tied: WeeklyPickLeg[] = [
      { id: "z", label: "Z", market: "Z", sport: "s", prob: 0.5 },
      { id: "a", label: "A", market: "A", sport: "s", prob: 0.5 },
    ];
    expect(buildHouseMultipla(tied, 1)!.selections.map((s) => s.id)).toEqual(["a", "z"]);
  });
});

describe("weeklyPickIncludedInPlan", () => {
  it("is included for Pro/admin, sold to the rest", () => {
    expect(weeklyPickIncludedInPlan("premium")).toBe(true);
    expect(weeklyPickIncludedInPlan("admin_full")).toBe(true);
    expect(weeklyPickIncludedInPlan("base")).toBe(false);
    expect(weeklyPickIncludedInPlan("free")).toBe(false);
  });
});

describe("weeklyPickAmount", () => {
  // launchPromoActive legge process.env (LAUNCH_PROMO_ENABLED + _DEADLINE).
  const saved = { ...process.env };
  afterEach(() => {
    process.env.LAUNCH_PROMO_ENABLED = saved.LAUNCH_PROMO_ENABLED;
    process.env.LAUNCH_PROMO_DEADLINE = saved.LAUNCH_PROMO_DEADLINE;
  });

  it("is the full price ($12.99) when the launch promo is off", () => {
    delete process.env.LAUNCH_PROMO_ENABLED;
    const r = weeklyPickAmount();
    expect(r.amount).toBe(WEEKLY_PICK_PRICE_USD);
    expect(r.amount).toBe(12.99);
    expect(r.discounted).toBe(false);
  });

  it("applies -50% via the SAME mechanism as plans when launch is active", () => {
    process.env.LAUNCH_PROMO_ENABLED = "true";
    process.env.LAUNCH_PROMO_DEADLINE = "2999-01-01T00:00:00Z";
    const r = weeklyPickAmount(new Date("2026-07-07T00:00:00Z"));
    // 12.99 * 0.5 = 6.495 → Math.round (come discountedAmountFor) → 6.50.
    // NB: la spec citava 6.49; il meccanismo esatto (round half-up) dà 6.50,
    // coerente coi piani (14.99→7.50). Delta 1 cent flaggato al gate.
    expect(r.discounted).toBe(true);
    expect(r.amount).toBe(6.5);
    expect(r.fullAmount).toBe(12.99);
  });

  it("stays full price when launch is enabled but the deadline has passed", () => {
    process.env.LAUNCH_PROMO_ENABLED = "true";
    process.env.LAUNCH_PROMO_DEADLINE = "2020-01-01T00:00:00Z";
    const r = weeklyPickAmount(new Date("2026-07-07T00:00:00Z"));
    expect(r.discounted).toBe(false);
    expect(r.amount).toBe(12.99);
  });
});

// Trust boundary: il grant della weekly pick NON deve avvenire senza pagamento
// confermato, né su un ordine già processato/replay. La decisione è la stessa
// funzione pura del rail piani (evaluateCallback), qui esercitata sugli importi
// della weekly pick ($12.99 pieno).
describe("weekly-pick grant gating (evaluateCallback)", () => {
  const AMOUNT = WEEKLY_PICK_PRICE_USD; // 12.99

  it("grants when the order is pending and the paid value clears the floor", () => {
    const d = evaluateCallback({ order: { status: "pending", amount_usd: AMOUNT }, valueCoin: 12.0 });
    expect(d.grant).toBe(true);
  });

  it("does NOT grant when the payment is unconfirmed (value_coin missing)", () => {
    const d = evaluateCallback({ order: { status: "pending", amount_usd: AMOUNT }, valueCoin: null });
    expect(d.grant).toBe(false);
    expect(d.reason).toBe("missing value_coin");
  });

  it("does NOT grant on a replayed/already-processed order (status != pending)", () => {
    const d = evaluateCallback({ order: { status: "paid", amount_usd: AMOUNT }, valueCoin: 12.0 });
    expect(d.grant).toBe(false);
    expect(d.reason).toBe("order not pending");
  });

  it("does NOT grant when the paid value is below the sanity floor", () => {
    const d = evaluateCallback({ order: { status: "pending", amount_usd: AMOUNT }, valueCoin: 1.0 });
    expect(d.grant).toBe(false);
    expect(d.reason).toBe("amount below threshold");
  });

  it("does NOT grant when the order is unknown (token not found)", () => {
    const d = evaluateCallback({ order: null, valueCoin: 12.0 });
    expect(d.grant).toBe(false);
    expect(d.reason).toBe("order not found");
  });
});

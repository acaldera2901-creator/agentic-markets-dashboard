import { describe, it, expect } from "vitest";
import {
  currentWeekStart,
  buildHouseMultipla,
  weeklyPickIncludedInPlan,
  WEEKLY_PICK_MAX_LEGS,
  type WeeklyPickLeg,
} from "./weekly-pick";

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

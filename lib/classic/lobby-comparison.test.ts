import { describe, it, expect } from "vitest";
import { classicTennisView } from "./card-view";
import { comparisonGap } from "./lobby-comparison";

const now = new Date("2026-10-16T10:00:00Z");
const base = { started: false, modelVersion: "elo_surface_v4_features_odds", probabilitySource: "model" as const, tournament: "ATP Shanghai", player1: "A", player2: "B", p: [0.7, 0.3] as [number, number], odds: [1.65, 2.25] as [number, number], leadIdx: 0 as const, eloAsOf: "2026-10-16T09:00:00Z", now, books: [] };
describe("lobby comparison eligibility", () => {
  it("admits a fresh tennis comparison without turning Elo into a value signal", () => {
    const view = classicTennisView(base);
    expect(comparisonGap(view)).toBeGreaterThan(0);
    expect(view.valueAllowed).toBe(false);
  });
  it("excludes stale Elo, market-only, missing prices and excessive raw divergence", () => {
    for (const override of [{ eloAsOf: "2026-10-15T09:00:00Z" }, { modelVersion: "partner-market-v1", probabilitySource: "market" as const }, { odds: null }, { p: [0.8, 0.2] as [number, number] }]) {
      expect(comparisonGap(classicTennisView({ ...base, ...override }))).toBeNull();
    }
  });
});

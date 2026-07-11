import { describe, it, expect } from "vitest";
import { buildModelVsMarket, buildMainGroups, type RichPrediction } from "./market-groups";

const row: RichPrediction = {
  match_id: "1", league: "SA", league_name: "Serie A", home_team: "Inter", away_team: "Verona",
  kickoff: "2026-07-11T18:45:00Z", p_home: 0.72, p_draw: 0.18, p_away: 0.10,
  odds_home: 1.55, odds_draw: 4.2, odds_away: 6.0, edge: 0.08, best_selection: "HOME",
  confidence_score: 78,
  enrichment: {
    extra_markets: [
      { key: "over_2_5", label: "Over 2.5", p: 0.61, model_odds: 1.64, market_odds: 1.72, edge: 0.05 },
      { key: "under_2_5", label: "Under 2.5", p: 0.39, model_odds: 2.56, market_odds: 2.10, edge: null },
    ],
    goals_summary: { expected_goals: 2.9 },
  },
};

describe("buildModelVsMarket", () => {
  it("modello vs implicita vs quota + edge mai negativo", () => {
    const mvm = buildModelVsMarket(row);
    expect(mvm.modelProb).toBeCloseTo(0.72, 5);
    expect(mvm.impliedProb).toBeCloseTo(1 / 1.55, 4);
    expect(mvm.bestOdds).toBe(1.55);
    expect(mvm.edgePct).toBeCloseTo(8, 5);
    expect(buildModelVsMarket({ ...row, edge: -0.03 }).edgePct).toBeNull();
  });
});

describe("buildMainGroups", () => {
  it("gruppo esiti con 3 chip e il pick raccomandato", () => {
    const g = buildMainGroups(row).find((x) => x.key === "esiti")!;
    expect(g.chips).toHaveLength(3);
    expect(g.chips.find((c) => c.recommended)!.selection).toContain("Inter");
  });
  it("gruppo gol da extra_markets (Over/Under)", () => {
    const g = buildMainGroups(row).find((x) => x.key === "gol")!;
    expect(g.chips.map((c) => c.selection)).toEqual(["Over 2.5", "Under 2.5"]);
    expect(g.chips[0].hasValue).toBe(true);
  });
  it("niente gruppo gol se non ci sono extra_markets over/under", () => {
    expect(buildMainGroups({ ...row, enrichment: {} }).find((x) => x.key === "gol")).toBeUndefined();
  });
});

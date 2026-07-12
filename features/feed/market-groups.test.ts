import { describe, it, expect } from "vitest";
import { buildModelVsMarket, buildMainGroups, buildPremiumGroups, buildAllGroups, type RichPrediction } from "./market-groups";

const row: RichPrediction = {
  match_id: "1", league: "SA", league_name: "Serie A", home_team: "Inter", away_team: "Verona",
  kickoff: "2026-07-11T18:45:00Z", p_home: 0.72, p_draw: 0.18, p_away: 0.10,
  odds_home: 1.55, odds_draw: 4.2, odds_away: 6.0, edge: 0.08, best_selection: "HOME",
  confidence_score: 78,
  enrichment: {
    extra_markets: [
      { key: "over_2_5", label: "O2.5", p: 0.61, model_odds: 1.64, market_odds: 1.72, edge: 0.05 },
      { key: "under_2_5", label: "U2.5", p: 0.39, model_odds: 2.56, market_odds: 2.10, edge: null },
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
  it("gruppo gol da extra_markets (Over/Under), label umanizzata dalla key non dall'abbreviazione", () => {
    const g = buildMainGroups(row).find((x) => x.key === "gol")!;
    expect(g.chips.map((c) => c.selection)).toEqual(["Over 2.5", "Under 2.5"]);
    expect(g.chips[0].hasValue).toBe(true);
  });
  it("multi-linea: sceglie la coppia 2.5 per key, non la prima riga trovata", () => {
    const multiLine: RichPrediction = {
      ...row,
      enrichment: {
        extra_markets: [
          { key: "over_1_5", label: "O1.5", p: 0.85, model_odds: 1.18, market_odds: 1.20, edge: 0.02 },
          { key: "over_2_5", label: "O2.5", p: 0.61, model_odds: 1.64, market_odds: 1.72, edge: 0.05 },
          { key: "under_1_5", label: "U1.5", p: 0.15, model_odds: 6.67, market_odds: 6.00, edge: null },
          { key: "under_2_5", label: "U2.5", p: 0.39, model_odds: 2.56, market_odds: 2.10, edge: null },
        ],
        goals_summary: { expected_goals: 2.9 },
      },
    };
    const g = buildMainGroups(multiLine).find((x) => x.key === "gol")!;
    expect(g.chips.map((c) => c.selection)).toEqual(["Over 2.5", "Under 2.5"]);
  });
  it("niente gruppo gol se non ci sono extra_markets over_2_5/under_2_5", () => {
    const noGolRow: RichPrediction = {
      ...row,
      enrichment: {
        extra_markets: [
          { key: "over_1_5", label: "O1.5", p: 0.85, model_odds: 1.18, market_odds: 1.20, edge: 0.02 },
          { key: "under_1_5", label: "U1.5", p: 0.15, model_odds: 6.67, market_odds: 6.00, edge: null },
        ],
      },
    };
    expect(buildMainGroups(noGolRow).find((x) => x.key === "gol")).toBeUndefined();
    expect(buildMainGroups({ ...row, enrichment: {} }).find((x) => x.key === "gol")).toBeUndefined();
  });
});

describe("buildPremiumGroups", () => {
  const gsRow = { ...row, enrichment: { ...row.enrichment,
    goalscorer_markets: [
      { playerId: "1", name: "Lautaro Martinez", side: "home", pScores: 0.42, marketImplied: null, bestPrice: 2.1, bookmaker: "x", edge: 0.06, confidence: "media" },
      { playerId: "2", name: "Thuram", side: "home", pScores: 0.31, marketImplied: null, bestPrice: 2.6, bookmaker: "x", edge: null, confidence: "media" },
    ] } } as const;

  it("gruppo marcatori con chip ordinati per pScores", () => {
    const g = buildPremiumGroups(gsRow as any).find((x) => x.key === "marcatori")!;
    expect(g.chips[0].selection).toContain("Lautaro");
    expect(g.chips[0].recommended).toBe(true); // top pScores con bestPrice
  });
  it("soft locked se soft_locked=true → group locked senza chip dati", () => {
    const g = buildPremiumGroups({ ...row, enrichment: { soft_locked: true } } as any).find((x) => x.key === "soft")!;
    expect(g.locked).toBe(true);
  });
  it("soft con cards/fouls non-generici (corner esclusi)", () => {
    const g = buildPremiumGroups({ ...row, enrichment: { soft: {
      cards: { expected: 4.2, main_line: 3.5, p_over: 0.58, is_generic: false },
      corners: { expected: 10, main_line: 9.5, p_over: 0.6, is_generic: false },
    } } } as any).find((x) => x.key === "soft")!;
    expect(g.chips.map((c) => c.market)).toContain("Cartellini");
    expect(g.chips.map((c) => c.market)).not.toContain("Corner");
  });
  it("nessun gruppo marcatori se goalscorer_markets assente", () => {
    expect(buildPremiumGroups({ ...row, enrichment: {} } as any).find((x) => x.key === "marcatori")).toBeUndefined();
  });
  it("dedup: due entry stesso lato/cognome/iniziale → tiene pScores più alto", () => {
    const dup = { ...row, enrichment: { goalscorer_markets: [
      { playerId: "1", name: "Marcus Thuram", side: "home", pScores: 0.30, marketImplied: null, bestPrice: 2.6, bookmaker: "x", edge: null, confidence: "media" },
      { playerId: "2", name: "Marcus Thuram", side: "home", pScores: 0.45, marketImplied: null, bestPrice: 2.1, bookmaker: "x", edge: 0.05, confidence: "media" },
    ] } } as any;
    const g = buildPremiumGroups(dup).find((x) => x.key === "marcatori")!;
    expect(g.chips).toHaveLength(1);
    expect(g.chips[0].prob).toBeCloseTo(0.45, 5);
  });
  it("marcatori: >4 entry → top 4 per pScores", () => {
    const mk = (n: string, p: number) => ({ playerId: n, name: n, side: "home", pScores: p, marketImplied: null, bestPrice: 2, bookmaker: "x", edge: null, confidence: "media" });
    const many = { ...row, enrichment: { goalscorer_markets: [mk("A", 0.5), mk("B", 0.4), mk("C", 0.3), mk("D", 0.2), mk("E", 0.1)] } } as any;
    const g = buildPremiumGroups(many).find((x) => x.key === "marcatori")!;
    expect(g.chips).toHaveLength(4);
    expect(g.chips.map((c) => c.selection)).toEqual(["A", "B", "C", "D"]);
  });
});

describe("buildAllGroups", () => {
  it("compone main + premium", () => {
    const full = { ...row, enrichment: { ...row.enrichment,
      goalscorer_markets: [{ playerId: "1", name: "Lautaro", side: "home", pScores: 0.4, marketImplied: null, bestPrice: 2.1, bookmaker: "x", edge: 0.05, confidence: "media" }],
      soft: { cards: { expected: 4.2, main_line: 3.5, p_over: 0.58, is_generic: false } } } } as any;
    const keys = buildAllGroups(full).map((g) => g.key);
    expect(keys).toContain("esiti");
    expect(keys).toContain("marcatori");
    expect(keys).toContain("soft");
  });
});

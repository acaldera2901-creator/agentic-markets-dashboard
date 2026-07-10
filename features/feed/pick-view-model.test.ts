import { describe, it, expect } from "vitest";
import { humanizePick, toPickCardVM, type ProjectedPrediction } from "./pick-view-model";

const base: ProjectedPrediction = {
  id: "1", external_event_id: null, sport: "football", competition: "Serie A",
  league: "Serie A", event_name: "Inter vs Verona", home_team: "Inter", away_team: "Verona",
  player_one: null, player_two: null, market: "1x2", pick: "Inter", bookmaker: "fp",
  odds: 1.55, fair_odds: null, edge_percent: 6.2, confidence_score: 78, risk_level: "low",
  stake_suggestion: null, closing_odds: null, closing_line_value: null, status: "open",
  signal_type: "value", source: "db", model_version: "v2", plan_access: "free",
  is_historical: false, is_live: false, is_paper: false, is_verified: true, is_demo: false,
  created_at: "", updated_at: "", published_at: "", starts_at: "2026-07-10T18:45:00Z",
  expires_at: "", settled_at: null, result: null, notes: null,
  explanation: "Inter in gran forma.", world_cup_stage: null, group_name: null, venue: null,
  neutral_venue: false, team_news_summary: null, market_movement_summary: null,
  source_table: null, source_id: null,
} as ProjectedPrediction;

describe("humanizePick", () => {
  it("1x2 con pick = squadra di casa → Vince {casa}", () => {
    expect(humanizePick({ market: "1x2", pick: "Inter", home_team: "Inter", away_team: "Verona" })).toBe("Vince l'Inter");
  });
  it("1x2 pareggio", () => {
    expect(humanizePick({ market: "1x2", pick: "X", home_team: "Inter", away_team: "Verona" })).toBe("Pareggio");
  });
  it("over/under → aggiunge 'gol'", () => {
    expect(humanizePick({ market: "over_under", pick: "Over 2.5", home_team: null, away_team: null })).toBe("Over 2.5 gol");
  });
  it("btts → linguaggio umano", () => {
    expect(humanizePick({ market: "btts", pick: "Yes", home_team: null, away_team: null })).toBe("Gol (entrambe segnano)");
  });
  it("mercato sconosciuto → pick grezzo", () => {
    expect(humanizePick({ market: "xyz", pick: "Qualcosa", home_team: null, away_team: null })).toBe("Qualcosa");
  });
});

describe("toPickCardVM", () => {
  it("mappa i campi chiave e la decisione umana", () => {
    const vm = toPickCardVM(base);
    expect(vm.id).toBe("1");
    expect(vm.decision).toBe("Vince l'Inter");
    expect(vm.confidenceScore).toBe(78);
    expect(vm.odds).toBe(1.55);
    expect(vm.hasValue).toBe(true);
    expect(vm.locked).toBe(false);
    expect(vm.why).toBe("Inter in gran forma.");
  });
  it("hasValue false se edge nullo o ≤0 (mai edge negativo mostrato)", () => {
    expect(toPickCardVM({ ...base, edge_percent: 0 }).hasValue).toBe(false);
    expect(toPickCardVM({ ...base, edge_percent: -3 }).hasValue).toBe(false);
    expect(toPickCardVM({ ...base, edge_percent: null }).hasValue).toBe(false);
  });
  it("locked riflette il flag di projection", () => {
    expect(toPickCardVM({ ...base, locked: true }).locked).toBe(true);
  });
});

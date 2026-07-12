import { describe, it, expect } from "vitest";
import { humanizePick, toPickCardVM, pickOutcomeLabel, type ProjectedPrediction } from "./pick-view-model";

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
  it("1x2 pick = squadra ospite il cui nome collide con token riservato → vince l'ospite, non pareggio", () => {
    const result = humanizePick({ market: "1x2", pick: "Verona", home_team: "Inter", away_team: "Verona" });
    expect(result.startsWith("Vince")).toBe(true);
    expect(result).toContain("Verona");
  });
  it("nome squadra che È il token 'X' → vince, non pareggio (ordering)", () => {
    const out = humanizePick({ market: "1x2", pick: "X", home_team: "Inter", away_team: "X" });
    expect(out).not.toBe("Pareggio");
    expect(out).toContain("X");
  });
  it("btts negativo → 'No Gol'", () => {
    expect(humanizePick({ market: "btts", pick: "No", home_team: null, away_team: null })).toBe("No Gol");
  });
  it("over/under con suffisso già presente → nessun doppio 'gol'", () => {
    expect(humanizePick({ market: "over_under", pick: "Over 2.5 gol", home_team: null, away_team: null })).toBe("Over 2.5 gol");
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
  it("riga locked/projected (market/pick/confidence/edge/odds assenti) non deve lanciare", () => {
    const row = {
      id: "9", sport: "football", competition: "Premier", starts_at: "2026-07-10T18:00:00Z", locked: true,
    } as ProjectedPrediction;
    expect(() => toPickCardVM(row)).not.toThrow();
    const vm = toPickCardVM(row);
    expect(vm.decision).toBe("");
    expect(vm.hasValue).toBe(false);
    expect(vm.locked).toBe(true);
    expect(vm.odds).toBe(null);
    expect(vm.confidenceScore).toBe(null);
  });
  it("fallback player_one/player_two quando home_team/away_team sono null", () => {
    const vm = toPickCardVM({ ...base, home_team: null, away_team: null, player_one: "Sinner", player_two: "Alcaraz" });
    expect(vm.homeTeam).toBe("Sinner");
    expect(vm.awayTeam).toBe("Alcaraz");
  });
  it("mappa sport, competition e kickoff", () => {
    const vm = toPickCardVM(base);
    expect(vm.sport).toBe(base.sport);
    expect(vm.competition).toBe(base.competition);
    expect(vm.kickoff).toBe(base.starts_at);
  });
  it("mappa externalEventId da external_event_id", () => {
    expect(toPickCardVM({ ...base, external_event_id: "EVT-9" }).externalEventId).toBe("EVT-9");
    expect(toPickCardVM({ ...base, external_event_id: null }).externalEventId).toBeNull();
  });
});

describe("toPickCardVM — settled state", () => {
  it("result 'won' → settled true, finalScore mappato, label 'Pronostico corretto'", () => {
    const vm = toPickCardVM({ ...base, result: "won", final_score: "2-1" });
    expect(vm.result).toBe("won");
    expect(vm.settled).toBe(true);
    expect(vm.finalScore).toBe("2-1");
    expect(pickOutcomeLabel(vm.result)).toBe("Pronostico corretto");
  });
  it("result 'lost' → label 'Non riuscito'", () => {
    const vm = toPickCardVM({ ...base, result: "lost" });
    expect(vm.result).toBe("lost");
    expect(vm.settled).toBe(true);
    expect(pickOutcomeLabel(vm.result)).toBe("Non riuscito");
  });
  it("result 'void' → label 'Annullato'", () => {
    const vm = toPickCardVM({ ...base, result: "void" });
    expect(vm.result).toBe("void");
    expect(vm.settled).toBe(true);
    expect(pickOutcomeLabel(vm.result)).toBe("Annullato");
  });
  it("result 'unresolved' → normalizzato a null, settled false", () => {
    const vm = toPickCardVM({ ...base, result: "unresolved" as ProjectedPrediction["result"] });
    expect(vm.result).toBeNull();
    expect(vm.settled).toBe(false);
    expect(pickOutcomeLabel(vm.result)).toBeNull();
  });
  it("nessun result → settled false", () => {
    const vm = toPickCardVM({ ...base, result: null });
    expect(vm.result).toBeNull();
    expect(vm.settled).toBe(false);
  });
  it("finalScore mappato da final_score, null se assente", () => {
    expect(toPickCardVM({ ...base, final_score: "3-0" }).finalScore).toBe("3-0");
    expect(toPickCardVM({ ...base }).finalScore).toBeNull();
  });
});

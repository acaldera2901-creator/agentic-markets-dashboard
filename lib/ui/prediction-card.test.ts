import { describe, it, expect } from "vitest";
import { formatPct, fromUnifiedPrediction } from "./prediction-card";
import type { UnifiedPrediction } from "@/lib/unified-adapter";

// Round 14: `edgeTone`/`formatEdge` non esistono più — l'edge non si scrive in
// nessuna vista, quindi non c'è più un tono da dipingere né un segno da
// stampare. I loro test se ne vanno con loro.
describe("formatPct", () => {
  it("percentuale intera, clampata", () => {
    expect(formatPct(64.4)).toBe("64");
    expect(formatPct(120)).toBe("100");
    expect(formatPct(null)).toBe("—");
  });
});

const base: UnifiedPrediction = {
  id: "p1", external_event_id: null, sport: "football", competition: "Premier League", league: "Premier League",
  event_name: "Arsenal vs Chelsea", home_team: "Arsenal", away_team: "Chelsea", player_one: null, player_two: null,
  market: "1X2", pick: "Arsenal", bookmaker: "bet365", odds: 1.92, fair_odds: 1.56, edge_percent: 12.0,
  confidence_score: 0.74, risk_level: "low", stake_suggestion: null, closing_odds: null, closing_line_value: null,
  status: "open", signal_type: "value", source: "v4", model_version: "v4", plan_access: "free",
  is_historical: false, is_live: false, is_paper: false, is_verified: true, is_demo: false,
  created_at: "2026-09-21T10:00:00Z", updated_at: "2026-09-21T10:00:00Z", published_at: null,
  starts_at: "2026-09-21T19:45:00Z", expires_at: "2026-09-21T21:45:00Z", settled_at: null, result: null,
  notes: null, explanation: "Model rates Arsenal higher than the market.", world_cup_stage: null, group_name: null,
  venue: null, neutral_venue: false, team_news_summary: null, market_movement_summary: null, source_table: null, source_id: null,
};

describe("fromUnifiedPrediction", () => {
  // #RESTYLING-0921 — l'edge si DERIVA da model−market, non si legge da
  // `edge_percent` (che è il value p·odds−1: su questa riga varrebbe +23.1,
  // mentre la card mostra 64 e 52 affiancati). Il fixture teneva
  // `edge_percent: 12` scritto a mano, coerente con la differenza ma non con la
  // pipeline: il test passava per costruzione. Ora il numero viene dai due che
  // la card rende davvero.
  it("modello da fair_odds, mercato da odds, edge = model − market", () => {
    const d = fromUnifiedPrediction(base, { kickoffLabel: "Today · 20:45" });
    expect(d.home).toBe("Arsenal");
    expect(d.away).toBe("Chelsea");
    expect(Math.round(d.modelPct!)).toBe(64);
    expect(Math.round(d.marketPct!)).toBe(52);
    expect(d.edgePct).toBeCloseTo(12.02, 2);
    expect(d.kickoffLabel).toBe("Today · 20:45");
  });

  it("ignora edge_percent (value) quando diverge dalla differenza mostrata", () => {
    // odds 2.0 / fair 1.60 → model 62.5, market 50 → +12.5 pp.
    // `edge_percent` direbbe 25 (value): la card mostrerebbe 62 · 50 · +25.
    const d = fromUnifiedPrediction({ ...base, odds: 2.0, fair_odds: 1.6, edge_percent: 25 });
    expect(d.edgePct).toBeCloseTo(12.5, 2);
  });
  it("senza quota di mercato non dichiara un edge", () => {
    const d = fromUnifiedPrediction({ ...base, odds: null, edge_percent: 9 });
    expect(d.marketPct).toBeNull();
    expect(d.edgePct).toBeNull();
    expect(d.modelPct).not.toBeNull();
  });
  it("tennis usa player_one/player_two", () => {
    const d = fromUnifiedPrediction({ ...base, sport: "tennis", home_team: null, away_team: null, player_one: "Sinner", player_two: "Alcaraz" });
    expect(d.home).toBe("Sinner");
    expect(d.away).toBe("Alcaraz");
  });
});

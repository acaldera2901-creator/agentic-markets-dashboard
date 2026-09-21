import { describe, it, expect } from "vitest";
import { edgeTone, formatEdge, formatPct, fromUnifiedPrediction, EDGE_FLAT_PP } from "./prediction-card";
import type { UnifiedPrediction } from "@/lib/unified-adapter";

describe("edgeTone", () => {
  it("null → none, |edge| < soglia → flat, altrimenti segno", () => {
    expect(edgeTone(null)).toBe("none");
    expect(edgeTone(Number.NaN)).toBe("none");
    expect(edgeTone(EDGE_FLAT_PP - 0.1)).toBe("flat");
    expect(edgeTone(-0.4)).toBe("flat");
    expect(edgeTone(4.3)).toBe("pos");
    expect(edgeTone(-2.1)).toBe("neg");
  });
});

describe("formatEdge / formatPct", () => {
  it("segno sempre, un decimale, meno tipografico", () => {
    expect(formatEdge(12)).toBe("+12.0");
    expect(formatEdge(-1.25)).toBe("−1.3");
    expect(formatEdge(0)).toBe("0.0");
    expect(formatEdge(null)).toBe("—");
  });
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
  it("modello da fair_odds, mercato da odds, edge in pp dal prodotto", () => {
    const d = fromUnifiedPrediction(base, { kickoffLabel: "Today · 20:45" });
    expect(d.home).toBe("Arsenal");
    expect(d.away).toBe("Chelsea");
    expect(Math.round(d.modelPct!)).toBe(64);
    expect(Math.round(d.marketPct!)).toBe(52);
    expect(d.edgePct).toBe(12);
    expect(d.kickoffLabel).toBe("Today · 20:45");
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

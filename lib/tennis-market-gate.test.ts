// #TENNIS-MARKET-GATE-0805 — tennis: no market price on the picked side, no
// directional pick.
//
// Why this file lives in lib/ and not tests/: vitest only picks up
// {app,lib,components,features}/**/*.test.ts — the ~36 files under tests/ have
// never run in CI (#TESTS-CI-0801). A test that does not run is not a test.
//
// Evidence behind the rule (am-lab/REPORT-tennis-noodds-2026-08-05.md, LIVE
// settled rows 01/06 → 05/08, gate applied as served):
//   with a price     n=183   claimed 71.6%   actual 74.9%
//   without a price  n=270   claimed 72.1%   actual 58.9%   z=3.51, p<0.001
// and the no-price cell is worst exactly where it claims most (75-79 band:
// 42.2% actual vs 77.1% claimed) — so raising the floor makes it worse, not
// better. No look-ahead: `odds` is written at publication, cross-checked
// 252/252 against the pre-match snapshots in prediction_log.
import { describe, it, expect } from "vitest";
import {
  hasTennisMarket,
  tennisSurfaceDecision,
  surfaceDecision,
  surfaceFloorFor,
  isSurfacedRow,
  TENNIS_REQUIRE_MARKET,
} from "./surfacing-gate";
import { tennisPredictionToUnifiedInsert } from "./tennis-adapter";

describe("hasTennisMarket", () => {
  it("accepts a usable decimal price", () => {
    expect(hasTennisMarket(1.41)).toBe(true);
    expect(hasTennisMarket(2)).toBe(true);
    expect(hasTennisMarket(1.01)).toBe(true);
  });

  it("fails closed on anything that is not a real price", () => {
    expect(hasTennisMarket(null)).toBe(false);
    expect(hasTennisMarket(undefined)).toBe(false);
    // 1.0 pays nothing back: a feed artefact, not a market.
    expect(hasTennisMarket(1)).toBe(false);
    expect(hasTennisMarket(0)).toBe(false);
    expect(hasTennisMarket(-2)).toBe(false);
    expect(hasTennisMarket(NaN)).toBe(false);
    expect(hasTennisMarket(Infinity)).toBe(false);
  });
});

describe("tennisSurfaceDecision", () => {
  it("surfaces a pick above the floor WITH a price", () => {
    const d = tennisSurfaceDecision(70, "Hamburg Open", 1.6);
    expect(d).toEqual({ isPick: true, belowFloor: false, noMarket: false });
  });

  it("drops the pick above the floor WITHOUT a price — the whole point", () => {
    const d = tennisSurfaceDecision(70, "Hamburg Open", null);
    expect(d.isPick).toBe(false);
    expect(d.noMarket).toBe(true);
    // and it must NOT be reported as "no clear favourite": the model has one.
    expect(d.belowFloor).toBe(false);
  });

  it("keeps the two reasons distinct when both apply", () => {
    const d = tennisSurfaceDecision(50, "Hamburg Open", null);
    expect(d).toEqual({ isPick: false, belowFloor: true, noMarket: true });
  });

  it("still enforces the segment-aware floor when a price exists", () => {
    // lo tier = 64: 63 stays below even with a perfectly good price.
    expect(tennisSurfaceDecision(63, "Hamburg Open", 1.5).isPick).toBe(false);
    expect(tennisSurfaceDecision(64, "Hamburg Open", 1.5).isPick).toBe(true);
    // hi tier = 62
    expect(tennisSurfaceDecision(62, "Wimbledon", 1.5).isPick).toBe(true);
    expect(tennisSurfaceDecision(61, "Wimbledon", 1.5).isPick).toBe(false);
    // lo-grass = 66
    expect(tennisSurfaceDecision(65, "Libéma Open", 1.5).isPick).toBe(false);
    expect(tennisSurfaceDecision(66, "Libéma Open", 1.5).isPick).toBe(true);
  });

  it("is one-way: the market can only REMOVE a pick, never add one", () => {
    for (let c = 0; c <= 100; c++) {
      const floorOnly = !surfaceDecision(c, surfaceFloorFor("tennis", "Hamburg Open")).belowFloor;
      const withGate = tennisSurfaceDecision(c, "Hamburg Open", 1.9).isPick;
      expect(withGate).toBe(floorOnly);
      expect(tennisSurfaceDecision(c, "Hamburg Open", null).isPick).toBe(false);
    }
  });

  it("is armed", () => {
    expect(TENNIS_REQUIRE_MARKET).toBe(true);
  });
});

describe("football is NOT subject to the market rule", () => {
  // On the same window football WITHOUT a price runs at 95% (n=20): applying
  // this rule there would delete the best picks. The football path never calls
  // tennisSurfaceDecision, and the shared helpers stay price-blind.
  it("surfaceFloorFor / isSurfacedRow ignore odds entirely", () => {
    expect(isSurfacedRow({ sport: "football", competition: "Serie A", confidence_score: 56 })).toBe(true);
    expect(surfaceFloorFor("football", "Serie A")).toBe(56);
  });
});

describe("isSurfacedRow is deliberately NOT retrofitted (no survivorship)", () => {
  // It answers "was this row SHOWN as a pick", so it must describe the rule that
  // was live when the row was published. Retrofitting the market gate onto June
  // rows would silently lift the published hit-rate by dropping picks we did
  // show. Same call as #MINORS-TIGHTEN 07/07.
  it("still surfaces a past above-floor tennis row with no odds", () => {
    expect(isSurfacedRow({ sport: "tennis", competition: "Hamburg Open", confidence_score: 70 })).toBe(true);
  });
});

// ── the writer: this is where the rule actually reaches the customer ─────────
const baseRow = {
  match_id: "tennis:espn:1:a:b",
  tournament: "Hamburg Open", // lo tier → floor 64
  surface: "clay",
  player1: "Player A",
  player2: "Player B",
  scheduled_at: "2026-08-20T10:00:00Z",
  p1: 0.7,
  p2: 0.3,
  odds_p1: 1.5,
  odds_p2: 2.6,
  edge: 0.05,
  best_selection: "P1",
  model_version: "elo_surface_v4_features_odds",
  serve_form_p1: 0.7, serve_form_p2: 0.6,
  return_form_p1: 0.4, return_form_p2: 0.35,
  feature_quality: 0.9,
};

describe("tennisPredictionToUnifiedInsert", () => {
  it("publishes the pick when the picked side has a price", () => {
    const d = tennisPredictionToUnifiedInsert(baseRow);
    expect(d.pick).toBe("Player A");
    expect(d.explanation).toBeTruthy();
    expect(d.confidence_score).toBe(70);
  });

  it("drops pick AND directional prose when the picked side has no price", () => {
    const d = tennisPredictionToUnifiedInsert({ ...baseRow, odds_p1: null });
    expect(d.pick).toBeNull();
    expect(d.explanation).toBeNull();
    // PROBABILITY-NEUTRAL: the row keeps its numbers and stays on the board.
    expect(d.confidence_score).toBe(70);
    expect(d.fair_odds).toBe(1.43);
    expect(d.home_team).toBe("Player A");
    expect(d.event_name).toBe("Player A vs Player B");
  });

  it("looks at the PICKED side's price, not just any price", () => {
    // P2 is the pick, only P1 has a price → no market on the side we would show.
    const d = tennisPredictionToUnifiedInsert({
      ...baseRow,
      best_selection: "P2",
      odds_p2: null,
    });
    expect(d.pick).toBeNull();
  });

  it("keeps dropping sub-floor picks exactly as before (no regression)", () => {
    const d = tennisPredictionToUnifiedInsert({ ...baseRow, p1: 0.6, p2: 0.4 });
    expect(d.pick).toBeNull(); // 60 < 64
  });
});

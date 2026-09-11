// #TENNIS-MARKET-GATE-0805 — tennis: no market price on the picked side, no
// directional pick.
//
// Why this file lives in lib/ and not tests/: vitest only picks up
// {app,lib,components,features}/**/*.test.ts, so a file under tests/ is invisible
// to `npm test`.
//
// ⚠️ CORRECTION (2026-08-08): the original note here said the ~36 files under
// tests/ "have never run in CI". That stopped being true on 2026-08-01, when
// #TESTS-CI-0801 added `node scripts/run-standalone-tests.mjs` to the workflow.
// Trusting the stale note cost us: this gate (2026-08-05) broke
// `tests/tennis-adapter-floor.test.ts` — whose fixtures carry no odds — and the
// red went unnoticed for three days because nobody expected tests/ to run.
// Before landing a change to the surfacing rules, run BOTH:
//   npm test  &&  node scripts/run-standalone-tests.mjs
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

// #PICK-SEMPRE-0911 (APPROVE Andrea 11/09: «sblocchiamo tutte le pick sia calcio
// sia tennis»). La regola del mercato e i floor restano nel codice come misura
// — l'evidenza qui sopra non e' cambiata — ma non tolgono piu' la pick: ogni
// riga porta il giocatore piu' probabile. Questi test pinnano il NUOVO contratto.
describe("tennisSurfaceDecision con #PICK-SEMPRE-0911", () => {
  it("surfaces a pick above the floor WITH a price", () => {
    const d = tennisSurfaceDecision(70, "Hamburg Open", 1.6);
    expect(d).toEqual({ isPick: true, belowFloor: false, noMarket: false });
  });

  it("keeps the pick WITHOUT a price (the market rule no longer removes it)", () => {
    const d = tennisSurfaceDecision(70, "Hamburg Open", null);
    expect(d.isPick).toBe(true);
    expect(d.noMarket).toBe(false);
    expect(d.belowFloor).toBe(false);
  });

  it("keeps the pick below the floor, with or without a price", () => {
    expect(tennisSurfaceDecision(50, "Hamburg Open", null)).toEqual({ isPick: true, belowFloor: false, noMarket: false });
    expect(tennisSurfaceDecision(63, "Hamburg Open", 1.5).isPick).toBe(true);
    expect(tennisSurfaceDecision(61, "Wimbledon", 1.5).isPick).toBe(true);
    expect(tennisSurfaceDecision(65, "Libéma Open", 1.5).isPick).toBe(true);
  });

  it("agrees with the football decision at every confidence: always a pick", () => {
    for (let c = 0; c <= 100; c++) {
      const floorOnly = !surfaceDecision(c, surfaceFloorFor("tennis", "Hamburg Open")).belowFloor;
      expect(floorOnly).toBe(true);
      expect(tennisSurfaceDecision(c, "Hamburg Open", 1.9).isPick).toBe(true);
      expect(tennisSurfaceDecision(c, "Hamburg Open", null).isPick).toBe(true);
    }
  });

  it("the market rule constant stays as a record of the measure", () => {
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

  it("keeps pick AND prose when the picked side has no price (#PICK-SEMPRE-0911)", () => {
    const d = tennisPredictionToUnifiedInsert({ ...baseRow, odds_p1: null });
    expect(d.pick).toBe("Player A");
    expect(d.explanation).toBeTruthy();
    // the fact «no market» stays written on the row
    expect(d.bookmaker).toBe("no market");
    expect(d.odds).toBeNull();
    expect(d.confidence_score).toBe(70);
    expect(d.fair_odds).toBe(1.43);
    expect(d.home_team).toBe("Player A");
    expect(d.event_name).toBe("Player A vs Player B");
  });

  it("publishes the picked side even when only the other side has a price", () => {
    const d = tennisPredictionToUnifiedInsert({
      ...baseRow,
      best_selection: "P2",
      odds_p2: null,
    });
    expect(d.pick).toBe("Player B");
  });

  it("publishes sub-floor picks too: the pick is the most probable player", () => {
    const d = tennisPredictionToUnifiedInsert({ ...baseRow, p1: 0.6, p2: 0.4 });
    expect(d.pick).toBe("Player A"); // 60 < 64, e la pick c'e' comunque
  });
});

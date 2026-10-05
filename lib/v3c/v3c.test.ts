// Pure-formula tests for lib/v3c — fictitious data only, no DB access.
import { describe, expect, it } from "vitest";
import { devig1x2, blendWithMarket } from "@/lib/poisson-model";
import { wilson95 } from "@/lib/wilson";
import { edgePp, market1x2, parseOutcome, topOutcome, MODEL_WEIGHT, MARKET_WEIGHT } from "./prob";
import { brier3, bucketIndex, pairedDifference, reliability, weekStartUtc } from "./scoring";
import { buildBoardMatch, bookPricesFor, liveFeedRows, orientPartnerPrice, type BoardSourceRow, type PartnerPriceRow } from "./board";
import { BOOKS } from "@/lib/betconstruct-books";
import { partnerSeries, ahSeries, seriesCoverage } from "./line-movement";
import { buildRecord, type SealedFootballRow } from "./record";
import { buildCalibration, tennisCalibration } from "./calibration";
import { redesignFlagOn } from "./guard";

const NOW = new Date("2026-10-05T12:00:00Z");

describe("prob", () => {
  it("market1x2 removes the margin proportionally and matches devig1x2", () => {
    const m = market1x2({ home: 2.0, draw: 3.4, away: 4.0 })!;
    const ref = devig1x2(2.0, 3.4, 4.0)!;
    expect(m.p.home).toBeCloseTo(ref.home, 12);
    expect(m.p.draw).toBeCloseTo(ref.draw, 12);
    expect(m.p.away).toBeCloseTo(ref.away, 12);
    expect(m.p.home + m.p.draw + m.p.away).toBeCloseTo(1, 12);
    // 1/2 + 1/3.4 + 1/4 − 1
    expect(m.margin).toBeCloseTo(0.5 + 1 / 3.4 + 0.25 - 1, 12);
  });

  it("market1x2 refuses a missing or invalid leg instead of inventing a market", () => {
    expect(market1x2({ home: 2, draw: null, away: 3 })).toBeNull();
    expect(market1x2({ home: 2, draw: 1, away: 3 })).toBeNull();
    expect(market1x2({ home: NaN, draw: 3, away: 3 })).toBeNull();
  });

  it("blend weights are the served 0.3 / 0.7", () => {
    expect(MODEL_WEIGHT).toBe(0.3);
    expect(MARKET_WEIGHT).toBeCloseTo(0.7, 12);
  });

  it("edge is signed percentage points", () => {
    expect(edgePp(0.48, 0.44)).toBe(4);
    expect(edgePp(0.40, 0.4425)).toBe(-4.25);
    expect(edgePp(0.4, null)).toBeNull();
  });

  it("topOutcome and parseOutcome", () => {
    expect(topOutcome({ home: 0.3, draw: 0.3, away: 0.4 })).toBe("away");
    expect(topOutcome({ home: 0.4, draw: 0.4, away: 0.2 })).toBe("home");
    expect(parseOutcome("DRAW")).toBe("draw");
    expect(parseOutcome("Rafael Nadal")).toBeNull();
    expect(parseOutcome(null)).toBeNull();
  });
});

describe("scoring", () => {
  it("brier3 on a hand-computed case", () => {
    // (0.5-1)^2 + 0.3^2 + 0.2^2 = 0.25 + 0.09 + 0.04
    expect(brier3({ home: 0.5, draw: 0.3, away: 0.2 }, "home")).toBeCloseTo(0.38, 12);
    expect(brier3({ home: 1, draw: 0, away: 0 }, "home")).toBe(0);
    expect(brier3({ home: 1, draw: 0, away: 0 }, "away")).toBe(2);
  });

  it("bucketIndex puts edges in the upper bucket and 1.0 in the last", () => {
    expect(bucketIndex(0)).toBe(0);
    expect(bucketIndex(0.1)).toBe(1);
    expect(bucketIndex(0.3)).toBe(3); // floating 0.3/0.1 = 2.9999…
    expect(bucketIndex(0.999)).toBe(9);
    expect(bucketIndex(1)).toBe(9);
  });

  it("reliability counts, means, Wilson interval and limited flag", () => {
    const pairs = [
      ...Array.from({ length: 40 }, (_, i) => ({ p: 0.62, hit: i < 26 })),
      { p: 0.15, hit: false },
      { p: 0.18, hit: true },
    ];
    const b = reliability(pairs);
    expect(b).toHaveLength(10);
    expect(b[6].n).toBe(40);
    expect(b[6].mean_predicted).toBe(0.62);
    expect(b[6].observed).toBe(0.65);
    const w = wilson95(26, 40)!;
    expect(b[6].ci95!.low).toBeCloseTo(w.low, 4);
    expect(b[6].ci95!.high).toBeCloseTo(w.high, 4);
    expect(b[6].limited_sample).toBe(false);
    expect(b[1].n).toBe(2);
    expect(b[1].limited_sample).toBe(true);
    expect(b[0].n).toBe(0);
    expect(b[0].observed).toBeNull();
  });

  it("pairedDifference mean and CI", () => {
    const d = pairedDifference([0.1, -0.1, 0.1, -0.1])!;
    expect(d.mean).toBeCloseTo(0, 12);
    // sd = sqrt(4*0.01/3), half = 1.96 * sd / 2
    expect(d.ci95.high).toBeCloseTo(1.959964 * Math.sqrt(0.04 / 3) / 2, 9);
    expect(pairedDifference([0.1])).toBeNull();
  });

  it("weekStartUtc returns the UTC Monday", () => {
    expect(weekStartUtc("2026-10-05T23:30:00Z")).toBe("2026-10-05"); // Monday
    expect(weekStartUtc("2026-10-11T23:59:00Z")).toBe("2026-10-05"); // Sunday
    expect(weekStartUtc("2026-10-12T00:00:00Z")).toBe("2026-10-12");
  });
});

const src = (over: Partial<BoardSourceRow> = {}): BoardSourceRow => {
  // model 0.50/0.25/0.25, market from 2.0/3.5/4.0, estimate = served blend
  const market = devig1x2(2.0, 3.5, 4.0)!;
  const est = blendWithMarket({ pHome: 0.5, pDraw: 0.25, pAway: 0.25 }, market);
  return {
    id: "oddsapi:abc",
    league: "MLS",
    competition: "MLS",
    kickoff: "2026-10-06T00:30:00Z",
    home: "Inter Miami",
    away: "Orlando City",
    computed_at: "2026-10-05T10:00:00Z",
    odds_home: 2.0, odds_draw: 3.5, odds_away: 4.0,
    model_p_home: 0.5, model_p_draw: 0.25, model_p_away: 0.25,
    p_home: est.pHome, p_draw: est.pDraw, p_away: est.pAway,
    sealed_at: "2026-10-05T04:00:00Z",
    ...over,
  };
};

const pp = (over: Partial<PartnerPriceRow> = {}): PartnerPriceRow => ({
  team_pair_key: "2026-10-06:inter miami|orlando city",
  bookmaker: "fortuneplay",
  home_name: "Inter Miami",
  away_name: "Orlando City",
  odds_home: 2.1, odds_draw: 3.4, odds_away: 3.9,
  captured_at: "2026-10-05T11:50:00Z",
  ...over,
});

describe("board", () => {
  it("separates market, model, estimate and edge; estimate is the 0.3/0.7 blend", () => {
    const m = buildBoardMatch(src(), [], NOW);
    const home = m.outcomes.find((o) => o.outcome === "home")!;
    const mk = devig1x2(2.0, 3.5, 4.0)!;
    expect(home.market_p).toBeCloseTo(mk.home, 4);
    expect(home.model_p).toBe(0.5);
    expect(home.estimate_p).toBeCloseTo(0.3 * 0.5 + 0.7 * mk.home, 4);
    expect(home.edge_pp).toBeCloseTo((0.3 * 0.5 + 0.7 * mk.home - mk.home) * 100, 2);
    expect(m.margin_removed).toBeCloseTo(1 / 2 + 1 / 3.5 + 1 / 4 - 1, 4);
    expect(m.blend).toEqual({ model: 0.3, market: 0.7 });
    expect(m.sealed_at).toBe("2026-10-05T04:00:00.000Z");
    expect(m.focus).toBe("home");
  });

  it("without a market: no market%, no edge, no blend — estimate is shown as served", () => {
    const m = buildBoardMatch(src({ odds_home: null, odds_draw: null, odds_away: null, p_home: 0.5, p_draw: 0.25, p_away: 0.25 }), [], NOW);
    expect(m.blend).toBeNull();
    expect(m.margin_removed).toBeNull();
    for (const o of m.outcomes) {
      expect(o.market_p).toBeNull();
      expect(o.edge_pp).toBeNull();
      expect(o.market_price).toBeNull();
    }
    expect(m.outcomes[0].estimate_p).toBe(0.5);
  });

  it("orients a book listing the fixture the other way round", () => {
    const swapped = pp({ home_name: "Orlando City", away_name: "Inter Miami", odds_home: 3.9, odds_away: 2.1 });
    expect(orientPartnerPrice({ home: "Inter Miami", away: "Orlando City" }, swapped)).toEqual({ home: 2.1, draw: 3.4, away: 3.9 });
    expect(orientPartnerPrice({ home: "A", away: "B" }, pp())).toBeNull();
  });

  it("only feed books, only fresh prices; best price is the highest", () => {
    const rows = [
      pp(),
      pp({ bookmaker: "ybets", odds_home: 2.15, captured_at: "2026-10-05T11:55:00Z" }),
      pp({ bookmaker: "stake", odds_home: 9.9 }), // no feed → never a price
      pp({ bookmaker: "fortuneplay", odds_home: 5.0, captured_at: "2026-10-05T09:00:00Z" }), // stale (3h)
    ];
    const prices = bookPricesFor({ home: "Inter Miami", away: "Orlando City" }, rows, NOW);
    expect(prices.home.map((p) => [p.bookmaker, p.price])).toEqual([["ybets", 2.15], ["fortuneplay", 2.1]]);
    const m = buildBoardMatch(src(), rows, NOW);
    expect(m.outcomes[0].best_price?.bookmaker).toBe("ybets");
    expect(m.outcomes[0].best_price?.url).toMatch(/^https:\/\//);
  });
});

describe("board live feed", () => {
  const fm = (over: Record<string, unknown> = {}) => ({
    teamPairKey: "2026-10-06:inter miami|orlando city", homeKey: "inter miami", awayKey: "orlando city",
    sport: "soccer", slug: "inter-miami-orlando-city", id: 42, urnId: "x",
    oddsHome: 2.05, oddsDraw: 3.5, oddsAway: 3.8, totalLine: null, totalOver: null, totalUnder: null,
    homeName: "Inter Miami", awayName: "Orlando City", startTime: "2026-10-06T00:30:00Z", ...over,
  });
  it("reads only the requested keys, deep-links FortunePlay, lands YBets, reports a down feed", () => {
    const boards = [
      { book: BOOKS[0], map: new Map([[fm().teamPairKey, fm()], ["other", fm({ teamPairKey: "other" })]]) },
      { book: BOOKS[1], map: new Map() },
    ] as unknown as Parameters<typeof liveFeedRows>[0];
    const { rows, missingBooks } = liveFeedRows(boards, new Set([fm().teamPairKey]), NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ bookmaker: "fortuneplay", source: "live_feed", captured_at: NOW.toISOString() });
    expect(rows[0].url).toContain("-m-42?stag=");
    expect(missingBooks).toEqual(["ybets"]);
    const m = buildBoardMatch(src(), rows, NOW);
    expect(m.outcomes[0].best_price).toMatchObject({ price: 2.05, source: "live_feed" });
  });
});

describe("line movement", () => {
  it("returns exactly the captured points — 2 captures, 2 points", () => {
    const rows = [
      pp({ captured_at: "2026-10-05T10:00:00Z", odds_home: 2.0 }),
      pp({ captured_at: "2026-10-05T11:00:00Z", odds_home: 2.2 }),
    ];
    const [s] = partnerSeries({ home: "Inter Miami", away: "Orlando City" }, rows);
    expect(s.market).toBe("1X2");
    expect(s.points).toHaveLength(2);
    expect(s.points[0].t).toBe("2026-10-05T10:00:00.000Z");
    expect(s.coverage).toMatchObject({ n_points: 2, median_interval_min: 60, max_gap_min: 60 });
  });

  it("market_p in line movement is the same function as the board", () => {
    const [s] = partnerSeries({ home: "Inter Miami", away: "Orlando City" }, [pp()]);
    const m = market1x2({ home: 2.1, draw: 3.4, away: 3.9 })!;
    if (s.market !== "1X2") throw new Error("expected 1X2");
    expect(s.points[0].market_p!.home).toBeCloseTo(m.p.home, 4);
  });

  it("drops non-feed books and swaps AH line for a reversed listing", () => {
    expect(partnerSeries({ home: "Inter Miami", away: "Orlando City" }, [pp({ bookmaker: "roobet" })])).toEqual([]);
    const [ah] = ahSeries({ home: "Inter Miami", away: "Orlando City" }, [
      { source: "odds_api_ah", home_name: "Orlando City", away_name: "Inter Miami", ah_line: 0.5, ah_odds_home: 1.9, ah_odds_away: 1.95, captured_at: "2026-10-05T10:00:00Z" },
    ]);
    if (ah.market !== "AH") throw new Error("expected AH");
    expect(ah.points[0]).toMatchObject({ line: -0.5, price: { home: 1.95, away: 1.9 } });
  });

  it("coverage of an empty series", () => {
    expect(seriesCoverage([])).toEqual({ n_points: 0, first_at: null, last_at: null, median_interval_min: null, max_gap_min: null });
    expect(seriesCoverage(["2026-10-05T10:00:00Z", "2026-10-05T10:10:00Z", "2026-10-05T10:40:00Z"]).median_interval_min).toBe(20);
  });
});

const sealed = (over: Partial<SealedFootballRow> = {}): SealedFootballRow => ({
  source_id: "m1",
  captured_at: "2026-09-01T08:00:00Z",
  commence_time: "2026-09-02T18:00:00Z",
  is_paper: false,
  p_home: 0.5, p_draw: 0.3, p_away: 0.2,
  result: "won", outcome: "HOME",
  market_p_home: 0.45, market_p_draw: 0.3, market_p_away: 0.25,
  ...over,
});

describe("record", () => {
  it("counts every category and starts «since» at the first seal", () => {
    const rows = [
      sealed(),
      sealed({ source_id: "m2", result: "void", outcome: "DRAW", captured_at: "2026-08-30T08:00:00Z" }), // no pick, still scored
      sealed({ source_id: "m3", result: "unresolved", outcome: null }),
      sealed({ source_id: "m4", result: "void", outcome: null }),
      sealed({ source_id: "m5", result: null, outcome: null, commence_time: "2026-10-04T10:00:00Z" }), // orphan
      sealed({ source_id: "m6", result: null, outcome: null, commence_time: "2026-10-05T10:00:00Z" }), // pending (<6h)
      sealed({ source_id: "m7", market_p_home: null, market_p_draw: null, market_p_away: null, is_paper: true }), // scored, unpaired
    ];
    const r = buildRecord(rows, NOW);
    expect(r.counts).toEqual({ sealed: 7, scored: 3, paired: 2, unresolved: 1, void_without_outcome: 1, orphans: 1, pending: 1, paper: 1 });
    expect(r.scope.since).toBe("2026-08-30T08:00:00Z");
    expect(r.outcomes).toEqual({ home: 2, draw: 1, away: 0 });
  });

  it("Brier estimate vs market are paired and hand-checkable", () => {
    const rows = [sealed(), sealed({ source_id: "m2", outcome: "DRAW", result: "lost" })];
    const r = buildRecord(rows, NOW);
    // estimate: home 0.25+0.09+0.04=0.38, draw 0.25+0.49+0.04=0.78 → 0.58
    // market:   home 0.3025+0.09+0.0625=0.455, draw 0.2025+0.49+0.0625=0.755 → 0.605
    expect(r.brier.estimate).toBeCloseTo(0.58, 4);
    expect(r.brier.market).toBeCloseTo(0.605, 4);
    expect(r.brier.difference).toBeCloseTo(-0.025, 4);
    expect(r.brier.n_paired).toBe(2);
    expect(r.brier.limited_sample).toBe(true);
  });

  it("weekly expected vs observed on the estimate's top outcome", () => {
    const rows = [
      sealed(), // top home, happened home
      sealed({ source_id: "m2", outcome: "AWAY", commence_time: "2026-09-03T18:00:00Z" }), // top home, missed
      sealed({ source_id: "m3", commence_time: "2026-09-09T18:00:00Z" }), // next week
    ];
    const r = buildRecord(rows, NOW);
    expect(r.weekly.map((w) => [w.week_start, w.n, w.expected_top, w.observed_top])).toEqual([
      ["2026-08-31", 2, 1, 1],
      ["2026-09-07", 1, 0.5, 1],
    ]);
    expect(r.weekly[0].limited_sample).toBe(true);
  });

  it("never publishes ROI, CLV or hit-rate", () => {
    const keys: string[] = [];
    const walk = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object")
        for (const [k, x] of Object.entries(v)) { keys.push(k.toLowerCase()); walk(x); }
    };
    walk(buildRecord([sealed()], NOW));
    for (const k of keys) expect(k).not.toMatch(/roi|clv|hit|yield|profit|units/);
  });
});

describe("calibration", () => {
  it("football buckets equal the record reliability (same population)", () => {
    const rows = [sealed(), sealed({ source_id: "m2", outcome: "DRAW" })];
    const c = buildCalibration(rows, [], NOW);
    expect(c.football.estimate).toEqual(buildRecord(rows, NOW).reliability);
    expect(c.football.n_pairs).toBe(6);
  });

  it("tennis is declared insufficient below 3 solid buckets", () => {
    const small = Array.from({ length: 40 }, (_, i) => ({ model_version: "elo", p: 0.65, result: i % 3 ? "won" : "lost" }));
    const t = tennisCalibration(small);
    expect(t.status).toBe("insufficient");
    expect(t.models[0].n).toBe(40);
  });

  it("tennis sufficient with 3 buckets of n >= 30; void/unresolved ignored", () => {
    const rows = [0.55, 0.65, 0.75].flatMap((p) =>
      Array.from({ length: 30 }, (_, i) => ({ model_version: "elo", p, result: i % 2 ? "won" : "lost" })),
    );
    rows.push({ model_version: "elo", p: 0.9, result: "void" });
    const t = tennisCalibration(rows);
    expect(t.status).toBe("sufficient");
    expect(t.models[0].n).toBe(90);
  });
});

describe("guard", () => {
  it("flag on only with NEXT_PUBLIC_REDESIGN=1", () => {
    expect(redesignFlagOn({ NEXT_PUBLIC_REDESIGN: "1" })).toBe(true);
    expect(redesignFlagOn({ NEXT_PUBLIC_REDESIGN: "0" })).toBe(false);
    expect(redesignFlagOn({})).toBe(false);
  });
});

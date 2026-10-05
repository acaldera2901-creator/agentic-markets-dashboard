// Pure-formula tests for the tennis part of lib/v3c — fictitious data only, no DB.
import { describe, expect, it } from "vitest";
import { BOOKS } from "@/lib/betconstruct-books";
import { applyTennisTemperature } from "@/lib/tennis-calibration";
import { teamPairKey } from "@/lib/team-pair-key";
import { market2way } from "./prob";
import { buildCalibration, tennisCalibration } from "./calibration";
import { buildRecord } from "./record";
import {
  buildTennisBoardMatch,
  ledgerTennisKind,
  marketAtSeal,
  servedTennisKind,
  tennisGapReason,
  tennisMlSeries,
  tennisPairKey,
  tennisRecordGroups,
  type SealedTennisRow,
  type TennisBoardSourceRow,
} from "./tennis";
import type { PartnerPriceRow } from "./board";

const NOW = new Date("2026-10-05T12:00:00Z");
const BOOK = BOOKS[0].key;

function src(over: Partial<TennisBoardSourceRow> = {}): TennisBoardSourceRow {
  return {
    id: "tennis:partner:2026-10-06_anna alfa|bea beta",
    tournament: "Partner feed",
    kickoff: "2026-10-06T14:10:00Z",
    player1: "Anna Alfa",
    player2: "Bea Beta",
    p1: 0.4459,
    p2: 0.5541,
    odds_p1: 2.05,
    odds_p2: 1.65,
    edge: null,
    model_version: "partner-market-v1",
    computed_at: "2026-10-05T10:00:00Z",
    odds_bookmaker: null,
    surfaced_pick: "Bea Beta",
    model_p1: null,
    model_p2: null,
    model_as_of: null,
    sealed_at: "2026-10-05T10:01:00Z",
    sealed_p1: 0.47,
    sealed_p2: 0.53,
    sealed_odds: 1.65,
    sealed_signal_type: "paper",
    ...over,
  };
}

const ELO = "elo_surface_v4_features_odds";

describe("tennis market", () => {
  it("market2way removes the margin proportionally", () => {
    const m = market2way(2.05, 1.65)!;
    const s = 1 / 2.05 + 1 / 1.65;
    expect(m.p1).toBeCloseTo(1 / 2.05 / s, 12);
    expect(m.p1 + m.p2).toBeCloseTo(1, 12);
    expect(m.margin).toBeCloseTo(s - 1, 12);
    expect(Math.round(m.p1 * 10_000) / 10_000).toBe(0.4459);
  });

  it("market2way refuses a missing or invalid leg", () => {
    expect(market2way(2, null)).toBeNull();
    expect(market2way(1, 3)).toBeNull();
  });
});

describe("tennis probability kind", () => {
  it("served kind mirrors the adapter: partner and anchored rows are the market", () => {
    expect(servedTennisKind({ model_version: "partner-market-v1", edge: null, odds_p1: 2, odds_p2: 1.8 })).toBe("market_tempered");
    expect(servedTennisKind({ model_version: ELO, edge: null, odds_p1: 2, odds_p2: 1.8 })).toBe("market_tempered");
    expect(servedTennisKind({ model_version: ELO, edge: null, odds_p1: null, odds_p2: null })).toBe("model_tempered");
    expect(servedTennisKind({ model_version: ELO, edge: 0.03, odds_p1: 2, odds_p2: 1.8 })).toBe("model");
  });

  it("ledger kind: a price in the seal means the market was sealed", () => {
    expect(ledgerTennisKind({ model_version: ELO, odds: 1.7, signal_type: "paper" })).toBe("market_tempered");
    expect(ledgerTennisKind({ model_version: ELO, odds: null, signal_type: "paper" })).toBe("model_tempered");
    expect(ledgerTennisKind({ model_version: ELO, odds: 1.7, signal_type: "signal" })).toBe("model");
    expect(ledgerTennisKind({ model_version: "partner-market-v1", odds: 1.7, signal_type: "paper" })).toBe("market_tempered");
  });
});

describe("tennis gap", () => {
  const mk = (t: string, h: string, a: string, oh: number, oa: number, book = BOOK): PartnerPriceRow => ({
    team_pair_key: "k", bookmaker: book, home_name: h, away_name: a, odds_home: oh, odds_draw: null, odds_away: oa, captured_at: t,
  });
  const ours = { player1: "Anna Alfa", player2: "Bea Beta" };

  it("never compares the market with itself", () => {
    expect(tennisGapReason({ kind: "market_tempered", sealed: true, hasRawModel: false, market: null })).toMatch(/no model of ours/);
    expect(tennisGapReason({ kind: "market_tempered", sealed: true, hasRawModel: true, market: { p1: 0.5, p2: 0.5, bookmaker: BOOK, captured_at: "x" } })).toMatch(/market price itself/);
  });

  it("our model: needs a seal and a market before it", () => {
    expect(tennisGapReason({ kind: "model_tempered", sealed: false, hasRawModel: true, market: null })).toBe("not sealed yet");
    expect(tennisGapReason({ kind: "model_tempered", sealed: true, hasRawModel: true, market: null })).toMatch(/no FortunePlay\/YBets price/);
    expect(tennisGapReason({ kind: "model_tempered", sealed: true, hasRawModel: true, market: { p1: 0.5, p2: 0.5, bookmaker: BOOK, captured_at: "x" } })).toBeNull();
  });

  it("market at seal = last feed capture at or before the seal, ≤150 min, oriented", () => {
    const seal = "2026-10-05T12:00:00Z";
    const rows = [
      mk("2026-10-05T09:00:00Z", "Anna Alfa", "Bea Beta", 3.0, 1.4), // > 150 min old
      mk("2026-10-05T10:00:00Z", "Bea Beta", "Anna Alfa", 1.5, 2.6), // reversed, the one
      mk("2026-10-05T12:30:00Z", "Anna Alfa", "Bea Beta", 1.2, 4.0), // after the seal: look-ahead
      mk("2026-10-05T11:00:00Z", "Anna Alfa", "Bea Beta", 2.0, 1.8, "not-a-feed-book"),
    ];
    const m = marketAtSeal(ours, seal, rows)!;
    expect(m.captured_at).toBe("2026-10-05T10:00:00.000Z");
    expect(m.p1).toBeCloseTo(1 / 2.6 / (1 / 2.6 + 1 / 1.5), 12);
    expect(marketAtSeal(ours, seal, rows.slice(0, 1))).toBeNull();
  });
});

describe("tennis pair key", () => {
  it("partner ids carry the key; others use teamPairKey", () => {
    expect(tennisPairKey(src())).toBe("2026-10-06:anna alfa|bea beta");
    const r = { id: "tennis:espn:1:x:y", player1: "Zoe Zeta", player2: "Anna Alfa", kickoff: "2026-10-06T14:10:00Z" };
    expect(tennisPairKey(r)).toBe(teamPairKey("tennis", "Zoe Zeta", "Anna Alfa", "2026-10-06T14:10:00.000Z"));
    expect(tennisPairKey(r)).toBe("2026-10-06:anna alfa|zoe zeta");
  });
});

describe("tennis board", () => {
  const reversed: PartnerPriceRow = {
    team_pair_key: "2026-10-06:anna alfa|bea beta",
    bookmaker: BOOK,
    home_name: "Bea Beta",
    away_name: "Anna Alfa",
    odds_home: 1.6,
    odds_draw: null,
    odds_away: 2.2,
    captured_at: "2026-10-05T11:30:00Z",
    source: "live_feed",
  };

  it("partner row: market only, tempered estimate, no model, no gap, books oriented", () => {
    const m = buildTennisBoardMatch(src(), [reversed], NOW);
    expect(m.probability_kind).toBe("market_tempered");
    expect(m.is_our_model).toBe(false);
    expect(m.tournament).toBeNull(); // «Partner feed» is not a tournament
    expect(m.sides[0].market_p).toBe(0.4459);
    expect(m.sides[0].model_p).toBeNull();
    expect(m.sides[0].estimate_p).toBe(Math.round(applyTennisTemperature(0.4459) * 10_000) / 10_000);
    expect(m.temperature).toBe(1.68);
    expect(m.sides[0].gap_pp).toBeNull();
    expect(m.gap_market).toBeNull();
    expect(m.gap_null_reason).toMatch(/no model of ours/);
    // the book lists Bea first: its 2.2 belongs to OUR player1 (Anna)
    expect(m.sides[0].best_price?.price).toBe(2.2);
    expect(m.sides[1].best_price?.price).toBe(1.6);
    expect(m.focus).toBe("p2");
    expect(m.surfaced_pick).toBe("p2");
    expect(m.sealed_at).toBe("2026-10-05T10:01:00.000Z");
  });

  it("Elo row with a price: market-anchored, raw Elo shown apart, gap still null", () => {
    const m = buildTennisBoardMatch(
      src({ id: "tennis:espn:9:a:b", model_version: ELO, tournament: "Open X", model_p1: 0.7, model_p2: 0.3, model_as_of: "2026-10-05T09:59:00Z", odds_bookmaker: "pinnacle" }),
      [],
      NOW,
    );
    expect(m.probability_kind).toBe("market_tempered");
    expect(m.sides[0].model_p).toBe(0.7);
    expect(m.market_source).toEqual({ bookmaker: "pinnacle", as_of: "2026-10-05T10:00:00.000Z" });
    expect(m.sides[0].gap_pp).toBeNull();
    expect(m.gap_null_reason).toMatch(/market price itself/);
  });

  it("Elo row without a price: tempered Elo; gap vs the feed price captured before the seal", () => {
    const row = src({
      id: "tennis:espn:9:a:b", model_version: ELO, p1: 0.79, p2: 0.21, odds_p1: null, odds_p2: null,
      model_p1: 0.79, model_p2: 0.21, sealed_p1: 0.69, sealed_p2: 0.31, sealed_odds: null, sealed_at: "2026-10-05T10:01:00Z",
    });
    const before = { ...reversed, captured_at: "2026-10-05T09:01:00Z" }; // Bea 1.6, Anna 2.2
    const m = buildTennisBoardMatch(row, [], NOW, [before, { ...reversed, captured_at: "2026-10-05T11:00:00Z", odds_away: 9 }]);
    expect(m.probability_kind).toBe("model_tempered");
    expect(m.is_our_model).toBe(true);
    expect(m.margin_removed).toBeNull();
    expect(m.sides[0].market_p).toBeNull();
    expect(m.sides[0].estimate_p).toBeCloseTo(0.6878, 3);
    const mp1 = 1 / 2.2 / (1 / 2.2 + 1 / 1.6);
    expect(m.gap_null_reason).toBeNull();
    expect(m.gap_market).toEqual({ bookmaker: BOOK, captured_at: "2026-10-05T09:01:00.000Z" });
    expect(m.sides[0].market_p_at_seal).toBe(Math.round(mp1 * 10_000) / 10_000);
    expect(m.sides[0].gap_pp).toBe(Math.round((0.69 - mp1) * 10_000) / 100);
    expect(m.sides[1].gap_pp).toBe(Math.round((0.31 - (1 - mp1)) * 10_000) / 100);
    // no history → no gap, with the reason
    const n = buildTennisBoardMatch(row, [], NOW);
    expect(n.sides[0].gap_pp).toBeNull();
    expect(n.gap_null_reason).toMatch(/no FortunePlay\/YBets price/);
  });

  it("Elo row with an edge: served untempered", () => {
    const m = buildTennisBoardMatch(src({ model_version: ELO, edge: 0.05, p1: 0.6, p2: 0.4 }), [], NOW);
    expect(m.probability_kind).toBe("model");
    expect(m.temperature).toBeNull();
    expect(m.sides[0].estimate_p).toBe(0.6);
  });
});

describe("tennis line movement", () => {
  it("one ML series per feed book, oriented, de-vigged, every capture kept", () => {
    const row = (t: string, h: string, a: string, oh: number, oa: number, book = BOOK): PartnerPriceRow => ({
      team_pair_key: "k", bookmaker: book, home_name: h, away_name: a, odds_home: oh, odds_draw: null, odds_away: oa, captured_at: t,
    });
    const s = tennisMlSeries({ home: "Anna Alfa", away: "Bea Beta" }, [
      row("2026-10-05T10:00:00Z", "Bea Beta", "Anna Alfa", 1.6, 2.2),
      row("2026-10-05T08:00:00Z", "Anna Alfa", "Bea Beta", 2.0, 1.8),
      row("2026-10-05T09:00:00Z", "Anna Alfa", "Bea Beta", 2.0, 1.8, "not-a-feed-book"),
    ]);
    expect(s).toHaveLength(1);
    expect(s[0].market).toBe("ML");
    const pts = s[0].points as { price: { p1: number; p2: number }; market_p: { p1: number } | null }[];
    expect(pts.map((p) => p.price.p1)).toEqual([2.0, 2.2]);
    expect(pts[1].market_p!.p1).toBe(Math.round((1 / 2.2 / (1 / 2.2 + 1 / 1.6)) * 10_000) / 10_000);
    expect(s[0].coverage.n_points).toBe(2);
    expect(s[0].coverage.median_interval_min).toBe(120);
  });
});

describe("tennis record and calibration", () => {
  const r = (over: Partial<SealedTennisRow>): SealedTennisRow => ({
    source_id: "tennis:espn:1:a:b", model_version: ELO, home_team: "Anna Alfa", away_team: "Bea Beta", pick: "Anna Alfa",
    p: 0.6, result: "won", odds: null, signal_type: "paper", captured_at: "2026-09-22T20:00:00Z",
    commence_time: "2026-09-23T10:00:00Z", ...over,
  });

  it("groups by what the sealed probability is, with honest counts", () => {
    const rows = [
      r({ p: 0.6, result: "won" }),
      r({ p: 0.7, result: "lost", captured_at: "2026-09-25T00:00:00Z" }),
      r({ p: 0.55, result: "void" }),
      r({ p: 0.8, result: null }),
      r({ p: 0.65, result: "won", odds: 1.5 }), // anchored → market
      r({ model_version: "partner-market-v1", p: 0.7, result: "won", odds: 1.4 }),
    ];
    const g = tennisRecordGroups(rows);
    const elo = g.find((x) => x.model_version === ELO && x.kind === "model_tempered")!;
    expect(elo.is_our_model).toBe(true);
    expect([elo.sealed, elo.scored, elo.settled_other, elo.unsettled]).toEqual([4, 2, 1, 1]);
    expect(elo.expected_wins).toBe(1.3);
    expect(elo.observed_wins).toBe(1);
    expect(elo.brier).toBe(Math.round((((0.6 - 1) ** 2 + 0.7 ** 2) / 2) * 10_000) / 10_000);
    expect(elo.brier_market).toBeNull();
    expect(elo.n_paired).toBe(0);
    expect(elo.brier_market_null_reason).toMatch(/no scored row/);
    expect(elo.limited_sample).toBe(true);
    expect(elo.since).toBe("2026-09-22T20:00:00.000Z");
    const anchored = g.find((x) => x.model_version === ELO && x.kind === "market_tempered")!;
    expect(anchored.is_our_model).toBe(false);
    expect(anchored.scored).toBe(1);
    expect(g.find((x) => x.model_version === "partner-market-v1")!.brier_market_null_reason).toMatch(/with itself/);
  });

  it("pairs our model rows with the feed price before the seal; Brier on the same rows", () => {
    const key = "2026-09-23:anna alfa|bea beta";
    const hist: PartnerPriceRow[] = [
      { team_pair_key: key, bookmaker: BOOK, home_name: "Anna Alfa", away_name: "Bea Beta", odds_home: 1.8, odds_draw: null, odds_away: 2.0, captured_at: "2026-09-22T19:00:00Z" },
    ];
    const rows = [
      r({ p: 0.6, result: "won" }),
      r({ source_id: "tennis:espn:2:c:d", home_team: "Cara Ceta", away_team: "Dora Delta", pick: "Dora Delta", p: 0.55, result: "lost" }), // no history
    ];
    const [g] = tennisRecordGroups(rows, new Map([[key, hist]]));
    const m = 1 / 1.8 / (1 / 1.8 + 1 / 2.0);
    expect(g.n_paired).toBe(1);
    expect(g.brier_paired).toBe(Math.round((0.6 - 1) ** 2 * 10_000) / 10_000);
    expect(g.brier_market).toBe(Math.round((m - 1) ** 2 * 10_000) / 10_000);
    expect(g.difference).toBeNull(); // < 2 pairs: no variance, no CI
    expect(g.brier_market_null_reason).toBeNull();
    expect(g.limited_sample).toBe(true);
  });

  it("record carries tennis and still no ROI, CLV or hit-rate key", () => {
    const rec = buildRecord([], NOW, [r({})]);
    expect(rec.contract).toBe("v3.record.2");
    expect(rec.tennis.groups).toHaveLength(1);
    const keys: string[] = [];
    const walk = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { keys.push(k.toLowerCase()); walk(x); }
    };
    walk(rec);
    for (const k of keys) expect(k).not.toMatch(/roi|clv|hit|yield|profit|units/);
  });

  it("a big market group never makes tennis calibration sufficient", () => {
    const market = [0.55, 0.65, 0.75].flatMap((p) =>
      Array.from({ length: 40 }, (_, i) => r({ model_version: "partner-market-v1", p, odds: 1.5, result: i % 2 ? "won" : "lost" })),
    );
    const ours = Array.from({ length: 40 }, (_, i) => r({ p: 0.65, result: i % 2 ? "won" : "lost" }));
    const t = tennisCalibration([...market, ...ours]);
    expect(t.status).toBe("insufficient");
    expect(t.models.find((m) => !m.is_our_model)!.n).toBe(120);
    expect(t.models.find((m) => m.is_our_model)!.n).toBe(40);
    expect(buildCalibration([], [...market, ...ours], NOW).contract).toBe("v3.calibration.2");
  });
});

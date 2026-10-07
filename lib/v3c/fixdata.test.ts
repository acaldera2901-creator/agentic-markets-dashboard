// #REDESIGN-V3C fixdata — the data/logic defects of QA-REPORT v3c-final3 (B1 B2 B5 B6 B8 M4 M6 A3 A6 L4),
// each with the case that failed before the fix. Fictitious rows shaped on the real ones (SELECT 07/10), no DB.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FpMatch } from "@/lib/fortuneplay-live";
import { buildBoardMatch, liveFeedRows, type BoardSourceRow } from "./board";
import { stampFeedMap } from "@/lib/feed-stamp";
import { dedupeFootballBoard, hasStarted, inputProblem, modelGuard, relevanceTier, valueToolsAllowed } from "./fixdata";
import { boardGroups, footballRows, tennisRows } from "./board-view";
import { dedupeTwinFixtures, type SealedFootballRow } from "./record";
import { toolDef } from "./tools";
import { yesterdayHome } from "./yesterday";
import type { V3YesterdayResponse } from "./contracts";
import { teamPairKey } from "@/lib/team-pair-key";
import type { TennisBoardSourceRow } from "./tennis";

const NOW = new Date("2026-10-07T14:52:00Z");

const src = (over: Partial<BoardSourceRow> = {}): BoardSourceRow => ({
  id: "oddsapi:x",
  league: "Belgian Pro League",
  competition: "Belgian Pro League",
  kickoff: "2026-10-08T18:00:00Z",
  home: "Cercle Brugge KSV",
  away: "RSC Anderlecht",
  computed_at: "2026-10-07T12:00:00Z",
  odds_home: 3.6,
  odds_draw: 3.5,
  odds_away: 2.05,
  model_p_home: 0.3,
  model_p_draw: 0.28,
  model_p_away: 0.42,
  p_home: 0.28,
  p_draw: 0.28,
  p_away: 0.44,
  sealed_at: null,
  ...over,
});

const fpRow = (home: string, away: string, kickoff: string, odds: [number, number, number]) => ({
  team_pair_key: teamPairKey("soccer", home, away, kickoff) as string,
  bookmaker: "fortuneplay",
  home_name: home,
  away_name: away,
  odds_home: odds[0],
  odds_draw: odds[1],
  odds_away: odds[2],
  captured_at: "2026-10-07T14:40:00Z",
  source: "live_feed" as const,
});

describe("B1 · a started match is never a pre-match row", () => {
  it("hasStarted: kick-off in the past", () => {
    expect(hasStarted("2026-10-07T14:00:00Z", NOW)).toBe(true);
    expect(hasStarted("2026-10-07T15:00:00Z", NOW)).toBe(false);
  });
  it("the API drops book prices and the best price of a match that has started", () => {
    const s = src({ kickoff: "2026-10-07T13:30:00Z" });
    const m = buildBoardMatch(s, [fpRow(s.home, s.away, s.kickoff, [3.7, 3.4, 2.1])], NOW);
    expect(m.outcomes.every((o) => o.best_price == null && o.book_prices.length === 0)).toBe(true);
    const pre = buildBoardMatch(src(), [fpRow(src().home, src().away, src().kickoff, [3.7, 3.4, 2.1])], NOW);
    expect(pre.outcomes[0].best_price?.price).toBe(3.7);
  });
  it("the view has no best price once the clock passes the kick-off (page left open)", () => {
    const m = buildBoardMatch(src({ kickoff: "2026-10-07T15:00:00Z" }), [fpRow("Cercle Brugge KSV", "RSC Anderlecht", "2026-10-07T15:00:00Z", [3.7, 3.4, 2.1])], NOW);
    expect(footballRows([m], "UTC", NOW)[0].best).not.toBeNull();
    expect(footballRows([m], "UTC", new Date("2026-10-07T15:01:00Z"))[0].best).toBeNull();
  });
  it("groups: Live (with a score) · Started (without) · then the days; never a started row in a day group", () => {
    const a = buildBoardMatch(src({ id: "a", kickoff: "2026-10-07T13:00:00Z" }), [], NOW);
    const b = buildBoardMatch(src({ id: "b", kickoff: "2026-10-07T14:30:00Z" }), [], NOW);
    const c = buildBoardMatch(src({ id: "c", kickoff: "2026-10-07T18:00:00Z" }), [], NOW);
    const g = boardGroups(footballRows([a, b, c], "UTC", NOW), NOW, (id) => id === "a");
    expect(g.map((x) => [x.day, x.rows.map((r) => r.m.id)])).toEqual([
      ["live", ["a"]],
      ["started", ["b"]],
      ["2026-10-07", ["c"]],
    ]);
  });
  it("order inside a day: top-league football, ATP/WTA, other football, other tennis; then kick-off", () => {
    expect(relevanceTier({ sport: "football", competition: "Premier League", league: "PL" })).toBe(0);
    expect(relevanceTier({ sport: "football", competition: "Austrian Bundesliga", league: null })).toBe(2);
    expect(relevanceTier({ sport: "tennis", tournament: "ATP Shanghai" })).toBe(1);
    expect(relevanceTier({ sport: "tennis", tournament: null, partner_tournament: "WTA Wuhan - Hard" })).toBe(1);
    expect(relevanceTier({ sport: "tennis", tournament: "ITF W35 Reims" })).toBe(3);
    expect(relevanceTier({ sport: "tennis", tournament: "ATP Challenger Braga" })).toBe(3);
    const pl = { ...buildBoardMatch(src({ id: "pl", kickoff: "2026-10-07T19:00:00Z", competition: "Premier League" }), [], NOW), relevance: 0 };
    const other = { ...buildBoardMatch(src({ id: "be", kickoff: "2026-10-07T16:00:00Z" }), [], NOW), relevance: 2 };
    const g = boardGroups(footballRows([other, pl], "UTC", NOW), NOW, () => false);
    expect(g[0].rows.map((r) => r.m.id)).toEqual(["pl", "be"]);
  });
});

describe("B2 · the price time is the capture time, not the request time", () => {
  it("a live-feed price carries the time the feed was read, not now", () => {
    const map = new Map<string, FpMatch>();
    const key = teamPairKey("soccer", "Cercle Brugge KSV", "RSC Anderlecht", "2026-10-08T18:00:00Z") as string;
    map.set(key, { teamPairKey: key, homeKey: "", awayKey: "", sport: "soccer", slug: "", id: 0, urnId: "", oddsHome: 3.7, oddsDraw: 3.4, oddsAway: 2.1, totalLine: null, totalOver: null, totalUnder: null, homeName: "Cercle Brugge KSV", awayName: "RSC Anderlecht", startTime: null });
    stampFeedMap(map, Date.parse("2026-10-07T14:31:00Z"));
    const { rows } = liveFeedRows([{ book: { key: "fortuneplay", landing: "https://x", matchUrlBase: undefined, stag: undefined }, map }], new Set([key]), NOW);
    expect(rows[0].captured_at).toBe("2026-10-07T14:31:00.000Z");
  });
  it("a feed copy older than the max age is not a current price", () => {
    const s = src();
    const old = { ...fpRow(s.home, s.away, s.kickoff, [3.7, 3.4, 2.1]), captured_at: "2026-10-07T11:00:00Z" };
    expect(buildBoardMatch(s, [old], NOW).outcomes[0].best_price).toBeNull();
  });
});

describe("B5 · the model sanity guard (raw model vs no-vig market)", () => {
  it("Cercle–Anderlecht: model 84% vs market 27% → Market only, estimate = market, gap 0", () => {
    const m = buildBoardMatch(src({ model_p_home: 0.84, model_p_draw: 0.08, model_p_away: 0.08, p_home: 0.44, p_draw: 0.22, p_away: 0.34 }), [], NOW);
    expect(m.model_guard?.level).toBe("market_only");
    const home = m.outcomes[0];
    expect(home.estimate_p).toBe(home.market_p);
    expect(home.edge_pp).toBe(0);
    expect(home.model_p).toBe(0.84); // the raw model stays in the API
    expect(valueToolsAllowed(m)).toBe(false);
  });
  it("15–25 pp: estimate kept, but no EV / Kelly / stake / edge badge", () => {
    const m = buildBoardMatch(src({ model_p_home: 0.48 }), [], NOW);
    expect(m.model_guard?.level).toBe("no_value");
    expect(m.outcomes[0].edge_pp).not.toBe(0);
    expect(valueToolsAllowed(m)).toBe(false);
  });
  it("≤ 15 pp: ok", () => {
    expect(buildBoardMatch(src(), [], NOW).model_guard?.level).toBe("ok");
    expect(modelGuard([{ model_p: null, market_p: 0.3 }]).level).toBe("ok");
  });
});

describe("B6 · the same football match twice (rescheduled)", () => {
  const r = (id: string, home: string, away: string, kickoff: string, computed_at: string) => ({ id, home, away, kickoff, computed_at });
  it("keeps the row the pipeline still refreshes (Shamrock–Drogheda 8 and 9/10, Aberdeen–St Johnstone 10 and 11/10)", () => {
    const rows = [
      r("sh8", "Shamrock Rovers", "Drogheda United", "2026-10-08T19:00:00Z", "2026-10-07T12:02:03Z"),
      r("sh9", "Shamrock Rovers", "Drogheda United", "2026-10-09T19:00:00Z", "2026-10-04T14:02:02Z"),
      r("ab10", "Aberdeen", "St Johnstone", "2026-10-10T14:00:00Z", "2026-10-03T20:02:07Z"),
      r("ab11", "Aberdeen", "St Johnstone", "2026-10-11T13:00:00Z", "2026-10-07T12:02:27Z"),
    ];
    expect(dedupeFootballBoard(rows).kept.map((x) => x.id)).toEqual(["sh8", "ab11"]);
  });
  it("same run → the later kick-off (Qingdao–Beijing 9/10 and 10/10, the books list 10/10)", () => {
    const rows = [
      r("q9", "Qingdao Hainiu FC", "Beijing FC", "2026-10-09T11:35:00Z", "2026-10-07T10:02:04Z"),
      r("q10", "Qingdao Hainiu FC", "Beijing FC", "2026-10-10T11:30:00Z", "2026-10-07T10:02:05Z"),
    ];
    expect(dedupeFootballBoard(rows).kept.map((x) => x.id)).toEqual(["q10"]);
  });
  it("reverse fixture and > 48 h apart are other matches", () => {
    const rows = [
      r("a", "Aberdeen", "St Johnstone", "2026-10-10T14:00:00Z", "2026-10-07T12:00:00Z"),
      r("b", "St Johnstone", "Aberdeen", "2026-10-11T14:00:00Z", "2026-10-07T12:00:00Z"),
      r("c", "Aberdeen", "St Johnstone", "2026-10-13T14:00:00Z", "2026-10-07T12:00:00Z"),
    ];
    expect(dedupeFootballBoard(rows).kept.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
  it("the record counts Sabadell–Andorra (3/10 and 4/10, both 0–0) and León–Monterrey once", () => {
    const row = (id: string, home: string, away: string, k: string, cap: string): SealedFootballRow => ({
      source_id: id, home_team: home, away_team: away, captured_at: cap, commence_time: k, is_paper: false,
      p_home: 0.4, p_draw: 0.3, p_away: 0.3, result: "void", outcome: "DRAW", market_p_home: null, market_p_draw: null, market_p_away: null,
    });
    const rows = [
      row("oddsapi:26e3", "Sabadell FC", "Andorra CF", "2026-10-03T16:30:00Z", "2026-09-26T18:02:11Z"),
      row("oddsapi:71df", "Sabadell FC", "Andorra CF", "2026-10-04T19:00:00Z", "2026-10-04T10:02:34Z"),
      row("espn:401877005", "León", "Monterrey", "2026-08-22T01:00:00Z", "2026-08-20T16:03:51Z"),
      row("oddsapi:d7e1", "León", "Monterrey", "2026-08-23T01:00:00Z", "2026-08-15T16:02:40Z"),
    ];
    expect(dedupeTwinFixtures(rows).map((x) => x.source_id)).toEqual(["oddsapi:26e3", "oddsapi:d7e1"]);
  });
});

describe("A6 · Yesterday on the home: no score under the minimum n", () => {
  const day = (fbWon: number, fbLost: number, brierN: number | null): V3YesterdayResponse => ({
    contract: "v3.yesterday.1", generated_at: NOW.toISOString(), day: "2026-10-06",
    football: { settled: fbWon + fbLost + 1, won: fbWon, lost: fbLost, other: 1, expected_wins: 0, limited_sample: fbWon + fbLost < 30 },
    tennis: { settled: 227, won: 170, lost: 57, other: 0, expected_wins: null, limited_sample: false },
    picks: [], brier: brierN == null ? null : { n: brierN, estimate: 0.819, market: 0.796 }, notes: [],
  });
  it("n = 1: no Brier, no Expected/Observed, the day's W/L of football; never the tennis W/L", () => {
    const v = yesterdayHome(day(0, 0, 1));
    expect(v.score).toBeNull();
    expect(v.wl).toEqual({ won: 0, lost: 0 });
    expect(JSON.stringify(v)).not.toContain("170");
  });
  it("n ≥ 30: the score is shown", () => {
    const v = yesterdayHome(day(20, 12, 32));
    expect(v.score).toEqual({ expected: 0, observed: 20, brier: { n: 32, estimate: 0.819, market: 0.796 } });
  });
});

describe("M4 · tool inputs: 1.01–1000, a reason for every refusal", () => {
  it("prices outside 1.01–1000 are refused, no 11-digit result", () => {
    expect(inputProblem("price", 999999999)).toBe("range");
    expect(inputProblem("price", 1.005)).toBe("range");
    expect(inputProblem("price", null)).toBe("empty");
    expect(inputProblem("price", 2.15)).toBeNull();
    expect(toolDef("odds-converter").compute({ price: 999999999 })).toEqual([]);
    expect(toolDef("arbitrage-calculator").compute({ p1: 999999999, p2: 1.5, p3: null, total: 1000 })).toEqual([]);
    expect(toolDef("margin-calculator").compute({ p1: 999999999, p2: 999999999, p3: 999999999 })).toEqual([]);
    expect(toolDef("ev-calculator").compute({ price: 1000, prob: 50 })[0].value.replace(/\D/g, "").length).toBeLessThan(11);
  });
  it("money, counts and rates have bounds too", () => {
    expect(inputProblem("money", 1e12)).toBe("range");
    expect(inputProblem("count", 2.5)).toBe("integer");
    expect(inputProblem("rate", 500)).toBe("range");
    expect(inputProblem("percent", 100)).toBe("range");
  });
});

describe("B8 / M6 · the tennis rows of our model reach the board", () => {
  beforeEach(() => vi.resetModules());
  it("Kalieva–Korpatsch: the sealed Elo row is kept over its partner twin, with the twin's market, book prices and the gap", async () => {
    const partner: TennisBoardSourceRow = {
      id: "tennis:partner:2026-10-08_elvina kalieva|tamara korpatsch", tournament: "Partner feed", kickoff: "2026-10-08T02:00:00Z",
      player1: "Elvina Kalieva", player2: "Tamara Korpatsch", p1: 0.462, p2: 0.538, odds_p1: 1.98, odds_p2: 1.7, edge: null,
      model_version: "partner-market-v1", computed_at: "2026-10-07T10:01:45Z", odds_bookmaker: "fortuneplay", surfaced_pick: null,
      model_p1: null, model_p2: null, model_as_of: null, sealed_at: "2026-10-07T10:01:45Z", sealed_p1: 0.48, sealed_p2: 0.52,
      sealed_odds: 1.7, sealed_signal_type: "paper", partner_tournament: "WTA Ningbo - Hard",
    };
    const elo: TennisBoardSourceRow = {
      ...partner, id: "tennis:espn:185281:elvina-kalieva:tamara-korpatsch", tournament: "WTA Ningbo", p1: 0.4047, p2: 0.5953,
      odds_p1: null, odds_p2: null, model_version: "elo_surface_v4_features_odds", odds_bookmaker: null, computed_at: "2026-10-07T08:00:00Z",
      sealed_at: "2026-10-07T08:01:42Z", sealed_p1: 0.44, sealed_p2: 0.56, sealed_odds: null, sealed_signal_type: "paper", partner_tournament: null,
    };
    const key = "2026-10-08:elvina kalieva|tamara korpatsch";
    const fm: FpMatch = { teamPairKey: key, homeKey: "", awayKey: "", sport: "tennis", slug: "", id: 0, urnId: "", oddsHome: 2.0, oddsDraw: null, oddsAway: 1.72, totalLine: null, totalOver: null, totalUnder: null, homeName: "Elvina Kalieva", awayName: "Tamara Korpatsch", startTime: null };
    vi.doMock("./queries", () => ({
      fetchBoardSources: async () => [],
      fetchTennisBoardSources: async () => [partner, elo],
      fetchBoardExcluded: async () => [],
      fetchLatestPartnerPrices: async () => [],
      fetchPartnerHistoryByKeys: async () =>
        new Map([[key, [{ team_pair_key: key, bookmaker: "fortuneplay", home_name: "Elvina Kalieva", away_name: "Tamara Korpatsch", odds_home: 1.95, odds_draw: null, odds_away: 1.75, captured_at: "2026-10-07T07:01:00Z" }]]]),
    }));
    vi.doMock("@/lib/price-books", async (orig) => {
      const real = (await orig()) as Record<string, unknown>;
      const map = new Map([[key, fm]]);
      return { ...real, fetchAllPriceBooks: async () => [{ book: { key: "fortuneplay", name: "FortunePlay", landing: "https://fp", platform: "betconstruct" }, map }] };
    });
    const { buildBoardResponse } = await import("./board-service");
    const b = await buildBoardResponse(NOW);
    expect(b.tennis.map((t) => t.id)).toEqual([elo.id]);
    const t = b.tennis[0];
    expect(t.sides[0].sealed_p).toBe(0.44);
    expect(t.sides[0].market_p).not.toBeNull();
    expect(t.sides[0].gap_pp).not.toBeNull();
    expect(t.sides[0].book_prices[0]?.price).toBe(2.0);
    expect(b.coverage.tennis.matches).toBe(b.tennis.length);
    vi.doUnmock("./queries");
    vi.doUnmock("@/lib/price-books");
  });
  it("a row past the board window (kick-off > 150 min ago) is not in the payload, so the counts match", async () => {
    const old: TennisBoardSourceRow = {
      id: "tennis:partner:old", tournament: "Partner feed", kickoff: "2026-10-07T11:00:00Z", player1: "A B", player2: "C D", p1: 0.5, p2: 0.5,
      odds_p1: 1.9, odds_p2: 1.9, edge: null, model_version: "partner-market-v1", computed_at: "2026-10-07T10:00:00Z", odds_bookmaker: null,
      surfaced_pick: null, model_p1: null, model_p2: null, model_as_of: null, sealed_at: null, sealed_p1: null, sealed_p2: null, sealed_odds: null, sealed_signal_type: null,
    };
    vi.doMock("./queries", () => ({
      fetchBoardSources: async () => [],
      fetchTennisBoardSources: async () => [old, { ...old, id: "tennis:partner:new", kickoff: "2026-10-07T16:00:00Z", player1: "E F" }],
      fetchBoardExcluded: async () => [],
      fetchLatestPartnerPrices: async () => [],
      fetchPartnerHistoryByKeys: async () => new Map(),
    }));
    vi.doMock("@/lib/price-books", async (orig) => ({ ...((await orig()) as Record<string, unknown>), fetchAllPriceBooks: async () => [] }));
    const { buildBoardResponse } = await import("./board-service");
    const b = await buildBoardResponse(NOW);
    expect(b.tennis.map((t) => t.id)).toEqual(["tennis:partner:new"]);
    expect(b.coverage.tennis.matches).toBe(1);
    vi.doUnmock("./queries");
    vi.doUnmock("@/lib/price-books");
  });
});

describe("tennis rows in the view: started → no best price", () => {
  it("tennisRows with now", () => {
    const m = { id: "t", sport: "tennis", kickoff: "2026-10-07T14:00:00Z", sides: [{ side: "p1", market_p: 0.6, best_price: { price: 1.5 }, book_prices: [] }, { side: "p2", market_p: 0.4, best_price: null, book_prices: [] }], focus: "p1" } as never;
    expect(tennisRows([m], "UTC", NOW)[0].best).toBeNull();
  });
});

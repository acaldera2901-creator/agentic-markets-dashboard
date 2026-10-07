// #REDESIGN-V3C fixdata3 — the data defects of QA-REPORT-3 (R2/B6 tennis twins with inverted names, R3 the age of
// a tennis market), each with the case that failed before the fix. Rows shaped on the real ones (SELECT 07/10), no DB.
import { describe, expect, it, vi } from "vitest";
import type { PartnerPriceRow } from "./board";
import { buildTennisBoardMatch, type TennisBoardSourceRow } from "./tennis";
import { dedupeTennisRows } from "./tennis-estimate";
import { dedupePartnerRelistings, oneRowPerMatch } from "./fixdata2";
import { ageHhMm, marketAgeMin, marketFresh, playerKey, tennisPairId, TENNIS_MARKET_MAX_AGE_H } from "./fixdata3";
import { findMatch } from "./match-view";
import { PARTNER_MARKET_MODEL } from "@/lib/partner-market";

const NOW = new Date("2026-10-07T17:00:00Z");
const FRESH = "2026-10-07T16:50:00Z";
const ELO = "elo_surface_v4_features_odds";

const row = (o: Partial<TennisBoardSourceRow> & Pick<TennisBoardSourceRow, "id" | "player1" | "player2" | "kickoff">): TennisBoardSourceRow => ({
  tournament: "Suzhou Open", p1: 0.5, p2: 0.5, odds_p1: null, odds_p2: null, edge: null, model_version: ELO, computed_at: "2026-10-06T09:57:00Z",
  odds_bookmaker: null, surfaced_pick: null, model_p1: null, model_p2: null, model_as_of: null, sealed_at: null, sealed_p1: null, sealed_p2: null,
  sealed_odds: null, sealed_signal_type: null, ...o,
});

// Bai Zhuoxuan – Emerson Jones, 8/10 02:00 (tennis_predictions 07/10): the Elo row (ESPN) has the family name first
// and no price; the partner row has «Zhuoxuan Bai» and 2.23/1.53. The board showed both: «no market» and 2.23/1.53.
const baiElo = row({ id: "tennis:espn:185274:bai-zhuoxuan:emerson-jones", player1: "Bai Zhuoxuan", player2: "Emerson Jones", kickoff: "2026-10-08T02:00:00Z" });
const baiPartner = row({
  id: "tennis:partner:2026-10-08_emerson jones|zhuoxuan bai", tournament: "Partner feed", player1: "Zhuoxuan Bai", player2: "Emerson Jones", kickoff: "2026-10-08T02:00:00Z",
  odds_p1: 2.23, odds_p2: 1.53, p1: 0.4, p2: 0.6, model_version: PARTNER_MARKET_MODEL, computed_at: "2026-10-06T14:01:04Z",
});
// Bu Yunchaokete – Luca Van Assche: partner 8/10 02:00 (Van Assche listed first) and ESPN 8/10 10:00 (Bu first, family name first)
const buPartner = row({
  id: "tennis:partner:2026-10-08_luca van assche|yunchaokete bu", tournament: "Partner feed", player1: "Luca Van Assche", player2: "Yunchaokete Bu", kickoff: "2026-10-08T02:00:00Z",
  odds_p1: 2.25, odds_p2: 1.52, model_version: PARTNER_MARKET_MODEL, computed_at: "2026-10-06T14:00:46Z",
});
const buElo = row({
  id: "tennis:espn:184868:bu-yunchaokete:luca-van-assche", tournament: "Rolex Shanghai Masters", player1: "Bu Yunchaokete", player2: "Luca Van Assche", kickoff: "2026-10-08T10:00:00Z",
  odds_p1: 1.69, odds_p2: 2.29, computed_at: "2026-10-05T05:24:10Z",
});

describe("R2/B6 · a tennis pair is the same match whatever the order of the players and of their names", () => {
  it("playerKey/tennisPairId ignore token order and side order, and keep different players apart", () => {
    expect(playerKey("Bai Zhuoxuan")).toBe(playerKey("Zhuoxuan Bai"));
    expect(tennisPairId("Bai Zhuoxuan", "Emerson Jones")).toBe(tennisPairId("Emerson Jones", "Zhuoxuan Bai"));
    expect(tennisPairId("Bu Yunchaokete", "Luca Van Assche")).toBe(tennisPairId("Luca Van Assche", "Yunchaokete Bu"));
    expect(tennisPairId("Emerson Jones", "Mai Hontama")).not.toBe(tennisPairId("Emerson Jones", "Zhuoxuan Bai"));
    expect(playerKey("Jack Pinnington-Jones")).toBe(playerKey("Jack Pinnington Jones"));
  });
  it("dedupeTennisRows pairs the Elo row with its partner twin when the names are inverted (Bai, Bu)", () => {
    const d = dedupeTennisRows([baiElo, baiPartner, buElo, buPartner], () => false);
    // before: dropped.size 0 — four rows, two matches
    expect(d.kept.map((r) => r.id).sort()).toEqual([baiPartner.id, buPartner.id].sort());
    expect(d.dropped.get(baiElo.id)).toBe(baiPartner.id);
    expect(d.dropped.get(buElo.id)).toBe(buPartner.id);
  });
  it("a partner re-listing with the players swapped and the names inverted is still one listing", () => {
    const later = { ...buPartner, id: "tennis:partner:2026-10-08_x", player1: "Bu Yunchaokete", player2: "Van Assche Luca", kickoff: "2026-10-08T05:00:00Z", computed_at: "2026-10-07T10:00:00Z" };
    const r = dedupePartnerRelistings([buPartner, later], PARTNER_MARKET_MODEL);
    expect(r.kept.map((x) => x.id)).toEqual([later.id]);
  });
  it("«Live now» lists the inverted twins once", () => {
    const rows = oneRowPerMatch([
      { id: baiPartner.id, sport: "tennis" as const, home: "Zhuoxuan Bai", away: "Emerson Jones" },
      { id: baiElo.id, sport: "tennis" as const, home: "Bai Zhuoxuan", away: "Emerson Jones" },
    ]);
    expect(rows).toHaveLength(1);
  });
  it("the board: one row per match, the dropped ids resolve to it (match page, price check, OG), the books oriented by name", async () => {
    // FortunePlay lists «Zhuoxuan Bai – Emerson Jones» at 2.30/1.60 under the partner key
    const fp: PartnerPriceRow = {
      team_pair_key: "2026-10-08:emerson jones|zhuoxuan bai", bookmaker: "fortuneplay", home_name: "Zhuoxuan Bai", away_name: "Emerson Jones",
      odds_home: 2.3, odds_draw: null, odds_away: 1.6, captured_at: FRESH, source: "price_history",
    };
    vi.resetModules();
    vi.doMock("./queries", () => ({
      fetchBoardSources: async () => [],
      fetchTennisBoardSources: async () => [baiElo, baiPartner, buElo, buPartner],
      fetchBoardExcluded: async () => [],
      fetchLatestPartnerPrices: async () => [fp],
      fetchPartnerHistoryByKeys: async () => new Map(),
    }));
    vi.doMock("@/lib/price-books", async (orig) => ({
      ...((await orig()) as Record<string, unknown>),
      fetchAllPriceBooks: async () => [{ book: { key: "fortuneplay", landing: "https://fortuneplay.example", matchUrlBase: null, stag: null }, map: new Map() }],
    }));
    const { buildBoardResponse } = await import("./board-service");
    const b = await buildBoardResponse(NOW);
    vi.doUnmock("./queries");
    vi.doUnmock("@/lib/price-books");
    const pairs = b.tennis.map((t) => tennisPairId(t.player1, t.player2));
    expect(new Set(pairs).size).toBe(pairs.length); // no match twice
    expect(b.tennis).toHaveLength(2);
    for (const id of [baiElo.id, baiPartner.id]) expect(findMatch(b, id)?.m.id).toBe(findMatch(b, baiPartner.id)?.m.id);
    for (const id of [buElo.id, buPartner.id]) expect(findMatch(b, id)?.m.id).toBe(findMatch(b, buPartner.id)?.m.id);
    const bai = b.tennis.find((t) => tennisPairId(t.player1, t.player2) === tennisPairId("Bai Zhuoxuan", "Emerson Jones"));
    const baiSide = bai?.sides.find((s) => playerKey(s.player) === playerKey("Bai Zhuoxuan"));
    expect(baiSide?.book_prices[0]?.price).toBe(2.3);
  });
});

describe("R3 · the age of a tennis market", () => {
  it("the age is measured at the reading, or at the start once play has begun; 6 h is the line", () => {
    expect(TENNIS_MARKET_MAX_AGE_H).toBe(6);
    expect(marketAgeMin("2026-10-07T11:00:00Z", "2026-10-08T02:00:00Z", NOW)).toBe(360);
    expect(marketFresh("2026-10-07T11:00:00Z", "2026-10-08T02:00:00Z", NOW)).toBe(true);
    expect(marketFresh("2026-10-07T10:59:00Z", "2026-10-08T02:00:00Z", NOW)).toBe(false);
    // started at 13:15: a 11:12 price is 2:03 old at the start, however late we read it
    expect(marketAgeMin("2026-10-07T11:12:00Z", "2026-10-07T13:15:00Z", NOW)).toBe(123);
    expect(marketFresh(null, "2026-10-08T02:00:00Z", NOW)).toBe(false);
    expect(ageHhMm(3127)).toBe("52:07");
    expect(ageHhMm(5)).toBe("00:05");
  });
  it("Bu–Van Assche: the 1.69/2.29 stored on 5/10 is not the market when the books pay 1.60/2.40 — the books' market, declared", () => {
    const key = "2026-10-08:bu yunchaokete|luca van assche";
    const fp: PartnerPriceRow = { team_pair_key: key, bookmaker: "fortuneplay", home_name: "Bu Yunchaokete", away_name: "Luca Van Assche", odds_home: 1.6, odds_draw: null, odds_away: 2.4, captured_at: FRESH, source: "live_feed" };
    const m = buildTennisBoardMatch(buElo, [fp], NOW);
    // before: market_from «stored», market_price 1.69 (2½ days old)
    expect(m.market_from).toBe("books");
    expect(m.sides[0].market_price).toBe(1.6);
  });
  it("an old stored price and no book: «may be outdated» with its age, no estimate and no gap on it", () => {
    const withElo = { ...buElo, elo_p1: 0.55, elo_p2: 0.45, elo_as_of: "2026-10-07T15:00:00Z", elo_home: "Bu Yunchaokete" };
    const m = buildTennisBoardMatch(withElo, [], NOW);
    expect(m.market_from).toBe("stale");
    expect(m.market_age_min).toBe(marketAgeMin(buElo.computed_at, buElo.kickoff, NOW));
    expect(m.sides[0].market_price).toBe(1.69);
    // before: estimate_kind «elo_blend_unsealed» with a gap computed on the 5/10 price
    expect(m.estimate_kind).toBe("market_only");
    expect(m.estimate_p).toBeNull();
    expect(m.gap_pp).toBeNull();
  });
  it("a fresh stored price stays the market, with its age", () => {
    const fresh = { ...buElo, computed_at: "2026-10-07T15:30:00Z", elo_p1: 0.55, elo_p2: 0.45, elo_as_of: "2026-10-07T15:00:00Z", elo_home: "Bu Yunchaokete" };
    const m = buildTennisBoardMatch(fresh, [], NOW);
    expect(m.market_from).toBe("stored");
    expect(m.market_age_min).toBe(90);
    expect(m.estimate_kind).toBe("elo_blend_unsealed");
  });
  it("no stored price and no book: no market at all (unchanged)", () => {
    const m = buildTennisBoardMatch(baiElo, [], NOW);
    expect(m.market_from).toBeNull();
    expect(m.market_age_min ?? null).toBeNull();
  });
});

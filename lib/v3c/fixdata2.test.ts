// #REDESIGN-V3C fixdata2 — the data/logic defects of QA-REPORT-2 (N2 N3 N4 N9 N10 N11, B6 residual),
// each with the case that failed before the fix. Fictitious rows shaped on the real ones (SELECT 07/10), no DB.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildBoardMatch, type BoardSourceRow, type PartnerPriceRow } from "./board";
import { buildTennisBoardMatch, type TennisBoardSourceRow } from "./tennis";
import { valueToolsAllowed } from "./fixdata";
import { bookImpliedMarket, dedupePartnerRelistings, estimateShown, fairFarFromBest, oneRowPerMatch, pcStartPrices, sealedTennisGuard, saneMarketSet, startedNoteKind } from "./fixdata2";
import { findMatch } from "./match-view";
import { tennisReceipt, type TennisReceiptRow } from "./receipts";
import { teamPairKey } from "@/lib/team-pair-key";
import type { V3BoardResponse, V3BookPrice } from "./contracts";
import type { V3LiveItem } from "./live-contract";

const NOW = new Date("2026-10-07T14:52:00Z");
const FRESH = "2026-10-07T14:40:00Z";

// Crystal Palace – Nottingham Forest, 11/10 (API preview 07/10 15:26): no stored market, raw model 20/21/59,
// partner books 2.68/3.35/2.64 (FortunePlay) … 2.57/3.25/2.61 (RollXO).
const palace = (over: Partial<BoardSourceRow> = {}): BoardSourceRow => ({
  id: "oddsapi:palace", league: "Premier League", competition: "Premier League", kickoff: "2026-10-11T13:00:00Z",
  home: "Crystal Palace FC", away: "Nottingham Forest FC", computed_at: "2026-10-07T12:00:00Z",
  odds_home: null, odds_draw: null, odds_away: null,
  model_p_home: 0.1987, model_p_draw: 0.2142, model_p_away: 0.5871,
  p_home: 0.1987, p_draw: 0.2142, p_away: 0.5871, sealed_at: null, ...over,
});
const fbRow = (bookmaker: string, odds: [number, number, number], r = palace()): PartnerPriceRow => ({
  team_pair_key: teamPairKey("soccer", r.home, r.away, r.kickoff) as string, bookmaker, home_name: r.home, away_name: r.away,
  odds_home: odds[0], odds_draw: odds[1], odds_away: odds[2], captured_at: FRESH, source: "live_feed",
});
const BOOKS = [fbRow("fortuneplay", [2.68, 3.35, 2.64]), fbRow("ybets", [2.63, 3.29, 2.59])];

describe("N3 · a football match without a stored market", () => {
  it("Palace–Forest: the market comes from the partner books' real prices; the guard runs on it (no «59%, fair 1.70» beside 2.64)", () => {
    const m = buildBoardMatch(palace(), BOOKS, NOW);
    const away = m.outcomes[2];
    // before: market_p null, estimate 0.5871 (the raw model), no guard
    expect(away.market_p).not.toBeNull();
    expect(away.market_p as number).toBeGreaterThan(0.34);
    expect(away.market_p as number).toBeLessThan(0.38);
    expect(m.market_from).toBe("books");
    expect(away.market_price).toBe(2.64); // the best REAL price, not a composite
    expect(m.margin_removed).not.toBeNull();
    // the same declared blend, on the books' market: 0.3·0.5871 + 0.7·market
    expect(away.estimate_p).toBeCloseTo(0.3 * 0.5871 + 0.7 * (away.market_p as number), 3);
    expect(m.model_guard?.level).toBe("no_value"); // |59 − 36| ≈ 23 pp
    expect(valueToolsAllowed(m)).toBe(false);
    expect(1 / away.estimate_p).toBeGreaterThan(2.2); // the fair price is no longer 1.70
  });
  it("Augsburg–Bayern: no market and no book → «no_market»: no estimate, no fair price, no EV/Kelly", () => {
    const m = buildBoardMatch(palace({ id: "oddsapi:aug" }), [], NOW);
    expect(m.model_guard?.level).toBe("no_market");
    expect(estimateShown(m)).toBe(false);
    expect(valueToolsAllowed(m)).toBe(false);
    expect(m.market_from).toBeNull();
  });
  it("the fair price of the estimate > 25% from the best real price → market only, no estimate shown", () => {
    // stored market 50% on home (1.95), books ≈ 36% (2.68): 14 pp apart, so the stored market stays; the raw model is
    // 60% (10 pp from the stored market: guard «ok»), estimate 53% → fair 1.89 beside a real 2.68 (29% away)
    const m = buildBoardMatch(
      palace({ odds_home: 1.95, odds_draw: 3.5, odds_away: 4.4, model_p_home: 0.6, model_p_draw: 0.22, model_p_away: 0.18, p_home: 0.53, p_draw: 0.25, p_away: 0.22 }),
      BOOKS,
      NOW,
    );
    expect(m.model_guard?.reason).toBe("price_far");
    expect(m.model_guard?.level).toBe("market_only");
    expect(estimateShown(m)).toBe(false);
    expect(m.outcomes[0].estimate_p).toBe(m.outcomes[0].market_p);
  });
  it("fairFarFromBest leaves long shots alone (< 10%)", () => {
    expect(fairFarFromBest([{ estimate_p: 0.05, best_price: { price: 14 } }])).toBe(false);
    expect(fairFarFromBest([{ estimate_p: 0.59, best_price: { price: 2.64 } }])).toBe(true);
    expect(fairFarFromBest([{ estimate_p: 0.43, best_price: { price: 2.64 } }])).toBe(false);
  });
});

describe("N10 · impossible stored prices", () => {
  it("a stored market far (> 15 pp) from the books is replaced by the books' market", () => {
    const m = buildBoardMatch(palace({ odds_home: 1.3, odds_draw: 5.0, odds_away: 9.0, p_home: 0.7, p_draw: 0.18, p_away: 0.12 }), BOOKS, NOW);
    // before: market 73% on Palace from the stored 1.30
    expect(m.outcomes[0].market_p as number).toBeLessThan(0.4);
    expect(m.market_from).toBe("books");
  });
  it("Ann Li 45.71 / Svitolina 1.02 on the Elo row (07/10): the books say 27/73 → the market shown is the books'", () => {
    const row: TennisBoardSourceRow = {
      id: "tennis:espn:184354:ann-li:elina-svitolina", tournament: "WTA China Open", kickoff: "2026-10-07T16:40:00Z", player1: "Ann Li", player2: "Elina Svitolina",
      p1: 0.0218, p2: 0.9782, odds_p1: 45.71, odds_p2: 1.02, edge: null, model_version: "elo_surface_v4_features_odds", computed_at: "2026-10-05T10:56:38Z",
      odds_bookmaker: "pinnacle", surfaced_pick: null, model_p1: 0.3, model_p2: 0.7, model_as_of: null, sealed_at: null, sealed_p1: null, sealed_p2: null, sealed_odds: null, sealed_signal_type: null,
    };
    const key = teamPairKey("tennis", "Ann Li", "Elina Svitolina", row.kickoff) as string;
    const fp: PartnerPriceRow = { team_pair_key: key, bookmaker: "fortuneplay", home_name: "Ann Li", away_name: "Elina Svitolina", odds_home: 3.35, odds_draw: null, odds_away: 1.24, captured_at: FRESH, source: "live_feed" };
    const m = buildTennisBoardMatch(row, [fp], NOW);
    // before: market_p 0.978 («market 98%»)
    expect(m.sides[1].market_p as number).toBeLessThan(0.8);
    expect(m.market_from).toBe("books");
  });
  it("a book price outside 0.5–99% implied is dropped, the match stays; a book with an impossible overround gives no price", () => {
    const m = buildBoardMatch(palace(), [fbRow("fortuneplay", [1.005, 3.35, 2.64]), fbRow("ybets", [2.63, 3.29, 2.59])], NOW);
    expect(m.outcomes[0].book_prices.map((b) => b.bookmaker)).toEqual(["ybets"]);
    const arb = buildBoardMatch(palace(), [fbRow("fortuneplay", [4.0, 4.0, 4.0])], NOW); // overround −25%: impossible for one book
    expect(arb.outcomes.every((o) => o.book_prices.length === 0)).toBe(true);
    expect(saneMarketSet([45.71, 1.02])).toBe(true); // a sane pair alone: caught by the cross-check, not here
    expect(saneMarketSet([4, 4, 4])).toBe(false);
  });
});

describe("N9 · the sealed Elo of our tennis model under the guard", () => {
  // Blinkova–Werner 08/10 (pick_ledger 07/10 12:01): sealed Elo 59/41, no price on the Elo row; partner twin 1.10/5.40
  const blinkova: TennisBoardSourceRow = {
    id: "tennis:espn:185246:anna-blinkova:caroline-werner", tournament: "WTA Ningbo", kickoff: "2026-10-08T04:00:00Z", player1: "Anna Blinkova", player2: "Caroline Werner",
    p1: 0.5947, p2: 0.4053, odds_p1: null, odds_p2: null, edge: null, model_version: "elo_surface_v4_features_odds", computed_at: "2026-10-07T11:45:12Z", odds_bookmaker: null,
    surfaced_pick: "Anna Blinkova", model_p1: 0.6, model_p2: 0.4, model_as_of: null, sealed_at: "2026-10-07T12:01:53Z", sealed_p1: 0.59, sealed_p2: 0.41, sealed_odds: null, sealed_signal_type: "paper",
    borrowed_market: { odds_p1: 1.1, odds_p2: 5.4, bookmaker: null, as_of: "2026-10-07T14:00:57Z" },
  };
  it("Blinkova 59% sealed vs market 83% (24.1 pp): no gap, the «no value» guard (before: no guard at all)", () => {
    const m = buildTennisBoardMatch(blinkova, [], NOW);
    expect(m.sealed_guard?.level).toBe("no_value");
    expect(m.sealed_guard?.delta_pp).toBeCloseTo(24.1, 1);
  });
  it("over 25 pp the sealed number is not shown (the board's «Market only»); no market at all → «no_market»", () => {
    const far = buildTennisBoardMatch({ ...blinkova, sealed_p1: 0.5, sealed_p2: 0.5 }, [], NOW);
    expect(far.sealed_guard?.level).toBe("market_only");
    const none = buildTennisBoardMatch({ ...blinkova, borrowed_market: undefined }, [], NOW);
    expect(none.sealed_guard?.level).toBe("no_market");
    expect(sealedTennisGuard(0.55, 0.5, 0.83).level).toBe("ok"); // the market at seal wins over the row's
  });
  it("record: a sealed tennis gap wider than 25 pp is not printed as a gap", () => {
    const r: TennisReceiptRow = {
      source_id: "tennis:espn:1:a:b", model_version: "elo_surface_v4_features_odds", home_team: "A B", away_team: "C D", pick: "A B", p: 0.59, result: "lost",
      odds: null, signal_type: "paper", captured_at: "2026-10-07T12:00:00Z", commence_time: "2026-10-08T04:00:00Z", source_table: "tennis_predictions",
      competition: null, final_score: null, revision: 1, p_home: 0.59, p_away: 0.41,
    };
    const key = teamPairKey("tennis", "A B", "C D", r.commence_time) as string;
    const hist: PartnerPriceRow = { team_pair_key: key, bookmaker: "fortuneplay", home_name: "A B", away_name: "C D", odds_home: 1.08, odds_draw: null, odds_away: 7.5, captured_at: "2026-10-07T11:30:00Z" };
    const rc = tennisReceipt(r, [hist]);
    expect(rc.market_p as number).toBeGreaterThan(0.85);
    expect(rc.gap_pp).toBeNull();
    expect(rc.gap_null_reason).toBe("model_far");
  });
});

describe("N2 · one number per match", () => {
  beforeEach(() => vi.resetModules());
  // Altmaier–Rune 07/10, start 13:15: tennis_predictions held the in-play 6.41/1.16 at 14:34–15:00, the last
  // pre-start snapshot (11:12) 2.73/1.51. The board said 85%, the page (after 15:00) 55%.
  const rune: TennisBoardSourceRow = {
    id: "tennis:espn:184885:daniel-altmaier:holger-rune", tournament: "ATP Shanghai", kickoff: "2026-10-07T13:15:00Z", player1: "Daniel Altmaier", player2: "Holger Rune",
    p1: 0.4458, p2: 0.5542, odds_p1: 6.41, odds_p2: 1.16, edge: null, model_version: "elo_surface_v4_features_odds", computed_at: "2026-10-05T05:24:10Z", odds_bookmaker: "betfair_ex_eu",
    surfaced_pick: null, model_p1: 0.2872, model_p2: 0.7128, model_as_of: "2026-10-07T14:34:42Z", sealed_at: null, sealed_p1: null, sealed_p2: null, sealed_odds: null, sealed_signal_type: null,
    elo_p1: 0.2872, elo_p2: 0.7128, elo_as_of: "2026-10-07T11:12:28Z", elo_home: "Daniel Altmaier", pre_odds_p1: 2.73, pre_odds_p2: 1.51,
  };
  it("a started Elo row reads the last pre-start price, not the in-play one written into tennis_predictions", () => {
    const inPlay = buildTennisBoardMatch(rune, [], NOW);
    const after = buildTennisBoardMatch({ ...rune, odds_p1: 2.2, odds_p2: 1.77 }, [], NOW);
    // before: 1.16 / 85% at 14:57, then 1.77 / 55% at 15:08 — two numbers for one match
    expect(inPlay.sides[1].market_price).toBe(1.51);
    expect(after.sides[1].market_price).toBe(1.51);
    expect(inPlay.sides[1].market_p).toBe(after.sides[1].market_p);
    expect(inPlay.market_from).toBe("pre_start");
    expect(inPlay.sides[1].book_prices).toEqual([]); // started: no pre-match price in the API either
  });
  it("two twin rows with different prices: the board shows one, and the page/OG of the dropped id read that same row", async () => {
    const partner: TennisBoardSourceRow = {
      ...rune, id: "tennis:partner:2026-10-07_daniel altmaier|holger rune", tournament: "Partner feed", kickoff: "2026-10-07T16:00:00Z", player1: "Holger Rune", player2: "Daniel Altmaier",
      p1: 0.6835, p2: 0.3165, odds_p1: 1.32, odds_p2: 2.85, model_version: "partner-market-v1", odds_bookmaker: null, model_p1: null, model_p2: null, elo_p1: null, elo_p2: null, elo_as_of: null, elo_home: null, pre_odds_p1: null, pre_odds_p2: null,
    };
    const elo = { ...rune, kickoff: "2026-10-07T16:15:00Z", odds_p1: 2.2, odds_p2: 1.77, elo_as_of: "2026-10-07T14:00:00Z" };
    vi.doMock("./queries", () => ({
      fetchBoardSources: async () => [],
      fetchTennisBoardSources: async () => [partner, elo],
      fetchBoardExcluded: async () => [],
      fetchLatestPartnerPrices: async () => [],
      fetchPartnerHistoryByKeys: async () => new Map(),
    }));
    vi.doMock("@/lib/price-books", async (orig) => ({ ...((await orig()) as Record<string, unknown>), fetchAllPriceBooks: async () => [] }));
    const { buildBoardResponse } = await import("./board-service");
    const b = await buildBoardResponse(NOW);
    expect(b.tennis).toHaveLength(1);
    const shown = b.tennis[0];
    const dropped = shown.id === elo.id ? partner.id : elo.id;
    // before: findMatch(board, droppedId) = null → the page fell back to the fixture, another number
    const viaDropped = findMatch(b, dropped);
    expect(viaDropped?.m.id).toBe(shown.id);
    expect(viaDropped?.sport === "tennis" ? viaDropped.m.sides[0].market_p : NaN).toBe(shown.sides[0].market_p);
    vi.doUnmock("./queries");
    vi.doUnmock("@/lib/price-books");
  });
  it("B6: the partner feed re-listing Cook–Sekulic on 7/10 and 8/10 → one row on the board, the old id an alias", async () => {
    const base: TennisBoardSourceRow = {
      id: "tennis:partner:2026-10-07_ethan cook|philip sekulic", tournament: "Partner feed", kickoff: "2026-10-07T14:57:00Z", player1: "Ethan Cook", player2: "Philip Sekulic",
      p1: 0.16, p2: 0.84, odds_p1: 5.6, odds_p2: 1.09, edge: null, model_version: "partner-market-v1", computed_at: "2026-10-07T10:00:53Z", odds_bookmaker: null,
      surfaced_pick: null, model_p1: null, model_p2: null, model_as_of: null, sealed_at: null, sealed_p1: null, sealed_p2: null, sealed_odds: null, sealed_signal_type: null,
    };
    const later = { ...base, id: "tennis:partner:2026-10-08_ethan cook|philip sekulic", kickoff: "2026-10-08T05:30:00Z", computed_at: "2026-10-07T12:00:52Z", odds_p1: 6.3, odds_p2: 1.085 };
    vi.doMock("./queries", () => ({
      fetchBoardSources: async () => [],
      fetchTennisBoardSources: async () => [base, later],
      fetchBoardExcluded: async () => [],
      fetchLatestPartnerPrices: async () => [],
      fetchPartnerHistoryByKeys: async () => new Map(),
    }));
    vi.doMock("@/lib/price-books", async (orig) => ({ ...((await orig()) as Record<string, unknown>), fetchAllPriceBooks: async () => [] }));
    const { buildBoardResponse } = await import("./board-service");
    const b = await buildBoardResponse(NOW);
    // before: both rows on the board (QA-2 B6)
    expect(b.tennis.map((t) => t.id)).toEqual([later.id]);
    expect(b.aliases?.[base.id]).toBe(later.id);
    vi.doUnmock("./queries");
    vi.doUnmock("@/lib/price-books");
  });
  it("findMatch resolves an alias chain and leaves unknown ids alone", () => {
    const board = { matches: [{ id: "c" }], tennis: [], aliases: { a: "b", b: "c" } } as unknown as V3BoardResponse;
    expect(findMatch(board, "a")?.m.id).toBe("c");
    expect(findMatch(board, "zzz")).toBeNull();
  });
});

describe("B6 residual · tennis re-listed by the partner feed, and «Live now» once per match", () => {
  const row = (id: string, kickoff: string, computed_at: string) => ({ id, player1: "Ethan Cook", player2: "Philip Sekulic", kickoff, computed_at, model_version: "partner-market-v1" });
  it("Cook–Sekulic 7/10 14:57 and 8/10 05:30: the later listing stays", () => {
    const d = dedupePartnerRelistings([row("t7", "2026-10-07T14:57:00Z", "2026-10-07T10:00:53Z"), row("t8", "2026-10-08T05:30:00Z", "2026-10-07T12:00:52Z")], "partner-market-v1");
    expect(d.kept.map((r) => r.id)).toEqual(["t8"]);
    expect(d.dropped.get("t7")).toBe("t8");
  });
  it("an Elo row is never merged here, and two listings 3 days apart are two matches", () => {
    const d = dedupePartnerRelistings([{ ...row("e", "2026-10-07T14:57:00Z", "2026-10-07T10:00:00Z"), model_version: "elo" }, row("p", "2026-10-07T15:00:00Z", "2026-10-07T10:00:00Z"), row("p3", "2026-10-10T15:00:00Z", "2026-10-07T11:00:00Z")], "partner-market-v1");
    expect(d.kept.map((r) => r.id)).toEqual(["e", "p", "p3"]);
  });
  it("«Live now»: Ann Li–Svitolina once, not as «Partner feed» and «China Open»", () => {
    const rows = oneRowPerMatch([
      { id: "tennis:partner:x", sport: "tennis" as const, home: "Ann Li", away: "Elina Svitolina" },
      { id: "tennis:espn:y", sport: "tennis" as const, home: "Elina Svitolina", away: "Ann Li" },
      { id: "oddsapi:z", sport: "football" as const, home: "A", away: "B" },
    ]);
    expect(rows.map((r) => r.id)).toEqual(["tennis:partner:x", "oddsapi:z"]);
    // the twin with a live score is the one kept (the match never drops out of «Live now»)
    const withScore = oneRowPerMatch(
      [
        { id: "tennis:partner:x", sport: "tennis" as const, home: "Ann Li", away: "Elina Svitolina" },
        { id: "tennis:espn:y", sport: "tennis" as const, home: "Elina Svitolina", away: "Ann Li" },
      ],
      (id) => id === "tennis:espn:y",
    );
    expect(withScore.map((r) => r.id)).toEqual(["tennis:espn:y"]);
  });
});

describe("N4 · the price check opens on a price a book really offers", () => {
  const bp = (bookmaker: string, price: number, url = "https://x.example/a"): V3BookPrice => ({ bookmaker, name: bookmaker, price, captured_at: FRESH, source: "live_feed", url });
  it("best real price per outcome, else an empty field (QA-2: 5.00 composite beside a best 4.50)", () => {
    expect(pcStartPrices([{ book_prices: [bp("fortuneplay", 4.5), bp("ybets", 4.4)] }, { book_prices: [] }, { book_prices: [bp("ybets", 1.8)] }])).toEqual(["4.50", "", "1.80"]);
    expect(pcStartPrices([{ book_prices: [{ ...bp("x", 9), url: "" }] }])).toEqual([""]);
  });
});

describe("N11 · the started note reads the live score", () => {
  it("a live tennis score → «live»; no item or not started → «none»", () => {
    const live = { sport: "tennis", state: "live", final_kind: null, sets: [{ p1: 6, p2: 4, tb1: null, tb2: null }, { p1: 2, p2: 1, tb1: null, tb2: null }], server: null, winner: null, source_id: "espn:1", matched_by: "names", source: "espn", updated_at: FRESH } as V3LiveItem;
    expect(startedNoteKind(live)).toBe("live");
    expect(startedNoteKind(undefined)).toBe("none");
    expect(startedNoteKind({ ...live, state: "pre", sets: [] } as V3LiveItem)).toBe("none");
  });
});

describe("bookImpliedMarket", () => {
  it("de-vigs each complete book and averages; incomplete books are left out", () => {
    const bp = (bookmaker: string, price: number): V3BookPrice => ({ bookmaker, name: bookmaker, price, captured_at: FRESH, source: "live_feed", url: "https://x" });
    const m = bookImpliedMarket([[bp("a", 2), bp("b", 1.9)], [bp("a", 2)]]);
    expect(m?.books).toEqual(["a"]);
    expect(m?.p[0]).toBeCloseTo(0.5, 6);
  });
});

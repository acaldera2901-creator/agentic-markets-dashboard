// Unified price-book registry + per-partner status (F7). Recorded fixtures
// only; global fetch throws so any live request would fail the test.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __setBookFetcherForTest } from "./betconstruct-feed";
import { __setAltenarFetcherForTest } from "./altenar-feed";
import { BOOKS, EXTRA_BOOKS } from "./betconstruct-books";
import { PARTNERS } from "./partners";
import { PARTNER_FEEDS_ENV, bookStatusFor, enabledPriceBooks, fetchAllPriceBooks, gatedFeedKeys, oddsOnSitePartners, partnerDirectory, priceBookByKey } from "./price-books";
import { buildBoardMatch, liveFeedRows, type BoardSourceRow } from "./v3c/board";
import { parseFortuneplayMatches } from "./fortuneplay-live";

const fx = (f: string) => JSON.parse(readFileSync(join(__dirname, "../tests/fixtures/partners", f), "utf8"));
const ROLLXO = fx("betconstruct_rollxo_soccer.json");
const N1 = fx("betconstruct_n1bet_soccer.json");
const ALT = fx("altenar_wildz_soccer.json");
const ALL_ON = { [PARTNER_FEEDS_ENV]: "rollxo, n1bet,WILDZ,beazt" };

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("no live access in tests"); }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  __setAltenarFetcherForTest(null);
});

describe("gate", () => {
  it("without the env var the registry is exactly today's (FortunePlay, YBets)", () => {
    expect(enabledPriceBooks({}).map((b) => b.key)).toEqual(BOOKS.map((b) => b.key));
    expect(priceBookByKey("rollxo", {})).toBeUndefined();
    expect(priceBookByKey("wildz", {})).toBeUndefined();
  });

  it("switches on only the listed gated books, case/space tolerant, never unknown keys", () => {
    expect([...gatedFeedKeys(ALL_ON)]).toEqual(["rollxo", "n1bet", "wildz", "beazt"]);
    expect(enabledPriceBooks(ALL_ON).map((b) => b.key)).toEqual(["fortuneplay", "ybets", "rollxo", "n1bet", "wildz", "beazt"]);
    expect(enabledPriceBooks({ [PARTNER_FEEDS_ENV]: "stake,roobet" }).map((b) => b.key)).toEqual(["fortuneplay", "ybets"]);
  });

  it("every enabled book has a real affiliate link (only clickable, attributed books compare)", () => {
    for (const b of enabledPriceBooks(ALL_ON)) expect(b.landing).toMatch(/^https:\/\//);
    expect(EXTRA_BOOKS.map((b) => b.landing)).toEqual(["https://rollxo.media/n1xqevdiuw", "https://n1betpartners.com/n16rrb51wa"]);
  });
});

describe("fetchAllPriceBooks", () => {
  it("gate off: never calls a gated feed", async () => {
    const seen: string[] = [];
    __setBookFetcherForTest(async (book) => { seen.push(book.key); return { data: [], pagination: { last_page: 1 } }; });
    __setAltenarFetcherForTest(async (url) => { seen.push(url); return ALT; });
    const boards = await fetchAllPriceBooks(Date.parse("2026-10-06T00:00:00Z"), {});
    expect(boards.map((b) => b.book.key)).toEqual(["fortuneplay", "ybets"]);
    expect(seen.some((k) => k === "rollxo" || k === "n1bet" || k.includes("altenar"))).toBe(false);
  });

  it("gate on: RollXO/N1 through the BetConstruct parser, Wildz/Beazt through Altenar", async () => {
    __setBookFetcherForTest(async (book, _page, sport) => {
      if (sport) return { data: [], pagination: { last_page: 1 } };
      return book.key === "rollxo" ? ROLLXO : book.key === "n1bet" ? N1 : { data: [], pagination: { last_page: 1 } };
    });
    __setAltenarFetcherForTest(async (url) => (url.includes("sportId=66") ? ALT : { events: [] }));
    const boards = await fetchAllPriceBooks(Date.parse("2026-10-06T00:00:00Z") + 1, ALL_ON);
    const size = Object.fromEntries(boards.map((b) => [b.book.key, b.map.size]));
    expect(size).toMatchObject({ rollxo: 4, n1bet: 4, wildz: 3, beazt: 3 });
    const roll = boards.find((b) => b.book.key === "rollxo")!;
    const arsenal = [...roll.map.values()].find((m) => m.homeName === "Arsenal")!;
    expect([arsenal.oddsHome, arsenal.oddsDraw, arsenal.oddsAway]).toEqual([1.34, 4.9, 7.7]);
  });
});

describe("board best price with all books", () => {
  const src = (o: Partial<BoardSourceRow> = {}): BoardSourceRow => ({
    id: "m1", league: "ESP", competition: "WCQ", kickoff: "2026-10-06T18:45:00Z", home: "Croatia", away: "Spain",
    computed_at: "2026-10-06T00:00:00Z", odds_home: 9, odds_draw: 6, odds_away: 1.27,
    model_p_home: 0.1, model_p_draw: 0.15, model_p_away: 0.75, p_home: 0.1, p_draw: 0.15, p_away: 0.75, sealed_at: null, ...o,
  });
  const NOW = new Date("2026-10-06T12:00:00Z");

  it("compares every enabled book on the fixture, best first, and lists every partner with a reason", () => {
    vi.stubEnv(PARTNER_FEEDS_ENV, "rollxo,n1bet");
    const boards = [
      { book: enabledPriceBooks()[2], map: new Map(parseFortuneplayMatches(ROLLXO).map((m) => [m.teamPairKey, m])) },
      { book: enabledPriceBooks()[3], map: new Map(parseFortuneplayMatches(N1).map((m) => [m.teamPairKey, m])) },
      { book: enabledPriceBooks()[0], map: new Map() }, // FortunePlay down
    ];
    const key = parseFortuneplayMatches(ROLLXO).find((m) => m.homeName === "Croatia")!.teamPairKey;
    const live = liveFeedRows(boards, new Set([key]), NOW);
    expect(live.missingBooks).toEqual(["fortuneplay"]);
    const m = buildBoardMatch(src(), live.rows, NOW);
    const away = m.outcomes[2];
    expect(away.book_prices.map((p) => [p.bookmaker, p.price])).toEqual([["n1bet", 1.25], ["rollxo", 1.25]]);
    expect(away.best_price?.url).toBe("https://n1betpartners.com/n16rrb51wa");

    const status = bookStatusFor(new Map([["rollxo", "live_feed"], ["n1bet", "live_feed"]]), new Set(["fortuneplay"]));
    expect(status).toHaveLength(PARTNERS.length);
    const by = Object.fromEntries(status.map((s) => [s.partner_id, s]));
    expect(status.slice(0, 2).map((s) => s.partner_id)).toEqual(["rollxo", "n1bet"]);
    expect(by.rollxo).toMatchObject({ oddsAvailable: true, reason: "live_feed" });
    expect(by.fortuneplay).toMatchObject({ oddsAvailable: false, reason: "feed_down" });
    expect(by.ybets).toMatchObject({ oddsAvailable: false, reason: "not_listed" });
    expect(by.wildz).toMatchObject({ oddsAvailable: false, reason: "pending_approval" });
    expect(by.hollywin.reason).toBe("region_restricted");
    expect(by.ggbet.reason).toBe("awaiting_partner_feed");
    expect(by.slotsbonus.reason).toBe("no_sportsbook");
    const dir = Object.fromEntries(partnerDirectory().map((p) => [p.partner_id, p]));
    expect(Object.keys(dir).sort()).toEqual(status.map((s) => s.partner_id).sort());
    expect(dir.betwinner.url).toBeNull(); // no geo-neutral link: the client resolves it by geo
    for (const p of Object.values(dir)) expect(p.logo).toMatch(/^\/logos\//);
  });

  it("odds-on-site list: no-feed and region-restricted partners with a real link, never gated or non-sportsbook", () => {
    const ids = oddsOnSitePartners().map((p) => p.partner_id).sort();
    expect(ids).toEqual(["betscore", "casea", "felicebet", "ggbet", "hollywin", "stonevegas", "velobet"]);
    for (const p of oddsOnSitePartners()) expect(p.url).toMatch(/^https:\/\//);
  });

  it("gate off: a gated book's row never becomes a price", () => {
    const rows = [{ team_pair_key: "k", bookmaker: "wildz", home_name: "Croatia", away_name: "Spain", odds_home: 50, odds_draw: 9, odds_away: 1.5, captured_at: NOW.toISOString() }];
    const m = buildBoardMatch(src(), rows, NOW);
    expect(m.outcomes.every((o) => o.book_prices.length === 0 && o.best_price === null)).toBe(true);
  });
});

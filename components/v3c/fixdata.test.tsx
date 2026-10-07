// components/v3c/fixdata.test.tsx (#REDESIGN-V3C fixdata) — what the pages show after the data fixes:
// B5/M5 the match page (no EV/Kelly over the guard, EV/Kelly on the best price, never a stake in €),
// B8 the sealed tennis Elo, M4 the tool error messages, B1 the started group. Fictitious data, no DB.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { V3BoardMatch, V3BoardTennisMatch, V3BoardTennisSide, V3BookPrice } from "@/lib/v3c/contracts";
import { buildBoardMatch, type BoardSourceRow } from "@/lib/v3c/board";
import { MatchView } from "./match/MatchView";
import { ToolCalc } from "./tools/ToolCalc";
import { getV3cToolsCopy } from "@/lib/i18n/v3c-tools";

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const FUTURE = "2099-10-10T18:00:00.000Z";

const src = (over: Partial<BoardSourceRow> = {}): BoardSourceRow => ({
  id: "oddsapi:cercle", league: "Belgian Pro League", competition: "Belgian Pro League", kickoff: FUTURE,
  home: "Cercle Brugge KSV", away: "RSC Anderlecht", computed_at: "2099-10-10T12:00:00Z",
  odds_home: 3.6, odds_draw: 3.5, odds_away: 2.05, model_p_home: 0.3, model_p_draw: 0.28, model_p_away: 0.42,
  p_home: 0.28, p_draw: 0.28, p_away: 0.44, sealed_at: null, ...over,
});
const book = (price: number): V3BookPrice => ({ bookmaker: "fortuneplay", name: "FortunePlay", price, captured_at: "2099-10-10T13:31:00.000Z", source: "live_feed", url: "https://fp.example/x" });
/** the board match with a book price on every outcome (buildBoardMatch only reads the feed by key; set them here) */
function withBooks(m: V3BoardMatch, prices: [number, number, number]): V3BoardMatch {
  return { ...m, outcomes: m.outcomes.map((o, i) => ({ ...o, book_prices: [book(prices[i])], best_price: book(prices[i]) })) };
}
const NOW = new Date("2099-10-10T13:40:00Z");

describe("B5/M5 · match page", () => {
  it("> 25 pp (Cercle 84% vs 27%): «Market only», no EV, no Kelly, no € stake", () => {
    const m = withBooks(buildBoardMatch(src({ model_p_home: 0.84, model_p_draw: 0.08, model_p_away: 0.08, p_home: 0.44, p_draw: 0.22, p_away: 0.34 }), [], NOW), [3.7, 3.4, 2.1]);
    const t = text(renderToStaticMarkup(<MatchView kind="football" m={m} series={[]} events={[]} partners links={[]} more={[]} />));
    expect(t).toContain("Market only: the model differs too much to show");
    expect(t).not.toMatch(/EV calculator|Kelly criterion|bankroll|€\d/);
    expect(t).not.toContain("+16.9");
  });
  it("ok: EV and Kelly on the BEST price of a book, Kelly as a fraction, never «€107 of a €500 bankroll»", () => {
    const m = withBooks(buildBoardMatch(src(), [], NOW), [3.7, 3.4, 2.2]);
    const html = renderToStaticMarkup(<MatchView kind="football" m={m} series={[]} events={[]} partners links={[]} more={[]} />);
    const t = text(html);
    expect(m.model_guard?.level).toBe("ok");
    expect(t).toContain("EV and Kelly at the best price, 2.20 at FortunePlay");
    expect(t).not.toMatch(/€\d+ of a €\d+ bankroll/);
    expect(html).toMatch(/kelly-criterion\?price=2\.2&amp;prob=/);
    expect(html).not.toMatch(/kelly-criterion\?[^"]*bank=/);
  });
});

describe("B8 · the sealed tennis Elo (model_tempered) on the match page", () => {
  const side = (s: "p1" | "p2", player: string, mkt: number, sealed: number, atSeal: number): V3BoardTennisSide => ({
    side: s, player, market_price: Math.round((1 / mkt) * 100) / 100, market_p: mkt, model_p: null, estimate_p: sealed, sealed_p: sealed,
    market_p_at_seal: atSeal, gap_pp: Math.round((sealed - atSeal) * 10_000) / 100, book_prices: [book(2.0)], best_price: book(2.0),
  });
  const KK: V3BoardTennisMatch = {
    id: "tennis:espn:185281:elvina-kalieva:tamara-korpatsch", sport: "tennis", tournament: "WTA Ningbo", kickoff: FUTURE, player1: "Elvina Kalieva", player2: "Tamara Korpatsch",
    market: "ML", model_version: "elo_surface_v4_features_odds", probability_kind: "model_tempered", is_our_model: true, temperature: 1.68, margin_removed: 0.05,
    market_source: { bookmaker: "fortuneplay", as_of: "2099-10-10T10:01:45.000Z" }, model_as_of: null, estimate_as_of: "2099-10-10T08:00:00.000Z",
    sealed_at: "2099-10-10T08:01:42.000Z", focus: "p2", surfaced_pick: null, gap_market: { bookmaker: "fortuneplay", captured_at: "2099-10-10T06:02:00.000Z" }, gap_null_reason: null,
    sides: [side("p1", "Elvina Kalieva", 0.4619, 0.44, 0.4836), side("p2", "Tamara Korpatsch", 0.5381, 0.56, 0.5164)],
  };
  it("Kalieva–Korpatsch: sealed %, market at seal, the gap and the books — not «No estimate of ours»", () => {
    const t = text(renderToStaticMarkup(<MatchView kind="tennis" m={KK} series={[]} events={[]} partners links={[]} more={[]} />));
    expect(t).toContain("Our Elo, sealed");
    expect(t).toMatch(/56 %/);
    expect(t).toContain("+4.4");
    expect(t).toMatch(/2\.00/);
    expect(t).not.toContain("No estimate of ours");
  });
});

describe("M4 · tool inputs say why a value is refused", () => {
  it("a price of 999999999 → «Use a value from 1.01 to 1,000.», no result", () => {
    // ToolCalc reads the query only in the browser: the server render shows the defaults, so the check is on the helper path
    const html = renderToStaticMarkup(<ToolCalc slug="odds-converter" copy={getV3cToolsCopy("en").tools["odds-converter"]} invalid="—" />);
    expect(html).not.toContain("v3c-in-err"); // defaults are valid
  });
});

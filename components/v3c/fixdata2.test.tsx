// components/v3c/fixdata2.test.tsx (#REDESIGN-V3C fixdata2) — what the pages show after the data fixes of
// QA-REPORT-2: N3 (no market → «Model only», no estimate/fair; far from the best price → no fair price),
// N9 (the sealed Elo under the guard), N4 (the price check opens on a real book price), N11 (started + score).
// Fictitious data, no DB.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { V3BoardTennisMatch, V3BoardTennisSide, V3BookPrice } from "@/lib/v3c/contracts";
import { buildBoardMatch, type BoardSourceRow, type PartnerPriceRow } from "@/lib/v3c/board";
import { teamPairKey } from "@/lib/team-pair-key";
import type { V3LiveResponse } from "@/lib/v3c/live-contract";
import { MatchView } from "./match/MatchView";
import { PriceCheck, type PcMatch } from "./match/PriceCheck";
import { StartedNote } from "./match/StartedNote";
import { LiveSeedProvider } from "./live/LiveBits";

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const FUTURE = "2099-10-11T13:00:00.000Z";
const NOW = new Date("2099-10-10T13:40:00Z");
const FRESH = "2099-10-10T13:31:00.000Z";

const palace = (over: Partial<BoardSourceRow> = {}): BoardSourceRow => ({
  id: "oddsapi:palace", league: "Premier League", competition: "Premier League", kickoff: FUTURE, home: "Crystal Palace FC", away: "Nottingham Forest FC",
  computed_at: "2099-10-10T12:00:00Z", odds_home: null, odds_draw: null, odds_away: null, model_p_home: 0.1987, model_p_draw: 0.2142, model_p_away: 0.5871,
  p_home: 0.1987, p_draw: 0.2142, p_away: 0.5871, sealed_at: null, ...over,
});
const fbRow = (bookmaker: string, odds: [number, number, number]): PartnerPriceRow => ({
  team_pair_key: teamPairKey("soccer", "Crystal Palace FC", "Nottingham Forest FC", FUTURE) as string, bookmaker, home_name: "Crystal Palace FC", away_name: "Nottingham Forest FC",
  odds_home: odds[0], odds_draw: odds[1], odds_away: odds[2], captured_at: FRESH, source: "live_feed",
});
const view = (m: ReturnType<typeof buildBoardMatch>) => renderToStaticMarkup(<MatchView kind="football" m={m} series={[]} events={[]} partners links={[]} more={[]} />);

describe("N3 · match page without a stored market", () => {
  it("no market and no book: «Model only: no market to compare», no estimate %, no fair price, no EV/Kelly", () => {
    const html = view(buildBoardMatch(palace(), [], NOW));
    const t = text(html);
    expect(t).toContain("Model only: no market to compare");
    // before: «Estimate 59%» and «fair 1.70»
    expect(t).not.toMatch(/59\s*%/);
    expect(t).not.toMatch(/fair 1\.70|fair price 1\.70|1\.70/);
    expect(t).not.toMatch(/EV calculator|Kelly criterion/);
    expect(t).not.toContain("Estimate = our model alone");
  });
  it("Palace–Forest with the books' prices: the market is theirs (declared), the estimate is no longer 59%", () => {
    const html = view(buildBoardMatch(palace(), [fbRow("fortuneplay", [2.68, 3.35, 2.64]), fbRow("ybets", [2.63, 3.29, 2.59])], NOW));
    const t = text(html);
    expect(t).toContain("Market from the partner books’ prices, margin removed");
    expect(t).not.toMatch(/\b59\s*%/);
    expect(t).not.toMatch(/EV calculator|Kelly criterion/); // no_value: |59 − 36| ≈ 23 pp
  });
  it("estimate far from the best real price: no estimate, no fair price, the reason said", () => {
    const m = buildBoardMatch(
      palace({ odds_home: 1.95, odds_draw: 3.5, odds_away: 4.4, model_p_home: 0.6, model_p_draw: 0.22, model_p_away: 0.18, p_home: 0.53, p_draw: 0.25, p_away: 0.22 }),
      [fbRow("fortuneplay", [2.68, 3.35, 2.64]), fbRow("ybets", [2.63, 3.29, 2.59])],
      NOW,
    );
    const t = text(view(m));
    expect(t).toContain("Our estimate is far from the best price: market only, no fair price.");
    expect(t).not.toMatch(/fair \d/);
  });
});

describe("N9 · the sealed Elo on the tennis match page", () => {
  const book = (price: number): V3BookPrice => ({ bookmaker: "fortuneplay", name: "FortunePlay", price, captured_at: FRESH, source: "live_feed", url: "https://fp.example/x" });
  const side = (s: "p1" | "p2", player: string, mkt: number, sealed: number): V3BoardTennisSide => ({
    side: s, player, market_price: Math.round((1 / mkt) * 100) / 100, market_p: mkt, model_p: null, estimate_p: sealed, sealed_p: sealed,
    market_p_at_seal: null, gap_pp: null, book_prices: [book(1.1)], best_price: book(1.1),
  });
  const BL = (sealed1: number, level: "no_value" | "market_only"): V3BoardTennisMatch => ({
    id: "tennis:espn:185246:anna-blinkova:caroline-werner", sport: "tennis", tournament: "WTA Ningbo", kickoff: FUTURE, player1: "Anna Blinkova", player2: "Caroline Werner",
    market: "ML", model_version: "elo_surface_v4_features_odds", probability_kind: "model_tempered", is_our_model: true, temperature: 1.68, margin_removed: 0.09,
    market_source: { bookmaker: null, as_of: FRESH }, model_as_of: null, estimate_as_of: FRESH, sealed_at: "2099-10-10T12:01:53.000Z", focus: "p1", surfaced_pick: "p1",
    gap_market: null, gap_null_reason: "x", sides: [side("p1", "Anna Blinkova", 0.8308, sealed1), side("p2", "Caroline Werner", 0.1692, 1 - sealed1)],
    sealed_guard: { level, delta_pp: Math.round((0.8308 - sealed1) * 1000) / 10, reason: "model_far" },
  });
  it("Blinkova 59% vs 83% (24.1 pp): the sealed Elo with the «no gap, no EV or Kelly» note", () => {
    const t = text(renderToStaticMarkup(<MatchView kind="tennis" m={BL(0.59, "no_value")} series={[]} events={[]} partners links={[]} more={[]} />));
    expect(t).toContain("Our Elo, sealed");
    expect(t).toContain("Our sealed Elo is far from the market here: no gap, no EV or Kelly.");
  });
  it("over 25 pp: no sealed number, «Market only», like the board", () => {
    const t = text(renderToStaticMarkup(<MatchView kind="tennis" m={BL(0.5, "market_only")} series={[]} events={[]} partners links={[]} more={[]} />));
    expect(t).not.toContain("Our Elo, sealed");
    expect(t).toContain("Market only: our sealed Elo differs too much from the market to show.");
  });
});

describe("N4 · price check default", () => {
  it("opens on the best real price (4.50), not on the composite 5.00 no book offers", () => {
    const bp = (price: number): V3BookPrice => ({ bookmaker: "fortuneplay", name: "FortunePlay", price, captured_at: FRESH, source: "live_feed", url: "https://fp.example/x" });
    const pc: PcMatch = {
      id: "oddsapi:x", sport: "football", home: "A", away: "B", kickoff: FUTURE, league: "Serie A", blend: true, links: [], guard: "ok",
      outcomes: [
        { outcome: "home", market_price: 5.0, estimate_p: 0.21, book_prices: [bp(4.5)] },
        { outcome: "draw", market_price: 3.4, estimate_p: 0.28, book_prices: [bp(3.3)] },
        { outcome: "away", market_price: 1.7, estimate_p: 0.51, book_prices: [] },
      ],
    };
    const html = renderToStaticMarkup(<PriceCheck matches={[pc]} initialId={pc.id} partners />);
    expect(html).toMatch(/name="p1"[^>]*value="4.50"|value="4.50"[^>]*name="p1"/);
    expect(html).not.toMatch(/value="5.00"/);
    // no book on «away» → an empty field: no check, no EV/Kelly from a price nobody offers
    expect(html).not.toMatch(/EV calculator|Kelly criterion/);
  });
});

describe("N11 · started note with a live score", () => {
  const id = "tennis:espn:184885:daniel-altmaier:holger-rune";
  const kickoff = "2099-10-10T13:15:00.000Z";
  const data = {
    contract: "v3.live.1", generated_at: "2099-10-10T13:40:00.000Z",
    items: { [id]: { sport: "tennis", state: "live", final_kind: null, sets: [{ p1: 4, p2: 6, tb1: null, tb2: null }, { p1: 2, p2: 1, tb1: null, tb2: null }], server: null, winner: null, source_id: "espn:1", matched_by: "names", source: "espn", updated_at: "2099-10-10T13:39:00.000Z" } },
  } as unknown as V3LiveResponse;
  it("with a score: no «no live score yet»", () => {
    const html = renderToStaticMarkup(
      <LiveSeedProvider value={{ nowIso: "2099-10-10T13:40:00.000Z", data }}>
        <StartedNote id={id} kickoff={kickoff} />
      </LiveSeedProvider>,
    );
    expect(text(html)).toContain("Under way, score above");
    expect(text(html)).not.toContain("no live score yet");
  });
  it("the match page (Rune, started, score in the header) no longer says «no live score yet» in the book section", () => {
    const now = Date.now();
    const ko = new Date(now - 40 * 60_000).toISOString();
    const side = (s: "p1" | "p2", player: string, mkt: number): V3BoardTennisSide => ({
      side: s, player, market_price: Math.round((1 / mkt) * 100) / 100, market_p: mkt, model_p: null, estimate_p: mkt, sealed_p: null, market_p_at_seal: null, gap_pp: null, book_prices: [], best_price: null,
    });
    const m = {
      id, sport: "tennis", tournament: "ATP Shanghai", kickoff: ko, player1: "Daniel Altmaier", player2: "Holger Rune", market: "ML", model_version: "elo_surface_v4_features_odds",
      probability_kind: "market_tempered", is_our_model: false, temperature: 1.68, margin_removed: 0.05, market_source: { bookmaker: null, as_of: ko }, model_as_of: null,
      estimate_as_of: ko, sealed_at: null, focus: "p2", surfaced_pick: null, gap_market: null, gap_null_reason: "x", sides: [side("p1", "Daniel Altmaier", 0.45), side("p2", "Holger Rune", 0.55)],
    } as unknown as V3BoardTennisMatch;
    const html = renderToStaticMarkup(
      <LiveSeedProvider value={{ nowIso: new Date(now).toISOString(), data: { ...data, generated_at: new Date(now).toISOString() } }}>
        <MatchView kind="tennis" m={m} series={[]} events={[]} partners links={[]} more={[]} />
      </LiveSeedProvider>,
    );
    expect(text(html)).not.toContain("no live score yet");
    expect(text(html)).toContain("Under way, score above");
  });
  it("without a score: the old note", () => {
    const html = renderToStaticMarkup(
      <LiveSeedProvider value={{ nowIso: "2099-10-10T13:40:00.000Z", data: { ...data, items: {} } }}>
        <StartedNote id={id} kickoff={kickoff} />
      </LiveSeedProvider>,
    );
    expect(text(html)).toContain("no live score yet");
  });
});

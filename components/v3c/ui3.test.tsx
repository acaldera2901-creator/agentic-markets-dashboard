// components/v3c/ui3.test.tsx (#REDESIGN-V3C ui3) — le due correzioni di Andrea del 07/10:
// A) un partner senza quota dice «Odds on partner site» (mai «no feed»);
// B) nel tennis non diamo la nostra stima: niente stima, gap, Brier o calibrazione tennis a schermo,
//    anche quando il contratto porta quei campi (restano nell'API).
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { V3BoardTennisMatch, V3BoardTennisSide, V3TennisRecordGroup, V3YesterdayResponse } from "@/lib/v3c/contracts";
import { V3C_COPY } from "@/lib/v3c/copy";
import { V3C_MATCH_COPY } from "@/lib/v3c/match-copy";
import { PAGES_COPY } from "@/lib/v3c/pages-copy";
import { MatchView } from "./match/MatchView";
import { PriceCheck, type PcMatch } from "./match/PriceCheck";
import { TennisRecord } from "./record/TennisRecord";
import { Yesterday } from "./home/Yesterday";

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

function side(s: "p1" | "p2", player: string, mkt: number): V3BoardTennisSide {
  return {
    side: s, player, market_price: Math.round((1 / mkt) * 100) / 100, market_p: mkt, model_p: 0.81, estimate_p: 0.77, sealed_p: 0.77,
    market_p_at_seal: 0.6, gap_pp: 17, book_prices: [], best_price: null,
  };
}
const TN: V3BoardTennisMatch = {
  id: "tennis:t1", sport: "tennis", tournament: "ATP Shanghai", kickoff: "2099-10-10T16:00:00.000Z", player1: "Jannik Sinner", player2: "Ben Shelton",
  market: "ML", model_version: "elo_surface_v4", probability_kind: "model", is_our_model: true, temperature: null, margin_removed: 0.05,
  market_source: { bookmaker: "fortuneplay", as_of: "2099-10-10T09:00:00.000Z" }, model_as_of: null, estimate_as_of: "2099-10-10T09:00:00.000Z",
  sealed_at: "2099-10-10T09:02:00.000Z", focus: "p1", surfaced_pick: "p1",
  gap_market: { bookmaker: "fortuneplay", captured_at: "2099-10-10T08:01:00.000Z" }, gap_null_reason: null,
  sides: [side("p1", "Jannik Sinner", 0.64), side("p2", "Ben Shelton", 0.36)],
};

describe("A · «Odds on partner site» in ogni superficie, nelle 11 lingue", () => {
  it("board, pannello, blocco partner, Books: la stessa formula, mai «feed»", () => {
    for (const l of Object.keys(V3C_COPY) as (keyof typeof V3C_COPY)[]) {
      const c = V3C_COPY[l], m = V3C_MATCH_COPY[l], p = PAGES_COPY[l];
      expect(c.board.noPrice).toBe(c.board.oddsOnSite);
      expect(m.oddsOnSite).toBe(c.board.oddsOnSite);
      expect(p.books.siteOdds).toBe(c.board.oddsOnSite);
      expect(c.board.siteOnlyLab.toLowerCase()).toContain(c.board.oddsOnSite.toLowerCase());
      expect(m.moreBooks(3).toLowerCase()).toContain(c.board.oddsOnSite.toLowerCase());
      for (const s of [c.board.noPrice, c.board.siteOnlyLab, m.oddsOnSite, m.moreBooks(2), p.books.siteOdds, p.books.metaRest]) expect(s).not.toMatch(/feed|flux|flöde|akış|поток|фид/i);
    }
    expect(V3C_COPY.en.board.oddsOnSite).toBe("Odds on partner site");
    expect(V3C_COPY.it.board.oddsOnSite).toBe("Quote sul sito del partner");
  });
});

describe("B · tennis senza la nostra stima", () => {
  it("pagina partita tennis: mercato, quote, line movement — niente stima né gap, anche con gap nel contratto", () => {
    const html = renderToStaticMarkup(<MatchView kind="tennis" m={TN} series={[]} events={[]} partners links={[]} more={[]} />);
    const t = text(html);
    expect(t).toContain("The market price, margin removed");
    expect(t).toContain("64");
    expect(t).toContain("No estimate of ours");
    expect(t.replace(/(no|not an) estimate of ours/gi, "")).not.toMatch(/77|\+17|estimate|\bgap\b|raw Elo|Elo v4/i);
    expect(html).toContain('href="/price-check?m=tennis%3At1"');
  });

  it("price check su una partita tennis: due prezzi, margine, nessuna colonna stima/gap", () => {
    const pc: PcMatch = {
      id: TN.id, sport: "tennis", home: TN.player1, away: TN.player2, kickoff: TN.kickoff, league: TN.tournament, blend: false, links: [],
      outcomes: [
        { outcome: "home", market_price: 1.5, estimate_p: null, book_prices: [] },
        { outcome: "away", market_price: 2.6, estimate_p: null, book_prices: [] },
      ],
    };
    const html = renderToStaticMarkup(<PriceCheck matches={[pc]} initialId={TN.id} partners />);
    const t = text(html);
    expect(html.match(/<input[^>]+type="number"[^>]+name="p\d"/g)).toHaveLength(2);
    expect(t).toContain("This match: market only, no estimate of ours");
    expect(t.replace(/(no|not an) estimate of ours/gi, "")).not.toMatch(/estimate|\bgap\b|EV calculator|Kelly/i);
  });

  it("record: il tennis come conteggi — etichetta «market-based», niente Brier né calibrazione", () => {
    const g = (over: Partial<V3TennisRecordGroup>): V3TennisRecordGroup => ({
      model_version: "elo_surface_v4", kind: "model_tempered", label: "x", is_our_model: true, since: "2026-08-01T00:00:00Z", sealed: 100, scored: 90, settled_other: 2,
      unsettled: 8, expected_wins: 60.2, observed_wins: 58, observed_ci95: { low: 0.5, high: 0.7 }, brier: 0.2211, n_paired: 10, brier_paired: 0.2, brier_market: 0.21,
      difference: -0.01, difference_ci95: { low: -0.05, high: 0.03 }, brier_market_null_reason: null, quantization_pp: 0.5, limited_sample: false, ...over,
    });
    const html = renderToStaticMarkup(<TennisRecord groups={[g({}), g({ model_version: "partner-market-v1", kind: "market_tempered", is_our_model: false, sealed: 40, scored: 30, observed_wins: 20, settled_other: 0, unsettled: 10 })]} />);
    const t = text(html);
    expect(t).toContain("Market-based probability");
    expect(t).toMatch(/Matches sealed 140 .*Settled 120 .*Won 78 .*Lost 42 .*Void 2 .*Awaiting a result 18/);
    expect(t).not.toMatch(/0\.22|Brier ·|Expected|our Elo|calibration curve|60\.2/);
  });

  it("Ieri: atteso e osservato sono del calcio; il tennis porta solo vinte–perse e la probabilità «market-based»", () => {
    const sum = (won: number, lost: number, exp: number) => ({ won, lost, void: 0, pending: 0, expected_wins: exp, limited_sample: true });
    const data = {
      contract: "v3.yesterday.1", day: "2026-10-06", generated_at: "2026-10-07T06:00:00Z", football: sum(3, 2, 2.9), tennis: sum(4, 1, 3.6), brier: null,
      picks: [{ sport: "tennis", home: "Jannik Sinner", away: "Ben Shelton", competition: "ATP", kickoff: "2026-10-06T10:00:00Z", pick: "Jannik Sinner", p: 0.64, result: "won", final_score: null }],
      notes: [],
    } as unknown as V3YesterdayResponse;
    const t = text(renderToStaticMarkup(<Yesterday data={data} />));
    expect(t).toContain("Expected in favour 2.9");
    expect(t).toContain("Observed 3");
    expect(t).toContain("Tennis · won–lost 4–1");
    expect(t).toContain("sealed on Jannik Sinner · market-based 64%");
  });
});

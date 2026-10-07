// tennis2 (#REDESIGN-V3C, Andrea 07/10) — la stima tennis «Elo-based, not sealed» sulla pagina partita e nel
// price check, il «Market only» altrove, le 11 lingue dell'avvertenza. Solo fixture, nessuna rete.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { V3BoardTennisMatch } from "@/lib/v3c/contracts";
import { V3C_COPY } from "@/lib/v3c/copy";
import { V3C_MATCH_COPY } from "@/lib/v3c/match-copy";
import { MatchView } from "./match/MatchView";
import { PriceCheck, type PcMatch } from "./match/PriceCheck";

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

const side = (s: "p1" | "p2", player: string, mkt: number) => ({
  side: s, player, market_price: Math.round((1 / mkt) * 100) / 100, market_p: mkt, model_p: s === "p1" ? 0.81 : 0.19, estimate_p: 0.7, sealed_p: null,
  market_p_at_seal: null, gap_pp: null, book_prices: [], best_price: null,
});
const BASE = {
  id: "tennis:espn:1:jannik-sinner:ben-shelton", sport: "tennis", tournament: "ATP Shanghai", kickoff: "2099-10-10T16:00:00.000Z", player1: "Jannik Sinner", player2: "Ben Shelton",
  market: "ML", model_version: "elo_surface_v4", probability_kind: "market_tempered", is_our_model: false, temperature: 1.68, margin_removed: 0.05,
  market_source: { bookmaker: "fortuneplay", as_of: "2099-10-10T09:00:00.000Z" }, model_as_of: null, estimate_as_of: "2099-10-10T09:00:00.000Z",
  sealed_at: "2099-10-10T09:02:00.000Z", focus: "p1", surfaced_pick: "p1", gap_market: null, gap_null_reason: "x",
  sides: [side("p1", "Jannik Sinner", 0.64), side("p2", "Ben Shelton", 0.36)],
} as unknown as V3BoardTennisMatch;
const ELO: V3BoardTennisMatch = {
  ...BASE, estimate_kind: "elo_blend_unsealed", estimate_p: { p1: 0.657, p2: 0.343 }, elo_p_raw: { p1: 0.81, p2: 0.19 }, elo_age_min: 50,
  elo_as_of: "2099-10-10T08:10:00.000Z", gap_pp: { p1: 1.7, p2: -1.7 }, gap_visible: true,
};

describe("tennis2 · pagina partita", () => {
  it("Elo-based: Market → Estimate → Gap attenuato, etichetta, avvertenza, nastro neutro; sigillo ancora «market-based»", () => {
    const html = renderToStaticMarkup(<MatchView kind="tennis" m={ELO} series={[]} events={[]} partners links={[]} more={[]} />);
    const t = text(html);
    expect(t).toContain("Market, then our Elo-based estimate");
    expect(t).toContain("Elo-based, not sealed");
    expect(t).toContain("In tennis our estimate is 90% market, 10% our Elo. Not sealed: the gap is information, not advice.");
    expect(t).toMatch(/\+1\.7 pp/);
    expect(html).toContain("v3c-mt-gap v3c-g-tn");
    expect(html).toContain("v3c-gl v3c-gl-tn");
    expect(html).toContain("v3c-mt-out-tn5");
    expect(t).toContain("Estimate: 90% market, 10% our Elo");
    // l'Elo grezzo (81%) non è mai un numero a schermo, né c'è un prezzo equo o un EV dalla stima
    expect(t).not.toMatch(/81%|EV calculator|Kelly|fair/i);
    expect(t).toContain("The sealed number is market-based, not an estimate of ours");
  });
  it("gap nascosto (|Elo − mercato| > 25 pp): stima sì, gap e nastro no", () => {
    const html = renderToStaticMarkup(<MatchView kind="tennis" m={{ ...ELO, gap_visible: false }} series={[]} events={[]} partners links={[]} more={[]} />);
    expect(html).not.toContain("v3c-mt-gap");
    expect(html).not.toContain("v3c-gl-tn");
    expect(text(html)).toContain("Gap not shown: our Elo is too far from the market");
  });
  it("Market only: nessuna stima, il motivo per questa partita", () => {
    const html = renderToStaticMarkup(<MatchView kind="tennis" m={{ ...BASE, estimate_kind: "market_only", estimate_p: null, gap_pp: null, gap_visible: false }} series={[]} events={[]} partners links={[]} more={[]} />);
    const t = text(html);
    expect(t).toContain("The market price, margin removed");
    expect(t).toContain("No estimate of ours for this match");
    expect(html).not.toContain("v3c-g-tn");
  });
});

// fixui2 N4: the price check opens on a book that quotes every outcome (never on a price no book offers): the fixtures carry one
describe("tennis2 · price check", () => {
  const pc = (over: Partial<PcMatch>): PcMatch => ({
    id: ELO.id, sport: "tennis", home: "Jannik Sinner", away: "Ben Shelton", kickoff: ELO.kickoff, league: "ATP Shanghai", blend: false, links: [],
    outcomes: [
      { outcome: "home", market_price: 1.5, estimate_p: 0.657, book_prices: [{ bookmaker: "fortuneplay", name: "FortunePlay", price: 1.5, captured_at: "2099-10-10T09:00:00.000Z", source: "live_feed" as const, url: "https://fp.example/a" }] },
      { outcome: "away", market_price: 2.6, estimate_p: 0.343, book_prices: [{ bookmaker: "fortuneplay", name: "FortunePlay", price: 2.6, captured_at: "2099-10-10T09:00:00.000Z", source: "live_feed" as const, url: "https://fp.example/a" }] },
    ],
    tnElo: true, gapHidden: false, ...over,
  });
  it("con la stima: colonne Estimate/Gap attenuate, niente verdetto «più alto/più basso», niente EV/Kelly", () => {
    const html = renderToStaticMarkup(<PriceCheck matches={[pc({})]} initialId={ELO.id} partners />);
    const t = text(html);
    expect(t).toContain("Estimate = 90% market + 10% our Elo, not sealed.");
    expect(html).toContain("v3c-g-tn");
    expect(html).not.toMatch(/<mark>66%/);
    expect(t).not.toMatch(/points (higher|lower) than our number|EV calculator|Kelly/);
  });
  it("Market only: la riga «This match: market only»", () => {
    const html = renderToStaticMarkup(<PriceCheck matches={[pc({ tnElo: false, outcomes: pc({}).outcomes.map((o) => ({ ...o, estimate_p: null })) })]} initialId={ELO.id} partners />);
    expect(text(html)).toContain("This match: market only, no estimate of ours.");
    expect(html).not.toContain("v3c-g-tn");
  });
});

describe("tennis2 · 11 lingue", () => {
  it("avvertenza ≤ 22 parole, etichette presenti, nessun claim vietato", () => {
    for (const l of Object.keys(V3C_COPY) as (keyof typeof V3C_COPY)[]) {
      const tn = V3C_COPY[l].tennis;
      expect(words(tn.caveat), l).toBeLessThanOrEqual(22);
      for (const s of [tn.caveat, tn.eloLabel, tn.marketOnly, tn.blendFact, V3C_MATCH_COPY[l].tnEloWhyBody]) {
        expect(s.length, l).toBeGreaterThan(0);
        expect(s).not.toMatch(/beat|guarant|sure|lock|value bet|batt|garant/i);
      }
      expect(tn.caveat).toMatch(/90/);
      expect(tn.caveat).toMatch(/10/);
    }
    // EN/IT approvate
    expect(V3C_COPY.en.tennis.eloLabel).toBe("Elo-based, not sealed");
    expect(V3C_COPY.it.tennis.eloLabel).toBe("basata su Elo, non sigillata");
    expect(V3C_COPY.en.tennis.marketOnly).toBe("Market only");
    expect(V3C_COPY.it.tennis.marketOnly).toBe("Solo mercato");
  });
});

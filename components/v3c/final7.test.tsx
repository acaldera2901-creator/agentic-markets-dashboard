// components/v3c/final7.test.tsx (#REDESIGN-V3C final7) — R5 of QA-REPORT-3 and the «Market only» check:
// a tennis match no book prices reads «No market» on the board AND on its page, with no price time; a price that
// may be outdated has no «prices as of» and says its age once; «Market only» in football carries no estimate text.
// Fictitious data, no DB.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { V3BoardTennisMatch, V3BoardTennisSide } from "@/lib/v3c/contracts";
import { buildBoardMatch, type BoardSourceRow } from "@/lib/v3c/board";
import { footballRows, tennisRows } from "@/lib/v3c/board-view";
import { copyFor } from "@/lib/v3c/copy";
import { TennisRow, FootballRow } from "./board/BoardRow";
import { MatchView } from "./match/MatchView";

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const FUTURE = "2099-10-11T13:00:00.000Z";
const NOW = new Date("2099-10-10T13:40:00Z");
const OLD = "2099-10-08T11:32:00.000Z"; // 50:08 before NOW

const side = (s: "p1" | "p2", player: string, mkt: number | null): V3BoardTennisSide => ({
  side: s, player, market_price: mkt == null ? null : Math.round((1 / mkt) * 100) / 100, market_p: mkt, model_p: null, estimate_p: mkt,
  sealed_p: null, market_p_at_seal: null, gap_pp: null, book_prices: [], best_price: null,
});
const tn = (over: Partial<V3BoardTennisMatch>, mkt: [number | null, number | null]): V3BoardTennisMatch =>
  ({
    id: "tennis:espn:fx7", sport: "tennis", tournament: "WTA Wuhan", kickoff: FUTURE, player1: "Elina Svitolina", player2: "Zheng Qinwen",
    market: "ML", model_version: "partner-market-v1", probability_kind: "market_tempered", is_our_model: false, temperature: 1, margin_removed: mkt[0] == null ? null : 0.05,
    market_source: { bookmaker: null, as_of: OLD }, model_as_of: null, estimate_as_of: OLD, sealed_at: null, focus: "p1", surfaced_pick: null,
    gap_market: null, gap_null_reason: "x", sides: [side("p1", "Elina Svitolina", mkt[0]), side("p2", "Zheng Qinwen", mkt[1])],
    ...over,
  }) as unknown as V3BoardTennisMatch;

const t = copyFor("en");
const row = (m: V3BoardTennisMatch) =>
  text(renderToStaticMarkup(<TennisRow r={tennisRows([m], "UTC", NOW)[0]} t={t} tz="UTC" locale="en" now={NOW} open onToggle={() => {}} partners surface="predictions" />));
const page = (m: V3BoardTennisMatch) => text(renderToStaticMarkup(<MatchView kind="tennis" m={m} series={[]} events={[]} partners links={[]} more={[]} />));

describe("R5 · a tennis match with no market", () => {
  const none = tn({ market_from: null, market_age_min: null } as never, [null, null]);
  it("board and page say the same «No market», never «Market only», never a price time", () => {
    for (const s of [row(none), page(none)]) {
      expect(s).toContain("No market");
      expect(s).toContain("No book prices this match yet: no market, no estimate, no gap.");
      expect(s).not.toContain("Market only");
      expect(s).not.toContain("prices as of");
      expect(s).not.toContain("Market price only");
    }
  });
});

describe("R5 · a price that may be outdated (> 6 h, no book)", () => {
  const stale = tn({ market_from: "stale", market_age_min: 3008 } as never, [0.46, 0.54]);
  it("board: no «prices as of», the age once in the label and once in the note, no separate «Price age»", () => {
    const s = row(stale);
    expect(s).not.toContain("prices as of");
    expect(s).not.toContain("Price age");
    expect(s).toContain("Market only: price may be outdated, 50:08 old (hh:mm)");
    expect(s).toContain("Last stored price, 50:08 old (hh:mm)");
  });
  it("page: no «prices as of», the outdated price said with its age", () => {
    const s = page(stale);
    expect(s).not.toContain("prices as of");
    expect(s).not.toContain("Price age");
    expect(s).toContain("Market only: price may be outdated. Last stored price, 50:08 old (hh:mm).");
  });
  it("a fresh market keeps its «prices as of»", () => {
    const fresh = tn({ market_from: "stored", market_age_min: 9, market_source: { bookmaker: null, as_of: "2099-10-10T13:31:00.000Z" } } as never, [0.46, 0.54]);
    expect(row(fresh)).toContain("prices as of");
    expect(page(fresh)).toContain("prices as of");
  });
});

describe("«Market only» in football (> 25 pp) carries no estimate text", () => {
  const src: BoardSourceRow = {
    id: "oddsapi:fx7-cercle", league: "Belgian Pro League", competition: "Belgian Pro League", kickoff: FUTURE, home: "Cercle Brugge KSV", away: "RSC Anderlecht",
    computed_at: "2099-10-10T13:31:00Z", odds_home: 3.6, odds_draw: 3.5, odds_away: 2.05, model_p_home: 0.62, model_p_draw: 0.2, model_p_away: 0.18,
    p_home: 0.62, p_draw: 0.2, p_away: 0.18, sealed_at: null,
  };
  const m = buildBoardMatch(src, [], NOW);
  it("the fixture is under the 25 pp guard", () => {
    expect(m.model_guard?.level).toBe("market_only");
  });
  it("page: no «A 26% estimate expects…», no 70/30 explanation", () => {
    const s = text(renderToStaticMarkup(<MatchView kind="football" m={m} series={[]} events={[]} partners links={[]} more={[]} />));
    expect(s).toContain("Market only");
    expect(s).not.toMatch(/estimate expects to be wrong/);
    expect(s).not.toContain("Estimate = 70% market + 30% model");
    expect(s).toContain("Our model differs too much from the market to show: the number is the market, margin removed.");
  });
  it("board panel: no 70/30 line, no «estimate as of»", () => {
    const r = footballRows([m], "UTC", NOW)[0];
    const s = text(renderToStaticMarkup(<FootballRow r={r} t={t} tz="UTC" locale="en" now={NOW} open onToggle={() => {}} partners surface="predictions" />));
    expect(s).toContain("Market only");
    expect(s).not.toContain("Estimate = 70% market + 30% model");
    expect(s).not.toMatch(/estimate as of/i);
  });
});

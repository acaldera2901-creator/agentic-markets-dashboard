// components/v3c/fixq.test.tsx (#REDESIGN-V3C fixq) — Q3, Q4, Q5 of QA-REPORT-4, each with the shape that failed.
// Fictitious rows shaped on the real ones (Napoli 08/10: no stored odds, books 1.46, raw model > 25 pp away;
// Heidenheim: composite 1.94, best linked book 1.82). No DB.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildBoardMatch, type BoardSourceRow, type PartnerPriceRow } from "@/lib/v3c/board";
import { footballRows } from "@/lib/v3c/board-view";
import { copyFor } from "@/lib/v3c/copy";
import { estimateShown } from "@/lib/v3c/fixdata2";
import { footballTape } from "@/lib/v3c/tape";
import { liveBoardMatches, sourceFrom, type BoardMatch } from "@/lib/v3c/board-source";
import { toolDef, toolPreview, valuePriceOf } from "@/lib/v3c/tools";
import { V3C_BANNER_COPY } from "@/lib/v3c/banner-copy";
import { PAGES_COPY } from "@/lib/v3c/pages-copy";
import { getV3cToolsCopy } from "@/lib/i18n/v3c-tools";
import { teamPairKey } from "@/lib/team-pair-key";
import type { V3BoardResponse, V3LineSeries } from "@/lib/v3c/contracts";
import { FootballRow } from "./board/BoardRow";
import { MatchView } from "./match/MatchView";
import { BoardBridge } from "./tools/BoardBridge";

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const FUTURE = "2099-10-11T13:00:00.000Z";
const NOW = new Date("2099-10-10T13:40:00Z");
const FRESH = "2099-10-10T13:31:00.000Z";
const t = copyFor("en");

// ─── Q4 ──────────────────────────────────────────────────────────────────────
const napoli: BoardSourceRow = {
  id: "oddsapi:fxq-napoli", league: "Serie A", competition: "Serie A", kickoff: FUTURE, home: "SSC Napoli", away: "Genoa CFC",
  computed_at: "2099-10-10T06:00:00Z", odds_home: null, odds_draw: null, odds_away: null,
  model_p_home: 0.33, model_p_draw: 0.3, model_p_away: 0.37, p_home: 0.33, p_draw: 0.3, p_away: 0.37, sealed_at: null,
};
const book = (bookmaker: string, odds: [number, number, number]): PartnerPriceRow => ({
  team_pair_key: teamPairKey("soccer", napoli.home, napoli.away, napoli.kickoff) as string, bookmaker, home_name: napoli.home, away_name: napoli.away,
  odds_home: odds[0], odds_draw: odds[1], odds_away: odds[2], captured_at: FRESH, source: "live_feed",
});
const BOOKS = [book("fortuneplay", [1.46, 4.5, 7.0]), book("ybets", [1.44, 4.4, 6.8])];
const series: V3LineSeries[] = [
  {
    market: "1X2", source: "partner", bookmaker: "fortuneplay",
    points: [
      { t: "2099-10-10T06:00:00Z", price: { home: 1.5, draw: 4.4, away: 6.6 }, market_p: null, margin: null },
      { t: FRESH, price: { home: 1.46, draw: 4.5, away: 7.0 }, market_p: null, margin: null },
    ],
    coverage: { n_points: 2, first_at: "2099-10-10T06:00:00Z", last_at: FRESH, median_interval_min: 451, max_gap_min: 451 },
  },
];

describe("Q4 · football «Market only» because the model is > 25 pp from the market (Napoli, Nantes, Watford)", () => {
  const m = buildBoardMatch(napoli, BOOKS, NOW);
  it("the fixture has the failing shape: market from the books, guard market_only for model_far", () => {
    expect(m.market_from).toBe("books");
    expect(m.model_guard?.level).toBe("market_only");
    expect(m.model_guard?.reason).toBe("model_far");
    expect(estimateShown(m)).toBe(false);
  });
  it("match page: no ESTIMATE box, no estimate column, no fair price, no «largest gap», no fair line in the tape", () => {
    const s = text(renderToStaticMarkup(<MatchView kind="football" m={m} series={series} events={[]} partners links={[]} more={[]} />));
    expect(s).toContain("Market only: the model differs too much to show");
    expect(s).not.toMatch(/fair price \d/);
    expect(s).not.toContain("Our estimate as a fair price");
    expect(s).not.toContain("largest gap on this market");
    expect(s).not.toContain("70% market · 30% model");
    expect(s).not.toMatch(/<mark>/);
    const html = renderToStaticMarkup(<MatchView kind="football" m={m} series={series} events={[]} partners links={[]} more={[]} />);
    expect(html).not.toContain("v3c-mt-arrow");
  });
  it("board row: market only, the reason said for this case (not the price_far sentence)", () => {
    const r = footballRows([m], "UTC", NOW)[0];
    const html = renderToStaticMarkup(<FootballRow r={r} t={t} tz="UTC" locale="en" now={NOW} open onToggle={() => {}} partners surface="predictions" />);
    const s = text(html);
    expect(s).toContain("Market only");
    expect(s).toContain("Market only: the model differs too much to show");
    expect(s).not.toMatch(/far from the best price/i);
    expect(s).not.toMatch(/Draw ±0\.0/);
    expect(html).not.toMatch(/<mark>/);
  });
  it("tape: no fair-price line from the hidden estimate", () => {
    const tape = footballTape(m, BOOKS);
    expect(tape?.fair ?? null).toBeNull();
  });
  it("tool examples skip it (no EV/Kelly prefill from a hidden estimate)", () => {
    const board = { matches: [m] } as unknown as Pick<V3BoardResponse, "matches">;
    expect(liveBoardMatches(board, NOW)).toEqual([]);
  });
});

// ─── Q5 ──────────────────────────────────────────────────────────────────────
const outcome = (key: string, label: string, price: number, market: number, estimate: number, best: number | null | undefined, prices: Record<string, number> = {}) =>
  ({ key, label, price, market, estimate, prices, best });
const heidenheim = (best: number | null): BoardMatch => ({
  id: "oddsapi:fxq-heid", league: "Bundesliga", day: "Sat", time: "13:30 UTC", home: { name: "1. FC Heidenheim" }, away: { name: "FC Augsburg" }, href: "/match/x",
  outcomes: [outcome("home", "1. FC Heidenheim", 1.94, 51, 55, best, best ? { fortuneplay: best } : {}), outcome("draw", "Draw", 3.6, 27, 26, null), outcome("away", "FC Augsburg", 4.2, 22, 19, null)],
});

describe("Q5 · EV and Kelly on the best linked book price, never the composite", () => {
  const ev = toolDef("ev-calculator");
  const kl = toolDef("kelly-criterion");
  it("Heidenheim: EV at 1.82 (best linked book), not +6.7% at 1.94", () => {
    const m = heidenheim(1.82);
    const ctx = { outcomes: m.outcomes, lead: m.outcomes[0] };
    const c = ev.column!(ctx);
    expect(c.price).toBe(1.82);
    expect(c.value).toBe("+0.1%"); // 0.55 × 1.82 − 1
    expect(c.value).not.toBe("+6.7%");
    expect(ev.fromBoard(ctx).price).toBe(1.82);
    expect(kl.fromBoard(ctx).price).toBe(1.82);
    expect(kl.column!(ctx).price).toBe(1.82);
  });
  it("no linked book → no EV, no Kelly (a dash), never the composite", () => {
    const m = heidenheim(null);
    const ctx = { outcomes: m.outcomes, lead: m.outcomes[0] };
    expect(valuePriceOf(m.outcomes[0])).toBeNull();
    expect(ev.column!(ctx)).toMatchObject({ value: "—", price: null });
    expect(kl.column!(ctx)).toMatchObject({ value: "—", price: null });
    expect(toolPreview("ev-calculator", ctx).output).toBe("—");
  });
  it("the board table shows the price used and says so", () => {
    const src = sourceFrom("live", "13:00 UTC", "/predictions", [heidenheim(1.82), { ...heidenheim(null), id: "oddsapi:fxq-none" }]);
    const c = getV3cToolsCopy("en");
    const s = text(renderToStaticMarkup(<BoardBridge def={ev} column={c.tools["ev-calculator"].column} copy={c.tool} src={src} />));
    expect(s).toContain("1.82");
    expect(s).not.toContain("1.94");
    expect(s).toContain(c.tool.bestPriceNote);
    // the margin tool keeps the board price and no note
    const sm = text(renderToStaticMarkup(<BoardBridge def={toolDef("margin-calculator")} column={c.tools["margin-calculator"].column} copy={c.tool} src={src} />));
    expect(sm).toContain("1.94");
    expect(sm).not.toContain(c.tool.bestPriceNote);
  });
  it("liveBoardMatches carries the linked best price of the board", () => {
    const m = buildBoardMatch({ ...napoli, id: "oddsapi:fxq-ok", model_p_home: 0.66, model_p_draw: 0.21, model_p_away: 0.13 }, BOOKS, NOW);
    const [row] = liveBoardMatches({ matches: [m] } as unknown as Pick<V3BoardResponse, "matches">, NOW);
    expect(row.outcomes[0].best).toBe(1.46);
  });
});

// ─── Q3 ──────────────────────────────────────────────────────────────────────
describe("Q3 · live wording: scores live, prices pre-match", () => {
  it("no «prices moving» in any language; live page labels say pre-match", () => {
    for (const [l, d] of Object.entries(V3C_BANNER_COPY)) {
      expect(d.live.title, l).not.toMatch(/moving|movimento|Bewegung|movimiento|mouvement|beweging|ruchu|меняются|rörelse|hareket/i);
    }
    expect(V3C_BANNER_COPY.en.live.title).toBe("Matches in play: live scores, pre-match numbers");
    expect(PAGES_COPY.en.books.live).not.toMatch(/^live/i);
  });
});

// ─── Q6 / Q9 ─────────────────────────────────────────────────────────────────
describe("Q9 · copy for people", () => {
  it("the age of a price in hours, not «21:40 (hh:mm)»", async () => {
    const { ageHuman } = await import("@/lib/v3c/fixdata3");
    expect(ageHuman(1300)).toBe("22 h");
    expect(ageHuman(45)).toBe("45 min");
    expect(ageHuman(1300, "ru")).toBe("22 ч");
    expect(ageHuman(null)).toBe("—");
  });
  it("the API's technical gap reason never reaches the page", async () => {
    const { tennisGapNote } = await import("@/lib/v3c/fixq-copy");
    const s = tennisGapNote("no FortunePlay/YBets price captured in the 150 min before the seal", "it", "far");
    expect(s).not.toMatch(/FortunePlay|150 min/);
    expect(s).toBe("Nessun prezzo partner salvato poco prima del sigillo: nessun gap da mostrare.");
    expect(tennisGapNote("the sealed Elo is 31.2 pp from the market: more than 15 pp, no gap is shown", "en", "far")).toBe("far");
  });
  it("one rounding: the bar says the same gap as the table (4.05 → «+4.0» on both… or «+4.1» on both)", async () => {
    const { Nastro } = await import("./Nastro");
    const { gapText } = await import("@/lib/v3c/board-view");
    const bar = text(renderToStaticMarkup(<Nastro market={27} estimate={31} gap={4.05} />));
    expect(bar).toContain(`${gapText(4.05)} pp`);
  });
});

describe("Q6 · a sealed tennis Elo with no market (Musetti–Zhou)", () => {
  it("the seal says «our Elo model», never «market-based»", async () => {
    const { fixqCopyFor, sealedOurs } = await import("@/lib/v3c/fixq-copy");
    const m = { probability_kind: "model_tempered", sealed_at: FRESH, sides: [{ sealed_p: 0.71 }, { sealed_p: 0.29 }] };
    expect(sealedOurs(m)).toBe(true);
    expect(sealedOurs({ ...m, probability_kind: "market_tempered" })).toBe(false);
    for (const l of ["en", "it", "de", "es", "fr", "nl", "pl", "pt", "ru", "sv", "tr"]) expect(fixqCopyFor(l).sealedWhyModel("x")).not.toMatch(/market-based|dal mercato|vom Markt|del mercado|du marché|van de markt|z rynku|do mercado|на рынке|från marknaden|piyasaya/);
  });
});

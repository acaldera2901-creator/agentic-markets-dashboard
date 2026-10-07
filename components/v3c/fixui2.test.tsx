// components/v3c/fixui2.test.tsx (#REDESIGN-V3C fixui2) — regressions of QA-REPORT-2, UI side:
// N1 the home bench never uses a guarded/started match and never shows € · B3 no «Sign in» in Fase 0 ·
// N4/N6 the price check opens on a book's prices or empty, Kelly without € · N5 community preview ·
// N8 the seal stamp has its day, and a row after kick-off is not a pre-match seal · N13 Pro preview · M7 links.
// Fictitious data, no DB.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { V3BoardMatch, V3BookPrice } from "@/lib/v3c/contracts";
import { buildBoardMatch, type BoardSourceRow } from "@/lib/v3c/board";
import { exampleEligible, hasMoney, priceCheckInitial, sealStamp, sealedBeforeKickoff, withoutMoney } from "@/lib/v3c/fixui2";
import { bannerCopyFor } from "@/lib/v3c/banner-copy";
import { relativizeSiteLinks } from "@/lib/v3c/site-links";
import { getV3cToolsCopy } from "@/lib/i18n/v3c-tools";
import { V3C_LANGS } from "@/lib/v3c/copy";
import { Bench } from "./home/Bench";
import { PriceCheck, type PcMatch } from "./match/PriceCheck";
import { Sigillo } from "./Sigillo";
import { Footer, TopBar } from "./Chrome";
import { V3cCommunity } from "./community/Community";

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const NOW = new Date("2099-10-10T12:00:00Z");
const src = (over: Partial<BoardSourceRow>): BoardSourceRow => ({
  id: "x", league: "Serie A", competition: "Serie A", kickoff: "2099-10-10T15:00:00.000Z", home: "Home FC", away: "Away FC",
  computed_at: "2099-10-10T11:00:00Z", odds_home: 2.2, odds_draw: 3.3, odds_away: 3.4,
  model_p_home: 0.45, model_p_draw: 0.28, model_p_away: 0.27, p_home: 0.45, p_draw: 0.28, p_away: 0.27, sealed_at: null, ...over,
});
const book = (price: number, key = "fortuneplay", name = "FortunePlay"): V3BookPrice => ({ bookmaker: key, name, price, captured_at: "2099-10-10T11:31:00.000Z", source: "live_feed", url: "https://fp.example/x" });
const withBooks = (m: V3BoardMatch, p: [number, number, number]): V3BoardMatch => ({ ...m, outcomes: m.outcomes.map((o, i) => ({ ...o, book_prices: [book(p[i])], best_price: book(p[i]) })) });

// Botafogo–Vasco shape: first match of the day, guard no_value (raw model 62% vs market ≈44%), EV +22% if shown
const guarded = withBooks(buildBoardMatch(src({ id: "oddsapi:botafogo", home: "Botafogo", away: "Vasco da Gama", kickoff: "2099-10-10T13:00:00.000Z", model_p_home: 0.62, model_p_draw: 0.2, model_p_away: 0.18, p_home: 0.5, p_draw: 0.26, p_away: 0.24 }), [], NOW), [2.25, 3.35, 3.45]);
const started = withBooks(buildBoardMatch(src({ id: "oddsapi:started", home: "Started FC", away: "Late FC", kickoff: "2099-10-10T11:00:00.000Z" }), [], NOW), [2.25, 3.35, 3.45]);
const ok = withBooks(buildBoardMatch(src({ id: "oddsapi:ok", home: "Inter", away: "Torino", kickoff: "2099-10-10T16:00:00.000Z", odds_home: 1.62, odds_draw: 4.1, odds_away: 5.6, model_p_home: 0.6, model_p_draw: 0.23, model_p_away: 0.17, p_home: 0.6, p_draw: 0.23, p_away: 0.17 }), [], NOW), [1.65, 4.1, 5.6]);

describe("N1 · the home bench", () => {
  it("the fixture is what QA saw: Botafogo is guarded, Inter is ok", () => {
    expect(guarded.model_guard?.level).toBe("no_value");
    expect(ok.model_guard?.level ?? "ok").toBe("ok");
  });
  it("exampleEligible drops guarded and started matches", () => {
    expect(exampleEligible([started, guarded, ok], NOW).map((m) => m.id)).toEqual(["oddsapi:ok"]);
  });
  it("with a guarded match first, the bench speaks of the ok one — no Botafogo, no EV of it, no €", () => {
    const t = text(renderToStaticMarkup(<Bench matches={[started, guarded, ok]} nowIso={NOW.toISOString()} />));
    expect(t).toContain("Inter – Torino");
    expect(t).not.toContain("Botafogo");
    expect(t).not.toMatch(/€|\$|£/);
  });
  it("no eligible match: neutral example numbers, declared as an example, still no €", () => {
    const html = renderToStaticMarkup(<Bench matches={[guarded, started]} nowIso={NOW.toISOString()} />);
    const t = text(html);
    expect(html).toContain('data-bench="sample"');
    expect(t).toContain("Example numbers, not a real match");
    expect(t).not.toContain("Botafogo");
    expect(t).not.toMatch(/€|\$|£/);
  });
  it("withoutMoney: Kelly «10.7% · €54» → «10.7%»", () => {
    expect(withoutMoney("10.7% · €54")).toBe("10.7%");
    expect(withoutMoney("+22.0%")).toBe("+22.0%");
    expect(withoutMoney("€400 on €1,000")).toBe("—");
    expect(hasMoney("54 €")).toBe(true);
  });
});

describe("B3 · no «Sign in» on v3c in Fase 0", () => {
  for (const l of ["en", "it", "de"] as const) {
    it(`${l}: header and footer carry no «${getV3cToolsCopy(l).nav.signIn}»; the footer has the discreet «Existing members» link`, () => {
      const c = getV3cToolsCopy(l);
      const html = renderToStaticMarkup(<><TopBar locale={l} copy={c.nav} /><Footer locale={l} copy={c} /></>);
      expect(text(html)).not.toContain(c.nav.signIn);
      expect(html.match(/href="\/plans\?auth=login"/g)?.length).toBe(1);
      expect(html).toContain('data-v3c="existing-members"');
    });
  }
});

const pcMatch = (over: Partial<PcMatch> = {}): PcMatch => ({
  id: "m1", sport: "football", home: "Genoa", away: "Fiorentina", kickoff: "2099-10-10T15:00:00.000Z", league: "Serie A", blend: true, links: [], guard: "ok",
  outcomes: [
    { outcome: "home", market_price: 5.0, estimate_p: 0.21, book_prices: [book(4.5, "beazt", "Beazt")] },
    { outcome: "draw", market_price: 3.4, estimate_p: 0.3, book_prices: [book(3.3, "beazt", "Beazt")] },
    { outcome: "away", market_price: 1.8, estimate_p: 0.49, book_prices: [book(1.75, "beazt", "Beazt")] },
  ],
  ...over,
});

describe("N4 · the price check opens on a price a book offers", () => {
  it("prefilled with Beazt's 4.50, never the market 5.00; Kelly a fraction, no € and no bankroll", () => {
    const html = renderToStaticMarkup(<PriceCheck matches={[pcMatch()]} initialId="m1" partners={false} />);
    expect(html).toContain('value="4.50"');
    expect(html).not.toContain('value="5.00"');
    expect(text(html)).toContain("Enter the price you see");
    // «Expected value per €1» is the EV unit, not a stake; no amount «€x of a €500 bankroll» and no bankroll box
    expect(text(html)).not.toMatch(/bankroll|€\d+(?:[.,]\d+)? of|€(?!1\b)\d/i);
  });
  it("no book quotes every outcome: empty boxes and an empty state, not an error", () => {
    const m = pcMatch({ outcomes: pcMatch().outcomes.map((o, i) => (i === 2 ? { ...o, book_prices: [] } : o)) });
    const html = renderToStaticMarkup(<PriceCheck matches={[m]} initialId="m1" partners={false} />);
    expect(html).toContain('data-pc="empty"');
    expect(html).not.toContain('value="5.00"');
    expect(html).not.toContain("v3c-pc-err");
  });
});

describe("N6 · the price check never opens another match in silence", () => {
  it("priceCheckInitial", () => {
    expect(priceCheckInitial(null, ["a", "b"], "a")).toEqual({ id: "a", notListed: false });
    expect(priceCheckInitial("b", ["a", "b"], "a")).toEqual({ id: "b", notListed: false });
    expect(priceCheckInitial("cercle", ["a", "b"], "a")).toEqual({ id: null, notListed: true });
  });
  it("not listed: the page says so and opens empty", () => {
    const html = renderToStaticMarkup(<PriceCheck matches={[pcMatch()]} initialId={null} notListed partners={false} />);
    expect(html).toContain('data-pc="not-listed"');
    expect(text(html)).toContain("This match is not in the price check");
    expect(html).not.toMatch(/<b>Genoa — Fiorentina<\/b>/); // the fascia names no match (it stays in the picker)
    expect(html).toMatch(/<option value="" selected="">/);
    expect(html).toContain('data-pc="empty"');
  });
});

describe("N8 · the seal stamp", () => {
  it("has the day: «27 Sept 16:02» style, in the view's zone", () => {
    expect(sealStamp("2099-09-27T14:02:00Z", "Europe/Rome")).toMatch(/^27 Sep\w* 16:02$/);
    const html = renderToStaticMarkup(<Sigillo sealedAt="2099-09-27T14:02:00Z" tz="Europe/Rome" kickoff="2099-10-07T14:00:00Z" label="sealed" afterLabel="logged" />);
    expect(text(html)).toMatch(/sealed 27 Sep\w* 16:02/);
    expect(html).not.toContain('data-seal="after"');
  });
  it("before the mount: the day and «UTC»", () => {
    expect(text(renderToStaticMarkup(<Sigillo sealedAt="2099-09-27T14:02:00Z" label="sealed" />))).toMatch(/27 Sep\w* 14:02 UTC/);
  });
  it("after kick-off it is not called a seal", () => {
    expect(sealedBeforeKickoff("2099-10-07T14:02:00Z", "2099-10-07T14:00:00Z")).toBe(false);
    expect(sealedBeforeKickoff("2099-10-07T13:58:00Z", "2099-10-07T14:00:00Z")).toBe(true);
    const html = renderToStaticMarkup(<Sigillo sealedAt="2099-10-07T14:02:00Z" tz="UTC" kickoff="2099-10-07T14:00:00Z" label="sealed" afterLabel="logged" afterTitle="after kick-off" />);
    expect(html).toContain('data-seal="after"');
    expect(text(html)).toContain("logged");
    expect(text(html)).not.toContain("sealed");
  });
});

describe("N5 · /community in Fase 0 is a preview", () => {
  it("no «See Pro», no «open with Pro»", () => {
    const html = renderToStaticMarkup(<V3cCommunity initial={{ access: "none", slips: [{ id: "s", creator_code: "ADA", mb_param: "x", created_at: "2099-10-01T10:00:00Z", locked: true, combined_prob: null, selections: [{ label: "Inter–Torino", sport: "football", when: "", market: null, prob: null }] }] }} />);
    const t = text(html);
    expect(t).toContain("Creator slips · preview");
    expect(t).not.toMatch(/See Pro|open with Pro|part of Pro/);
    expect(html).not.toContain('href="/pricing"');
  });
});

describe("N13 · the record's Pro banner is an informative preview", () => {
  it("no «Compare», no «See what Pro adds», in the 11 languages", () => {
    expect(bannerCopyFor("en").pro).toEqual({ title: "Pro preview: nothing to buy yet", link: "Read the Pro preview" });
    for (const l of V3C_LANGS) expect(`${bannerCopyFor(l).pro.title} ${bannerCopyFor(l).pro.link}`).not.toMatch(/compar|vergleich|porównaj|сравн|jämför|karşılaştır|adds|aggiunge/i);
  });
});

describe("M7 · the 8 absolute links of the published articles (SELECT 07/10) become relative", () => {
  const tags = ["/tr/tools/probability-calculator", "/de/tools/ev-calculator", "/tools", "/predictions", "/history", "/tools/ev-calculator", "/tools/margin-calculator", "/tools/probability-calculator"];
  it.each(tags)("%s", (p) => {
    const out = relativizeSiteLinks(`<p><a href="https://www.betredge.com${p}">x</a></p>`);
    expect(out).toBe(`<p><a href="${p}">x</a></p>`);
    expect(out).not.toMatch(/betredge\.com/);
  });
});

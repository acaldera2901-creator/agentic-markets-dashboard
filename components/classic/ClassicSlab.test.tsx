// #CLASSIC-ROOBET-1013 round 2 — il piede della scheda: UNA quota (la pick) o i tre partner.
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ClassicSlab, fallbackPartners, pickCell } from "./ClassicSlab";
import { ClassicPricesProvider } from "./ClassicContext";
import type { PredictionCardData } from "@/lib/ui/prediction-card";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

const data = (p: Partial<PredictionCardData> = {}): PredictionCardData => ({
  id: "1", sport: "football", league: "Serie A", home: "Genoa", away: "Fiorentina",
  startsAt: new Date(Date.now() + 3 * 3600_000).toISOString(), kickoffLabel: "Today, 20:45",
  isLive: false, pick: "Genoa to win", modelPct: 48, marketPct: 44, edgePct: 4,
  classic: { sport: "football", est: [0.48, 0.27, 0.25], odds: [2.1, 3.4, 3.6], leadIdx: 0 },
  ...p,
});

function mount(d: PredictionCardData, blocked = false) {
  return render(
    <ClassicPricesProvider fpOdds={{}} booksBlocked={blocked} geoCountry="DE" tz="Europe/Rome" tennisComputedAt={null}>
      <ClassicSlab data={d} href="/m/1" lang="en" />
    </ClassicPricesProvider>,
  );
}

describe("ClassicSlab (round 2)", () => {
  it("fallbackPartners: nothing when the geo is blocked; at least three partners otherwise, sportsbooks first", () => {
    expect(fallbackPartners({ booksBlocked: true, geoCountry: "DE" })).toEqual([]);
    const list = fallbackPartners({ booksBlocked: false, geoCountry: "DE" });
    expect(list.length).toBeGreaterThanOrEqual(3);
    expect(list[0].name).toBe("FortunePlay");
    // #POSTBACK-1014 (main): network partners go through the tracked /go/<id> redirect
    expect(list.every((p) => p.url.startsWith("https://") || p.url.startsWith("/go/"))).toBe(true);
  });

  it("pickCell: the best linked price on the pick side, or null", () => {
    expect(pickCell(null, ["1", "X", "2"], 0)).toBeNull();
    const view = { chips: [{ key: "fp", name: "FortunePlay", url: "https://x", price: 2.1, best: true }, { key: "yb", name: "YBets", url: "https://y", price: null, best: false }] } as never;
    expect(pickCell(view, ["1", "X", "2"], 2)).toMatchObject({ label: "2", price: 2.1, bookName: "FortunePlay" });
  });

  it("without a partner price the foot shows three partner logos, never an invented price; the CTA stays on the same row", () => {
    mount(data());
    const foot = screen.getByTestId("classic-odds");
    const partners = within(foot).getByTestId("classic-partners");
    expect(partners.getAttribute("data-n")).toBe("3");
    expect(within(partners).getAllByRole("link")).toHaveLength(3);
    for (const a of within(partners).getAllByRole("link")) expect(a).toHaveAttribute("rel", expect.stringContaining("sponsored"));
    expect(screen.queryByText(/\d\.\d\d/)).toBeNull();
    expect(screen.getByRole("link", { name: /View analysis/ })).toBeInTheDocument();
  });

  it("locked card: no odds (the pick is what Pro buys), partner logos instead", () => {
    mount(data({ locked: true, pick: null, classic: { sport: "football", estLead: 0.48, oddsLead: 2.1 } }));
    expect(screen.getByText("Pro pick")).toBeInTheDocument();
    expect(screen.getByTestId("classic-partners")).toBeInTheDocument();
    expect(screen.queryByText(/\d\.\d\d/)).toBeNull();
  });

  it("geo blocked: no partner link at all (fail-closed)", () => {
    mount(data(), true);
    expect(screen.queryByTestId("classic-partners")).toBeNull();
    expect(screen.getByTestId("classic-odds")).toBeEmptyDOMElement();
  });

  it("the context (market, gap) lives behind the «i», not in a row of its own", () => {
    mount(data());
    const info = screen.getByTestId("classic-info");
    expect(info).toHaveAttribute("hidden");
    expect(info.textContent).toMatch(/Market 4\d%/);
    expect(info.textContent).toMatch(/pts (above|below) the market|In line/);
  });
});

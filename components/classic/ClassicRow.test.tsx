// #CLASSIC-ROOBET-1013 round 3 — la colonna del mercato della riga mentre la geo non è ancora nota.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClassicRow } from "./ClassicRow";
import { ClassicPricesProvider } from "./ClassicContext";
import { classicCopy } from "@/lib/classic/lobby-copy";
import type { PredictionCardData } from "@/lib/ui/prediction-card";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

const now = Date.now();
const data: PredictionCardData = {
  id: "1", sport: "football", league: "Serie A", home: "Genoa", away: "Fiorentina",
  startsAt: new Date(now + 3 * 3600_000).toISOString(), kickoffLabel: "Today, 20:45",
  isLive: false, pick: "Genoa to win", modelPct: 48, marketPct: 44, edgePct: 4,
  classic: { sport: "football", est: [0.48, 0.27, 0.25], odds: [2.1, 3.4, 3.6], leadIdx: 0 },
};

function mount(booksBlocked: boolean, geoCountry: string) {
  return render(
    <ClassicPricesProvider fpOdds={{}} booksBlocked={booksBlocked} geoCountry={geoCountry} tz="Europe/Rome" tennisComputedAt={null}>
      <ul>
        <ClassicRow item={{ data, key: "football:1" }} link={{ href: "/m/1", locked: false }} lang="en" tz="Europe/Rome" now={now} copy={classicCopy("en")} />
      </ul>
    </ClassicPricesProvider>,
  );
}

describe("ClassicRow — market column", () => {
  it("geo not known yet (/api/geo-books pending): no false «No partner price», no link either", () => {
    mount(true, "");
    expect(screen.queryByText("No partner price")).toBeNull();
    expect(screen.queryByTestId("classic-partners")).toBeNull();
  });

  // #CLASSIC-ASSET-1013 round 3 (Andrea, 14/10): niente «No partner price» — la
  // colonna resta vuota, nessun link partner, nessuna quota inventata.
  it("geo known and blocked: the market column stays empty, links nothing", () => {
    mount(true, "IT");
    expect(screen.queryByText("No partner price")).toBeNull();
    expect(screen.queryByTestId("classic-partners")).toBeNull();
    expect(screen.queryAllByRole("link", { name: /partner/i })).toHaveLength(0);
  });

  it("geo open, no partner price for the match: three partner logos", () => {
    mount(false, "DE");
    expect(screen.getByTestId("classic-partners").getAttribute("data-n")).toBe("3");
    expect(screen.queryByText("No partner price")).toBeNull();
  });
});

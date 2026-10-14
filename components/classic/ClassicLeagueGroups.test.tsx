// components/classic/ClassicLeagueGroups.test.tsx — #CLASSIC-PAGES-1014
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ClassicLeagueGroups } from "./ClassicLeagueGroups";
import { CARDS_PER_LEAGUE } from "@/lib/classic/league-groups";
import type { LobbyItem } from "@/lib/ui/lobby";

const NOW = Date.parse("2026-10-14T10:00:00Z");
const h = (n: number) => new Date(NOW + n * 3600_000).toISOString();
let seq = 0;
function item(p: Partial<LobbyItem["data"]> & { league: string }): LobbyItem {
  const id = String(++seq);
  const data = { id, sport: "football", home: `Home ${id}`, away: `Away ${id}`, startsAt: h(5), isLive: false, pick: null, modelPct: 50, marketPct: 50, edgePct: 0, ...p } as LobbyItem["data"];
  return { data, key: `${data.sport}:${id}` };
}
const many = (league: string, n: number, p: Partial<Omit<LobbyItem["data"], "league">> = {}) => Array.from({ length: n }, () => item({ league, ...p }));

// ordine atteso: Championship (live) · Serie A (tier 1, h+2) · Premier League (tier 1, h+5) · Ligue 1 (tier 1, h+9)
const items = [
  ...many("Serie A", CARDS_PER_LEAGUE + 3, { startsAt: h(2) }),
  ...many("Premier League", 4),
  ...many("Ligue 1", 2, { startsAt: h(9) }),
  ...many("Championship", 1, { isLive: true, startsAt: h(-0.5) }),
];

function setup(extra: Partial<React.ComponentProps<typeof ClassicLeagueGroups>> = {}) {
  const renderCard = vi.fn((it: LobbyItem) => <article data-testid="card">{it.data.home}</article>);
  render(<ClassicLeagueGroups items={extra.items ?? items} lang="en" renderCard={renderCard} {...extra} />);
  return { renderCard };
}

const headers = () => screen.getAllByRole("button", { name: /Matches:/ });

describe("ClassicLeagueGroups", () => {
  it("one header per league, live first then top leagues, with country and count", () => {
    setup();
    expect(headers().map((b) => b.textContent)).toEqual([
      "Championship" + "England" + "1 live" + "1",
      "Serie A" + "Italy" + String(CARDS_PER_LEAGUE + 3),
      "Premier League" + "England" + "4",
      "Ligue 1" + "France" + "2",
    ]);
  });

  it("opens the two biggest groups and the live one; the rest is closed and renders no card", () => {
    const { renderCard } = setup();
    expect(headers().map((b) => b.getAttribute("aria-expanded"))).toEqual(["true", "true", "true", "false"]);
    // Serie A shows CARDS_PER_LEAGUE cards and «See all»; PL its 4; Championship 1; Ligue 1 nothing
    expect(renderCard).toHaveBeenCalledTimes(CARDS_PER_LEAGUE + 4 + 1);
    const serieA = screen.getAllByTestId("classic-league-group")[1];
    expect(within(serieA).getAllByTestId("card")).toHaveLength(CARDS_PER_LEAGUE);
    expect(within(serieA).getByRole("button", { name: `See all ${CARDS_PER_LEAGUE + 3}` })).toHaveAttribute("aria-expanded", "false");
    const pl = screen.getAllByTestId("classic-league-group")[2];
    expect(within(pl).queryByRole("button", { name: /See all/ })).toBeNull();
  });

  it("each league toggles on its own, with aria-expanded and aria-controls", () => {
    setup();
    const [, serieA, , ligue1] = headers();
    const panelId = serieA.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    expect(document.getElementById(panelId!)).not.toBeNull();
    fireEvent.click(serieA);
    expect(serieA).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById(panelId!)).toBeNull();
    fireEvent.click(ligue1);
    expect(ligue1).toHaveAttribute("aria-expanded", "true");
    expect(within(screen.getAllByTestId("classic-league-group")[3]).getAllByTestId("card")).toHaveLength(2);
    // the other headers did not move
    expect(headers()[2]).toHaveAttribute("aria-expanded", "true");
  });

  it("«See all (N)» reveals the rest, «Show less» folds it back", () => {
    setup();
    const serieA = screen.getAllByTestId("classic-league-group")[1];
    fireEvent.click(within(serieA).getByRole("button", { name: /See all/ }));
    expect(within(serieA).getAllByTestId("card")).toHaveLength(CARDS_PER_LEAGUE + 3);
    const less = within(serieA).getByRole("button", { name: "Show less" });
    expect(less).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(less);
    expect(within(serieA).getAllByTestId("card")).toHaveLength(CARDS_PER_LEAGUE);
  });

  it("forceOpen (search or competition filter) opens every group", () => {
    setup({ forceOpen: true });
    expect(headers().every((b) => b.getAttribute("aria-expanded") === "true")).toBe(true);
  });

  it("arrow keys, Home and End move the focus between headers", () => {
    setup();
    const hs = headers();
    hs[0].focus();
    fireEvent.keyDown(hs[0], { key: "ArrowDown" });
    expect(document.activeElement).toBe(hs[1]);
    fireEvent.keyDown(hs[1], { key: "End" });
    expect(document.activeElement).toBe(hs[3]);
    fireEvent.keyDown(hs[3], { key: "ArrowDown" });
    expect(document.activeElement).toBe(hs[0]);
    fireEvent.keyDown(hs[0], { key: "ArrowUp" });
    expect(document.activeElement).toBe(hs[3]);
    fireEvent.keyDown(hs[3], { key: "Home" });
    expect(document.activeElement).toBe(hs[0]);
  });

  it("is sport-agnostic: tennis tournaments get their circuit, unnamed rows become «Other tournaments»", () => {
    setup({ items: [...many("WTA Wuhan", 2, { sport: "tennis" }), item({ sport: "tennis", league: "" })], lang: "it" });
    const names = screen.getAllByRole("button", { name: /Partite:/ }).map((b) => b.textContent);
    expect(names[0]).toContain("WTA Wuhan");
    expect(names[0]).toContain("WTA");
    expect(names[1]).toContain("Altri tornei");
  });

  it("renders the lead above the groups", () => {
    setup({ lead: <p>quota row</p> });
    const root = screen.getByTestId("classic-league-groups");
    expect(root.firstElementChild?.textContent).toBe("quota row");
  });
});

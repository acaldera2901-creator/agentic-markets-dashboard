// lib/classic/league-groups.test.ts — #CLASSIC-PAGES-1014
import { describe, expect, it } from "vitest";
import type { LobbyItem } from "@/lib/ui/lobby";
import { CARDS_PER_LEAGUE, OPEN_BY_SIZE, OPEN_LIVE_MAX, OPEN_WINDOW, defaultOpenIds, groupLeagues } from "./league-groups";
import { UNNAMED_LEAGUE } from "./lobby-model";

const NOW = Date.parse("2026-10-14T10:00:00Z");
const h = (n: number) => new Date(NOW + n * 3600_000).toISOString();
let seq = 0;
function item(p: Partial<LobbyItem["data"]> & { league: string | null }): LobbyItem {
  const id = String(++seq);
  const data = { id, sport: "football", home: `Home ${id}`, away: `Away ${id}`, startsAt: h(5), isLive: false, pick: null, modelPct: 50, marketPct: 50, edgePct: 0, ...p } as LobbyItem["data"];
  return { data, key: `${data.sport}:${id}` };
}

describe("groupLeagues", () => {
  it("orders live leagues first, then top leagues, then by first kick-off, then by name", () => {
    const items = [
      item({ league: "League Two", startsAt: h(1) }),          // tier 3, starts first
      item({ league: "Serie A", startsAt: h(6) }),             // tier 1, late
      item({ league: "Premier League", startsAt: h(4) }),      // tier 1, earlier than Serie A
      item({ league: "Championship", startsAt: h(-0.5), isLive: true }), // tier 2 but LIVE
      item({ league: "Bundesliga", startsAt: h(4) }),          // tier 1, same start as PL → by name
    ];
    expect(groupLeagues(items).map((g) => g.league)).toEqual(["Championship", "Bundesliga", "Premier League", "Serie A", "League Two"]);
  });

  it("keeps the incoming order inside a group (the page's own sort decides)", () => {
    const a = item({ league: "Serie A", startsAt: h(8) });
    const b = item({ league: "Serie A", startsAt: h(2) });
    const [g] = groupLeagues([a, b]);
    expect(g.items.map((x) => x.key)).toEqual([a.key, b.key]);
    expect(g.liveCount).toBe(0);
    expect(g.firstStart).toBe(Date.parse(h(2)));
  });

  it("is sport-agnostic: tennis gets circuit and country from the same rules, unnamed rows get their own group", () => {
    const groups = groupLeagues([
      item({ sport: "tennis", league: "ATP Tokyo" }),
      item({ sport: "tennis", league: null }),
      item({ sport: "tennis", league: "  " }),
    ]);
    expect(groups.map((g) => g.league)).toEqual(["ATP Tokyo", UNNAMED_LEAGUE]);
    expect(groups[0].circuit).toBe("ATP");
    expect(groups[1].items).toHaveLength(2);
    expect(groups[1].country).toBeNull();
  });
});

describe("defaultOpenIds", () => {
  it("opens the two biggest groups among the first OPEN_WINDOW, the rest stays closed", () => {
    const items = [
      ...Array.from({ length: 3 }, () => item({ league: "Serie A" })),
      ...Array.from({ length: 5 }, () => item({ league: "League Two" })),
      ...Array.from({ length: 4 }, () => item({ league: "La Liga" })),
      item({ league: "Ligue 1" }),
    ];
    // page order: La Liga, Ligue 1, Serie A (tier 1), League Two (tier 3) — all within the window
    const open = defaultOpenIds(groupLeagues(items));
    expect(open.size).toBe(OPEN_BY_SIZE);
    expect([...open]).toEqual(["football:League Two", "football:La Liga"]);
  });

  it("a big league beyond the window does not open: what opens is on the first screen", () => {
    const items = [
      ...Array.from({ length: 9 }, () => item({ league: "Champions League" })),
      ...Array.from({ length: 6 }, () => item({ league: "Bundesliga" })),
      item({ league: "Ligue 1" }),
      ...Array.from({ length: 11 }, () => item({ league: "Serie A" })),
      ...Array.from({ length: 5 }, () => item({ league: "Eredivisie" })),
      ...Array.from({ length: 12 }, () => item({ league: "League One" })),
    ];
    const groups = groupLeagues(items);
    expect(groups.slice(0, OPEN_WINDOW).map((g) => g.league)).toEqual(["Bundesliga", "Champions League", "Ligue 1", "Serie A"]);
    expect([...defaultOpenIds(groups)]).toEqual(["football:Serie A", "football:Champions League"]);
  });

  it("a league with a live match opens too, up to the cap", () => {
    const items = [
      ...Array.from({ length: 4 }, () => item({ league: "Serie A" })),
      ...Array.from({ length: 4 }, () => item({ league: "La Liga" })),
      item({ league: "Eredivisie", isLive: true, startsAt: h(-1) }),
      item({ league: "Ligue 1", isLive: true, startsAt: h(-1) }),
      item({ league: "Primeira Liga", isLive: true, startsAt: h(-1) }),
    ];
    const groups = groupLeagues(items);
    // live first (Ligue 1 tier 1, then the two tier 2 by name), then Serie A, La Liga
    expect(groups.map((g) => g.league)).toEqual(["Ligue 1", "Eredivisie", "Primeira Liga", "La Liga", "Serie A"]);
    const open = defaultOpenIds(groups);
    expect([...open].filter((id) => groups.find((g) => g.id === id)!.liveCount > 0)).toEqual(["football:Ligue 1", "football:Eredivisie"]);
    expect(open.size).toBe(OPEN_LIVE_MAX + 1);
    // the window holds the three live groups and La Liga: La Liga opens (4 rows), Serie A is beyond the window
    expect(open.has("football:La Liga")).toBe(true);
    expect(open.has("football:Serie A")).toBe(false);
  });

  it("ties on size go to the group that comes first in the page order", () => {
    const groups = groupLeagues([item({ league: "League Two" }), item({ league: "Serie A" }), item({ league: "Premier League" })]);
    expect([...defaultOpenIds(groups)]).toEqual(["football:Premier League", "football:Serie A"]);
  });

  it("CARDS_PER_LEAGUE is two rows of four", () => {
    expect(CARDS_PER_LEAGUE).toBe(8);
  });
});

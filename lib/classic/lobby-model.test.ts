import { describe, expect, it } from "vitest";
import type { LobbyItem } from "@/lib/ui/lobby";
import {
  applySportFilter, applyTab, differsMostItems, estimatedRawGapPp, featuredItems, groupBySportLeague,
  leagueTier, matchesDateFilter, matchesQuery, tennisCircuit, DIFFERS_MAX_RAW_GAP_PP, UNNAMED_LEAGUE,
} from "./lobby-model";

const NOW = Date.parse("2026-10-10T10:00:00Z");
const h = (n: number) => new Date(NOW + n * 3600_000).toISOString();

let seq = 0;
function item(p: Partial<LobbyItem["data"]> & { league: string | null }): LobbyItem {
  const id = String(++seq);
  const data = {
    id, sport: "football", home: `H${id}`, away: `A${id}`, startsAt: h(5), isLive: false,
    pick: null, modelPct: 50, marketPct: 50, edgePct: 0, ...p,
  } as LobbyItem["data"];
  return { data, key: `${data.sport}:${id}` };
}

describe("groupBySportLeague", () => {
  it("orders sports football → tennis, leagues by tier then first kick-off, never an empty group", () => {
    const rows = [
      item({ sport: "tennis", league: "ATP Tokyo", startsAt: h(1) }),
      item({ league: "League Two", startsAt: h(1) }),
      item({ league: "Serie A", startsAt: h(6) }),
      item({ league: "Premier League", startsAt: h(3) }),
      item({ league: "Serie A", startsAt: h(2) }),
      item({ league: "Championship", startsAt: h(0.5) }),
    ];
    const blocks = groupBySportLeague(rows);
    expect(blocks.map((b) => b.sport)).toEqual(["football", "tennis"]);
    expect(blocks[0].groups.map((g) => g.league)).toEqual(["Serie A", "Premier League", "Championship", "League Two"]);
    expect(blocks[0].groups[0].items.map((r) => r.data.startsAt)).toEqual([h(2), h(6)]);
    expect(blocks[0].count).toBe(5);
    expect(blocks.flatMap((b) => b.groups).every((g) => g.items.length > 0)).toBe(true);
  });

  it("puts live rows first inside a group and counts them", () => {
    const rows = [item({ league: "Serie A", startsAt: h(1) }), item({ league: "Serie A", startsAt: h(-1), isLive: true })];
    const g = groupBySportLeague(rows)[0].groups[0];
    expect(g.items[0].data.isLive).toBe(true);
    expect(g.liveCount).toBe(1);
  });

  it("knows the country of the leagues the board serves, unknown leagues sink to the bottom", () => {
    const blocks = groupBySportLeague([item({ league: "Mystery Cup", startsAt: h(0.1) }), item({ league: "Serie B" })]);
    expect(blocks[0].groups[0].league).toBe("Serie B");
    expect(blocks[0].groups[0].country).toEqual({ iso: "IT" });
    expect(blocks[0].groups[1].country).toBeNull();
    expect(leagueTier("football", "Mystery Cup")).toBe(4);
  });
});

describe("unnamed leagues", () => {
  it("rows without a league/tournament form one group at the bottom", () => {
    const rows = [item({ sport: "tennis", league: null, startsAt: h(0.1) }), item({ sport: "tennis", league: "Challenger Lima", startsAt: h(9) })];
    const g = groupBySportLeague(rows)[0].groups;
    expect(g.map((x) => x.league)).toEqual(["Challenger Lima", UNNAMED_LEAGUE]);
    expect(g[1].circuit).toBeNull();
  });
});

describe("tennis", () => {
  it("ranks main tour above Challenger/ITF and names the circuit", () => {
    expect(leagueTier("tennis", "ATP Shanghai")).toBe(1);
    expect(leagueTier("tennis", "Wimbledon")).toBe(1);
    expect(leagueTier("tennis", "Challenger Lima")).toBe(3);
    expect(tennisCircuit("Challenger Lima")).toBe("Challenger");
    expect(tennisCircuit("WTA Wuhan")).toBe("WTA");
    expect(tennisCircuit(null)).toBeNull();
  });
});

describe("estimatedRawGapPp / differsMostItems", () => {
  it("inverts the 0.3 football blend; tennis is not a blend", () => {
    // servito 55 vs mercato 50 → grezzo ≈ 5/0,3 ≈ 16,7 (senza margine) — fuori.
    const fb = item({ league: "Serie A", modelPct: 55, marketPct: 50, edgePct: 5 });
    expect(estimatedRawGapPp(fb)!).toBeGreaterThan(DIFFERS_MAX_RAW_GAP_PP);
    const tn = item({ sport: "tennis", league: "ATP Tokyo", modelPct: 60, marketPct: 50, edgePct: 10 });
    expect(estimatedRawGapPp(tn)!).toBeLessThanOrEqual(DIFFERS_MAX_RAW_GAP_PP);
  });

  it("has no gap without a market, or when the number IS the market", () => {
    expect(estimatedRawGapPp(item({ league: "Serie A", marketPct: null, edgePct: null }))).toBeNull();
    expect(estimatedRawGapPp(item({ sport: "tennis", league: "ATP", probabilitySource: "market", modelPct: 52, marketPct: 50 }))).toBeNull();
  });

  it("keeps only not-started rows within 15 raw points, largest served gap first", () => {
    const ok1 = item({ league: "Serie A", modelPct: 52, marketPct: 51, edgePct: 1 });
    const ok2 = item({ league: "Serie A", modelPct: 53, marketPct: 51, edgePct: 2 });
    const tooFar = item({ league: "Serie A", modelPct: 60, marketPct: 50, edgePct: 10 });
    const live = item({ league: "Serie A", modelPct: 53, marketPct: 51, edgePct: 2, isLive: true, startsAt: h(-1) });
    const noMarket = item({ league: "Serie A", marketPct: null, edgePct: null });
    const out = differsMostItems([ok1, ok2, tooFar, live, noMarket], NOW);
    expect(out.map((r) => r.key)).toEqual([ok2.key, ok1.key]);
  });

  it("leaves tennis out (the tennis number is an unsealed Elo, not our estimate)", () => {
    const tn = item({ sport: "tennis", league: "ATP Tokyo", modelPct: 55, marketPct: 50, edgePct: 5 });
    expect(differsMostItems([tn], NOW)).toEqual([]);
  });
});

describe("featuredItems", () => {
  it("comparison rail mixes eligible sports but keeps tennis chronological, never ordered by Elo gap", () => {
    const t1 = item({ sport: "tennis", league: "ATP", startsAt: h(1), classic: { sport: "tennis", modelVersion: "elo", tournament: "ATP" } });
    const t2 = item({ sport: "tennis", league: "WTA", startsAt: h(2), classic: { sport: "tennis", modelVersion: "elo", tournament: "ATP" } });
    const f = item({ league: "Serie A", classic: { sport: "football" } });
    const market = item({ sport: "tennis", league: "ITF", classic: { sport: "tennis", modelVersion: "elo", tournament: "ATP" } });
    const gap = (r: LobbyItem) => r === market ? null : r === t1 ? 0.2 : 4;
    expect(differsMostItems([f, t2, market, t1], NOW, 6, gap)).toEqual([t1, t2, f]);
  });
  it("opens with tennis without losing football, including lower-tier tennis", () => {
    const football = Array.from({ length: 12 }, () => item({ league: "Serie A", locked: false }));
    const tennis = Array.from({ length: 4 }, () => item({ sport: "tennis", league: "ITF Example", locked: false }));
    const result = featuredItems([...football, ...tennis], NOW);
    expect(result.slice(0, 3).map(r => r.data.sport)).toEqual(["tennis", "tennis", "football"]);
    expect(result).toHaveLength(10);
    expect(new Set(result.map(r => r.key)).size).toBe(10);
  });

  it("Free puts all six server-unlocked matches first without unlocking anything", () => {
    const open = ["football", "tennis"].flatMap(sport => Array.from({ length: 3 }, () => item({ sport, league: "ITF Example", locked: false, startsAt: h(10) })));
    const closed = Array.from({ length: 12 }, () => item({ league: "Serie A", locked: true, startsAt: h(1) }));
    const result = featuredItems([...closed, ...open], NOW, 10, true);
    expect(new Set(result.slice(0, 6).map(r => r.key))).toEqual(new Set(open.map(r => r.key)));
    expect(result.slice(6).every(r => r.data.locked)).toBe(true);
    expect(closed.every(r => r.data.locked)).toBe(true);
  });

  it("Pro does not apply Free priorities or a three-per-sport selection cap", () => {
    const rows = Array.from({ length: 8 }, (_, i) => item({ sport: "tennis", league: "ATP Tokyo", locked: false, startsAt: h(i + 1) }));
    expect(featuredItems(rows, NOW)).toEqual(rows);
  });
  it("prefers live, then next kick-offs, in tier-1 leagues", () => {
    const rows = [
      item({ league: "Veikkausliiga", startsAt: h(0.2) }),
      item({ league: "Serie A", startsAt: h(4) }),
      item({ league: "Premier League", startsAt: h(2) }),
      item({ league: "La Liga", startsAt: h(-0.5), isLive: true }),
      item({ league: "Bundesliga", startsAt: h(3) }),
      item({ league: "Ligue 1", startsAt: h(-3) }), // finita, non live: fuori
    ];
    const f = featuredItems(rows, NOW);
    expect(f.map((r) => r.data.league)).toEqual(["La Liga", "Premier League", "Bundesliga", "Serie A"]);
  });

  it("falls back to lower tiers rather than staying empty", () => {
    const rows = [item({ league: "League Two" }), item({ league: "Veikkausliiga" })];
    expect(featuredItems(rows, NOW)).toHaveLength(2);
  });
});

describe("filters", () => {
  const tz = "Europe/Rome";
  it("today / tomorrow / live in the user's timezone", () => {
    const today = item({ league: "Serie A", startsAt: "2026-10-10T20:00:00Z" });
    const tomorrow = item({ league: "Serie A", startsAt: "2026-10-11T12:00:00Z" });
    const lateTonightUtcButTomorrowRome = item({ league: "Serie A", startsAt: "2026-10-10T22:30:00Z" });
    const live = item({ league: "Serie A", startsAt: "2026-10-10T09:00:00Z", isLive: true });
    expect(matchesDateFilter(today, "today", tz, NOW)).toBe(true);
    expect(matchesDateFilter(tomorrow, "tomorrow", tz, NOW)).toBe(true);
    expect(matchesDateFilter(lateTonightUtcButTomorrowRome, "tomorrow", tz, NOW)).toBe(true);
    expect(matchesDateFilter(live, "today", tz, NOW)).toBe(true);
    expect(matchesDateFilter(live, "live", tz, NOW)).toBe(true);
    expect(matchesDateFilter(today, "live", tz, NOW)).toBe(false);
  });

  it("Popular = top leagues, but never empties the page", () => {
    const top = item({ league: "Serie A" });
    const low = item({ league: "League Two" });
    expect(applySportFilter([top, low], "popular")).toEqual([top]);
    expect(applySportFilter([low], "popular")).toEqual([low]);
    expect(applySportFilter([top, item({ sport: "tennis", league: "ATP" })], "tennis")).toHaveLength(1);
  });

  it("In-Play and Starting Soon tabs", () => {
    const live = item({ league: "Serie A", isLive: true, startsAt: h(-1) });
    const soon = item({ league: "Serie A", startsAt: h(1) });
    const later = item({ league: "Serie A", startsAt: h(8) });
    expect(applyTab([live, soon, later], "inplay", NOW)).toEqual([live]);
    expect(applyTab([live, soon, later], "soon", NOW)).toEqual([soon]);
    expect(applyTab([live, soon, later], "all", NOW)).toHaveLength(3);
  });

  it("search matches teams and league, case-insensitive", () => {
    const r = item({ league: "Serie A", home: "Genoa CFC", away: "ACF Fiorentina" });
    expect(matchesQuery(r, "fiorent")).toBe(true);
    expect(matchesQuery(r, "serie")).toBe(true);
    expect(matchesQuery(r, "juve")).toBe(false);
    expect(matchesQuery(r, "  ")).toBe(true);
  });
});

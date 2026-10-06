// Name-tolerant join for Altenar books — pairs taken from the live probe of
// 06/10/2026 (board name || Wildz name). Fictitious prices.
import { describe, expect, it } from "vitest";
import type { FpMatch } from "@/lib/fortuneplay-live";
import { compatibleNames, fuzzyFootballMatch } from "./fixture-match";

const fm = (homeName: string, awayName: string, startTime = "2026-10-10T14:00:00Z", over: Partial<FpMatch> = {}): FpMatch => ({
  teamPairKey: `${homeName}|${awayName}`, homeKey: "", awayKey: "", sport: "soccer", slug: "", id: 1, urnId: "",
  oddsHome: 2, oddsDraw: 3.4, oddsAway: 3.6, totalLine: null, totalOver: null, totalUnder: null,
  homeName, awayName, startTime, ...over,
});
const mapOf = (...ms: FpMatch[]) => new Map(ms.map((m) => [m.teamPairKey, m]));

describe("compatibleNames", () => {
  it.each([
    ["KuPS Kuopio", "KuPS"],
    ["Botafogo", "Botafogo-RJ"],
    ["SV Darmstadt 98", "Darmstadt"],
    ["Club Atlético de Madrid", "Atlético Madrid"],
    ["Västerås SK", "Vasteras SK FK"],
  ])("%s ~ %s", (a, b) => expect(compatibleNames(a, b)).toBe(true));

  it.each([
    ["Pau FC", "Laval"],
    ["Amed SK", "Amed Sportif Faaliyetler"],
    ["Manchester United", "Manchester City"],
    ["", "Arsenal"],
  ])("%s !~ %s", (a, b) => expect(compatibleNames(a, b)).toBe(false));
});

describe("fuzzyFootballMatch", () => {
  const ours = { home: "PSV Eindhoven", away: "Heerenveen", kickoff: "2026-10-10T14:00:00Z" };

  it("joins when both teams are compatible and kickoff is within 30 min", () => {
    expect(fuzzyFootballMatch(mapOf(fm("PSV", "Heerenveen", "2026-10-10T14:15:00Z")), ours)).toMatchObject({ swapped: false });
  });

  it("reports a reversed listing", () => {
    expect(fuzzyFootballMatch(mapOf(fm("Heerenveen", "PSV")), ours)?.swapped).toBe(true);
  });

  it("refuses: kickoff too far, one team different, tennis, or two candidates", () => {
    expect(fuzzyFootballMatch(mapOf(fm("PSV", "Heerenveen", "2026-10-10T15:00:00Z")), ours)).toBeNull();
    expect(fuzzyFootballMatch(mapOf(fm("PSV", "Ajax")), ours)).toBeNull();
    expect(fuzzyFootballMatch(mapOf(fm("PSV", "Heerenveen", undefined, { sport: "tennis" })), ours)).toBeNull();
    expect(fuzzyFootballMatch(mapOf(fm("PSV", "Heerenveen"), fm("PSV Eindhoven", "SC Heerenveen")), ours)).toBeNull();
  });
});

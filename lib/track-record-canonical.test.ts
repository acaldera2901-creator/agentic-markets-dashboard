// #COERENZA-1001 (b) — una sola definizione di «pick che conta».
//
// Prima: wasShownAsPick (route) e countsAsShownPick (yesterday-read) scritte a
// mano, la seconda lasciava passare verification_state NULL e non
// deduplicava; il dedup teneva la gemella con settled_at più recente.
import { describe, it, expect } from "vitest";
import { dedupeByFixture } from "./dedupe-fixtures";
import { isShownPick, dedupeShownPicks, trackRecordPopulation } from "./track-record";

const base = {
  sport: "football", competition: "Allsvenskan", market: "1X2",
  home_team: "Kalmar FF", away_team: "BK Häcken",
  starts_at: "2026-09-20T13:00:00Z", notes: null as string | null,
  verification_state: "verified", confidence_score: 70,
};

describe("dedupeByFixture: opzione oldest", () => {
  it("vince il valore più BASSO di freshness, e un valore assente perde", () => {
    const rows = [
      { id: "new", home_team: "A", away_team: "B", kickoff: "2026-09-20T13:00:00Z", at: "2026-09-19T10:00:00Z" },
      { id: "old", home_team: "A", away_team: "B", kickoff: "2026-09-20T13:00:00Z", at: "2026-09-18T10:00:00Z" },
      { id: "none", home_team: "A", away_team: "B", kickoff: "2026-09-20T13:00:00Z", at: null },
    ];
    expect(dedupeByFixture(rows, { freshness: (r) => r.at, oldest: true }).map((r) => r.id)).toEqual(["old"]);
    // default invariato: vince il più alto
    expect(dedupeByFixture(rows, { freshness: (r) => r.at }).map((r) => r.id)).toEqual(["new"]);
  });
});

describe("dedupeShownPicks: vince la pick vista per prima dal cliente", () => {
  it("nelle gemelle con pick opposte conta la pubblicata prima, non la settlata per ultima", () => {
    const first = { ...base, id: "first", pick: "HOME", result: "lost",
      published_at: "2026-09-19T08:00:00Z", settled_at: "2026-09-20T15:00:00Z" };
    const later = { ...base, id: "later", pick: "AWAY", result: "won",
      published_at: "2026-09-19T20:00:00Z", settled_at: "2026-09-21T09:00:00Z" };
    expect(dedupeShownPicks([later, first]).map((r) => r.id)).toEqual(["first"]);
  });
});

describe("isShownPick", () => {
  it("pick nulla o sotto floor (non WC) non è mostrata; WC sotto floor sì; legacy sì", () => {
    const below = JSON.stringify({ surface: { below_floor: true } });
    expect(isShownPick({ pick: null })).toBe(false);
    expect(isShownPick({ pick: "HOME", notes: below, competition: "Serie A" })).toBe(false);
    expect(isShownPick({ pick: "HOME", notes: below, competition: "World Cup" })).toBe(true);
    expect(isShownPick({ pick: "HOME", notes: null })).toBe(true);
    expect(isShownPick({ pick: "HOME", notes: "{rotto" })).toBe(true);
  });
});

describe("trackRecordPopulation", () => {
  it("verification_state NULL non entra nell'headline", () => {
    const p = trackRecordPopulation([
      { ...base, id: "x", pick: "HOME", result: "won", verification_state: null, published_at: "2026-09-19T08:00:00Z" },
    ]);
    expect(p.headlineRows).toHaveLength(0);
    expect(p.unverifiedExcluded).toBe(1);
  });

  it("le esclusioni sono disgiunte e sommano al denominatore", () => {
    const p = trackRecordPopulation([
      { ...base, id: "ok", pick: "HOME", result: "won", published_at: "2026-09-19T08:00:00Z" },
      { ...base, id: "twin", pick: "HOME", result: "won", published_at: "2026-09-19T09:00:00Z" },
      { ...base, id: "unv", home_team: "Malmo FF", pick: "HOME", result: "lost", verification_state: "unverified", published_at: "2026-09-19T08:00:00Z" },
      { ...base, id: "unr", home_team: "AIK", pick: "HOME", result: "unresolved", published_at: "2026-09-19T08:00:00Z" },
      { ...base, id: "nul", home_team: "Hammarby", pick: "HOME", result: null, published_at: "2026-09-19T08:00:00Z" },
      // post-cutover, nazionale sotto il floor della sua lega → fuori dall'headline
      { ...base, id: "floor", competition: "UEFA Nations League", home_team: "Italia", away_team: "Francia",
        starts_at: "2026-09-27T18:45:00Z", confidence_score: 37, pick: "AWAY", result: "won", published_at: "2026-09-26T08:00:00Z" },
    ]);
    expect(p.headlineRows.map((r) => r.id)).toEqual(["ok"]);
    expect(p.dedupDropped).toBe(1);
    expect(p.dedupDroppedDecided).toBe(1);
    expect(p.unverifiedExcluded).toBe(1);
    expect(p.unresolvedExcluded).toBe(2);
    expect(p.excludedByFloor.map((r) => r.id)).toEqual(["floor"]);
    expect(p.surfaced.length).toBe(
      p.headlineRows.length + p.unverifiedExcluded + p.unresolvedExcluded + p.excludedByFloor.length,
    );
  });
});

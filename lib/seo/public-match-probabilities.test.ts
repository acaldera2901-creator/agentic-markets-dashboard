import { describe, expect, it } from "vitest";
import { fixtureReadingKey, publicMatchReadings } from "./public-match-probabilities";

const start = "2026-11-25T17:45:00.000Z";
const fixture = {
  id: "test",
  sport: "football",
  competition: "Test league",
  home: "First FC",
  away: "Second FC",
  startsAt: start,
} as const;
const football = { home_team: " FIRST  FC ", away_team: "Second FC", kickoff: start, locked: true, model_prob: 0.55 };

describe("public match readings", () => {
  const key = fixtureReadingKey(fixture)!;

  it("uses only the locked public number and matches the precise fixture time", () => {
    const readings = publicMatchReadings("football", { predictions: [{ ...football, p_home: 0.7, pick: "home" }] });
    expect(readings.get(key)).toEqual({ probability: 0.55, source: "estimate" });
    expect(readings.get(fixtureReadingKey({ ...fixture, startsAt: "2026-11-25T18:00:00.000Z" })!)).toBeUndefined();
  });

  it("suppresses ambiguous, stale, unlocked or invalid data", () => {
    expect(publicMatchReadings("football", { predictions: [football, football] }).get(key)).toBeNull();
    expect(publicMatchReadings("football", { is_stale: true, predictions: [football] }).size).toBe(0);
    expect(publicMatchReadings("football", { predictions: [{ ...football, locked: false }, { ...football, model_prob: -1 }] }).size).toBe(0);
  });

  it("keeps recent database football readings through the two-hour refresh cycle", () => {
    const now = Date.parse("2026-11-25T13:50:00Z");
    const payload = { source: "database", is_stale: true };
    const read = (computed_at: string) =>
      publicMatchReadings("football", { ...payload, predictions: [{ ...football, computed_at }] }, now);

    expect(read("2026-11-25T12:01:00Z").get(key))
      .toEqual({ probability: 0.55, source: "estimate", computedAt: "2026-11-25T12:01:00Z" });
    expect(read("2026-11-25T11:49:00Z").size).toBe(0);
    expect(read("2026-11-25T13:51:00Z").size).toBe(0);
    expect(read("invalid").size).toBe(0);
    expect(publicMatchReadings("football", {
      source: "database", is_stale: false, predictions: [{ ...football, computed_at: "2026-11-25T11:00:00Z" }],
    }, now).size).toBe(0);
  });

  it("keeps market-derived tennis numbers distinct from estimates", () => {
    const tennis = { player1: fixture.home, player2: fixture.away, scheduled: start, locked: true, model_prob: 0.61 };
    expect(publicMatchReadings("tennis", { matches: [{ ...tennis, probability_source: "market" }] }).get(key))
      .toEqual({ probability: 0.61, source: "market" });
    expect(publicMatchReadings("tennis", { matches: [{ ...tennis, probability_source: "unknown" }] }).size).toBe(0);
  });
});

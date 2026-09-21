import { describe, expect, it } from "vitest";
import { deduplicatePredictions } from "./prediction-dedup";

const a = { id: "espn", sport: "tennis", market: "ML", home_team: "Ayla Aksu", away_team: "Lina Gjorcheska", pick: "Lina Gjorcheska", competition: "Ankara Open", starts_at: "2026-09-21T16:00:00Z", updated_at: "2026-09-21T15:00:00Z" };
const b = { ...a, id: "partner", home_team: a.away_team, away_team: a.home_team, competition: "Partner feed" };
describe("tennis fixture reconciliation", () => {
  it("collapses a named tournament and its provider placeholder with equivalent timestamp", () => {
    expect(deduplicatePredictions([a, { ...b, starts_at: "2026-09-21T18:00:00+02:00" }]).rows).toHaveLength(1);
  });
  it("quarantines contradictory winners independent of source order", () => {
    const bad = { ...b, pick: a.home_team };
    for (const rows of [[a, bad], [bad, a]]) {
      expect(deduplicatePredictions(rows)).toEqual({ rows: [], conflictedFixtures: 1 });
    }
  });
  it("preserves distinct tournaments, rounds and times", () => {
    for (const changed of [{ competition: "Another Open" }, { round: "Final" }, { starts_at: "2026-09-21T20:00:00Z" }]) {
      expect(deduplicatePredictions([{ ...a, round: "Semi-final" }, { ...b, ...changed }]).rows).toHaveLength(2);
    }
  });
  it("never lets a generic source bridge two distinct tournaments", () => {
    const other = { ...a, id: "other", competition: "Other Open" };
    expect(deduplicatePredictions([a, other, b]).rows.map(r => r.id).sort()).toEqual(["espn", "other"]);
  });
  it("selects the freshest coherent source deterministically without swapping fields", () => {
    const newer = { ...b, updated_at: "2026-09-21T15:01:00Z" };
    expect(deduplicatePredictions([a, newer]).rows).toEqual([newer]);
    expect(deduplicatePredictions([newer, a]).rows).toEqual([newer]);
  });
  it("normalizes Unicode and whitespace but does not guess abbreviated player aliases", () => {
    expect(deduplicatePredictions([a, { ...b, home_team: "  LINA   GJORCHESKA " }]).rows).toHaveLength(1);
    expect(deduplicatePredictions([a, { ...b, home_team: "L. Gjorcheska" }]).rows).toHaveLength(2);
  });
  it("preserves rows with incomplete identity and leaves input unchanged", () => {
    const rows = [Object.freeze({ ...a, starts_at: "bad" }), Object.freeze({ ...b, starts_at: "bad" })];
    expect(deduplicatePredictions(rows).rows).toHaveLength(2);
  });
  it("preserves existing ordered football daily dedup and prefers a declared pick", () => {
    const football = { ...a, sport: "football", pick: null };
    const complete = { ...football, id: "complete", pick: "1" };
    expect(deduplicatePredictions([football, complete]).rows).toEqual([complete]);
  });
  it("keeps first fixture position when replacing a football source", () => {
    const first = { ...a, sport: "football", pick: null };
    const second = { ...first, id: "second", home_team: "Other" };
    const replacement = { ...first, id: "replacement", pick: "1" };
    expect(deduplicatePredictions([first, second, replacement]).rows).toEqual([replacement, second]);
  });
  it("does not broaden legacy football identity normalization", () => {
    const first = { ...a, sport: "football", home_team: "Team  A" };
    expect(deduplicatePredictions([first, { ...first, id: "other", home_team: "Team A" }]).rows).toHaveLength(2);
  });
  it("filters football sources before legacy deduplication", () => {
    const first = { ...a, sport: "football", status: "open" };
    const second = { ...first, id: "second", status: "pending_settlement" };
    expect(deduplicatePredictions([first, second], r => r.status === "pending_settlement").rows).toEqual([second]);
  });
  it("resolves incomplete tournament/round context using the entire bucket, never ID order", () => {
    const final = { ...b, id: "b", round: "Final", pick: a.home_team };
    const semi = { ...b, id: "c", round: "Semi", pick: a.away_team };
    for (const id of ["a", "z"]) {
      expect(deduplicatePredictions([{ ...a, id }, final, semi]).rows).toEqual([final, semi]);
    }
  });
});

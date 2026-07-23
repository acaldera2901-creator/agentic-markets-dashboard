import { describe, it, expect } from "vitest";
import {
  SUMMER_LEAGUES,
  SUMMER_LIVE_ESPN_SLUGS,
  isSummerLeague,
  fetchSummerHistory,
  matchModelTeam,
} from "./summer-leagues";
import { surfaceFloorFor, isSurfacedRow } from "./surfacing-gate";

// #SERIE-B-1 — Serie B rides the off-free-tier ("summer league") machinery.
// These tests pin the wiring so a future refactor can't silently drop the
// league or collapse its precautionary floor into Serie A's default.

describe("#SERIE-B-1 wiring", () => {
  it("Serie B is registered as an off-free-tier league", () => {
    expect(isSummerLeague("SB")).toBe(true);
    expect(SUMMER_LEAGUES.SB).toBe("Serie B");
  });

  it("ships a non-empty history snapshot with valid results", () => {
    const hist = fetchSummerHistory("SB");
    expect(hist.length).toBeGreaterThan(100); // a full I2 season is ~380
    for (const m of hist.slice(0, 50)) {
      expect(typeof m.homeTeam).toBe("string");
      expect(typeof m.awayTeam).toBe("string");
      expect(Number.isInteger(m.homeGoals)).toBe(true);
      expect(Number.isInteger(m.awayGoals)).toBe(true);
      expect(m.homeGoals).toBeGreaterThanOrEqual(0);
      expect(m.awayGoals).toBeGreaterThanOrEqual(0);
    }
  });

  it("is included in the live ESPN scoreboard slugs (ita.2)", () => {
    expect(SUMMER_LIVE_ESPN_SLUGS).toContain("ita.2");
  });

  it("resolves fixture-name drift against the model roster", () => {
    const roster = ["US Avellino", "Hellas Verona", "Virtus Entella", "Sudtirol"];
    expect(matchModelTeam("Avellino", roster)).toBe("US Avellino");
    expect(matchModelTeam("Verona", roster)).toBe("Hellas Verona");
    // A team not in the roster (e.g. relegated/promoted out) must NOT be guessed.
    expect(matchModelTeam("Juventus", roster)).toBeNull();
  });
});

describe("#SERIE-B-1 surfacing floor (coverage-first, precautionary 65)", () => {
  it("Serie B uses the precautionary floor 65, not the club default 56", () => {
    expect(surfaceFloorFor("football", "Serie B")).toBe(65);
    expect(surfaceFloorFor("football", "SERIE B")).toBe(65); // case-insensitive
  });

  it("does NOT collide with Serie A (Serie A stays at the club default 56)", () => {
    expect(surfaceFloorFor("football", "Serie A")).toBe(56);
  });

  it("only surfaces a directional pick at/above the 65 floor", () => {
    expect(isSurfacedRow({ sport: "football", competition: "Serie B", confidence_score: 64 })).toBe(false);
    expect(isSurfacedRow({ sport: "football", competition: "Serie B", confidence_score: 65 })).toBe(true);
    // A strong Serie A favourite at 60 still surfaces (its floor is 56) — proves
    // the two Italian leagues are gated independently.
    expect(isSurfacedRow({ sport: "football", competition: "Serie A", confidence_score: 60 })).toBe(true);
  });
});

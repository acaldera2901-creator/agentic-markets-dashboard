import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchInjuries } from "./api-football-enrichment";

// Shape of the live /injuries?fixture= response (sampled 2026-10-01, fixture 1490500).
const entry = (team: string, id: number, name: string) => ({
  player: { id: 1, name, type: "Missing Fixture", reason: "Ankle Injury" },
  team: { id, name: team },
  fixture: { id: 1490500 },
});

describe("fetchInjuries", () => {
  beforeEach(() => { process.env.API_FOOTBALL_KEY = "short-key"; });
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.API_FOOTBALL_KEY; });

  it("assigns sides by team name even when the away side comes first", async () => {
    const body = { response: [entry("St. Louis City", 2, "A. Away"), entry("New York Red Bulls", 1, "H. Home")] };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));
    const inj = await fetchInjuries(1490500, { home: "New York Red Bulls", away: "St. Louis City SC" });
    expect(inj.home).toEqual(["H. Home (Missing Fixture)"]);
    expect(inj.away).toEqual(["A. Away (Missing Fixture)"]);
  });

  it("drops entries that match neither side and degrades to empty on HTTP error", async () => {
    const body = { response: [entry("Somebody Else", 9, "X")] };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));
    expect(await fetchInjuries(1, { home: "Inter", away: "Milan" })).toEqual({ home: [], away: [] });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 403 })));
    expect(await fetchInjuries(1, { home: "Inter", away: "Milan" })).toEqual({ home: [], away: [] });
  });
});

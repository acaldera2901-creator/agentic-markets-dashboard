// #CALCIO-1001 — why 217 sealed football picks ended 'unresolved'.
//
// Measured 01/10: ESPN answers 400 to every `dates=YYYYMMDD-YYYYMMDD` range
// (since 15/09, noted in core/espn_soccer_client.py::_scoreboard_window), so
// lib/summer-leagues.ts::fetchEspnResults returned [] on EVERY run: no espn:*
// row of the 28 minor leagues could close from the cron, and step E sealed
// them 'unresolved' at 48h. Single days and whole months still answer 200.
import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchSummerResults } from "@/lib/summer-leagues";
import { espnSlugForLeague, pianoRecuperoEspn } from "@/lib/espn-results";
import { mesiEspn, ESPN_RECOVERY_DAYS } from "@/lib/espn";

const espnEvent = (id: string, date: string, hs: string, as: string) => ({
  id, date,
  status: { type: { completed: true, state: "post" } },
  competitions: [{ competitors: [
    { homeAway: "home", score: hs, team: { displayName: "Club Brugge" } },
    { homeAway: "away", score: as, team: { displayName: "Anderlecht" } },
  ] }],
});

afterEach(() => vi.unstubAllGlobals());

describe("fetchSummerResults — ESPN rejects date ranges", () => {
  it("reads finals through month queries, never a range", async () => {
    const seen: string[] = [];
    const recent = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const old = new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      seen.push(url);
      if (/dates=\d{8}-\d{8}/.test(url)) return new Response("Failed to get events endpoint.", { status: 400 });
      if (/dates=\d{6}(&|$)/.test(url)) {
        return new Response(JSON.stringify({ events: [espnEvent("1", recent, "2", "1"), espnEvent("2", old, "0", "0")] }), { status: 200 });
      }
      return new Response("[]", { status: 200 });
    }));
    const out = await fetchSummerResults("BEL");
    expect(out).toEqual([{ id: "espn:1", homeGoals: 2, awayGoals: 1 }]); // the 40-day-old one is outside the window
    expect(seen.some((u) => /dates=\d{8}-\d{8}/.test(u))).toBe(false);
  });
});

describe("recovery of open served rows by date + names", () => {
  it("every served league resolves to its ESPN slug, top and minor", () => {
    expect(espnSlugForLeague("PL")).toBe("eng.1");
    expect(espnSlugForLeague("BEL")).toBe("bel.1");
    expect(espnSlugForLeague("MLS")).toBe("usa.1");
    expect(espnSlugForLeague("POL")).toBeUndefined(); // no ESPN league
  });

  it("months follow ESPN's US day: a 02:30Z kickoff on the 1st is listed in the previous month", () => {
    expect(mesiEspn(new Date("2026-10-01T02:30:00Z"), new Date("2026-10-01T02:30:00Z"))).toEqual(["202609", "202610"]);
    expect(mesiEspn(new Date("2026-09-10T00:00:00Z"), new Date("2026-09-20T00:00:00Z"))).toEqual(["202609"]);
  });

  it("groups rows by slug with the months to read, skipping leagues without ESPN", () => {
    const plan = pianoRecuperoEspn(
      [
        { league: "BEL", starts_at: "2026-09-20T16:00:00Z" },
        { league: "BEL", starts_at: "2026-10-01T02:30:00Z" },
        { league: "POL", starts_at: "2026-09-20T16:00:00Z" },
      ],
      espnSlugForLeague,
    );
    expect([...plan.keys()]).toEqual(["bel.1"]);
    expect(plan.get("bel.1")!.mesi).toEqual(["202609", "202610"]);
    expect(plan.get("bel.1")!.righe).toHaveLength(2);
  });

  it("the retry horizon is a week, not 48h", () => {
    expect(ESPN_RECOVERY_DAYS).toBe(7);
  });
});

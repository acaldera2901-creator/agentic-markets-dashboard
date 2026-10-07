// lib/v3c/live-service.test.ts (#V3C-LIVESCORES) — what the service reads and
// how often. DB and fetch mocked with the RECORDED ESPN payloads: no network.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbQueryStrict = vi.fn();
vi.mock("@/lib/db", () => ({ dbQueryStrict: (...a: unknown[]) => dbQueryStrict(...a) }));

import { _resetLiveCache, computeLive, getLive } from "./live-service.server";

const fx = (f: string) => JSON.parse(readFileSync(join(process.cwd(), "tests/fixtures/espn-live", f), "utf8"));
const NOW = new Date("2026-10-07T08:15:00Z");

describe("live service", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    _resetLiveCache();
    dbQueryStrict.mockReset().mockResolvedValue([
      { source_id: "tennis:espn:184839:tomas-machac:zhang-zhizhen", source_table: "tennis_predictions", league: "Rolex Shanghai Masters", starts_at: "2026-10-07 06:45:00+00", home_team: "Tomas Machac", away_team: "Zhang Zhizhen" },
      { source_id: "oddsapi:x", source_table: "match_predictions", league: "PD2", starts_at: "2026-10-07 07:30:00+00", home_team: "Sporting Gijon", away_team: "Celta Fortuna" },
    ]);
    fetchMock.mockReset().mockImplementation(async (url: string) => {
      const body = url.includes("/tennis/atp/") ? fx("tennis-atp-20261007.json") : url.includes("/tennis/wta/") ? fx("tennis-wta-20261007.json") : { events: [] };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("SELECT only, and only the scoreboards of the rows in the window", async () => {
    const r = await computeLive(NOW);
    const sql = String(dbQueryStrict.mock.calls[0][0]);
    expect(sql.trim().startsWith("SELECT")).toBe(true);
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|UPSERT)\b/i);
    const urls = fetchMock.mock.calls.map((c) => String(c[0]).replace(/^.*\/sports/, ""));
    expect(urls.sort()).toEqual(["/soccer/esp.2/scoreboard?dates=20261007", "/tennis/atp/scoreboard?dates=20261007", "/tennis/wta/scoreboard?dates=20261007"]);
    expect(r.items["tennis:espn:184839:tomas-machac:zhang-zhizhen"]).toMatchObject({ sport: "tennis", state: "live" });
    expect(r.coverage.football).toEqual({ rows: 1, matched: 0, no_source: 0, unmatched: 1 });
  });

  it("a feed error is reported, not hidden", async () => {
    fetchMock.mockImplementation(async () => new Response("nope", { status: 503 }));
    const r = await computeLive(NOW);
    expect(r.items).toEqual({});
    expect(r.coverage.failed_feeds.length).toBe(3);
    expect(r.coverage.tennis.no_source).toBe(1);
  });

  it("one build per TTL: concurrent and repeated calls share it", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    try {
      await Promise.all([getLive(), getLive(), getLive()]);
      await getLive();
      expect(dbQueryStrict).toHaveBeenCalledTimes(1);
      vi.setSystemTime(new Date(NOW.getTime() + 21_000));
      await getLive();
      expect(dbQueryStrict).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

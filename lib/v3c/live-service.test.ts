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

// live2 (#V3C-LIVE2): the fallback sources behind ESPN, with the recorded API-Football payload and a
// SYNTHETIC The Odds API game in progress. Keys are dummies; the network is mocked.
describe("live service · fallback sources", () => {
  const T = new Date("2026-10-07T10:40:00Z");
  const POL_ID = "0123456789abcdef0123456789abcdef";
  const KEY_A = "dummy-apif-key-123";
  const KEY_O = "dummy-odds-key-456";
  const apif = JSON.parse(readFileSync(join(process.cwd(), "tests/fixtures/live-sources/apifootball-live-all-20261007.json"), "utf8"));
  const odds = [{ id: POL_ID, commence_time: "2026-10-07T10:00:00Z", completed: false, home_team: "Legia Warszawa", away_team: "Lech Poznań", scores: [{ name: "Legia Warszawa", score: "1" }, { name: "Lech Poznań", score: "1" }], last_update: "2026-10-07T10:39:40Z" }];
  const fetchMock = vi.fn();
  let oddsStatus = 200;
  let oddsRemaining = "4900000";

  beforeEach(() => {
    _resetLiveCache();
    vi.stubEnv("API_FOOTBALL_DIRECT_KEY", KEY_A);
    vi.stubEnv("ODDS_API_KEY", KEY_O);
    oddsStatus = 200;
    oddsRemaining = "4900000";
    dbQueryStrict.mockReset().mockResolvedValue([
      { source_id: `oddsapi:${POL_ID}`, source_table: "match_predictions", league: "POL", starts_at: "2026-10-07 10:00:00+00", home_team: "Legia Warsaw", away_team: "Lech Poznan" },
      { source_id: "jp-1", source_table: "match_predictions", league: "JPN", starts_at: "2026-10-07 10:00:00+00", home_team: "Tokyo", away_team: "Shonan Bellmare" },
    ]);
    fetchMock.mockReset().mockImplementation(async (url: string) => {
      if (url.includes("api-sports.io")) return new Response(JSON.stringify(apif), { status: 200, headers: { "x-ratelimit-requests-remaining": "57" } });
      if (url.includes("the-odds-api.com")) return new Response(JSON.stringify(oddsStatus === 200 ? odds : { message: "rate" }), { status: oddsStatus, headers: { "x-requests-remaining": oddsRemaining, "x-requests-last": "1" } });
      return new Response(JSON.stringify({ events: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("rows ESPN does not cover get API-Football and The Odds API scores, each tagged with source and time", async () => {
    const r = await computeLive(T);
    expect(r.items[`oddsapi:${POL_ID}`]).toMatchObject({ source: "odds_api", matched_by: "id", state: "live", home: 1, away: 1, minute: null, updated_at: "2026-10-07T10:39:40.000Z" });
    expect(r.items["jp-1"]).toMatchObject({ source: "api_football", matched_by: "names", home: 2, away: 0, minute: "35'", updated_at: T.toISOString() });
    expect(r.source.name).toBe("API-Football + The Odds API");
    expect(r.sources.map((s) => [s.id, s.state, s.items])).toEqual([["espn", "ok", 0], ["api_football", "ok", 1], ["odds_api", "ok", 1]]);
    expect(r.sources[1]).toMatchObject({ calls_today: 1, budget_day: 40, remaining: 57 });
    expect(r.degraded).toBe(false);
    expect(r.coverage.football).toEqual({ rows: 2, matched: 2, no_source: 0, unmatched: 0 });
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.filter((u) => u.includes("api-sports.io"))).toEqual(["https://v3.football.api-sports.io/fixtures?live=all"]);
    expect(urls.filter((u) => u.includes("the-odds-api.com")).map((u) => u.replace(/apiKey=[^&]+/, "apiKey=…"))).toEqual(["https://api.the-odds-api.com/v4/sports/soccer_poland_ekstraklasa/scores?apiKey=…"]);
    // keys never leave the server
    expect(JSON.stringify(r)).not.toContain(KEY_A);
    expect(JSON.stringify(r)).not.toContain(KEY_O);
  });

  it("inside each source's interval the cached read is served: no new paid request", async () => {
    await computeLive(T);
    const n = fetchMock.mock.calls.length;
    const r = await computeLive(new Date(T.getTime() + 20_000));
    expect(fetchMock.mock.calls.length).toBe(n);
    expect(Object.keys(r.items).sort()).toEqual(["jp-1", `oddsapi:${POL_ID}`]);
  });

  it("no daily budget left → degraded and said so; the row shows no score instead of a stale one", async () => {
    vi.stubEnv("LIVE_APIF_DAILY", "0");
    const r = await computeLive(T);
    expect(r.items["jp-1"]).toBeUndefined();
    expect(r.sources[1]).toMatchObject({ id: "api_football", state: "degraded", reason: "daily live budget reached" });
    expect(r.degraded).toBe(true);
    expect(r.coverage.football).toMatchObject({ matched: 1, no_source: 1 });
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("api-sports.io"))).toBe(false);
  });

  it("an HTTP error backs off and is reported without the key", async () => {
    oddsStatus = 429;
    const r = await computeLive(T);
    expect(r.items[`oddsapi:${POL_ID}`]).toBeUndefined();
    expect(r.coverage.failed_feeds).toContain("odds-api/scores/soccer_poland_ekstraklasa:429");
    expect(r.sources[2]).toMatchObject({ state: "degraded", reason: "backing off after an error" });
    expect(r.coverage.failed_feeds.join(" ")).not.toContain(KEY_O);
  });

  it("provider quota under the reserve → live reads pause, the last fresh read is still served", async () => {
    oddsRemaining = "100";
    await computeLive(T);
    const n = fetchMock.mock.calls.filter((c) => String(c[0]).includes("the-odds-api.com")).length;
    const r = await computeLive(new Date(T.getTime() + 60_000));
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes("the-odds-api.com")).length).toBe(n);
    expect(r.sources[2]).toMatchObject({ state: "degraded", remaining: 100 });
    expect(r.items[`oddsapi:${POL_ID}`]).toMatchObject({ source: "odds_api", home: 1 });
  });

  it("without keys the fallbacks are «off», and ESPN-only behaviour is unchanged", async () => {
    vi.stubEnv("API_FOOTBALL_DIRECT_KEY", "");
    vi.stubEnv("ODDS_API_KEY", "");
    const r = await computeLive(T);
    expect(r.items).toEqual({});
    expect(r.sources.map((s) => s.state)).toEqual(["ok", "off", "off"]);
    expect(r.coverage.football).toMatchObject({ no_source: 2 });
  });
});

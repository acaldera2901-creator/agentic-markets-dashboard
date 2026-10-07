// lib/v3c/live2.test.ts (#V3C-LIVE2) — the two new live sources, the matching
// with different team names, the merge and the quota. Payloads RECORDED on
// 07/10 (tests/fixtures/live-sources); shapes the recording did not catch
// (half-time, penalties, an own goal, a game in progress on The Odds API) are
// written inline and marked SYNTHETIC. No network.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { V3LiveItem } from "./live-contract";
import { apiFootballAuth, apifMinute, apifState, parseApiFootballLive, type SourceSoccerEvent } from "./live-apifootball";
import { fuse, matchSourceEvent, oddsApiIdOf, sourceItem, teamMarkers } from "./live-fuse";
import type { LiveRow } from "./live-match";
import { parseOddsApiScores } from "./live-oddsapi";
import { LiveBudget } from "./live-quota";

const fx = (f: string) => JSON.parse(readFileSync(join(process.cwd(), "tests/fixtures/live-sources", f), "utf8"));
const AT = "2026-10-07T10:40:00.000Z";
const row = (p: Partial<LiveRow>): LiveRow => ({ id: "x", sport: "football", league: null, kickoff: "2026-10-07T10:00:00Z", home: "A", away: "B", ...p });

describe("API-Football live=all (recorded 07/10)", () => {
  const evs = parseApiFootballLive(fx("apifootball-live-all-20261007.json"), AT);
  it("every recorded fixture is read, with minute, score and the time we read it", () => {
    expect(evs).toHaveLength(12);
    const tokyo = evs.find((e) => e.id === "1635580")!;
    expect(tokyo).toMatchObject({ home: "FC Tokyo", away: "Shonan Bellmare", state: "live", minute: "35'", homeScore: 2, awayScore: 0, updatedAt: AT });
    expect(tokyo.events).toEqual([
      { minute: "14'", kind: "goal", team: "home", player: "F. Yamada" },
      { minute: "34'", kind: "goal", team: "home", player: null },
    ]);
  });
  it("a missed penalty and yellow cards are not goals or reds", () => {
    expect(evs.find((e) => e.id === "1635588")!.events).toEqual([]);
    expect(evs.find((e) => e.id === "1635585")!.events.map((e) => e.kind)).toEqual(["goal"]);
  });
  it("statuses, minutes and finals (SYNTHETIC shapes)", () => {
    expect(["NS", "1H", "HT", "2H", "ET", "BT", "P", "FT", "AET", "PEN", "PST", "ABD", "??"].map(apifState)).toEqual([
      "pre", "live", "break", "live", "live", "break", "live", "final", "final", "final", "off", "off", null,
    ]);
    expect([apifMinute(90, 4), apifMinute(0, null), apifMinute(null, null), apifMinute(45, 0)]).toEqual(["90'+4'", null, null, "45'"]);
    const base = { fixture: { id: 9, date: "2026-10-07T18:00:00+00:00", status: { short: "PEN", elapsed: 120 } }, teams: { home: { id: 1, name: "H" }, away: { id: 2, name: "A" } }, goals: { home: 1, away: 1 }, score: { penalty: { home: 4, away: 3 } } };
    const og = { time: { elapsed: 50 }, team: { id: 1 }, player: { name: "X" }, type: "Goal", detail: "Own Goal" };
    const so = { time: { elapsed: 120 }, team: { id: 2 }, player: { name: "Y" }, type: "Goal", detail: "Penalty", comments: "Penalty Shootout" };
    const red = { time: { elapsed: 70, extra: null }, team: { id: 2 }, player: { name: "Z" }, type: "Card", detail: "Red Card" };
    const [e] = parseApiFootballLive({ response: [{ ...base, events: [og, so, red] }] }, AT);
    expect(e).toMatchObject({ state: "final", final_kind: "pen", minute: null, pens: { home: 4, away: 3 }, homeScore: 1, awayScore: 1 });
    // own goal: side unverified → not placed; shoot-out kicks are not goals of the match
    expect(e.events).toEqual([{ minute: "70'", kind: "red_card", team: "away", player: "Z" }]);
  });
  it("garbage is dropped, never a 0", () => {
    expect(parseApiFootballLive(null, AT)).toEqual([]);
    expect(parseApiFootballLive({ response: [{ fixture: { id: 1 } }] }, AT)).toEqual([]);
    const [e] = parseApiFootballLive({ response: [{ fixture: { id: 1, date: AT, status: { short: "1H", elapsed: 10 } }, teams: { home: { name: "H" }, away: { name: "A" } }, goals: { home: null, away: "x" } }] }, AT);
    expect([e.homeScore, e.awayScore]).toEqual([null, null]);
  });
  it("the direct api-sports key first, RapidAPI only as a fallback, nothing without a key", () => {
    expect(apiFootballAuth({})).toBeNull();
    expect(apiFootballAuth({ API_FOOTBALL_DIRECT_KEY: "d", API_FOOTBALL_KEY: "r" })).toEqual({ base: "https://v3.football.api-sports.io", headers: { "x-apisports-key": "d" } });
    expect(apiFootballAuth({ API_FOOTBALL_KEY: "r" })!.base).toContain("rapidapi");
  });
});

describe("The Odds API /scores (recorded 07/10)", () => {
  const NOW = new Date("2026-10-07T10:40:00Z");
  it("completed with scores → final, by name, no FT/AET word; future → pre", () => {
    const evs = parseOddsApiScores(fx("oddsapi-scores-arg-20261007.json"), NOW);
    expect(evs.find((e) => e.id === "aa690fd7e46982c83048052821dc9cc6")).toMatchObject({
      state: "final", final_kind: null, homeScore: 1, awayScore: 0, minute: null, updatedAt: "2026-10-05T07:03:44.000Z",
    });
    expect(evs.find((e) => e.id === "271a6d20ede17d1858ebf2089454b948")).toMatchObject({ state: "pre", homeScore: null });
  });
  it("in progress → live without a minute; kicked off without scores → no item (SYNTHETIC)", () => {
    const evs = parseOddsApiScores(
      [
        { id: "a1", commence_time: "2026-10-07T10:00:00Z", completed: false, home_team: "H", away_team: "A", scores: [{ name: "A", score: "2" }, { name: "H", score: "1" }], last_update: "2026-10-07T10:39:30Z" },
        { id: "a2", commence_time: "2026-10-07T10:00:00Z", completed: false, home_team: "H", away_team: "A", scores: null },
        { id: "a3", commence_time: "2026-10-07T08:00:00Z", completed: true, home_team: "H", away_team: "A", scores: null },
      ],
      NOW,
    );
    expect(evs).toHaveLength(1);
    // scores are keyed by name, not by position
    expect(evs[0]).toMatchObject({ id: "a1", state: "live", minute: null, homeScore: 1, awayScore: 2 });
  });
});

describe("matching with different names (aliases)", () => {
  const odds = parseOddsApiScores(fx("oddsapi-scores-arg-20261007.json"), new Date("2026-10-07T10:40:00Z"));
  const pd2 = parseOddsApiScores(fx("oddsapi-scores-pd2-20261007.json"), new Date("2026-10-07T10:40:00Z"));
  it("our `oddsapi:` id is matched exactly, whatever the names", () => {
    const r = row({ id: "oddsapi:aa690fd7e46982c83048052821dc9cc6", league: "ARG", kickoff: "2026-10-04T17:45:00Z", home: "Huracan", away: "Aldosivi" });
    expect(oddsApiIdOf(r)).toBe("aa690fd7e46982c83048052821dc9cc6");
    expect(matchSourceEvent(r, odds, oddsApiIdOf(r))).toMatchObject({ by: "id", swapped: false });
  });
  it("by names: accents, sponsor-less short names, either orientation", () => {
    const r = row({ id: "560001", kickoff: "2026-10-04T17:50:00Z", home: "Huracan", away: "Aldosivi" });
    expect(matchSourceEvent(r, odds, null)).toMatchObject({ by: "names", swapped: false });
    const sw = row({ id: "560002", kickoff: "2026-10-04T14:17:00Z", home: "Celta Fortuna", away: "Sporting Gijon" });
    const hit = matchSourceEvent(sw, pd2, null)!;
    expect(hit.swapped).toBe(true);
    // re-oriented to OUR home/away: Sporting 3–2 Celta Fortuna at the source → 2–3 for us
    expect(sourceItem(hit, "odds_api", AT)).toMatchObject({ home: 2, away: 3, source: "odds_api", source_id: "oddsapi:429c16be4cc62dc2acb2799d91abd94a" });
  });
  it("«B» = «II», but never a women's, youth or third team for the club's first team", () => {
    expect(teamMarkers("Real Sociedad B")).toBe(teamMarkers("Real Sociedad II"));
    const apif = parseApiFootballLive(fx("apifootball-live-all-20261007.json"), AT);
    expect(matchSourceEvent(row({ home: "FC Seoul", away: "Boeun Sangmu" }), apif, null)).toBeNull();
    expect(matchSourceEvent(row({ home: "Real Madrid", away: "Guadalajara" }), apif, null)).toBeNull();
    expect(matchSourceEvent(row({ home: "Dynamo Kyiv", away: "Kolos Kovalivka" }), apif, null)).toBeNull();
    expect(matchSourceEvent(row({ home: "Kawasaki Frontale", away: "Tegevajaro Miyazaki" }), apif, null)).toMatchObject({ by: "names" });
  });
  it("a short name on one side («PSV» ⊂ «PSV Eindhoven») when the other side is a strong match; never both weak", () => {
    const ev: SourceSoccerEvent[] = [{ id: "7", kickoff: "2026-10-07T10:00:00Z", home: "Ajax", away: "PSV Eindhoven", state: "live", final_kind: null, minute: "20'", homeScore: 0, awayScore: 1, pens: null, events: [], updatedAt: AT }];
    expect(matchSourceEvent(row({ home: "Ajax Amsterdam", away: "PSV" }), ev, null)).toMatchObject({ by: "names", swapped: false });
    expect(matchSourceEvent(row({ home: "PSV", away: "Ajax" }), ev, null)).toMatchObject({ swapped: true });
    const weak: SourceSoccerEvent[] = [{ ...ev[0], home: "AZ Alkmaar", away: "PSV Eindhoven" }];
    expect(matchSourceEvent(row({ home: "AZ", away: "PSV" }), weak, null)).toBeNull();
  });
  it("kick-off more than 30' apart, or two candidates → no score", () => {
    expect(matchSourceEvent(row({ kickoff: "2026-10-07T10:45:00Z", home: "FC Tokyo", away: "Shonan Bellmare" }), parseApiFootballLive(fx("apifootball-live-all-20261007.json"), AT), null)).toBeNull();
    const dup: SourceSoccerEvent[] = ["1", "2"].map((id) => ({ id, kickoff: "2026-10-07T10:00:00Z", home: "FC Tokyo", away: "Shonan Bellmare", state: "live", final_kind: null, minute: null, homeScore: 0, awayScore: 0, pens: null, events: [], updatedAt: AT }));
    expect(matchSourceEvent(row({ home: "FC Tokyo", away: "Shonan Bellmare" }), dup, null)).toBeNull();
  });
});

describe("merge (same row, several sources)", () => {
  const it0 = (p: Partial<Extract<V3LiveItem, { sport: "football" }>>): V3LiveItem => ({
    sport: "football", state: "live", final_kind: null, minute: null, home: 1, away: 0, pens: null, events: [], source_id: "s", matched_by: "id", source: "odds_api", updated_at: "2026-10-07T10:39:00Z", ...p,
  });
  it("the most recent timestamp wins", () => {
    const a = it0({ source: "api_football", minute: "60'", updated_at: "2026-10-07T10:35:00Z", home: 0 });
    const b = it0({ source: "odds_api", updated_at: "2026-10-07T10:39:00Z" });
    expect(fuse([a, b])).toMatchObject({ source: "odds_api", home: 1, minute: null });
  });
  it("a tie goes to ESPN → API-Football → The Odds API", () => {
    const t = "2026-10-07T10:40:00Z";
    expect(fuse([it0({ source: "odds_api", updated_at: t }), it0({ source: "api_football", updated_at: t })])!.source).toBe("api_football");
    expect(fuse([it0({ source: "api_football", updated_at: t }), it0({ source: "espn", updated_at: t })])!.source).toBe("espn");
  });
  it("minute and goals are borrowed only from a source with the same state and score", () => {
    const goal = [{ minute: "12'", kind: "goal" as const, side: "home" as const, player: null }];
    const same = it0({ source: "api_football", minute: "61'", events: goal, updated_at: "2026-10-07T10:38:00Z" });
    expect(fuse([it0({}), same])).toMatchObject({ source: "odds_api", minute: "61'", events: goal });
    const other = it0({ source: "api_football", minute: "61'", events: goal, home: 2, updated_at: "2026-10-07T10:38:00Z" });
    expect(fuse([it0({}), other])).toMatchObject({ source: "odds_api", minute: null, events: [] });
    expect(fuse([])).toBeNull();
  });
});

describe("quota and backoff", () => {
  const T0 = Date.parse("2026-10-07T10:00:00Z");
  it("interval per resource, then the daily budget, and a new UTC day resets it", () => {
    const b = new LiveBudget({ dailyBudget: 3, minIntervalMs: 30_000, reserve: 0 });
    expect(b.check(T0, "k1")).toBe("ok");
    b.record(T0, { ok: true, resource: "k1", cost: 2 });
    expect(b.check(T0 + 10_000, "k1")).toBe("interval");
    expect(b.check(T0 + 10_000, "k2")).toBe("ok");
    expect(b.check(T0 + 40_000, "k1", 2)).toBe("budget");
    expect(b.check(Date.parse("2026-10-08T00:00:01Z"), "k1", 2)).toBe("ok");
  });
  it("the provider's remaining header under the reserve stops live reads", () => {
    const b = new LiveBudget({ dailyBudget: 100, minIntervalMs: 0, reserve: 25 });
    b.record(T0, { ok: true, remaining: 25 });
    expect(b.check(T0 + 1)).toBe("reserve");
    b.record(T0 + 2, { ok: true, remaining: 60 });
    expect(b.check(T0 + 3)).toBe("ok");
  });
  it("errors back off 30 s, 60 s, 120 s … and a success clears it; Retry-After is honoured", () => {
    const b = new LiveBudget({ dailyBudget: 100, minIntervalMs: 0, reserve: 0 });
    b.record(T0, { ok: false });
    expect(b.check(T0 + 29_000)).toBe("backoff");
    expect(b.check(T0 + 30_001)).toBe("ok");
    b.record(T0 + 31_000, { ok: false });
    expect(b.check(T0 + 31_000 + 59_000)).toBe("backoff");
    b.record(T0 + 100_000, { ok: true });
    expect(b.check(T0 + 100_001)).toBe("ok");
    b.record(T0 + 200_000, { ok: false, retryAfterMs: 300_000 });
    expect(b.check(T0 + 200_000 + 299_000)).toBe("backoff");
  });
});

// Altenar adapter — recorded fixtures only (tests/fixtures/partners, real
// responses of 06/10/2026, trimmed). No live access: fetch is stubbed.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ALTENAR_USER_AGENT, __setAltenarFetcherForTest, altenarEventsUrl, fetchAltenarBoard, parseAltenarEvents } from "./altenar-feed";
import { ALTENAR_BOOKS } from "./altenar-books";

const fx = (f: string) => JSON.parse(readFileSync(join(__dirname, "../tests/fixtures/partners", f), "utf8"));
const SOCCER = fx("altenar_wildz_soccer.json");
const TENNIS = fx("altenar_wildz_tennis.json");
const wildz = ALTENAR_BOOKS.find((b) => b.key === "wildz")!;

afterEach(() => {
  __setAltenarFetcherForTest(null);
  vi.unstubAllGlobals();
});

describe("parseAltenarEvents", () => {
  it("normalizes a football 1X2 to the FpMatch shape (home/draw/away by odd type)", () => {
    const rows = parseAltenarEvents(SOCCER);
    // Argentina–Benin is in the fixture with the home price suspended
    // (oddStatus 7, price 0): no partial 1X2.
    expect(rows.map((r) => r.homeName)).toEqual(["Jordan", "Colombia", "USA"]);
    const j = rows.find((r) => r.homeName === "Jordan")!;
    expect(j).toMatchObject({
      sport: "soccer", awayName: "Venezuela", oddsHome: 1.9, oddsDraw: 3.3334, oddsAway: 4.0,
      startTime: "2026-10-06T17:00:00Z", teamPairKey: "2026-10-06:jordan|venezuela",
    });
  });

  it("reads the tennis Winner market (2 ways, no draw)", () => {
    const rows = parseAltenarEvents(TENNIS);
    const d = rows.find((r) => r.homeName === "Aziz Dougaz")!;
    expect(d).toMatchObject({ sport: "tennis", awayName: "Federico Cina", oddsHome: 2.8, oddsDraw: null, oddsAway: 1.4 });
    expect(d.teamPairKey.startsWith("2026-10-06:")).toBe(true);
  });

  it("drops what is not a full match result instead of inventing a leg", () => {
    const p = structuredClone(SOCCER);
    const ev = p.events[0];
    const m = p.markets.find((x: { typeId: number; id: number }) => x.typeId === 1 && ev.marketIds.includes(x.id));
    const drawId = m.oddIds.find((id: number) => p.odds.find((o: { id: number; typeId: number }) => o.id === id)?.typeId === 2);
    p.odds = p.odds.filter((o: { id: number }) => o.id !== drawId);
    expect(parseAltenarEvents(p).find((r) => r.homeName === "Jordan")).toBeUndefined();
    expect(parseAltenarEvents(null)).toEqual([]);
    expect(parseAltenarEvents({ events: [{ sportId: 99 }] })).toEqual([]);
  });
});

describe("fetchAltenarBoard", () => {
  it("asks the public widget with an identifiable user-agent, one sport per request", async () => {
    const calls: { url: string; ua: string }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, ua: (init.headers as Record<string, string>)["User-Agent"] });
      return new Response(JSON.stringify(url.includes("sportId=68") ? TENNIS : SOCCER), { status: 200 });
    }));
    const map = await fetchAltenarBoard(wildz, Date.parse("2026-10-06T00:00:00Z"));
    expect(calls.map((c) => new URL(c.url).searchParams.get("sportId"))).toEqual(["66", "68"]);
    expect(calls.every((c) => c.ua === ALTENAR_USER_AGENT && /BetRedge/.test(c.ua))).toBe(true);
    expect(calls[0].url).toBe(altenarEventsUrl(wildz, 66));
    expect(new URL(calls[0].url).searchParams.get("integration")).toBe("wildz");
    expect(map.size).toBe(6);
  });

  it("caches for 5 minutes and keeps the last good copy when the widget fails", async () => {
    let n = 0;
    __setAltenarFetcherForTest(async () => {
      n += 1;
      if (n > 2) throw new Error("down");
      return SOCCER;
    });
    const t0 = Date.parse("2026-10-06T00:00:00Z");
    expect((await fetchAltenarBoard(wildz, t0)).size).toBe(3);
    await fetchAltenarBoard(wildz, t0 + 60_000);
    expect(n).toBe(2); // fresh cache, no request
    expect((await fetchAltenarBoard(wildz, t0 + 6 * 60_000)).size).toBe(3); // stale served, refresh fails
  });
});

import { describe, expect, it } from "vitest";
import type { V3LiveItem } from "./live-contract";
import { V3C_LIVE_COPY } from "./live-copy";
import { announcements, liveBadge, nextDelay, scoreOf, wantsLive } from "./live-view";

const c = V3C_LIVE_COPY.en;
const fb = (p: Partial<Extract<V3LiveItem, { sport: "football" }>> = {}): V3LiveItem => ({
  sport: "football", state: "live", final_kind: null, minute: "67'", home: 2, away: 1, pens: null, events: [], source_id: "espn:1", matched_by: "names", source: "espn", updated_at: "2026-10-07T10:00:00Z", ...p,
});
const tn = (p: Partial<Extract<V3LiveItem, { sport: "tennis" }>> = {}): V3LiveItem => ({
  sport: "tennis", state: "live", final_kind: null, sets: [{ p1: 6, p2: 3, tb1: null, tb2: null }, { p1: 4, p2: 1, tb1: null, tb2: null }], server: "p1", winner: null, source_id: "espn:2", matched_by: "id", source: "espn", updated_at: "2026-10-07T10:00:00Z", ...p,
});

describe("live badge", () => {
  it("football live: minute and score", () => {
    expect(liveBadge(fb(), true, c)).toEqual({ label: "Live", tone: "live", sub: "67'", score: "2–1" });
  });
  it("half-time, finals (FT / AET / pens) and the honest «score n/a»", () => {
    expect(liveBadge(fb({ state: "break", minute: null }), true, c)).toMatchObject({ label: "HT", score: "2–1" });
    expect(liveBadge(fb({ state: "final", final_kind: "ft", minute: null }), true, c)).toMatchObject({ label: "Finished", tone: "done", sub: "FT" });
    expect(liveBadge(fb({ state: "final", final_kind: "pen", pens: { home: 4, away: 3 } }), true, c)?.sub).toBe("Pens 4–3");
    // live2: started and no source covers it → «Kick-off» before the time, quiet: no «Live», no minute, no number
    expect(liveBadge(undefined, true, c)).toEqual({ label: "Kick-off", tone: "quiet", sub: null, score: null, lead: true });
    expect(liveBadge(undefined, true, c, "tennis")).toMatchObject({ label: "Start", lead: true, score: null });
    // The Odds API: «completed» without FT/AET/pens → no word we would have to guess
    expect(liveBadge(fb({ state: "final", final_kind: null, minute: null }), true, c)).toMatchObject({ label: "Finished", sub: null, score: "2–1" });
    expect(liveBadge(undefined, false, c)).toBeNull();
  });
  it("a missing score stays missing", () => {
    expect(liveBadge(fb({ home: null }), true, c)?.score).toBeNull();
  });
  it("tennis: sets, current set, tie-breaks", () => {
    expect(liveBadge(tn(), true, c)).toMatchObject({ sub: "Set 2", score: "6-3 4-1" });
    expect(scoreOf(tn({ sets: [{ p1: 7, p2: 6, tb1: 7, tb2: 4 }, { p1: 6, p2: 6, tb1: 5, tb2: 1 }] }))).toBe("7-6(4) 6-6(5-1)");
    // doubles match tie-break, as ESPN served it on 07/10 (Kuwata/Ye – Shi/Yao)
    expect(scoreOf(tn({ sets: [{ p1: 6, p2: 2, tb1: null, tb2: null }, { p1: 6, p2: 7, tb1: 5, tb2: 7 }, { p1: 1, p2: 0, tb1: 10, tb2: 4 }] }))).toBe("6-2 6-7(5) [10-4]");
    expect(liveBadge(tn({ state: "final", final_kind: "ret" }), true, c)).toMatchObject({ label: "Finished", sub: "Ret." });
    expect(liveBadge(tn({ state: "pre", sets: [] }), true, c)).toMatchObject({ label: "Not started", score: null });
  });
});

describe("polling", () => {
  it("45 s, doubling on errors up to 5 min", () => {
    expect([0, 1, 2, 3, 9].map(nextDelay)).toEqual([45_000, 90_000, 180_000, 300_000, 300_000]);
  });
  it("only around a kick-off", () => {
    const now = new Date("2026-10-07T12:00:00Z");
    expect(wantsLive("2026-10-07T11:00:00Z", now)).toBe(true);
    expect(wantsLive("2026-10-07T12:10:00Z", now)).toBe(true);
    expect(wantsLive("2026-10-07T12:30:00Z", now)).toBe(false);
    expect(wantsLive("2026-10-07T08:59:00Z", now)).toBe(false);
  });
});

describe("announcements (aria-live polite)", () => {
  const names = () => ["Inter", "Torino"] as [string, string];
  it("a goal and a final are said; the minute ticking is not", () => {
    expect(announcements({ a: fb({ minute: "66'" }) }, { a: fb() }, names, c)).toEqual([]);
    expect(announcements({ a: fb({ home: 1 }) }, { a: fb() }, names, c)).toEqual(["Score update: Inter 2, Torino 1"]);
    expect(announcements({ a: fb() }, { a: fb({ state: "final" }) }, names, c)).toEqual(["Final score: Inter 2, Torino 1"]);
    expect(announcements(null, { a: fb() }, names, c)).toEqual([]);
  });
  it("tennis: only the end, in sets", () => {
    expect(announcements({ t: tn() }, { t: tn({ sets: [{ p1: 6, p2: 3, tb1: null, tb2: null }, { p1: 4, p2: 2, tb1: null, tb2: null }] }) }, names, c)).toEqual([]);
    expect(announcements({ t: tn() }, { t: tn({ state: "final", sets: [{ p1: 6, p2: 3, tb1: null, tb2: null }, { p1: 6, p2: 2, tb1: null, tb2: null }] }) }, names, c)).toEqual(["Final score: Inter 2, Torino 0"]);
  });
});

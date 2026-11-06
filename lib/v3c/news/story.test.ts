import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { names, repeats, sameStory, STORY_WINDOW_MS } from "./story";
import { parseNewsPage } from "./page";
import { parseRss, type FeedItem } from "./feed";
import { freshState, runCycle, sha, type WatcherDb } from "./watcher";
import type { RewriteOutcome } from "./claude-cli";

const H = 3_600_000;
const T0 = Date.parse("2026-11-05T19:56:00Z");
// the pair published twice on 05/11 (two sources, same match)
const A = { at: T0, title: "Crystal Palace and Hoffenheim draw 1-1 after Kamada's late leveller" };
const B = { at: T0 + 110 * 60_000, title: "Crystal Palace take a point versus Hoffenheim" };

describe("story dedup (before the paid rewrite)", () => {
  it("names: capitalised runs, possessive cut, competitions and title openers dropped", () => {
    expect(names(A.title)).toEqual(["crystal palace", "hoffenheim", "kamada"]);
    expect(names(B.title)).toEqual(["crystal palace", "hoffenheim"]);
    expect(names("Late drama as Arsenal beat Chelsea in the Premier League")).toEqual(["arsenal", "chelsea"]);
  });

  it("the 05/11 duplicate is caught, both ways", () => {
    expect(sameStory(A, B)).toMatch(/^same match \(crystal palace · hoffenheim\)/);
    expect(sameStory(B, A)).toMatch(/^same match/);
    expect(repeats(B, [A])).toMatch(/^duplicate story: same match/);
  });

  it("same clubs outside the window (the return fixture months later) are NOT merged", () => {
    expect(sameStory(A, { ...B, at: T0 + STORY_WINDOW_MS + H })).toBeNull();
    expect(sameStory(A, { ...B, at: T0 - 90 * 24 * H })).toBeNull();
  });

  it("different stories are NOT merged", () => {
    // one shared club only
    expect(sameStory({ at: T0, title: "Arsenal beat Chelsea 2-0 at the Emirates" }, { at: T0 + H, title: "Arsenal beat Tottenham in the derby" })).toBeNull();
    // same two names but one is not a result (transfer/injury news about the same clubs)
    expect(sameStory(A, { at: T0 + H, title: "Crystal Palace eye Hoffenheim striker in January" })).toBeNull();
    // same league, different matches
    expect(sameStory({ at: T0, title: "Inter beat Roma in Serie A" }, { at: T0 + H, title: "Juventus beat Lazio in Serie A" })).toBeNull();
    // short titles never trigger the token overlap
    expect(sameStory({ at: T0, title: "Salah injured" }, { at: T0 + H, title: "Salah injured again" })).toBeNull();
  });

  it("other news: a near-identical title is caught by token overlap", () => {
    expect(sameStory({ at: T0, title: "Cole Palmer omitted from England squad for November friendlies" }, { at: T0 + 3 * H, title: "Cole Palmer omitted from the England squad for friendlies" })).toMatch(/^same title/);
  });

  it("no false merge among the recorded FotMob page + RSS items", () => {
    const html = readFileSync(join(__dirname, "__fixtures__", "fotmob-news-page.html"), "utf8");
    const rss = readFileSync(join(__dirname, "__fixtures__", "fotmob-topnews.xml"), "utf8");
    const items = [...(parseNewsPage(html) as { ok: true; items: FeedItem[] }).items, ...parseRss(rss).items];
    const uniq = [...new Map(items.map((i) => [i.title, i])).values()];
    const hits = uniq.flatMap((a, i) => uniq.slice(i + 1).map((b) => [a.title, b.title, sameStory({ at: a.t, title: a.title }, { at: b.t, title: b.title })])).filter((x) => x[2]);
    expect(hits).toEqual([]);
  });

  it("watcher: a candidate repeating a story written in the last 36 h is dropped BEFORE claude, and remembered as seen", async () => {
    const html = readFileSync(join(__dirname, "__fixtures__", "fotmob-news-page.html"), "utf8");
    const items = (parseNewsPage(html) as { ok: true; items: FeedItem[] }).items;
    const now = Math.max(...items.map((i) => i.t)) + 60_000;
    const target = items.find((i) => i.text.split(/\s+/).length >= 12)!;
    const s = freshState();
    s.lastRssAt = now; // page only
    s.stories = [{ at: target.t - H, title: target.title }];
    const rewrite = async (): Promise<RewriteOutcome> => ({ kind: "final", reason: "test" });
    const rewritten: string[] = [];
    const db: WatcherDb = { enabled: async () => true, insert: async () => {}, setState: async () => {}, prune: async () => {} };
    const f = (async (u: string | URL | Request) => new Response(String(u).endsWith("robots.txt") ? "User-agent: *\nDisallow: /api/*\n" : html, { status: 200 })) as typeof fetch;
    const rep = await runCycle(s, { now: () => now, fetch: f, db, log: () => {}, rewrite: async (it) => (rewritten.push(it.title), rewrite()) }, { maxRewrites: 50 });
    expect(rep.rejected).toContainEqual({ hash: sha(target.guid), reason: expect.stringMatching(/^duplicate story: same title/) });
    expect(rewritten).not.toContain(target.title);
    expect(s.seen[sha(target.guid)]).toBe(now);
  });
});

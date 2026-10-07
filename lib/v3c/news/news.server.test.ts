// lib/v3c/news/news.server.test.ts (#REDESIGN-V3C news2) — the pipeline with the
// sources injected (no network, Next cache bypassed): only rewritten notes reach the
// page, no key = no request to FotMob, a block stops the source and is not retried,
// errors back off.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: <T extends (...a: never[]) => unknown>(f: T) => f }));

import { buildNews, getNews, readSource, resetNewsHealth } from "./news.server";
import { parseNewsPage } from "./page";
import { parseRss, type FeedItem } from "./feed";
import { RewriteError, type AiNote, type Rewriter } from "./rewrite";

const page = parseNewsPage(readFileSync(join(__dirname, "__fixtures__", "fotmob-news-page.html"), "utf8"));
const PAGE_ITEMS = page.ok ? page.items : [];
const RSS_ITEMS = parseRss(readFileSync(join(__dirname, "__fixtures__", "fotmob-topnews.xml"), "utf8")).items;
const T = Date.parse("2026-10-07T10:36:00Z");

/** Rewrites only the items whose title contains «3-0» or «1-0»; the rest are «insufficient». */
const fakeRw = (): Rewriter & { calls: string[] } => {
  const calls: string[] = [];
  return {
    id: "fake:v",
    calls,
    async rewrite(it: FeedItem): Promise<AiNote> {
      calls.push(it.guid);
      if (!/\b[0-9]-[0-9]\b/.test(it.title)) throw new RewriteError("insufficient");
      return { kind: "ai", en: { title: `Result ${calls.length}`, body: "A match was played." }, it: { title: `Risultato ${calls.length}`, body: "Si è giocata una partita." }, model: "fake" };
    },
  };
};
const okRead = (items: FeedItem[], at = T) => vi.fn(async () => ({ ok: true as const, fetchedAt: at, items }));

describe("buildNews", () => {
  beforeEach(() => resetNewsHealth());
  afterEach(() => vi.restoreAllMocks());

  it("no rewriter → «pending», and NO request to FotMob", async () => {
    const read = { page: okRead(PAGE_ITEMS), rss: okRead(RSS_ITEMS) };
    const r = await buildNews(null, read, T);
    expect(r.feed).toEqual({ state: "pending" });
    expect(read.page).not.toHaveBeenCalled();
    expect(read.rss).not.toHaveBeenCalled();
  });

  it("only rewritten items become cards; the original headline never travels", async () => {
    const rw = fakeRw();
    const r = await buildNews(rw, { page: okRead(PAGE_ITEMS), rss: okRead(RSS_ITEMS) }, T);
    expect(r.feed.state).toBe("ok");
    if (r.feed.state !== "ok") return;
    const results = PAGE_ITEMS.filter((i) => /\b[0-9]-[0-9]\b/.test(i.title));
    expect(r.feed.cards.map((c) => c.guid).sort()).toEqual(results.map((i) => i.guid).sort());
    const json = JSON.stringify(r.feed);
    for (const it of [...PAGE_ITEMS, ...RSS_ITEMS]) expect(json).not.toContain(it.title);
    expect(r.feed.fetchedAt).toBe(T);
    expect(rw.calls.length).toBe(20); // merged and capped
  });

  it("nothing rewritten yet → «pending», not an empty list of originals", async () => {
    const rw: Rewriter = { id: "x", rewrite: async () => { throw new RewriteError("insufficient"); } };
    const r = await buildNews(rw, { page: okRead(PAGE_ITEMS), rss: okRead(RSS_ITEMS) }, T);
    expect(r.feed).toEqual({ state: "pending" });
  });

  it("403/challenge → «blocked», the RSS is not asked either, and nothing is fetched again", async () => {
    const pageRead = vi.fn(async () => ({ ok: false as const, checkedAt: T, error: "blocked (http 403)", blocked: "http 403" }));
    const rssRead = okRead(RSS_ITEMS);
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const r1 = await buildNews(fakeRw(), { page: pageRead, rss: rssRead }, T);
    expect(r1.feed).toEqual({ state: "blocked" });
    expect(err.mock.calls[0][0]).toMatch(/block.*OFF on this instance.*NEWS_FOTMOB_ENABLED=0/);
    const r2 = await buildNews(fakeRw(), { page: pageRead, rss: rssRead }, T + 24 * 3_600_000);
    expect(r2.feed).toEqual({ state: "blocked" });
    expect(pageRead).toHaveBeenCalledTimes(1);
    expect(rssRead).not.toHaveBeenCalled();
  });

  it("a 5xx backs off: no new request inside the window, the RSS still serves", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const pageRead = vi.fn(async () => ({ ok: false as const, checkedAt: T, error: "http 503" }));
    const read = { page: pageRead, rss: okRead(RSS_ITEMS) };
    const r = await buildNews(fakeRw(), read, T);
    expect(r.feed.state === "ok" || r.feed.state === "pending").toBe(true); // RSS items have no score → pending
    await buildNews(fakeRw(), read, T + 5 * 60_000);
    expect(pageRead).toHaveBeenCalledTimes(1);
    await buildNews(fakeRw(), read, T + 11 * 60_000);
    expect(pageRead).toHaveBeenCalledTimes(2);
  });

  it("both sources down → «error»", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const down = vi.fn(async () => ({ ok: false as const, checkedAt: T, error: "http 500" }));
    expect((await buildNews(fakeRw(), { page: down, rss: down }, T)).feed).toEqual({ state: "error", checkedAt: T });
  });
});

describe("readSource · one GET, robots first, /api refused", () => {
  afterEach(() => vi.restoreAllMocks());
  const robots = "User-agent: *\nAllow: /\nDisallow: /api/*\n";
  const html = readFileSync(join(__dirname, "__fixtures__", "fotmob-news-page.html"), "utf8");

  it("reads the page with our user-agent, after robots.txt", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockImplementation(async (u) => new Response(String(u).endsWith("/robots.txt") ? robots : html, { status: 200 }));
    const s = await readSource("https://www.fotmob.com/en/news", "page", T);
    expect(s.ok && s.items.length).toBe(20);
    const urls = f.mock.calls.map((c) => String(c[0]));
    expect(urls).toEqual(["https://www.fotmob.com/robots.txt", "https://www.fotmob.com/en/news"]);
    expect(((f.mock.calls[1][1] as RequestInit).headers as Record<string, string>)["user-agent"]).toMatch(/^BetRedgeNews\/1\.0/);
  });

  it("an /api URL is never requested", async () => {
    const f = vi.spyOn(globalThis, "fetch");
    const s = await readSource("https://www.fotmob.com/api/worldnews?lang=en&page=1", "page", T);
    expect(s.ok).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it("a challenge page is reported as a block; a 429 carries Retry-After", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (u) =>
      String(u).endsWith("/robots.txt") ? new Response(robots) : new Response("<title>Just a moment...</title>", { status: 403 }),
    );
    expect(await readSource("https://www.fotmob.com/en/news", "page", T)).toMatchObject({ ok: false, blocked: "http 403" });
    vi.spyOn(globalThis, "fetch").mockImplementation(async (u) =>
      String(u).endsWith("/robots.txt") ? new Response(robots) : new Response("slow down", { status: 429, headers: { "retry-after": "900" } }),
    );
    expect(await readSource("https://www.fotmob.com/en/news", "page", T)).toMatchObject({ ok: false, error: "http 429", retryAfterS: 900 });
  });
});

describe("never at build time", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("`next build` (NEXT_PHASE=phase-production-build): «pending», NO request to FotMob nor to the model", async () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    vi.stubEnv("NEWS_FOTMOB_ENABLED", "1");
    vi.stubEnv("NEWS_REWRITE_PROVIDER", "gateway");
    const f = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("", { status: 500 }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await getNews()).toEqual({ state: "pending" });
    expect(f).not.toHaveBeenCalled();
  });
});

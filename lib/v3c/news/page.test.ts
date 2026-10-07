// lib/v3c/news/page.test.ts (#REDESIGN-V3C news2) — the FotMob news PAGE without the
// network: the page recorded on 07/10/2026 10:35 UTC (trimmed to its __NEXT_DATA__ list;
// imageUrl/sourceIconUrl left in on purpose to prove they are never read), robots.txt,
// the /api refusal, block detection, merging with the RSS, the backoff, and the
// anti-copy rule run on real items with hand-written rewrites.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRss, robotsAllows } from "./feed";
import {
  assertNotApi,
  BASE_INTERVAL_MS,
  FOTMOB_NEWS_PAGE_URL,
  freshHealth,
  looksBlocked,
  mayFetch,
  MAX_BACKOFF_MS,
  mergeSources,
  nextHealth,
  parseNewsPage,
  retryAfterS,
} from "./page";
import { checkRewrite, sharesRun } from "./rewrite";
import { matchTeams } from "./teams";

const HTML = readFileSync(join(__dirname, "__fixtures__", "fotmob-news-page.html"), "utf8");
const RSS = readFileSync(join(__dirname, "__fixtures__", "fotmob-topnews.xml"), "utf8");
const READ_AT = Date.parse("2026-10-07T10:35:49Z");
const MIN = 60_000;

const parsed = parseNewsPage(HTML);
const items = parsed.ok ? parsed.items : [];

describe("page · the recorded FotMob news page", () => {
  it("reads the 20 items of the embedded list, newest first", () => {
    expect(parsed.ok).toBe(true);
    expect(items).toHaveLength(20);
    for (let i = 1; i < items.length; i++) expect(items[i].t).toBeLessThanOrEqual(items[i - 1].t);
  });
  it("the first five match the page as read (title, source, time, link)", () => {
    expect(items.slice(0, 5).map((i) => [i.title.slice(0, 40), i.source, new Date(i.t).toISOString().slice(11, 16)])).toEqual([
      ["‘Not Worth the Risk’—Arsenal Suffer Late", "SI via FotMob", "10:30"],
      ["FotMob Opinion: Argentina will never pro", "FotMob", "10:22"],
      ["Goals at a 60-Year High, Swans Flying, a", "The Analyst via FotMob", "10:20"],
      ["United States 1-0 Canada: Ellis caps per", "FotMob", "09:59"],
      ["Premier League Fixture Difficulty: Who H", "The Analyst via FotMob", "09:30"],
    ]);
    expect(items[0].url).toBe("https://www.fotmob.com/embed/news/01m4925ta2rw/not-worth-riskarsenal-suffer-late-international-break-injury-casualty");
    expect(items[2].url).toMatch(/^https:\/\/theanalyst\.com\/articles\//);
    expect(items[0].guid).toBe("fotmob:news:ftbpro_01m4925ta2rw");
  });
  it("fresh: newest 6 min old at read time, median under 8 h (the RSS was 5 days old)", () => {
    const ages = items.map((i) => (READ_AT - i.t) / MIN).sort((a, b) => a - b);
    expect(Math.round(ages[0])).toBe(6);
    expect((ages[9] + ages[10]) / 2).toBeLessThan(8 * 60); // 457 min
  });
  it("never carries an image or an icon", () => {
    expect(HTML).toContain("imageUrl");
    expect(JSON.stringify(items)).not.toMatch(/imageUrl|minutemediacdn|image_resources|\.png|\.jpg/i);
  });
  it("lead is input only, plain text", () => {
    const withLead = items.find((i) => i.text);
    expect(withLead?.text).not.toMatch(/</);
  });
  it("broken or changed pages fail cleanly, never patched", () => {
    expect(parseNewsPage("<html>nothing</html>")).toEqual({ ok: false, error: "no __NEXT_DATA__" });
    expect(parseNewsPage('<script id="__NEXT_DATA__" type="application/json">{oops</script>')).toEqual({ ok: false, error: "bad __NEXT_DATA__" });
    expect(parseNewsPage('<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"fallback":{}}}}</script>')).toEqual({ ok: false, error: "no news list" });
    const bad = { props: { pageProps: { fallback: { news: [{ id: "a", title: "ok", gmtTime: "2026-10-07T10:00:00Z", page: { url: "/news/a" } }, { id: "b", title: "no date", gmtTime: "soon", page: { url: "/news/b" } }, { id: "c", title: "bad link", gmtTime: "2026-10-07T10:00:00Z", page: { url: "javascript:alert(1)" } }] } } } };
    const p = parseNewsPage(`<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(bad)}</script>`);
    expect(p.ok && p.items.map((i) => i.guid)).toEqual(["fotmob:news:a"]);
  });
});

describe("page · robots.txt and /api", () => {
  const FOTMOB = "User-agent: *\nAllow: /\nDisallow: /api/*\nDisallow: /auth/*\nDisallow: /info\n\nUser-agent: Googlebot\nAllow: /api/*\n";
  it("FotMob's real rules (07/10): /en/news allowed, /api/worldnews not", () => {
    expect(new URL(FOTMOB_NEWS_PAGE_URL).pathname).toBe("/en/news");
    expect(robotsAllows(FOTMOB, "/en/news")).toBe(true);
    expect(robotsAllows(FOTMOB, "/api/worldnews?lang=en&page=1")).toBe(false);
  });
  it("/api is refused in code even if robots allowed it", () => {
    expect(() => assertNotApi("https://www.fotmob.com/api/worldnews?lang=en")).toThrow(/api/);
    expect(() => assertNotApi("https://www.fotmob.com/API/x")).toThrow();
    expect(() => assertNotApi(FOTMOB_NEWS_PAGE_URL)).not.toThrow();
  });
});

describe("page · block detection", () => {
  const hdr = (h: Record<string, string>) => ({ get: (k: string) => h[k.toLowerCase()] ?? null });
  it("403, Cloudflare challenge, or a 200 without the page data = blocked", () => {
    expect(looksBlocked(403, "")).toBe(true);
    expect(looksBlocked(200, "<title>Just a moment...</title>")).toBe(true);
    expect(looksBlocked(503, "<script src='/cdn-cgi/challenge-platform/x'></script>")).toBe(true);
    expect(looksBlocked(200, "<html></html>", hdr({ "cf-mitigated": "challenge" }))).toBe(true);
    expect(looksBlocked(200, "<html>no data</html>")).toBe(true);
    expect(looksBlocked(200, HTML)).toBe(false);
    expect(looksBlocked(500, "oops")).toBe(false); // a plain error is backed off, not a block
  });
});

describe("page · merge with the RSS", () => {
  const rss = parseRss(RSS).items;
  it("one entry per story: same guid, link, FotMob topnews id or title", () => {
    const dupe = { ...rss[0], guid: "fotmob:news:x", url: "https://www.fotmob.com/topnews/29859-other-slug", title: "different" };
    const sameTitle = { ...rss[1], guid: "y", url: "https://elsewhere.test/a", title: rss[1].title.toUpperCase() + "!" };
    const merged = mergeSources([[dupe, sameTitle], rss], 50);
    expect(merged.filter((i) => i.url.includes("29859"))).toHaveLength(1);
    expect(merged.filter((i) => i.title.toLowerCase().startsWith(rss[1].title.toLowerCase().slice(0, 20)))).toHaveLength(1);
    expect(merged).toHaveLength(rss.length);
  });
  it("page and RSS together: newest first, capped", () => {
    const merged = mergeSources([items, rss], 20);
    expect(merged).toHaveLength(20);
    expect(merged[0].guid).toBe(items[0].guid);
    for (let i = 1; i < merged.length; i++) expect(merged[i].t).toBeLessThanOrEqual(merged[i - 1].t);
  });
});

describe("page · backoff", () => {
  const t0 = 1_000_000;
  it("errors double the wait 10 → 20 → 40 min, up to 6 h; success resets", () => {
    let h = nextHealth(freshHealth(), { ok: false }, t0);
    expect(h.nextAt - t0).toBe(BASE_INTERVAL_MS);
    expect(mayFetch(h, t0 + 5 * MIN)).toBe(false);
    expect(mayFetch(h, t0 + 10 * MIN)).toBe(true);
    h = nextHealth(h, { ok: false }, t0);
    expect(h.nextAt - t0).toBe(2 * BASE_INTERVAL_MS);
    h = nextHealth(h, { ok: false }, t0);
    expect(h.nextAt - t0).toBe(4 * BASE_INTERVAL_MS);
    for (let i = 0; i < 10; i++) h = nextHealth(h, { ok: false }, t0);
    expect(h.nextAt - t0).toBe(MAX_BACKOFF_MS);
    expect(nextHealth(h, { ok: true }, t0)).toEqual(freshHealth());
  });
  it("429 with Retry-After waits at least that long", () => {
    const h = nextHealth(freshHealth(), { ok: false, retryAfterS: 3600 }, t0);
    expect(h.nextAt - t0).toBe(3600_000);
    expect(retryAfterS("120")).toBe(120);
    expect(retryAfterS(null)).toBeUndefined();
  });
  it("a block stops the source for good: no success revives it", () => {
    const h = nextHealth(freshHealth(), { ok: false, blocked: "http 403" }, t0);
    expect(h.blocked).toBe("http 403");
    expect(mayFetch(h, t0 + 100 * MAX_BACKOFF_MS)).toBe(false);
    expect(nextHealth(h, { ok: true }, t0).blocked).toBe("http 403");
  });
});

describe("page · anti-copy on real items (hand-written rewrites)", () => {
  const byTitle = (s: string) => items.find((i) => i.title.startsWith(s))!;
  it("faithful rewrites of real items pass; no 6-word run with the original", () => {
    const arg = byTitle("Argentina 3-0 Benin");
    const note = {
      en: { title: "Argentina beat Benin 3-0 in Messi’s farewell", body: "The game at Estadio Monumental was Lionel Messi’s 208th and last appearance for his country." },
      it: { title: "L’Argentina batte il Benin 3-0 nell’addio di Messi", body: "Al Monumental Lionel Messi ha giocato la sua 208ª e ultima partita con la nazionale." },
    };
    expect(checkRewrite(note, arg)).toBeNull();
    expect(sharesRun(`${note.en.title}. ${note.en.body}`, `${arg.title}. ${arg.text}`)).toBe(false);
  });
  it("a lazy rewrite that keeps 6 words of the lead is refused", () => {
    const eng = byTitle("England 3-0 Czechia");
    const lazy = { en: { title: "England beat Czechia", body: "Kane was involved in all of England's goals in the game." }, it: { title: "Inghilterra batte Cechia", body: "Vittoria per 3-0 a Wembley." } };
    expect(checkRewrite(lazy, eng)).toMatch(/6-word/);
  });
  it("team matching on real items: national teams found, «Inter Miami» style decoys not", () => {
    const board = ["United States", "Canada", "Argentina", "England", "Arsenal"];
    const us = byTitle("United States 1-0 Canada");
    expect([...matchTeams(`${us.title}. ${us.text}`, board)].sort()).toEqual(["Canada", "United States"]);
    expect([...matchTeams(byTitle("‘Not Worth the Risk’").title, board)]).toEqual(["Arsenal"]);
  });
});

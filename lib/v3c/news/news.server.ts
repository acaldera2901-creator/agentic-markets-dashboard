// lib/v3c/news/news.server.ts (#REDESIGN-V3C news, news2) — the live news, server side.
//
// Guardrails (debt accepted by Andrea 2026-10-05 and 07/10, owner Andrea):
//  - OFF unless NEWS_FOTMOB_ENABLED is a «yes» (Production: unset → off; Preview: set it).
//    Off = no request to FotMob, no LLM call, the page shows what it showed before.
//  - No rewriter configured → no request to FotMob either: nothing could be shown
//    (Andrea: never an original headline without a rewrite), the page says «coming».
//  - Sources: the public news PAGE https://www.fotmob.com/en/news (page.ts, fresh
//    news, read from its embedded data) first, the RSS (feed.ts) second. Never /api.
//    robots.txt is read (cached 6 h) and obeyed for every path; /api refused in code.
//  - Low frequency: ONE request per source per refresh — page every 10 min, RSS every
//    hour (unstable_cache, shared by the instances; an error is cached too). On top,
//    per instance: 4xx/5xx/429/network → wait 10, 20, 40 … min (max 6 h, or the
//    server's Retry-After); 403/challenge → the source stops itself on this instance,
//    logs why, and the page shows the «paused» state. Never worked around.
//  - One rewrite per item, ever: cached by guid (+ rewriter id) with no expiry. Only
//    transient failures (network, HTTP) are retried, at most every 15 min per item.
//  - Nothing is written to the database.
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { envFlagOn } from "@/lib/redesign-flag";
import { FOTMOB_FEED_URL, NEWS_USER_AGENT, parseRss, robotsAllows, type FeedItem } from "./feed";
import { assertNotApi, FOTMOB_NEWS_PAGE_URL, freshHealth, looksBlocked, mayFetch, mergeSources, nextHealth, parseNewsPage, retryAfterS, type SourceHealth } from "./page";
import { headlineFallback, newsRewriter, RewriteError, type AiNote, type Note, type Rewriter } from "./rewrite";
import { matchTeams } from "./teams";
import { mostMoved, type MoverCard } from "./movers";
import { getBoard } from "../board-data.server";
import { footballPairKey } from "../board";
import { leadOutcome } from "../board-view";
import { partnerSeries } from "../line-movement";
import { tapeLines, type TapeKey } from "../match-view";
import { fetchTapeHistory } from "../queries";
import { TAPE_HOURS } from "../tape";

/** How many stories we keep after merging the sources (newest first). */
export const MAX_ITEMS = 20;
export const PAGE_REVALIDATE_S = 600;
export const FEED_REVALIDATE_S = 3600;
const ROBOTS_REVALIDATE_S = 6 * 3600;
const RETRY_MS = 15 * 60_000;
/** total time a render may spend rewriting; the rest waits for the next render */
const REWRITE_BUDGET_MS = 30_000;
const CONCURRENCY = 3;

type Env = Record<string, string | undefined>;

export function newsEnabled(env: Env = process.env): boolean {
  return envFlagOn(env.NEWS_FOTMOB_ENABLED);
}

const pageUrl = (env: Env = process.env) => env.NEWS_FOTMOB_PAGE_URL?.trim() || FOTMOB_NEWS_PAGE_URL;
const feedUrl = (env: Env = process.env) => env.NEWS_FOTMOB_FEED_URL?.trim() || FOTMOB_FEED_URL;

type SourceState =
  | { ok: true; fetchedAt: number; items: FeedItem[] }
  | { ok: false; checkedAt: number; error: string; blocked?: string; retryAfterS?: number };

const get = (url: string, accept: string) => {
  assertNotApi(url);
  return fetch(url, { headers: { "user-agent": NEWS_USER_AGENT, accept }, cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(10_000) });
};

/** robots.txt: 404 = no rules; any other failure = do not fetch. */
const robotsFor = unstable_cache(
  async (origin: string): Promise<{ ok: true; text: string } | { ok: false }> => {
    try {
      const r = await get(`${origin}/robots.txt`, "text/plain");
      if (r.status === 404) return { ok: true, text: "" };
      if (!r.ok) return { ok: false };
      return { ok: true, text: await r.text() };
    } catch {
      return { ok: false };
    }
  },
  ["v3c-news-robots"],
  { revalidate: ROBOTS_REVALIDATE_S, tags: ["v3c-news"] },
);

/** One GET of one source, robots first; a block is recognised and reported, never retried around. */
export async function readSource(url: string, kind: "page" | "rss", now = Date.now()): Promise<SourceState> {
  const u = new URL(url);
  try {
    assertNotApi(url);
  } catch (e) {
    return { ok: false, checkedAt: now, error: String(e) };
  }
  const robots = await robotsFor(u.origin);
  if (!robots.ok) return { ok: false, checkedAt: now, error: "robots unavailable" };
  if (!robotsAllows(robots.text, u.pathname + u.search)) return { ok: false, checkedAt: now, error: "robots disallow" };
  try {
    const r = await get(url, kind === "page" ? "text/html" : "application/rss+xml, application/xml;q=0.9, text/plain;q=0.8");
    const body = await r.text();
    if (kind === "page" && looksBlocked(r.status, body, r.headers)) return { ok: false, checkedAt: now, error: `blocked (http ${r.status})`, blocked: `http ${r.status}` };
    if (kind === "rss" && r.status === 403) return { ok: false, checkedAt: now, error: "blocked (http 403)", blocked: "http 403" };
    if (!r.ok) return { ok: false, checkedAt: now, error: `http ${r.status}`, retryAfterS: retryAfterS(r.headers.get("retry-after")) };
    if (kind === "rss") return { ok: true, fetchedAt: now, items: parseRss(body).items };
    const p = parseNewsPage(body);
    return p.ok ? { ok: true, fetchedAt: now, items: p.items } : { ok: false, checkedAt: now, error: p.error };
  } catch (e) {
    return { ok: false, checkedAt: now, error: String(e).slice(0, 120) };
  }
}

const pageFor = unstable_cache(async (url: string) => readSource(url, "page"), ["v3c-news-page"], { revalidate: PAGE_REVALIDATE_S, tags: ["v3c-news"] });
const feedFor = unstable_cache(async (url: string) => readSource(url, "rss"), ["v3c-news-feed"], { revalidate: FEED_REVALIDATE_S, tags: ["v3c-news"] });

// ─── per-instance health: backoff and the self-stop ─────────────────────────

type Kind = "page" | "rss";
const health: Record<Kind, SourceHealth> = { page: freshHealth(), rss: freshHealth() };
const lastStamp: Record<Kind, number> = { page: 0, rss: 0 };
const lastGood: Record<Kind, { fetchedAt: number; items: FeedItem[] } | null> = { page: null, rss: null };
/** Set once FotMob answers with a block: every FotMob source stops on this instance. */
let blockedReason: string | null = null;

/** Test hook: forget the per-instance state. */
export function resetNewsHealth(): void {
  health.page = freshHealth();
  health.rss = freshHealth();
  lastStamp.page = lastStamp.rss = 0;
  lastGood.page = lastGood.rss = null;
  blockedReason = null;
}

async function source(kind: Kind, url: string, read: (u: string) => Promise<SourceState>, now = Date.now()): Promise<{ fetchedAt: number; items: FeedItem[] } | null> {
  if (blockedReason || !mayFetch(health[kind], now)) return lastGood[kind];
  const s = await read(url);
  const stamp = s.ok ? s.fetchedAt : s.checkedAt;
  if (stamp !== lastStamp[kind]) {
    // a new answer (not the same cached one seen again): update the health once
    lastStamp[kind] = stamp;
    health[kind] = nextHealth(health[kind], s.ok ? { ok: true } : { ok: false, blocked: s.blocked, retryAfterS: s.retryAfterS }, now);
    if (!s.ok && s.blocked) {
      blockedReason = `${kind} ${s.blocked}`;
      console.error(`[v3c/news] FotMob answered with a block (${blockedReason}): the FotMob source is now OFF on this instance and will not be retried. Set NEWS_FOTMOB_ENABLED=0 and review before turning it back on.`);
    } else if (!s.ok) console.warn(`[v3c/news ${kind}]`, s.error, `next try after ${new Date(health[kind].nextAt).toISOString()}`);
  }
  if (s.ok) lastGood[kind] = { fetchedAt: s.fetchedAt, items: s.items };
  return lastGood[kind];
}

// ─── one rewrite per item ────────────────────────────────────────────────────

const lastTransient = new Map<string, number>();

function transient(e: unknown): boolean {
  // an HTTP error (bad key, rate limit, outage, a request the API rejects) is retried later;
  // a refusal, «insufficient» or a failed check is final and cached as a headline
  if (e instanceof RewriteError) return /^http \d+$/.test(e.message);
  return true; // network, abort, anything unexpected
}

async function noteFor(rw: Rewriter, item: FeedItem, deadline: number): Promise<Note> {
  const cached = unstable_cache(
    async (): Promise<Note> => {
      try {
        return await rw.rewrite(item);
      } catch (e) {
        if (transient(e)) throw e; // not cached: retried later
        return headlineFallback(item, e instanceof Error ? e.message : "rejected"); // cached: never asked again, never shown
      }
    },
    ["v3c-news-rw", rw.id, item.guid],
    { revalidate: false, tags: ["v3c-news", `v3c-news:${item.guid}`] },
  );
  const failedAt = lastTransient.get(item.guid);
  if (failedAt != null && Date.now() - failedAt < RETRY_MS) return headlineFallback(item, "retry-later");
  if (Date.now() > deadline) return headlineFallback(item, "time budget");
  try {
    return await cached();
  } catch (e) {
    lastTransient.set(item.guid, Date.now());
    console.warn("[v3c/news rewrite]", item.guid, String(e).slice(0, 160));
    return headlineFallback(item, "error");
  }
}

async function mapLimit<T, R>(xs: readonly T[], n: number, f: (x: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(xs.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, xs.length) }, async () => {
      while (i < xs.length) {
        const k = i++;
        out[k] = await f(xs[k]);
      }
    }),
  );
  return out;
}

// ─── what the pages get ──────────────────────────────────────────────────────

/** One REWRITTEN note as the client receives it. The original headline never travels. */
export type NewsCard = { guid: string; url: string; source: string; t: number; note: AiNote };
/**
 * off: NEWS_FOTMOB_ENABLED unset (production) · pending: on, but no note rewritten
 * yet (no LLM credential, or the first rewrites still running) · blocked: FotMob
 * answered with a block and the source stopped itself · error: no source answered.
 */
export type NewsFeed =
  | { state: "off" }
  | { state: "pending" }
  | { state: "blocked" }
  | { state: "error"; checkedAt: number }
  | { state: "ok"; fetchedAt: number; cards: NewsCard[] };

type Internal = { feed: NewsFeed; items: FeedItem[] };

/** Merge the sources, rewrite what is new, keep only what was rewritten. Exported for the tests (reads injected). */
export async function buildNews(
  rw: Rewriter | null,
  read: { page: (u: string) => Promise<SourceState>; rss: (u: string) => Promise<SourceState> } = { page: pageFor, rss: feedFor },
  now = Date.now(),
): Promise<Internal> {
  if (!rw) return { feed: { state: "pending" }, items: [] }; // nothing could be shown: do not even ask FotMob
  const page = await source("page", pageUrl(), read.page, now);
  const rss = blockedReason ? null : await source("rss", feedUrl(), read.rss, now);
  if (blockedReason) return { feed: { state: "blocked" }, items: [] }; // stopped: show nothing from FotMob
  if (!page && !rss) return { feed: { state: "error", checkedAt: now }, items: [] };
  const items = mergeSources([page?.items ?? [], rss?.items ?? []], MAX_ITEMS);
  const deadline = Date.now() + REWRITE_BUDGET_MS;
  const notes = await mapLimit(items, CONCURRENCY, (it) => noteFor(rw, it, deadline));
  const cards: NewsCard[] = [];
  const shown: FeedItem[] = [];
  items.forEach((it, i) => {
    const n = notes[i];
    if (n.kind !== "ai") return; // not rewritten → not shown (no original headline, ever)
    cards.push({ guid: it.guid, url: it.url, source: it.source, t: it.t, note: n });
    shown.push(it);
  });
  if (!cards.length) return { feed: { state: "pending" }, items: [] };
  const fetchedAt = Math.max(page?.fetchedAt ?? 0, rss?.fetchedAt ?? 0);
  return { feed: { state: "ok", fetchedAt, cards }, items: shown };
}

const loadNews = cache(async (): Promise<Internal> => {
  if (!newsEnabled()) return { feed: { state: "off" }, items: [] };
  return buildNews(newsRewriter());
});

export async function getNews(): Promise<NewsFeed> {
  return (await loadNews()).feed;
}

/** guid → the board team names the ORIGINAL item names (matching runs on the source text, server side only). */
export async function newsTeams(teams: readonly string[]): Promise<Map<string, string[]>> {
  const { items } = await loadNews();
  const out = new Map<string, string[]>();
  for (const it of items) {
    const found = matchTeams(`${it.title}. ${it.text}`, teams);
    if (found.size) out.set(it.guid, [...found]);
  }
  return out;
}

/** The notes that name either team of a match, newest first. */
export async function newsForMatch(home: string, away: string): Promise<NewsCard[]> {
  const { feed } = await loadNews();
  if (feed.state !== "ok") return [];
  const hit = await newsTeams([home, away]);
  return feed.cards.filter((c) => hit.has(c.guid));
}

export type { MoverCard } from "./movers";

/** A board match a note names, for the «On the board» link. */
export type NoteMatch = { id: string; home: string; away: string; league: string | null };
export type NewsPage = { feed: NewsFeed; links: Record<string, NoteMatch[]>; movers: MoverCard[] | null };

/**
 * Everything the News page shows: the notes, the board matches each one names
 * and «Most moved today». Board or price history unavailable → the notes still
 * show, links/strip are left out (movers null), never invented.
 */
export async function newsPage(now = Date.now()): Promise<NewsPage> {
  const feed = await getNews();
  if (feed.state !== "ok") return { feed, links: {}, movers: null };
  const b = await getBoard();
  if (!b.ok) return { feed, links: {}, movers: null };
  const ms = b.data.matches;
  const teamsByGuid = await newsTeams(ms.flatMap((m) => [m.home, m.away]));
  const links: Record<string, NoteMatch[]> = {};
  for (const [guid, teams] of teamsByGuid) {
    const hit = ms.filter((m) => teams.includes(m.home) || teams.includes(m.away));
    if (hit.length) links[guid] = hit.slice(0, 2).map((m) => ({ id: m.id, home: m.home, away: m.away, league: m.competition || m.league }));
  }
  let movers: MoverCard[] | null = null;
  try {
    const keys = new Map(ms.flatMap((m) => {
      const k = footballPairKey(m);
      return k ? [[m.id, k] as const] : [];
    }));
    const hist = await fetchTapeHistory([...keys.values()], TAPE_HOURS);
    const rows = ms.map((m) => {
      const lead = leadOutcome(m);
      const line = tapeLines(partnerSeries(m, hist.get(keys.get(m.id) ?? "") ?? []), lead.outcome as TapeKey)[0];
      return { m, outcome: lead.outcome, points: line?.points ?? [] };
    });
    movers = mostMoved(rows, teamsByGuid, feed.cards, now);
  } catch (e) {
    console.error("[v3c/news movers]", String(e));
  }
  return { feed, links, movers };
}

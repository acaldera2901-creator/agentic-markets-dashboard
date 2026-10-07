// lib/v3c/news/news.server.ts (#REDESIGN-V3C news) — the live news, server side.
//
// Guardrails (debt accepted by Andrea 2026-10-05, PIANO-COSTRUZIONE «News da FotMob»):
//  - OFF unless NEWS_FOTMOB_ENABLED is a «yes» (Production: unset → off; Preview: set it).
//    Off = no request to FotMob, no LLM call, the page shows what it showed before.
//  - Only the public RSS (feed.ts). robots.txt is read (cached 6 h) and obeyed.
//  - Low frequency: the parsed feed is cached 15 min with unstable_cache (an error is
//    cached too, so a failing feed is not hammered); pages never fetch per visit.
//  - One rewrite per item, ever: cached by guid (+ rewriter id) with no expiry. Only
//    transient failures (network, 429/5xx) are retried, at most every 15 min per item.
//  - Nothing is written to the database.
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { envFlagOn } from "@/lib/redesign-flag";
import { FOTMOB_FEED_URL, NEWS_USER_AGENT, parseRss, robotsAllows, type FeedItem } from "./feed";
import { anthropicRewriter, headlineFallback, RewriteError, type Note, type Rewriter } from "./rewrite";
import { matchTeams } from "./teams";
import { mostMoved, type MoverCard } from "./movers";
import { getBoard } from "../board-data.server";
import { footballPairKey } from "../board";
import { leadOutcome } from "../board-view";
import { partnerSeries } from "../line-movement";
import { tapeLines, type TapeKey } from "../match-view";
import { fetchTapeHistory } from "../queries";
import { TAPE_HOURS } from "../tape";

/** How many items of the feed we use (the feed carries 20; a cap keeps the volume low). */
export const MAX_ITEMS = 12;
export const FEED_REVALIDATE_S = 900;
const ROBOTS_REVALIDATE_S = 6 * 3600;
const RETRY_MS = 15 * 60_000;
/** total time a render may spend rewriting; the rest shows the headline, uncached */
const REWRITE_BUDGET_MS = 30_000;
const CONCURRENCY = 3;

type Env = Record<string, string | undefined>;

export function newsEnabled(env: Env = process.env): boolean {
  return envFlagOn(env.NEWS_FOTMOB_ENABLED);
}

function feedUrl(env: Env = process.env): string {
  return env.NEWS_FOTMOB_FEED_URL?.trim() || FOTMOB_FEED_URL;
}

type FeedState = { ok: true; fetchedAt: number; items: FeedItem[] } | { ok: false; checkedAt: number; error: string };

const get = (url: string) =>
  fetch(url, { headers: { "user-agent": NEWS_USER_AGENT, accept: "application/rss+xml, application/xml;q=0.9, text/plain;q=0.8" }, cache: "no-store", signal: AbortSignal.timeout(10_000) });

/** robots.txt: 404 = no rules; any other failure = do not fetch. */
const robotsFor = unstable_cache(
  async (origin: string): Promise<{ ok: true; text: string } | { ok: false }> => {
    try {
      const r = await get(`${origin}/robots.txt`);
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

const feedFor = unstable_cache(
  async (url: string): Promise<FeedState> => {
    const now = Date.now();
    const u = new URL(url);
    const robots = await robotsFor(u.origin);
    if (!robots.ok) return { ok: false, checkedAt: now, error: "robots unavailable" };
    if (!robotsAllows(robots.text, u.pathname + u.search)) return { ok: false, checkedAt: now, error: "robots disallow" };
    try {
      const r = await get(url);
      if (!r.ok) return { ok: false, checkedAt: now, error: `http ${r.status}` };
      const items = parseRss(await r.text()).items.slice(0, MAX_ITEMS);
      return { ok: true, fetchedAt: now, items };
    } catch (e) {
      return { ok: false, checkedAt: now, error: String(e).slice(0, 120) };
    }
  },
  ["v3c-news-feed"],
  { revalidate: FEED_REVALIDATE_S, tags: ["v3c-news"] },
);

// ─── one rewrite per item ────────────────────────────────────────────────────

const lastTransient = new Map<string, number>();

function transient(e: unknown): boolean {
  // an HTTP error (bad key, rate limit, outage, a request the API rejects) is retried later;
  // a refusal, «insufficient» or a failed check is final and cached as a headline
  if (e instanceof RewriteError) return /^http \d+$/.test(e.message);
  return true; // network, abort, anything unexpected
}

async function noteFor(rw: Rewriter | null, item: FeedItem, deadline: number): Promise<Note> {
  if (!rw) return headlineFallback(item, "no-key");
  const cached = unstable_cache(
    async (): Promise<Note> => {
      try {
        return await rw.rewrite(item);
      } catch (e) {
        if (transient(e)) throw e; // not cached: retried later
        return headlineFallback(item, e instanceof Error ? e.message : "rejected"); // cached: never asked again
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

/** One note as the client receives it. The original headline travels ONLY when not rewritten. */
export type NewsCard = { guid: string; url: string; source: string; t: number; note: Note };
export type NewsFeed = { state: "off" } | { state: "error"; checkedAt: number } | { state: "ok"; fetchedAt: number; cards: NewsCard[] };

type Internal = { feed: NewsFeed; items: FeedItem[] };

const loadNews = cache(async (): Promise<Internal> => {
  if (!newsEnabled()) return { feed: { state: "off" }, items: [] };
  const f = await feedFor(feedUrl());
  if (!f.ok) {
    console.warn("[v3c/news feed]", f.error);
    return { feed: { state: "error", checkedAt: f.checkedAt }, items: [] };
  }
  const rw = anthropicRewriter();
  const deadline = Date.now() + REWRITE_BUDGET_MS;
  const notes = await mapLimit(f.items, CONCURRENCY, (it) => noteFor(rw, it, deadline));
  const cards = f.items.map((it, i) => ({ guid: it.guid, url: it.url, source: it.source, t: it.t, note: notes[i] }));
  return { feed: { state: "ok", fetchedAt: f.fetchedAt, cards }, items: f.items };
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

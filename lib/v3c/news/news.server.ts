// lib/v3c/news/news.server.ts (#REDESIGN-V3C news, news2, newswatch) — the live news, server side.
//
// newswatch (Andrea 07/10: no API key, no AI Gateway): the site no longer calls
// FotMob nor any model. A watcher on Andrea's Mac (scripts/news_watcher, daemon
// com.betredge.news-watcher) reads FotMob, has the notes rewritten by the local
// `claude -p` and writes them to `news_items` / `news_state`. Here we only READ
// those two tables (SELECT, service role, server side), at request time.
//  - OFF unless NEWS_FOTMOB_ENABLED is a «yes» (Production: unset → off, no query,
//    the page is the guides only, as on main).
//  - The switch without a redeploy: `UPDATE news_state SET enabled = false`, or stop
//    the daemon (after 2 h without a run the page says «paused»).
//  - `next build` never reads the tables (NEXT_PHASE guard; /v3c/blog calls connection()).
import { cache } from "react";
import { envFlagOn } from "@/lib/redesign-flag";
import { dbQueryStrict } from "@/lib/db";
import { feedFromTable, ITEMS_SQL, STATE_SQL, type NewsCard, type NewsFeed, type NewsItemRow, type NewsStateRow } from "./table";
import { matchTeams } from "./teams";
import { mostMoved, type MoverCard } from "./movers";
import { getBoard } from "../board-data.server";
import { footballPairKey } from "../board";
import { leadOutcome } from "../board-view";
import { partnerSeries } from "../line-movement";
import { tapeLines, type TapeKey } from "../match-view";
import { fetchTapeHistory } from "../queries";
import { TAPE_HOURS } from "../tape";

export type { NewsCard, NewsFeed } from "./table";

type Env = Record<string, string | undefined>;

export function newsEnabled(env: Env = process.env): boolean {
  return envFlagOn(env.NEWS_FOTMOB_ENABLED);
}

/** Reads the two tables; a read error (table missing, DB down) is the «error» state, never an exception. */
export async function readNews(now = Date.now(), query: typeof dbQueryStrict = dbQueryStrict): Promise<NewsFeed> {
  try {
    const [state] = await query<NewsStateRow>(STATE_SQL);
    const rows = state?.enabled ? await query<NewsItemRow>(ITEMS_SQL) : [];
    return feedFromTable(state ?? null, rows, now);
  } catch (e) {
    console.error("[v3c/news] news tables unreadable:", String(e).slice(0, 160));
    return { state: "error" };
  }
}

const loadNews = cache(async (): Promise<NewsFeed> => {
  if (!newsEnabled()) return { state: "off" };
  // `next build` prerendering: no query (a result would be baked into the HTML).
  if (process.env.NEXT_PHASE === "phase-production-build") return { state: "off" };
  return readNews();
});

export async function getNews(): Promise<NewsFeed> {
  return loadNews();
}

/** guid → the board team names a note names (the teams the watcher stored, checked against the original). */
export function newsTeams(cards: readonly NewsCard[], teams: readonly string[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const c of cards) {
    if (!c.teams.length) continue;
    const found = matchTeams(c.teams.join(". "), teams);
    if (found.size) out.set(c.guid, [...found]);
  }
  return out;
}

/** The notes that name either team of a match, newest first. */
export async function newsForMatch(home: string, away: string): Promise<NewsCard[]> {
  const feed = await loadNews();
  if (feed.state !== "ok") return [];
  const hit = newsTeams(feed.cards, [home, away]);
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
  const teamsByGuid = newsTeams(feed.cards, ms.flatMap((m) => [m.home, m.away]));
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

// lib/news/read.server.ts (#NEWS-FOTMOB-PROD-1026) — the live news, server side.
// Ported from betredge/v3c-newswatch:lib/v3c/news/news.server.ts (1932f315),
// without the v3c board/«Most moved» wiring: here the site only READS the two
// tables (SELECT, service role, request time). The links to the board are made
// where the board already is — in the browser (components/news/use-news.ts).
//  - OFF unless NEWS_FOTMOB_ENABLED is a «yes» (Production: unset → off, no
//    query, /blog is the guides only, as today).
//  - The switch without a redeploy: `UPDATE news_state SET enabled = false`, or
//    stop the daemon (after 2 h without a run the page says «paused»).
//  - `next build` never reads the tables (NEXT_PHASE guard).
import { cache } from "react";
import { dbQueryStrict } from "@/lib/db";
import { feedFromTable, ITEMS_SQL, STATE_SQL, type NewsFeed, type NewsItemRow, type NewsStateRow } from "./table";

export type { NewsCard, NewsFeed } from "./table";

type Env = Record<string, string | undefined>;
const ON = new Set(["1", "true", "on", "yes"]);

/** The env switch: on only with an explicit «yes». */
export function newsEnabled(env: Env = process.env): boolean {
  const raw = env.NEWS_FOTMOB_ENABLED;
  return raw != null && ON.has(raw.trim().toLowerCase());
}

/** Reads the two tables; a read error (table missing, DB down) is the «error» state, never an exception. */
export async function readNews(now = Date.now(), query: typeof dbQueryStrict = dbQueryStrict): Promise<NewsFeed> {
  try {
    const [state] = await query<NewsStateRow>(STATE_SQL);
    const rows = state?.enabled ? await query<NewsItemRow>(ITEMS_SQL) : [];
    return feedFromTable(state ?? null, rows, now);
  } catch (e) {
    console.error("[news] news tables unreadable:", String(e).slice(0, 160));
    return { state: "error" };
  }
}

const loadNews = cache(async (): Promise<NewsFeed> => {
  if (!newsEnabled()) return { state: "off" };
  // `next build` prerendering: no query (a result would be baked into the HTML).
  if (process.env.NEXT_PHASE === "phase-production-build") return { state: "off" };
  return readNews();
});

/** One read per request (React cache): /blog and /api/news share it. */
export async function getNews(): Promise<NewsFeed> {
  return loadNews();
}

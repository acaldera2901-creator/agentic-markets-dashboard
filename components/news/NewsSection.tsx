// components/news/NewsSection.tsx (#NEWS-FOTMOB-PROD-1026) — the News section
// of /blog, server side. Off (NEWS_FOTMOB_ENABLED unset, production today) →
// renders nothing and the page keeps its ISR: byte for byte today's /blog.
// On → the page is ISR (app/blog/page.tsx revalidate = 60) and reads the two tables
// at each revalidation, never at build (NEXT_PHASE guard in read.server); the list itself
// is a client component so the language, the relative times and the «On the board» links are the visitor's.
// #SEO-AEO-1106: it used to call connection(), which made the WHOLE /blog dynamic per request
// (Cache-Control private/no-store, x-vercel-cache MISS, TTFB 0.7-1.5 s vs 0.2 s for the home): the
// ISR `revalidate` of the page was dead code. Freshness is now bounded by the 60 s revalidate.
import { getNews, newsEnabled } from "@/lib/news/read.server";
import { noteImage } from "@/lib/news/per-note.server";
import { wireFeed } from "@/lib/news/view";
import { NewsList } from "./NewsList";

export async function NewsSection() {
  if (!newsEnabled()) return null;
  const feed = await getNews();
  if (feed.state === "off") return null;
  return <NewsList feed={wireFeed(feed, noteImage)} />;
}

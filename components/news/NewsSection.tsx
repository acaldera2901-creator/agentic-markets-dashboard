// components/news/NewsSection.tsx (#NEWS-FOTMOB-PROD-1026) — the News section
// of /blog, server side. Off (NEWS_FOTMOB_ENABLED unset, production today) →
// renders nothing and the page keeps its ISR: byte for byte today's /blog.
// On → the page waits for the request (connection()) and reads the two tables
// now, never at build; the list itself is a client component so the language,
// the relative times and the «On the board» links are the visitor's.
import { connection } from "next/server";
import { getNews, newsEnabled } from "@/lib/news/read.server";
import { NewsList } from "./NewsList";

export async function NewsSection() {
  if (!newsEnabled()) return null;
  await connection();
  const feed = await getNews();
  if (feed.state === "off") return null;
  return <NewsList feed={feed} />;
}

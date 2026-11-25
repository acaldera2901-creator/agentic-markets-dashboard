import { getNews, newsEnabled } from "@/lib/news/read.server";
import { noteImage } from "@/lib/news/per-note.server";
import { wireFeed } from "@/lib/news/view";
import { NewsList } from "./NewsList";

export async function NewsSection() {
  if (!newsEnabled()) return null;
  const feed = await getNews();
  // The build deliberately skips the database. A cold ISR response can serve
  // that HTML before regeneration, so recover via the existing public feed.
  return <NewsList initialFeed={feed.state === "off" ? null : wireFeed(feed, noteImage)} />;
}

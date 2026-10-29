// app/api/news/route.ts (#NEWS-FOTMOB-PROD-1026) — the rewritten FotMob notes
// for the browser (the «Latest news» strip on the board, the News card of the
// match sheet). Same read as /blog (lib/news/read.server.ts): SELECT only, at
// request time; off → {state:"off"} and no query. Short shared cache: the
// watcher runs every ten minutes, a minute of CDN cache costs nothing.
import { NextResponse } from "next/server";
import { getNews } from "@/lib/news/read.server";
import { noteImage } from "@/lib/news/per-note.server";
import { wireFeed } from "@/lib/news/view";

export const dynamic = "force-dynamic";

export async function GET() {
  const feed = await getNews();
  const maxAge = feed.state === "off" ? 300 : 60;
  return NextResponse.json(wireFeed(feed, noteImage), {
    headers: { "Cache-Control": `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge}` },
  });
}

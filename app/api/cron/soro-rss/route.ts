// #SORO-RSS-0813: pull del feed RSS Soro -> bozze in blog_posts.
// Solo cattura: ogni riga nasce 'draft', la pubblicazione è un gate umano.
import { NextResponse } from "next/server";
import { verifyBearer } from "@/lib/admin-auth";
import { runSoroRssSync } from "@/lib/soro-rss";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!verifyBearer(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.SORO_RSS_URL) {
    return NextResponse.json({ error: "SORO_RSS_URL not configured" }, { status: 503 });
  }
  try {
    const result = await runSoroRssSync();
    return NextResponse.json(result);
  } catch (e) {
    console.error("[cron/soro-rss] failed:", String(e));
    return NextResponse.json({ error: "sync failed" }, { status: 500 });
  }
}

// app/api/cron/indexnow/route.ts — #SEO-AEO-0825
// Legge la sitemap servita (non una lista parallela: se la sitemap sbaglia,
// sbagliano insieme e il difetto si vede una volta sola) e la sottopone a
// IndexNow. La ricevuta con ok:true viene LETTA dalla risposta, non assunta.
import { NextRequest, NextResponse } from "next/server";
import { verifyBearer } from "@/lib/admin-auth";
import {
  INDEXNOW_HOST,
  INDEXNOW_KEY,
  extractSitemapUrls,
  submitToIndexNow,
} from "@/lib/seo/indexnow";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!verifyBearer(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sitemapUrl = `https://${INDEXNOW_HOST}/sitemap.xml`;

  let xml: string;
  try {
    const res = await fetch(sitemapUrl, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { error: "sitemap_unreachable", status: res.status, sitemapUrl },
        { status: 502 }
      );
    }
    xml = await res.text();
  } catch (e) {
    return NextResponse.json(
      { error: "sitemap_fetch_failed", detail: String(e), sitemapUrl },
      { status: 502 }
    );
  }

  const urls = extractSitemapUrls(xml);
  if (urls.length === 0) {
    // Una sitemap che non produce URL e' un guasto, non un no-op silenzioso.
    return NextResponse.json({ error: "sitemap_empty", sitemapUrl }, { status: 502 });
  }

  const receipt = await submitToIndexNow(urls);
  // 202 = ricevuto, chiave ancora da validare da parte di Bing. Non e' un
  // guasto (non va in 502) ma non e' nemmeno una conferma: esce 202 anche di
  // qui, cosi' chi legge il log del cron vede la differenza invece di un 200.
  const status = receipt.ok ? 200 : receipt.pendingValidation ? 202 : 502;
  return NextResponse.json(
    {
      host: INDEXNOW_HOST,
      sitemapUrl,
      keyLocation: `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`,
      ...receipt,
      ran_at: new Date().toISOString(),
    },
    { status }
  );
}

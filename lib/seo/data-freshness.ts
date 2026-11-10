// lib/seo/data-freshness.ts — #SEO-AEO-1106 (audit point 4): the REAL last-change date of the pages whose content is data.
// The sitemap used the date of the last commit of the page's files: for the boards (/, /predictions, /history) that is the template, months old
// (/predictions said 22 Aug), while the content changes every agent cycle. Here: the newest update of the public rows the page shows.
// Never in the future; fail-soft (null → the sitemap keeps the file date).
import { dbQuery } from "@/lib/db";

export type Freshness = { board: string | null; history: string | null };

const iso = (v: unknown): string | null => {
  const t = v ? new Date(v as string).getTime() : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

/** Later of the page-file date and the data date; a data date in the future (clock skew) is ignored; invalid values are ignored. Pure. */
export function pickLastModified(fileDate: string, dataDate: string | null | undefined, now = Date.now()): string {
  const f = Date.parse(fileDate);
  const d = dataDate ? Date.parse(dataDate) : NaN;
  if (!Number.isFinite(d) || d > now) return fileDate;
  return !Number.isFinite(f) || d > f ? new Date(d).toISOString() : fileDate;
}

export async function fetchFreshness(): Promise<Freshness> {
  try {
    const [b] = await dbQuery<{ board: unknown; history: unknown }>(
      `SELECT
         (SELECT MAX(updated_at) FROM unified_predictions
           WHERE published_at IS NOT NULL AND is_demo = FALSE AND is_historical = FALSE
             AND starts_at > NOW() - interval '150 minutes') AS board,
         (SELECT MAX(settled_at) FROM unified_predictions
           WHERE is_demo = FALSE AND is_historical = TRUE AND settled_at IS NOT NULL) AS history`
    );
    return { board: iso(b?.board), history: iso(b?.history) };
  } catch (e) {
    console.error("[seo/data-freshness]", String(e));
    return { board: null, history: null };
  }
}

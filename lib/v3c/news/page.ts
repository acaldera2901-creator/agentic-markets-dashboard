// lib/v3c/news/page.ts (#REDESIGN-V3C news2) — the public FotMob news PAGE
// (https://www.fotmob.com/en/news), parsed. Pure: no network, no Next.
//
// Why the page and not only the RSS: the RSS carries ~20 editorial pieces (last
// one 02/10 when read on 07/10); the page lists the fresh news (results,
// injuries, transfers, 5–60 minutes old). Measured 07/10/2026: the page is a
// Next.js pages-router document; the list is NOT in the HTML markup, it travels
// in the embedded `<script id="__NEXT_DATA__">` JSON, under
// props.pageProps.fallback["/api/worldnews?lang=en&page=1"] — 20 items with
// id, title, lead, gmtTime, sourceStr, page.url, imageUrl, sourceIconUrl.
// We read that JSON out of the page we fetched; we never call /api (robots.txt
// disallows it; `assertNotApi` makes it impossible).
//
// Fields we read: id, title and lead (raw material for the rewrite and the team
// matching — never shown), gmtTime, sourceStr, page.url. Never imageUrl or
// sourceIconUrl. Debt accepted by Andrea (ToS/copyright, owner Andrea, 07/10).
import { decodeEntities, plainText, type FeedItem } from "./feed";

export const FOTMOB_ORIGIN = "https://www.fotmob.com";
/** The one page we read (newswatch, Andrea 07/10: /it/news; it embeds the same English list as /en/news). */
export const FOTMOB_NEWS_PAGE_URL = `${FOTMOB_ORIGIN}/it/news`;

/** Throws on any /api path: we never call an API, whatever robots.txt says. */
export function assertNotApi(url: string): void {
  const p = new URL(url).pathname.toLowerCase();
  if (p === "/api" || p.startsWith("/api/")) throw new Error(`refusing /api path: ${p}`);
}

/**
 * A bot challenge or a block instead of the page: 403, Cloudflare markers, or a
 * 200 without the Next.js data. On this answer the source stops itself.
 */
export function looksBlocked(status: number, body: string, headers?: { get(name: string): string | null }): boolean {
  if (status === 403 || status === 401 || status === 451) return true;
  if (headers?.get("cf-mitigated")) return true;
  const head = body.slice(0, 20_000);
  if (/<title>\s*(Just a moment|Attention Required|Access denied)/i.test(head)) return true;
  if (/challenge-platform|cf-chl-|__cf_chl_|cf_chl_opt/i.test(head)) return true;
  return status === 200 && !body.includes("__NEXT_DATA__");
}

type Raw = { id?: unknown; title?: unknown; lead?: unknown; gmtTime?: unknown; sourceStr?: unknown; page?: { url?: unknown } | null };

const str = (x: unknown): string => (typeof x === "string" ? x : "");

/** The news link: relative → fotmob.com; absolute only over http(s). Query and hash kept off. */
function linkOf(raw: string): string | null {
  if (!raw) return null;
  try {
    const u = new URL(decodeEntities(raw.trim()), FOTMOB_ORIGIN);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

/** A list in the page data looks like news when its entries carry title + gmtTime + page.url. */
function isNewsList(v: unknown): v is Raw[] {
  return Array.isArray(v) && v.length > 0 && v.every((x) => x && typeof x === "object" && "title" in x && "gmtTime" in x);
}

/** Where the list lives: the fallback key that names news, else any news-shaped list in the fallback. */
function findList(data: unknown): Raw[] {
  const fb = (data as { props?: { pageProps?: { fallback?: Record<string, unknown> } } })?.props?.pageProps?.fallback;
  if (!fb || typeof fb !== "object") return [];
  const keys = Object.keys(fb).sort((a, b) => Number(/news/i.test(b)) - Number(/news/i.test(a)));
  for (const k of keys) {
    const v = fb[k];
    if (isNewsList(v)) return v;
    // some pages wrap the list ({ news: [...] }); one level is enough
    if (v && typeof v === "object") for (const w of Object.values(v)) if (isNewsList(w)) return w;
  }
  return [];
}

export type ParsedPage = { ok: true; items: FeedItem[] } | { ok: false; error: string };

/** Parse the news page. Items without id/title/date/link are skipped, never patched. */
export function parseNewsPage(html: string): ParsedPage {
  const m = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return { ok: false, error: "no __NEXT_DATA__" };
  let data: unknown;
  try {
    data = JSON.parse(m[1]);
  } catch {
    return { ok: false, error: "bad __NEXT_DATA__" };
  }
  const list = findList(data);
  if (!list.length) return { ok: false, error: "no news list" };
  const items: FeedItem[] = [];
  const seen = new Set<string>();
  for (const r of list) {
    const id = str(r.id).trim();
    const title = plainText(str(r.title));
    const t = Date.parse(str(r.gmtTime));
    const url = linkOf(str(r.page?.url));
    if (!id || !title || !url || !Number.isFinite(t)) continue;
    const guid = `fotmob:news:${id}`;
    if (seen.has(guid)) continue;
    seen.add(guid);
    const by = plainText(str(r.sourceStr)) || "FotMob";
    items.push({ guid, title, text: plainText(str(r.lead)), url, t, source: /^fotmob$/i.test(by) ? "FotMob" : `${by} via FotMob` });
  }
  items.sort((a, b) => b.t - a.t);
  return { ok: true, items };
}

// ─── merging the sources ─────────────────────────────────────────────────────

const titleKey = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** FotMob topnews ids: «/topnews/29865-…» on the page, «urn:fotmob:feed:topnews:29865» in the RSS. */
function topnewsId(it: FeedItem): string | null {
  return it.url.match(/\/topnews\/(\d+)/)?.[1] ?? it.guid.match(/topnews:(\d+)$/)?.[1] ?? null;
}

/**
 * Page first, RSS second: one entry per story (same guid, same link, same
 * FotMob topnews id or same normalised title), newest first, at most `max`.
 */
export function mergeSources(lists: readonly (readonly FeedItem[])[], max: number): FeedItem[] {
  const out: FeedItem[] = [];
  const keys = new Set<string>();
  for (const list of lists)
    for (const it of list) {
      const ks = [`g:${it.guid}`, `u:${it.url}`, `t:${titleKey(it.title)}`];
      const tn = topnewsId(it);
      if (tn) ks.push(`n:${tn}`);
      if (ks.some((k) => keys.has(k))) continue;
      for (const k of ks) keys.add(k);
      out.push(it);
    }
  return out.sort((a, b) => b.t - a.t).slice(0, max);
}

// ─── backoff ─────────────────────────────────────────────────────────────────

export const BASE_INTERVAL_MS = 10 * 60_000;
export const MAX_BACKOFF_MS = 6 * 3_600_000;

/** Health of one source on this server instance. */
export type SourceHealth = { failures: number; nextAt: number; blocked: string | null };

export const freshHealth = (): SourceHealth => ({ failures: 0, nextAt: 0, blocked: null });

/**
 * After an answer: success resets; a 4xx/5xx/429/network error doubles the wait
 * (10 min, 20, 40 … max 6 h, or the server's Retry-After if longer); a block
 * (403/challenge) stops the source for good on this instance.
 */
export function nextHealth(h: SourceHealth, outcome: { ok: true } | { ok: false; blocked?: string; retryAfterS?: number }, now: number): SourceHealth {
  if (h.blocked) return h;
  if (outcome.ok) return freshHealth();
  if (outcome.blocked) return { failures: h.failures + 1, nextAt: Number.POSITIVE_INFINITY, blocked: outcome.blocked };
  const failures = h.failures + 1;
  const wait = Math.min(MAX_BACKOFF_MS, BASE_INTERVAL_MS * 2 ** (failures - 1));
  const server = Math.min(MAX_BACKOFF_MS, (outcome.retryAfterS ?? 0) * 1000);
  return { failures, nextAt: now + Math.max(wait, server), blocked: null };
}

/** May we send a request now? */
export const mayFetch = (h: SourceHealth, now: number): boolean => !h.blocked && now >= h.nextAt;

/** Retry-After in seconds (delta or HTTP date); undefined when absent or unreadable. */
export function retryAfterS(v: string | null): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  if (Number.isFinite(n) && n >= 0) return n;
  const d = Date.parse(v);
  return Number.isFinite(d) ? Math.max(0, (d - Date.now()) / 1000) : undefined;
}

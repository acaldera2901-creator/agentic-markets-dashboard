// lib/v3c/news/table.ts (#REDESIGN-V3C newswatch) — the two tables between the
// news watcher (writes, on Andrea's Mac, service role) and the site (reads,
// server side, SELECT only). One file for both sides: the row shapes, the row
// the watcher builds, and the page state the site derives from what it reads.
// DDL: docs/redesign/news-watcher-proposal.md (gated, not applied).
import type { AiNote, NoteText, Rewritten } from "./rewrite";
import type { FeedItem } from "./feed";

/** After this long without a successful watcher run the page says «paused». */
export const STALE_MS = 2 * 3_600_000;
/** How many notes the page shows, newest first. */
export const MAX_ITEMS = 20;
/** Notes older than this are not shown (retention in the table is 30 days). */
export const SHOW_DAYS = 7;

/** news_state: one row (id = 1). The switch is `enabled`. */
export type NewsStateRow = {
  enabled: boolean;
  /** last watcher run that READ the source successfully: «Updated at hh:mm» */
  last_run_at: string | null;
  last_error: string | null;
  source_status: "ok" | "degraded" | "blocked" | "limited" | string | null;
};

/** news_items: one rewritten note. No original headline or teaser is ever stored. */
export type NewsItemRow = {
  guid_hash: string;
  source: string;
  source_url: string;
  published_at: string;
  rewritten_en: NoteText;
  rewritten_it: NoteText;
  teams: string[];
  rewrite_model: string;
  rewritten_at: string;
};

/** One REWRITTEN note as the client receives it. The original headline never travels. */
export type NewsCard = { guid: string; url: string; source: string; t: number; note: AiNote; teams: string[] };

/**
 * off: NEWS_FOTMOB_ENABLED unset (production today) · paused: switched off in the
 * table, source blocked, or no watcher run for 2 h (Mac asleep, daemon stopped) ·
 * empty: the watcher runs, nothing rewritten yet · error: the table could not be read.
 */
export type NewsFeed =
  | { state: "off" }
  | { state: "paused"; since: number | null }
  | { state: "empty"; updatedAt: number }
  | { state: "error" }
  | { state: "ok"; updatedAt: number; cards: NewsCard[] };

const ms = (s: string | null | undefined): number | null => {
  const t = s ? Date.parse(s) : NaN;
  return Number.isFinite(t) ? t : null;
};

const text = (x: unknown): NoteText | null => {
  const o = typeof x === "string" ? safeJson(x) : x;
  if (!o || typeof o !== "object") return null;
  const { title, body } = o as Record<string, unknown>;
  return typeof title === "string" && typeof body === "string" && title.trim() && body.trim() ? { title: title.trim(), body: body.trim() } : null;
};

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

const httpUrl = (u: string): boolean => {
  try {
    const p = new URL(u).protocol;
    return p === "https:" || p === "http:";
  } catch {
    return false;
  }
};

/** A row as read → a card, or null when anything is missing or malformed (never patched). */
export function cardFromRow(r: NewsItemRow): NewsCard | null {
  const t = ms(r.published_at);
  const en = text(r.rewritten_en);
  const it = text(r.rewritten_it);
  if (t == null || !en || !it || !r.guid_hash || !r.source || !httpUrl(r.source_url)) return null;
  const teams = Array.isArray(r.teams) ? r.teams.filter((x): x is string => typeof x === "string") : [];
  return { guid: r.guid_hash, url: r.source_url, source: r.source, t, note: { kind: "ai", en, it, model: r.rewrite_model ?? "" }, teams };
}

/** What the page shows, from the state row and the item rows. Pure. */
export function feedFromTable(state: NewsStateRow | null, rows: readonly NewsItemRow[], now: number): NewsFeed {
  const last = ms(state?.last_run_at);
  if (!state || state.enabled !== true || state.source_status === "blocked") return { state: "paused", since: last };
  if (last == null || now - last > STALE_MS) return { state: "paused", since: last };
  const cards = rows
    .map(cardFromRow)
    .filter((c): c is NewsCard => c != null)
    .sort((a, b) => b.t - a.t)
    .slice(0, MAX_ITEMS);
  return cards.length ? { state: "ok", updatedAt: last, cards } : { state: "empty", updatedAt: last };
}

/** The row the watcher writes for one rewritten item. */
export function rowFor(item: FeedItem, guidHash: string, r: Rewritten, now: number): NewsItemRow {
  return {
    guid_hash: guidHash,
    source: item.source,
    source_url: item.url,
    published_at: new Date(item.t).toISOString(),
    rewritten_en: r.note.en,
    rewritten_it: r.note.it,
    teams: r.teams,
    rewrite_model: r.note.model,
    rewritten_at: new Date(now).toISOString(),
  };
}

/** The site's two reads (SELECT only), shared with the mock DB that recognises them. */
export const STATE_SQL = "SELECT enabled, last_run_at, last_error, source_status FROM news_state WHERE id = 1";
export const ITEMS_SQL = `SELECT guid_hash, source, source_url, published_at, rewritten_en, rewritten_it, teams, rewrite_model, rewritten_at FROM news_items WHERE published_at > now() - interval '${SHOW_DAYS} days' ORDER BY published_at DESC LIMIT ${MAX_ITEMS}`;

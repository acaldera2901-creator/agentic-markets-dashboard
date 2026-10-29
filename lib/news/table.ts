// lib/news/table.ts (#NEWS-FOTMOB-PROD-1026) — the site's READ side of the two
// news tables the watcher writes (news_items / news_state, in prod since
// APPROVE #NEWSWATCH-1). Ported from betredge/v3c-newswatch:lib/v3c/news/table.ts
// (1932f315), read side only: the row shapes, the card the page shows and the
// state it derives. The watcher side (rowFor) stays on that branch — the site
// never writes. No original headline or teaser is ever stored or shown.

/** After this long without a successful watcher run the page says «paused». */
export const STALE_MS = 2 * 3_600_000;
/** How many notes the page shows, newest first. */
export const MAX_ITEMS = 20;
/** Notes older than this are not shown (retention in the table is 30 days). */
export const SHOW_DAYS = 7;

/**
 * A row written before a barrier existed and refused later (re-verification):
 * `rewrite_model` becomes «rejected · <reason> · <old model>». The site never
 * shows these.
 */
export const REJECTED_PREFIX = "rejected · ";

export type NoteText = { title: string; body: string };
export type AiNote = { kind: "ai"; en: NoteText; it: NoteText; model: string };

/** news_state: one row (id = 1). The switch is `enabled`. */
export type NewsStateRow = {
  enabled: boolean;
  /** last watcher run that READ the source successfully: «Updated at hh:mm» */
  last_run_at: string | null;
  last_error: string | null;
  source_status: "ok" | "degraded" | "blocked" | "limited" | string | null;
};

/** news_items: one rewritten note. */
export type NewsItemRow = {
  guid_hash: string;
  source: string;
  source_url: string;
  published_at: string;
  rewritten_en: NoteText | string;
  rewritten_it: NoteText | string;
  teams: string[];
  rewrite_model: string;
  rewritten_at: string;
};

/** One REWRITTEN note as the client receives it. */
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

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

const text = (x: unknown): NoteText | null => {
  const o = typeof x === "string" ? safeJson(x) : x;
  if (!o || typeof o !== "object") return null;
  const { title, body } = o as Record<string, unknown>;
  return typeof title === "string" && typeof body === "string" && title.trim() && body.trim() ? { title: title.trim(), body: body.trim() } : null;
};

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
  if (typeof r.rewrite_model === "string" && r.rewrite_model.startsWith(REJECTED_PREFIX)) return null;
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

/** The site's two reads (SELECT only). */
export const STATE_SQL = "SELECT enabled, last_run_at, last_error, source_status FROM news_state WHERE id = 1";
export const ITEMS_SQL = `SELECT guid_hash, source, source_url, published_at, rewritten_en, rewritten_it, teams, rewrite_model, rewritten_at FROM news_items WHERE published_at > now() - interval '${SHOW_DAYS} days' AND rewrite_model NOT LIKE '${REJECTED_PREFIX}%' ORDER BY published_at DESC LIMIT ${MAX_ITEMS}`;

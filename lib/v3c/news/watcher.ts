// lib/v3c/news/watcher.ts (#REDESIGN-V3C newswatch) — one run of the news
// watcher: read FotMob, queue what is new, rewrite it with the local `claude -p`,
// check it, write it. Every dependency is injected (fetch, rewrite, DB, clock):
// the tests drive it with fixtures, `--dry-run` with a DB that only prints, the
// daemon with the real ones — one path for all three.
//
// Guardrails (debt accepted by Andrea 05/10, widened 07/10 to the page; owner Andrea):
//  - ONE GET of https://www.fotmob.com/it/news per run (~10 min), the RSS at most
//    hourly; robots.txt read (cached 6 h) and obeyed; /api refused in code;
//    identifiable user-agent; 4xx/5xx/429 → 10, 20, 40 … min backoff (max 6 h).
//  - 403 / challenge → the watcher stops itself: `blocked` is written to the
//    local state and to news_state.source_status, and no request leaves again
//    until a person clears it (`--unblock`).
//  - Dedup by sha256 of the guid and of the link; only NEW items reach `claude`.
//  - Usage/rate limit of the subscription → stop rewriting for this run, write
//    last_error, keep the item queued (on file) for the next run. No burst retry.
//  - Rows are written only after the checks pass; the original headline and
//    teaser stay in the local queue file, never in the table.
import { createHash } from "node:crypto";
import { FOTMOB_FEED_URL, NEWS_USER_AGENT, parseRss, robotsAllows, type FeedItem } from "./feed";
import { assertNotApi, FOTMOB_NEWS_PAGE_URL, looksBlocked, mayFetch, mergeSources, nextHealth, parseNewsPage, retryAfterS, type SourceHealth } from "./page";
import { rowFor, type NewsItemRow, type NewsStateRow } from "./table";
import { words } from "./rewrite";
import type { RewriteOutcome } from "./claude-cli";

export const RSS_EVERY_MS = 3_600_000;
export const ROBOTS_EVERY_MS = 6 * 3_600_000;
/** Items older than this are never rewritten (first run, or a long sleep). */
export const MAX_AGE_MS = 48 * 3_600_000;
/** Rewrites per run: caps the subscription use (6 per 10 min at most). */
export const MAX_REWRITES = 6;
/**
 * Items whose teaser has fewer words than this are not sent to `claude`: measured
 * 07/10 on the real page, 2 of 3 headline-only items (SI) came back «insufficient»
 * — a call spent for nothing. They are dropped as «no teaser».
 */
export const MIN_TEASER_WORDS = 8;
/** A transient failure is retried on this many runs, then the item is dropped. */
export const MAX_ATTEMPTS = 3;
const SEEN_KEEP_MS = 7 * 86_400_000;
export const RETENTION_DAYS = 30;

type Kind = "page" | "rss";
export type Queued = { item: FeedItem; hash: string; attempts: number; row?: NewsItemRow };

/** Everything the watcher remembers between runs (a JSON file next to the daemon). */
export type WatcherState = {
  v: 1;
  /** sha256(guid) and sha256(url) → first seen (ms) */
  seen: Record<string, number>;
  queue: Queued[];
  health: Record<Kind, { failures: number; nextAt: number }>;
  /** set on a 403/challenge; nothing is fetched while it is set */
  blocked: string | null;
  lastRssAt: number;
  robots: { at: number; text: string } | null;
};

export const freshState = (): WatcherState => ({
  v: 1,
  seen: {},
  queue: [],
  health: { page: { failures: 0, nextAt: 0 }, rss: { failures: 0, nextAt: 0 } },
  blocked: null,
  lastRssAt: 0,
  robots: null,
});

export type StatePatch = Partial<Pick<NewsStateRow, "last_run_at" | "last_error" | "source_status">>;

export interface WatcherDb {
  /** news_state.enabled; throws when the table cannot be read */
  enabled(): Promise<boolean>;
  /** insert, ignoring rows whose guid_hash is already there */
  insert(rows: NewsItemRow[]): Promise<void>;
  setState(patch: StatePatch): Promise<void>;
  /** delete rows published before `before` (retention) */
  prune(before: string): Promise<void>;
}

export type Deps = {
  now: () => number;
  fetch: typeof fetch;
  rewrite: (item: FeedItem) => Promise<RewriteOutcome>;
  db: WatcherDb;
  log: (line: string) => void;
};

export type RunOptions = { pageUrl?: string; feedUrl?: string; maxRewrites?: number };

export type RunReport = {
  /** 0 ok · 1 something broke (DB) · 2 the source blocked us (needs a person) */
  exit: 0 | 1 | 2;
  disabled?: boolean;
  fetched: Record<Kind, number | null>;
  queued: number;
  rewritten: number;
  rejected: { hash: string; reason: string }[];
  written: number;
  limited: string | null;
  errors: string[];
  outcomes: { item: FeedItem; outcome: RewriteOutcome }[];
};

export const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

type Read = { ok: true; items: FeedItem[] } | { ok: false; error: string; blocked?: string; retryAfterS?: number };

const get = (f: typeof fetch, url: string, accept: string) => {
  assertNotApi(url);
  return f(url, { headers: { "user-agent": NEWS_USER_AGENT, accept }, redirect: "follow", signal: AbortSignal.timeout(15_000) });
};

/** robots.txt, cached 6 h in the state: 404 = no rules; any other failure = keep the old copy, or do not fetch. */
async function robots(s: WatcherState, d: Deps, origin: string): Promise<string | null> {
  const now = d.now();
  if (s.robots && now - s.robots.at < ROBOTS_EVERY_MS) return s.robots.text;
  try {
    const r = await get(d.fetch, `${origin}/robots.txt`, "text/plain");
    if (r.status === 404) s.robots = { at: now, text: "" };
    else if (r.ok) s.robots = { at: now, text: await r.text() };
  } catch {
    /* keep the old copy below */
  }
  return s.robots?.text ?? null;
}

/** One GET of one source, robots first; a block is recognised and reported, never worked around. */
export async function readSource(s: WatcherState, d: Deps, url: string, kind: Kind): Promise<Read> {
  try {
    assertNotApi(url);
  } catch (e) {
    return { ok: false, error: String(e) };
  }
  const u = new URL(url);
  const rules = await robots(s, d, u.origin);
  if (rules == null) return { ok: false, error: "robots unavailable" };
  if (!robotsAllows(rules, u.pathname + u.search)) return { ok: false, error: "robots disallow" };
  try {
    const r = await get(d.fetch, url, kind === "page" ? "text/html" : "application/rss+xml, application/xml;q=0.9, text/plain;q=0.8");
    const body = await r.text();
    if (kind === "page" && looksBlocked(r.status, body, r.headers)) return { ok: false, error: `blocked (http ${r.status})`, blocked: `page http ${r.status}` };
    if (kind === "rss" && (r.status === 403 || r.status === 401 || r.status === 451)) return { ok: false, error: `blocked (http ${r.status})`, blocked: `rss http ${r.status}` };
    if (!r.ok) return { ok: false, error: `http ${r.status}`, retryAfterS: retryAfterS(r.headers.get("retry-after")) };
    if (kind === "rss") return { ok: true, items: parseRss(body).items };
    const p = parseNewsPage(body);
    return p.ok ? { ok: true, items: p.items } : { ok: false, error: p.error };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 120) };
  }
}

const toHealth = (h: { failures: number; nextAt: number }): SourceHealth => ({ ...h, blocked: null });

/** One run. Mutates and returns `s` (the caller saves it, or not in dry-run). */
export async function runCycle(s: WatcherState, d: Deps, o: RunOptions = {}): Promise<RunReport> {
  const rep: RunReport = { exit: 0, fetched: { page: null, rss: null }, queued: 0, rewritten: 0, rejected: [], written: 0, limited: null, errors: [], outcomes: [] };
  const now = d.now();

  // 1. the switch
  let enabled: boolean;
  try {
    enabled = await d.db.enabled();
  } catch (e) {
    rep.errors.push(`news_state unreadable: ${String(e).slice(0, 160)}`);
    rep.exit = 1;
    return rep;
  }
  if (!enabled) {
    d.log("news_state.enabled = false: nothing fetched, nothing written");
    rep.disabled = true;
    return rep;
  }

  // 2. stopped by a block until a person clears it
  if (s.blocked) {
    d.log(`source blocked (${s.blocked}): not fetching. Review, then run with --unblock.`);
    await d.db.setState({ source_status: "blocked", last_error: `blocked: ${s.blocked}` }).catch(() => {});
    rep.exit = 2;
    return rep;
  }

  // 3. the sources: the page every run, the RSS hourly
  const lists: FeedItem[][] = [];
  let anyOk = false;
  const due: [Kind, string][] = [["page", o.pageUrl ?? FOTMOB_NEWS_PAGE_URL]];
  if (now - s.lastRssAt >= RSS_EVERY_MS) due.push(["rss", o.feedUrl ?? FOTMOB_FEED_URL]);
  for (const [kind, url] of due) {
    if (!mayFetch(toHealth(s.health[kind]), now)) continue;
    if (kind === "rss") s.lastRssAt = now;
    const r = await readSource(s, d, url, kind);
    const h = nextHealth(toHealth(s.health[kind]), r.ok ? { ok: true } : { ok: false, blocked: r.blocked, retryAfterS: r.retryAfterS }, now);
    s.health[kind] = { failures: h.failures, nextAt: Number.isFinite(h.nextAt) ? h.nextAt : 0 };
    if (!r.ok && r.blocked) {
      s.blocked = r.blocked;
      d.log(`FotMob answered with a block (${r.blocked}): the watcher stops itself.`);
      await d.db.setState({ source_status: "blocked", last_error: `blocked: ${r.blocked}` }).catch(() => {});
      rep.exit = 2;
      return rep;
    }
    if (!r.ok) {
      rep.errors.push(`${kind}: ${r.error}`);
      continue;
    }
    anyOk = true;
    rep.fetched[kind] = r.items.length;
    lists.push(r.items);
  }

  // 4. what is new goes to the queue
  const queuedHashes = new Set(s.queue.map((q) => q.hash));
  for (const it of mergeSources(lists, 60)) {
    const h = sha(it.guid);
    const uh = sha(it.url);
    if (s.seen[h] || s.seen[uh] || queuedHashes.has(h)) continue;
    if (now - it.t > MAX_AGE_MS) {
      s.seen[h] = s.seen[uh] = now; // too old to be news: never rewritten
      continue;
    }
    if (words(it.text).length < MIN_TEASER_WORDS) {
      s.seen[h] = s.seen[uh] = now; // nothing to rewrite from: never sent to claude
      rep.rejected.push({ hash: h, reason: "no teaser" });
      continue;
    }
    s.queue.push({ item: it, hash: h, attempts: 0 });
    queuedHashes.add(h);
    rep.queued++;
  }
  s.queue = s.queue.filter((q) => now - q.item.t <= MAX_AGE_MS || q.row); // stale and not rewritten: dropped
  s.queue.sort((a, b) => b.item.t - a.item.t);

  // 5. rewrite, newest first, at most N per run; stop at the first usage limit
  const done = (q: Queued) => {
    s.seen[q.hash] = s.seen[sha(q.item.url)] = now;
  };
  let budget = o.maxRewrites ?? MAX_REWRITES;
  for (const q of s.queue) {
    if (q.row) continue;
    if (budget <= 0) break;
    budget--;
    const out = await d.rewrite(q.item);
    rep.outcomes.push({ item: q.item, outcome: out });
    if (out.kind === "ok") {
      q.row = rowFor(q.item, q.hash, out.rewritten, now);
      rep.rewritten++;
    } else if (out.kind === "final") {
      rep.rejected.push({ hash: q.hash, reason: out.reason });
      done(q);
    } else if (out.kind === "limit") {
      rep.limited = out.reason;
      d.log(`claude usage limit: ${out.reason} — the queue waits for the next run`);
      break;
    } else {
      q.attempts++;
      rep.errors.push(`rewrite: ${out.reason}`);
      if (q.attempts >= MAX_ATTEMPTS) done(q);
    }
  }
  s.queue = s.queue.filter((q) => !s.seen[q.hash] || q.row);

  // 6. write what passed; only then is it «seen»
  const rows = s.queue.filter((q) => q.row).map((q) => q.row!);
  if (rows.length) {
    try {
      await d.db.insert(rows);
      rep.written = rows.length;
      for (const q of s.queue) if (q.row) done(q);
      s.queue = s.queue.filter((q) => !q.row);
    } catch (e) {
      rep.errors.push(`insert failed: ${String(e).slice(0, 160)}`);
      rep.exit = 1; // the rewrites stay in the queue file: written next run, not redone
    }
  }

  // 7. housekeeping and the state row
  for (const [k, t] of Object.entries(s.seen)) if (now - t > SEEN_KEEP_MS) delete s.seen[k];
  try {
    await d.db.prune(new Date(now - RETENTION_DAYS * 86_400_000).toISOString());
  } catch (e) {
    rep.errors.push(`prune failed: ${String(e).slice(0, 120)}`);
  }
  const lastError = rep.limited ? `usage limit: ${rep.limited}`.slice(0, 300) : rep.errors.length ? rep.errors.join(" · ").slice(0, 300) : null;
  const patch: StatePatch = { last_error: lastError, source_status: rep.limited ? "limited" : anyOk ? "ok" : "degraded" };
  if (anyOk) patch.last_run_at = new Date(now).toISOString();
  try {
    await d.db.setState(patch);
  } catch (e) {
    rep.errors.push(`news_state update failed: ${String(e).slice(0, 120)}`);
    rep.exit = 1;
  }
  return rep;
}

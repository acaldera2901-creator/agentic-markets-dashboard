// lib/v3c/news/watcher.test.ts (#REDESIGN-V3C newswatch) — one run of the news
// watcher on the recorded FotMob page and RSS, with a fake fetch, a fake `claude`
// and a fake DB: no network, no model, no database.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { freshState, MAX_ATTEMPTS, MAX_REWRITES, MIN_TEASER_WORDS, runCycle, sha, type Deps, type WatcherDb } from "./watcher";
import { words } from "./rewrite";
import { claudeArgs, LIMIT_RE, readCliOutput, type RewriteOutcome } from "./claude-cli";
import { parseNewsPage } from "./page";
import { NEWS_USER_AGENT, type FeedItem } from "./feed";
import type { NewsItemRow } from "./table";

const HTML = readFileSync(join(__dirname, "__fixtures__", "fotmob-news-page.html"), "utf8");
const RSS = readFileSync(join(__dirname, "__fixtures__", "fotmob-topnews.xml"), "utf8");
const ROBOTS = "User-agent: *\nDisallow: /api/*\nDisallow: /auth/*\n";
const READ_AT = Date.parse("2026-10-07T10:35:49Z");
const MIN = 60_000;
const PAGE = "https://www.fotmob.com/it/news";
const FEED = "https://www.fotmob.com/topnews/feed?format=rss";

type Answer = { status: number; body: string; headers?: Record<string, string> };
const ITEMS = (parseNewsPage(HTML) as { ok: true; items: FeedItem[] }).items;
const hasTeaser = (it: FeedItem) => words(it.text).length >= MIN_TEASER_WORDS;
const res = (a: Answer) => new Response(a.body, { status: a.status, headers: a.headers });

function fakeFetch(routes: Record<string, Answer | (() => Answer)>) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    expect(new Headers(init?.headers).get("user-agent")).toBe(NEWS_USER_AGENT);
    const r = routes[u];
    if (!r) throw new Error(`unexpected GET ${u}`);
    return res(typeof r === "function" ? r() : r);
  });
}

/** A rewrite that passes the checks for any item (generic words, no copy). */
const okRewrite = (item: FeedItem): RewriteOutcome => ({
  kind: "ok",
  usage: { ms: 4000, costUsd: 0.003, inTokens: 1500, outTokens: 250, model: "claude-haiku-4-5" },
  rewritten: { note: { kind: "ai", en: { title: `Note ${item.guid.length}`, body: "A short neutral note." }, it: { title: "Nota", body: "Una breve nota neutra." }, model: "claude-haiku-4-5 · prompt v3" }, teams: [] },
});

function fakeDb(enabled = true) {
  const rows: NewsItemRow[] = [];
  const patches: Record<string, unknown>[] = [];
  const db: WatcherDb & { rows: NewsItemRow[]; patches: Record<string, unknown>[]; failInsert: boolean } = {
    rows,
    patches,
    failInsert: false,
    enabled: vi.fn(async () => enabled),
    insert: vi.fn(async (r: NewsItemRow[]) => {
      if (db.failInsert) throw new Error("http 500");
      rows.push(...r);
    }),
    setState: vi.fn(async (p) => void patches.push(p)),
    prune: vi.fn(async () => {}),
  };
  return db;
}

function deps(over: Partial<Deps> & { db: WatcherDb }, now = READ_AT): Deps {
  return {
    now: () => now,
    fetch: fakeFetch({ "https://www.fotmob.com/robots.txt": { status: 200, body: ROBOTS }, [PAGE]: { status: 200, body: HTML }, [FEED]: { status: 200, body: RSS } }) as unknown as typeof fetch,
    rewrite: vi.fn(async (it: FeedItem) => okRewrite(it)),
    log: () => {},
    ...over,
  };
}

describe("watcher · one run on the recorded page", () => {
  it("robots first, one GET of the page and one of the RSS, never /api; newest 6 rewritten and written", async () => {
    const db = fakeDb();
    const d = deps({ db });
    const s = freshState();
    const rep = await runCycle(s, d);
    const urls = (d.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(urls).toEqual(["https://www.fotmob.com/robots.txt", PAGE, FEED]);
    expect(urls.some((u) => u.includes("/api"))).toBe(false);
    expect(rep.exit).toBe(0);
    expect(rep.fetched.page).toBe(20);
    expect(rep.rewritten).toBe(MAX_REWRITES);
    expect(db.rows).toHaveLength(MAX_REWRITES);
    // the newest WITH a teaser first, and the row carries no original headline or teaser
    const newest = ITEMS.find(hasTeaser)!;
    expect(db.rows[0].guid_hash).toBe(sha(newest.guid));
    expect(db.rows[0].source_url).toBe(newest.url);
    expect(JSON.stringify(db.rows)).not.toContain(newest.title);
    expect(Object.keys(db.rows[0]).sort()).toEqual(["guid_hash", "published_at", "rewrite_model", "rewritten_at", "rewritten_en", "rewritten_it", "source", "source_url", "teams"].sort());
    // headline-only items never reach claude; the rest waits in the local queue;
    // the 5-day-old RSS items are never queued
    const noTeaser = rep.rejected.filter((r) => r.reason === "no teaser").length;
    expect(noTeaser).toBe(ITEMS.filter((i) => !hasTeaser(i)).length);
    expect(noTeaser).toBeGreaterThan(0);
    for (const c of (d.rewrite as ReturnType<typeof vi.fn>).mock.calls) expect(hasTeaser(c[0] as FeedItem)).toBe(true);
    expect(s.queue.length).toBe(rep.queued - MAX_REWRITES);
    expect(s.queue.every((q) => READ_AT - q.item.t <= 48 * 60 * MIN)).toBe(true);
    expect(db.patches.at(-1)).toMatchObject({ source_status: "ok", last_error: null, last_run_at: new Date(READ_AT).toISOString() });
    expect(db.prune).toHaveBeenCalledWith(new Date(READ_AT - 30 * 86_400_000).toISOString());
  });

  it("dedup: the next run rewrites only what is still queued, nothing twice; RSS not before an hour", async () => {
    const db = fakeDb();
    const s = freshState();
    await runCycle(s, deps({ db }));
    const d2 = deps({ db }, READ_AT + 10 * MIN);
    const rep2 = await runCycle(s, d2);
    const urls = (d2.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(urls).toEqual([PAGE]); // robots cached, RSS hourly
    expect(rep2.queued).toBe(0);
    const hashes = db.rows.map((r) => r.guid_hash);
    expect(new Set(hashes).size).toBe(hashes.length);
    const seenRewrites = (d2.rewrite as ReturnType<typeof vi.fn>).mock.calls.map((c) => (c[0] as FeedItem).guid);
    expect(seenRewrites.length).toBeLessThanOrEqual(MAX_REWRITES);
  });

  it("only new items reach claude: an item seen by URL (another guid) is skipped", async () => {
    const db = fakeDb();
    const s = freshState();
    const first = (parseNewsPage(HTML) as { ok: true; items: FeedItem[] }).items[0];
    s.seen[sha(first.url)] = READ_AT - MIN;
    const d = deps({ db });
    await runCycle(s, d, { maxRewrites: 20 });
    const asked = (d.rewrite as ReturnType<typeof vi.fn>).mock.calls.map((c) => (c[0] as FeedItem).url);
    expect(asked).not.toContain(first.url);
  });

  it("news_state.enabled = false → no request at all, nothing written", async () => {
    const db = fakeDb(false);
    const d = deps({ db });
    const rep = await runCycle(freshState(), d);
    expect(rep.disabled).toBe(true);
    expect(d.fetch).not.toHaveBeenCalled();
    expect(d.rewrite).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("news_state unreadable → exit 1, no request", async () => {
    const db = fakeDb();
    db.enabled = vi.fn(async () => {
      throw new Error("relation news_state does not exist");
    });
    const d = deps({ db });
    const rep = await runCycle(freshState(), d);
    expect(rep.exit).toBe(1);
    expect(d.fetch).not.toHaveBeenCalled();
  });
});

describe("watcher · block, backoff, limits", () => {
  it("403 on the page → stops itself: blocked in state and news_state, exit 2, no RSS, no claude; next run sends nothing", async () => {
    const db = fakeDb();
    const s = freshState();
    const d = deps({ db, fetch: fakeFetch({ "https://www.fotmob.com/robots.txt": { status: 200, body: ROBOTS }, [PAGE]: { status: 403, body: "Forbidden" } }) as unknown as typeof fetch });
    const rep = await runCycle(s, d);
    expect(rep.exit).toBe(2);
    expect(s.blocked).toBe("page http 403");
    expect(db.patches.at(-1)).toMatchObject({ source_status: "blocked" });
    expect(d.rewrite).not.toHaveBeenCalled();
    const d2 = deps({ db }, READ_AT + 60 * MIN);
    const rep2 = await runCycle(s, d2);
    expect(rep2.exit).toBe(2);
    expect(d2.fetch).not.toHaveBeenCalled();
  });

  it("a Cloudflare challenge with 200 is a block too", async () => {
    const s = freshState();
    const d = deps({ db: fakeDb(), fetch: fakeFetch({ "https://www.fotmob.com/robots.txt": { status: 200, body: ROBOTS }, [PAGE]: { status: 200, body: "<title>Just a moment...</title>" } }) as unknown as typeof fetch });
    expect((await runCycle(s, d)).exit).toBe(2);
  });

  it("429 → backoff (Retry-After honoured): the next run within the wait sends no request; degraded, no last_run_at", async () => {
    const db = fakeDb();
    const s = freshState();
    const d = deps({ db, fetch: fakeFetch({ "https://www.fotmob.com/robots.txt": { status: 200, body: ROBOTS }, [PAGE]: { status: 429, body: "", headers: { "retry-after": "1800" } }, [FEED]: { status: 503, body: "" } }) as unknown as typeof fetch });
    const rep = await runCycle(s, d);
    expect(rep.exit).toBe(0);
    expect(s.health.page.nextAt).toBe(READ_AT + 30 * MIN);
    expect(db.patches.at(-1)).toMatchObject({ source_status: "degraded" });
    expect(db.patches.at(-1)).not.toHaveProperty("last_run_at");
    const d2 = deps({ db }, READ_AT + 20 * MIN);
    await runCycle(s, d2);
    expect(d2.fetch).not.toHaveBeenCalled();
  });

  it("robots.txt disallowing the page → no GET of the page", async () => {
    const s = freshState();
    const d = deps({ db: fakeDb(), fetch: fakeFetch({ "https://www.fotmob.com/robots.txt": { status: 200, body: "User-agent: BetRedgeNews\nDisallow: /\n" } }) as unknown as typeof fetch });
    const rep = await runCycle(s, d);
    expect(rep.errors.join()).toMatch(/robots disallow/);
  });

  it("usage limit → stops at the first one, item stays queued, last_error written, retried next run", async () => {
    const db = fakeDb();
    const s = freshState();
    const rewrite = vi.fn(async (): Promise<RewriteOutcome> => ({ kind: "limit", reason: "You've hit your weekly limit · resets 6pm" }));
    const rep = await runCycle(s, deps({ db, rewrite }));
    expect(rewrite).toHaveBeenCalledTimes(1);
    expect(rep.limited).toMatch(/weekly limit/);
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.patches.at(-1)).toMatchObject({ source_status: "limited", last_error: expect.stringMatching(/^usage limit: You've hit/) });
    const queued = s.queue.length;
    expect(queued).toBe(rep.queued);
    const rep2 = await runCycle(s, deps({ db }, READ_AT + 10 * MIN));
    expect(rep2.rewritten).toBe(MAX_REWRITES);
    expect(s.queue.length).toBe(queued - MAX_REWRITES);
  });

  it("a failed check is final (dropped, never retried); a transient failure is retried at most 3 runs", async () => {
    const db = fakeDb();
    const s = freshState();
    const final = vi.fn(async (): Promise<RewriteOutcome> => ({ kind: "final", reason: "check: copies a 6-word run" }));
    const rep = await runCycle(s, deps({ db, rewrite: final }, READ_AT), { maxRewrites: 1 });
    const failed = rep.rejected.filter((r) => r.reason !== "no teaser");
    expect(failed).toEqual([{ hash: expect.any(String), reason: "check: copies a 6-word run" }]);
    expect(final).toHaveBeenCalledTimes(1);
    expect(s.queue.find((q) => q.hash === failed[0].hash)).toBeUndefined();
    const flaky = vi.fn(async (): Promise<RewriteOutcome> => ({ kind: "transient", reason: "claude exit 1" }));
    const target = s.queue[0].hash;
    for (let i = 0; i < MAX_ATTEMPTS; i++) await runCycle(s, deps({ db, rewrite: flaky }, READ_AT + (i + 1) * MIN), { maxRewrites: 1 });
    expect(s.queue.find((q) => q.hash === target)).toBeUndefined();
    expect(s.seen[target]).toBeDefined();
  });

  it("insert fails → exit 1, the rewrites stay queued and are written next run WITHOUT asking claude again", async () => {
    const db = fakeDb();
    db.failInsert = true;
    const s = freshState();
    const d = deps({ db });
    const rep = await runCycle(s, d, { maxRewrites: 2 });
    expect(rep.exit).toBe(1);
    expect(s.queue.filter((q) => q.row)).toHaveLength(2);
    db.failInsert = false;
    const d2 = deps({ db }, READ_AT + 10 * MIN);
    const rep2 = await runCycle(s, d2, { maxRewrites: 0 });
    expect(d2.rewrite).not.toHaveBeenCalled();
    expect(rep2.written).toBe(2);
    expect(db.rows).toHaveLength(2);
  });
});

describe("claude-cli · the local `claude -p`", () => {
  const item = (parseNewsPage(HTML) as { ok: true; items: FeedItem[] }).items[3]; // «United States 1-0 Canada …»
  const good = { status: "ok", headline_en: "USA edge Canada 1-0 in Minnesota", body_en: "Pochettino's side extended their momentum against their neighbours.", headline_it: "Gli USA superano il Canada 1-0 in Minnesota", body_it: "La squadra di Pochettino prolunga il buon momento contro i vicini.", teams: ["United States", "Canada", "Brazil"] };
  const cli = (o: object) => JSON.stringify({ type: "result", subtype: "success", is_error: false, num_turns: 2, result: JSON.stringify(good), structured_output: good, total_cost_usd: 0.0028, usage: { input_tokens: 1549, output_tokens: 253 }, modelUsage: { "claude-haiku-4-5-20251001": {} }, ...o });

  it("args: print mode, haiku, no tools, safe mode, no MCP, no session, JSON schema, no thinking; never an API key", () => {
    const a = claudeArgs();
    expect(a[0]).toBe("-p");
    expect(a).toEqual(expect.arrayContaining(["--safe-mode", "--strict-mcp-config", "--no-session-persistence"]));
    expect(a[a.indexOf("--model") + 1]).toBe("haiku");
    expect(a[a.indexOf("--tools") + 1]).toBe("");
    expect(a[a.indexOf("--output-format") + 1]).toBe("json");
    expect(JSON.parse(a[a.indexOf("--json-schema") + 1]).required).toContain("teams");
    expect(JSON.parse(a[a.indexOf("--settings") + 1])).toEqual({ alwaysThinkingEnabled: false });
    expect(a.join(" ")).not.toMatch(/api.?key|--bare/i);
  });

  it("success → ok note, usage read, invented team dropped", () => {
    const o = readCliOutput(cli({}), "", 0, item, 4242);
    expect(o.kind).toBe("ok");
    if (o.kind !== "ok") return;
    expect(o.rewritten.teams).toEqual(["United States", "Canada"]);
    expect(o.rewritten.note.model).toBe("claude-haiku-4-5-20251001 · prompt v4");
    expect(o.usage).toEqual({ ms: 4242, costUsd: 0.0028, inTokens: 1549, outTokens: 253, model: "claude-haiku-4-5-20251001" });
  });

  it("weekly/usage/rate limit (in result or stderr) → limit; other errors → transient; failed check → final", () => {
    expect(readCliOutput(cli({ is_error: true, subtype: "error_during_execution", result: "You've hit your weekly limit · resets Oct 9, 6pm" }), "", 1, item, 1).kind).toBe("limit");
    expect(readCliOutput("", "Error: 429 rate_limit_error", 1, item, 1).kind).toBe("limit");
    expect(readCliOutput("", "spawn ENOENT", 1, item, 1).kind).toBe("transient");
    expect(readCliOutput(cli({ is_error: true, result: "Something went wrong" }), "", 1, item, 1).kind).toBe("transient");
    const bad = { ...good, body_en: "A sure win for the USA." };
    expect(readCliOutput(cli({ structured_output: bad, result: JSON.stringify(bad) }), "", 0, item, 1)).toMatchObject({ kind: "final", reason: expect.stringMatching(/banned/) });
    expect(LIMIT_RE.test("Claude usage limit reached. Your limit will reset at 6pm")).toBe(true);
    expect(LIMIT_RE.test("The match ended with a red card")).toBe(false);
  });
});

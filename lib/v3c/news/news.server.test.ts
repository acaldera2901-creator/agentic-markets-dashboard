// lib/v3c/news/news.server.test.ts (#REDESIGN-V3C newswatch) — the site side:
// it only READS news_state / news_items (SELECT), never FotMob, never a model.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const query = vi.fn();
vi.mock("@/lib/db", () => ({ dbQueryStrict: (sql: string) => query(sql) }));

import { getNews, newsTeams, readNews } from "./news.server";
import { cardFromRow, feedFromTable, ITEMS_SQL, REJECTED_PREFIX, STALE_MS, STATE_SQL, type NewsItemRow, type NewsStateRow } from "./table";

const NOW = Date.parse("2026-10-07T12:00:00Z");
const iso = (t: number) => new Date(t).toISOString();
const state = (o: Partial<NewsStateRow> = {}): NewsStateRow => ({ enabled: true, last_run_at: iso(NOW - 5 * 60_000), last_error: null, source_status: "ok", ...o });
const row = (i: number, o: Partial<NewsItemRow> = {}): NewsItemRow => ({
  guid_hash: `h${i}`,
  source: "SI via FotMob",
  source_url: `https://www.fotmob.com/embed/news/${i}`,
  published_at: iso(NOW - i * 3_600_000),
  rewritten_en: { title: `Note ${i}`, body: "Body." },
  rewritten_it: { title: `Nota ${i}`, body: "Testo." },
  teams: ["Inter"],
  rewrite_model: "claude-haiku-4-5 · prompt v3",
  rewritten_at: iso(NOW - i * 3_600_000 + 60_000),
  ...o,
});

afterEach(() => {
  query.mockReset();
  vi.unstubAllEnvs();
});

describe("feedFromTable · the page states", () => {
  it("fresh run + rows → ok, «Updated at» = the watcher's last_run_at, newest first", () => {
    const f = feedFromTable(state(), [row(3), row(1), row(2)], NOW);
    expect(f.state).toBe("ok");
    if (f.state !== "ok") return;
    expect(f.updatedAt).toBe(NOW - 5 * 60_000);
    expect(f.cards.map((c) => c.guid)).toEqual(["h1", "h2", "h3"]);
    expect(f.cards[0]).toMatchObject({ url: "https://www.fotmob.com/embed/news/1", source: "SI via FotMob", note: { kind: "ai", en: { title: "Note 1" } }, teams: ["Inter"] });
  });
  it("fresh run, no rows → empty (the guides show)", () => {
    expect(feedFromTable(state(), [], NOW)).toEqual({ state: "empty", updatedAt: NOW - 5 * 60_000 });
  });
  it("paused: switched off, blocked, last run over 2 h ago, never run, or no state row — and no cards", () => {
    const since = NOW - STALE_MS - 60_000;
    expect(feedFromTable(state({ enabled: false }), [row(1)], NOW)).toEqual({ state: "paused", since: NOW - 5 * 60_000 });
    expect(feedFromTable(state({ source_status: "blocked" }), [row(1)], NOW).state).toBe("paused");
    expect(feedFromTable(state({ last_run_at: iso(since) }), [row(1)], NOW)).toEqual({ state: "paused", since });
    expect(feedFromTable(state({ last_run_at: iso(NOW - STALE_MS) }), [row(1)], NOW).state).toBe("ok"); // exactly 2 h: still fresh
    expect(feedFromTable(state({ last_run_at: null }), [], NOW)).toEqual({ state: "paused", since: null });
    expect(feedFromTable(null, [row(1)], NOW)).toEqual({ state: "paused", since: null });
  });
  it("a usage limit or a degraded source still shows the notes while runs are fresh", () => {
    expect(feedFromTable(state({ source_status: "limited", last_error: "usage limit" }), [row(1)], NOW).state).toBe("ok");
  });
  it("malformed rows are dropped, never patched (jsonb as text is read)", () => {
    expect(cardFromRow(row(1, { rewritten_en: JSON.stringify({ title: "T", body: "B" }) as never }))?.note.en).toEqual({ title: "T", body: "B" });
    expect(cardFromRow(row(1, { rewritten_it: { title: "", body: "x" } }))).toBeNull();
    expect(cardFromRow(row(1, { source_url: "javascript:alert(1)" }))).toBeNull();
    expect(cardFromRow(row(1, { published_at: "nope" }))).toBeNull();
    expect(cardFromRow(row(1, { teams: null as never }))?.teams).toEqual([]);
  });
  it("a row refused at re-verification («rejected · …» in rewrite_model) is never shown, nor selected", () => {
    expect(cardFromRow(row(1, { rewrite_model: `${REJECTED_PREFIX}reverify: scorer invented · haiku · prompt v3` }))).toBeNull();
    expect(feedFromTable(state(), [row(1, { rewrite_model: `${REJECTED_PREFIX}x` })], NOW).state).toBe("empty");
    expect(ITEMS_SQL).toContain(`rewrite_model NOT LIKE '${REJECTED_PREFIX}%'`);
  });
});

describe("readNews · SELECT only, at request time", () => {
  it("reads the state row then the items; only SELECTs", async () => {
    query.mockImplementation(async (sql: string) => (sql === STATE_SQL ? [state()] : [row(1)]));
    const f = await readNews(NOW);
    expect(f.state).toBe("ok");
    expect(query.mock.calls.map((c) => c[0])).toEqual([STATE_SQL, ITEMS_SQL]);
    for (const [sql] of query.mock.calls) expect(sql).toMatch(/^SELECT /);
  });
  it("switched off → the items are not even read", async () => {
    query.mockImplementation(async () => [state({ enabled: false })]);
    expect((await readNews(NOW)).state).toBe("paused");
    expect(query).toHaveBeenCalledTimes(1);
  });
  it("table missing / DB down → error state, no exception", async () => {
    query.mockRejectedValue(new Error('relation "news_state" does not exist'));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await readNews(NOW)).toEqual({ state: "error" });
    spy.mockRestore();
  });
  it("NEWS_FOTMOB_ENABLED unset → off: no query, no fetch", async () => {
    vi.stubEnv("NEWS_FOTMOB_ENABLED", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await getNews()).toEqual({ state: "off" });
    expect(query).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
  it("`next build` never reads the tables, nor calls anything out", async () => {
    vi.stubEnv("NEWS_FOTMOB_ENABLED", "1");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await getNews()).toEqual({ state: "off" });
    expect(query).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("newsTeams · board links from the stored teams", () => {
  it("matches the board names through the aliases; a note without teams links nothing", () => {
    const f = feedFromTable(state(), [row(1, { teams: ["Man Utd", "Brighton"] }), row(2, { teams: [] })], NOW);
    if (f.state !== "ok") throw new Error(f.state);
    const m = newsTeams(f.cards, ["Manchester United", "Brighton & Hove Albion", "Inter"]);
    expect([...m.entries()]).toEqual([["h1", ["Manchester United", "Brighton & Hove Albion"]]]);
  });
});

// lib/v3c/news/daily-pick.test.ts (#NEWSWATCH-TOP3-1120) — the daily selection:
// Rome day and slots, the score, the caps, and the runs of the watcher with it
// (recorded FotMob page, fake claude, fake DB, fake cards: no network, no model).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { CLUBS } from "../../news/clubs";
import { topPick, DEFAULT_PICK, dailyFor, isTop5, mayPick, romeDay, scoreFootball, slotsOpen, type DailyState } from "./daily-pick";
import { freshState, runCycle, type Deps, type ImageDeps, type WatcherDb } from "./watcher";
import type { ImageAttempt } from "./image-gen";
import type { RewriteOutcome } from "./claude-cli";
import type { FeedItem } from "./feed";
import type { NewsItemRow } from "./table";

const HTML = readFileSync(join(__dirname, "__fixtures__", "fotmob-news-page.html"), "utf8");
const RSS = readFileSync(join(__dirname, "__fixtures__", "fotmob-topnews.xml"), "utf8");
const PAGE = "https://www.fotmob.com/it/news";
const FEED = "https://www.fotmob.com/topnews/feed?format=rss";
const READ_AT = Date.parse("2026-10-07T10:35:49Z"); // 12:35 Rome (CEST): slot 1 open, slot 2 at 14:00
const MIN = 60_000;

describe("daily-pick · Rome day and slots", () => {
  it("the day turns at Rome midnight, not UTC nor the Mac's Atlantic/Canary", () => {
    expect(romeDay(Date.parse("2026-11-20T22:59:00Z"))).toBe("2026-11-20"); // 23:59 Rome (CET)
    expect(romeDay(Date.parse("2026-11-20T23:00:00Z"))).toBe("2026-11-21"); // 00:00 Rome
    expect(romeDay(Date.parse("2026-07-01T22:00:00Z"))).toBe("2026-07-02"); // CEST
  });
  it("slots open at 09, 14, 19 Rome", () => {
    expect(slotsOpen(Date.parse("2026-11-21T07:59:00Z"))).toBe(0);
    expect(slotsOpen(Date.parse("2026-11-21T08:00:00Z"))).toBe(1);
    expect(slotsOpen(Date.parse("2026-11-21T12:59:00Z"))).toBe(1);
    expect(slotsOpen(Date.parse("2026-11-21T13:00:00Z"))).toBe(2);
    expect(slotsOpen(Date.parse("2026-11-21T18:00:00Z"))).toBe(3);
    expect(slotsOpen(Date.parse("2026-11-21T22:59:00Z"))).toBe(3);
  });
});

describe("daily-pick · the score", () => {
  const it_ = (title: string, text = "", source = "BBC") => ({ title, text, source });
  it("the top-5 boundary of clubs.ts holds (LEAGUE_TIER_TOP5 = PL, SA, PD, BL1, FL1)", () => {
    const by = (n: string) => CLUBS.find((c) => c.name === n)!;
    for (const n of ["AC Milan", "Real Madrid CF", "FC Bayern München", "Paris Saint-Germain FC", "Manchester United FC", "Le Havre AC"]) expect(isTop5(by(n))).toBe(true);
    for (const n of ["Benfica", "Celtic", "Inter Miami CF", "Flamengo", "FC Inter Turku"]) expect(isTop5(by(n))).toBe(false);
  });
  it("ranks the snapshot of 20/11 the way a bettor would: injuries at top-5 clubs first", () => {
    const saka = scoreFootball(it_("Arteta confirms Saliba return for Arsenal, Saka out for four more weeks", "", "FotMob"), []);
    const bayern = scoreFootball(it_("Bayern Munich 1-1 Koln: Kane and Olise injured in Bundesliga draw", "", "FotMob"), []);
    const brady = scoreFootball(it_("NFL great Brady could buy Chelsea stake"), []);
    const glentoran = scoreFootball(it_("First defeat and first red for Ferguson as Glentoran falter"), []);
    const mls = scoreFootball(it_("Sullivan unafraid as MLS playoffs approach with Philadelphia Union"), []);
    expect(saka).toEqual({ score: 4.5, why: "top5+2 market+2 fotmob+0.5" });
    expect(bayern.score).toBe(4.5);
    expect(brady.score).toBe(2);
    expect(mls.score).toBe(1);
    expect(glentoran.score).toBe(0);
  });
  it("coverage: other recent items on the same club add up to +2", () => {
    const others = ["Cost of Man Utd hiring and firing managers nears £100m", "Osimhen keen on Man Utd move", "Man United eye a new striker", "Chelsea win"];
    expect(scoreFootball(it_("Man Utd CEO accepts criticism"), others)).toEqual({ score: 4, why: "top5+2 coverage+2" });
    expect(scoreFootball(it_("Man Utd CEO accepts criticism"), others.slice(3))).toEqual({ score: 2, why: "top5+2" });
  });
  it("topPick: highest score, then newest", () => {
    const c = (t: number, score: number) => ({ item: { t }, s: { score, why: "" } });
    expect(topPick([c(1, 2), c(3, 4), c(2, 4)])!.item.t).toBe(3);
    expect(topPick([])).toBeNull();
  });
});

describe("daily-pick · caps", () => {
  const at = Date.parse("2026-11-21T19:00:00Z"); // 20:00 Rome: all 3 slots open
  const day = (picks: DailyState["picks"]): DailyState => ({ day: romeDay(at), picks });
  const p = (status: "image" | "published" | "dead") => ({ hash: Math.random().toString(), sport: "football" as const, at, score: 1, status, title: "" });
  it("3 published = done; one in flight = wait; a dead pick hands its place over up to 6 rewrites", () => {
    expect(mayPick(day([]), "football", DEFAULT_PICK, at).ok).toBe(true);
    expect(mayPick(day([p("published"), p("published"), p("published")]), "football", DEFAULT_PICK, at)).toMatchObject({ ok: false, why: "3/3 published today" });
    expect(mayPick(day([p("image")]), "football", DEFAULT_PICK, at).ok).toBe(false);
    expect(mayPick(day([p("dead"), p("dead"), p("published")]), "football", DEFAULT_PICK, at)).toMatchObject({ ok: true, why: "slot 2/3" });
    expect(mayPick(day([p("dead"), p("dead"), p("dead"), p("dead"), p("dead"), p("published")]), "football", DEFAULT_PICK, at)).toMatchObject({ ok: false, why: "rewrite cap 6/6" });
    expect(mayPick(day([]), "tennis", DEFAULT_PICK, at).ok).toBe(false); // a sport not configured is never picked
  });
  it("a slot not open yet waits; an unused slot rolls over to the next one", () => {
    const morning = Date.parse("2026-11-21T07:30:00Z");
    expect(mayPick({ day: romeDay(morning), picks: [] }, "football", DEFAULT_PICK, morning).ok).toBe(false);
    const noon = Date.parse("2026-11-21T11:00:00Z");
    expect(mayPick({ day: romeDay(noon), picks: [p("published")] }, "football", DEFAULT_PICK, noon).ok).toBe(false);
    expect(mayPick(day([p("published")]), "football", DEFAULT_PICK, at).ok).toBe(true); // 20:00, 1 of 3 out
  });
  it("at Rome midnight the counters reset; only a note still waiting for its card moves over", () => {
    const prev: DailyState = { day: "2026-11-20", picks: [p("published"), p("dead"), p("image")] };
    const next = dailyFor(prev, Date.parse("2026-11-20T23:00:00Z"));
    expect(next.day).toBe("2026-11-21");
    expect(next.picks.map((x) => x.status)).toEqual(["image"]);
    expect(dailyFor(next, Date.parse("2026-11-21T10:00:00Z"))).toBe(next);
  });
});

// ── the watcher with the selection on ──
const okRewrite = (item: FeedItem): RewriteOutcome => ({
  kind: "ok",
  usage: { ms: 4000, costUsd: 0.003, inTokens: 1500, outTokens: 250, model: "claude-haiku-4-5" },
  rewritten: { note: { kind: "ai", en: { title: `Note ${item.guid.length}`, body: "A short neutral note." }, it: { title: "Nota", body: "Una breve nota neutra." }, model: "claude-haiku-4-5 · prompt v3" }, teams: [] },
});
function fakeDb(): WatcherDb & { rows: NewsItemRow[] } {
  const rows: NewsItemRow[] = [];
  return { rows, enabled: vi.fn(async () => true), insert: vi.fn(async (r: NewsItemRow[]) => void rows.push(...r)), setState: vi.fn(async () => {}), prune: vi.fn(async () => {}), attachImage: vi.fn(async () => {}) };
}
const ROUTES = { "https://www.fotmob.com/robots.txt": { status: 200, body: "User-agent: *\nDisallow: /api/*\n" }, [PAGE]: { status: 200, body: HTML }, [FEED]: { status: 200, body: RSS } };
function deps(db: WatcherDb, now: number, over: Partial<Deps> = {}): Deps {
  return {
    db,
    now: () => now,
    fetch: vi.fn(async (u: string | URL | Request) => {
      const r = ROUTES[String(u) as keyof typeof ROUTES];
      return new Response(r.body, { status: r.status });
    }) as unknown as typeof fetch,
    rewrite: vi.fn(async (it: FeedItem) => okRewrite(it)),
    log: () => {},
    ...over,
  };
}
type Job = Parameters<ImageDeps["make"]>[0];
let n = 0;
const sig = () => ({ dhash: (BigInt(0x9e3779b97f4a7c15) * BigInt(++n) % (BigInt(1) << BigInt(64))).toString(16).padStart(16, "0"), csig: Array.from({ length: 48 }, (_, i) => (i * 37 + n * 101) % 256) });
const files = (base: string) => ({ png: `/x/${base}.png`, webp: `/x/${base}.webp`, webpBytes: 30_000 });
const pick = { pick: DEFAULT_PICK };

describe("watcher · daily selection (#NEWSWATCH-TOP3-1120)", () => {
  it("one rewrite per open slot, the best-scored candidate, the rest waits in the queue for free", async () => {
    const db = fakeDb();
    const s = freshState();
    const d = deps(db, READ_AT);
    const rep = await runCycle(s, d, pick);
    expect(d.rewrite).toHaveBeenCalledTimes(1);
    expect(rep.rewritten).toBe(1);
    expect(db.rows).toHaveLength(1); // no pictures: written at once = published
    expect(s.daily!.picks).toMatchObject([{ sport: "football", status: "published" }]);
    expect(s.queue.length).toBeGreaterThan(0);
    // the second run in the same slot spends nothing: slot 1 is used, slot 2 opens at 14:00 Rome
    const d2 = deps(db, READ_AT + 10 * MIN);
    await runCycle(s, d2, pick);
    expect(d2.rewrite).not.toHaveBeenCalled();
    // 14:00 and 19:00 Rome: one each, then nothing for the rest of the day
    for (const t of ["2026-10-07T12:00:00Z", "2026-10-07T17:00:00Z", "2026-10-07T19:30:00Z", "2026-10-07T21:30:00Z"]) await runCycle(s, deps(db, Date.parse(t)), pick);
    expect(db.rows).toHaveLength(3);
    expect(s.daily!.picks.filter((p) => p.status === "published")).toHaveLength(3);
  });

  it("the picked one is the top score of the queue", async () => {
    const s = freshState();
    const d = deps(fakeDb(), READ_AT);
    const lines: string[] = [];
    d.log = (l) => lines.push(l);
    await runCycle(s, d, pick);
    const asked = (d.rewrite as ReturnType<typeof vi.fn>).mock.calls[0][0] as FeedItem;
    const scores = [asked, ...s.queue.map((q) => q.item)].map((i) => scoreFootball(i, []).score);
    expect(lines.some((l) => l.startsWith("pick football slot 1/3 · score"))).toBe(true);
    // coverage can only raise the picked one; without it no queued item beats it by more than the coverage cap
    expect(Math.max(...scores.slice(1))).toBeLessThanOrEqual(scores[0] + 2);
  });

  it("a refused rewrite hands its place to the next candidate on the next run; 6 rewrites a day at most", async () => {
    const s = freshState();
    const db = fakeDb();
    const final = vi.fn(async (): Promise<RewriteOutcome> => ({ kind: "final", reason: "facts: invented" }));
    let t = READ_AT; // slot 1 open, nothing published: every dead pick hands over, until the cap
    for (let i = 0; i < 10; i++, t += 5 * MIN) await runCycle(s, deps(db, t, { rewrite: final }), pick);
    expect(final).toHaveBeenCalledTimes(6);
    expect(new Set(final.mock.calls.map((c) => (c as unknown as [FeedItem])[0].guid)).size).toBe(6);
    expect(db.rows).toHaveLength(0);
  });

  it("with cards: the pick waits for its card, a note with no real photo hands over after 2 runs, an old job without card is dropped", async () => {
    const s = freshState();
    const db = fakeDb();
    // a job from before the selection, never got its card: dropped (it would cost credits); one with its card ready stays
    s.images = [
      { hash: "a".repeat(64), base: "news-aaaaaaaaaaaa", note: { title: "Old", body: "Old note." }, teams: [], attempts: 0, at: READ_AT - 30 * 60 * MIN, lastError: "emma: no verified real photo with credit — card not made" },
      { hash: "b".repeat(64), base: "news-bbbbbbbbbbbb", note: { title: "Ready", body: "Ready note." }, teams: [], attempts: 0, at: READ_AT - 60 * MIN, files: files("news-bbbbbbbbbbbb") },
    ];
    const publish = vi.fn(async (j: { base: string }) => `https://x/${j.base}.webp`);
    const limit = vi.fn(async (): Promise<ImageAttempt> => ({ kind: "limit", reason: "test: no card this run" }));
    await runCycle(s, deps(db, READ_AT, { images: { make: limit, publish, holdRows: true } }), pick);
    expect(s.images!.map((j) => j.base)).not.toContain("news-aaaaaaaaaaaa");
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ base: "news-bbbbbbbbbbbb" }), expect.anything());
    const first = s.daily!.picks[0];
    expect(first.status).toBe("image");
    expect(db.rows.some((r) => r.guid_hash === first.hash)).toBe(false); // held until its card
    // the photo search fails (as pictures() records it in emma), 2 runs in a row
    for (let i = 1; i <= 2; i++) {
      s.images!.find((j) => j.hash === first.hash)!.lastError = "emma: no verified real photo with credit — card not made";
      await runCycle(s, deps(db, READ_AT + i * 5 * MIN, { images: { make: limit, publish, holdRows: true } }), pick);
    }
    expect(s.daily!.picks[0].status).toBe("dead");
    expect(s.images!.some((j) => j.hash === first.hash)).toBe(false);
    // the next run picks another one, its card comes out, it is published
    const ok = vi.fn(async (j: Job): Promise<ImageAttempt> => ({ kind: "ok", files: files(j.base), ms: 1, sig: sig(), textSeen: j.expected }));
    await runCycle(s, deps(db, READ_AT + 15 * MIN, { images: { make: ok, publish, holdRows: true } }), pick);
    expect(s.daily!.picks.map((p) => p.status)).toEqual(["dead", "published"]);
    expect(db.rows.some((r) => r.guid_hash === s.daily!.picks[1].hash)).toBe(true);
  });

  it("without `pick` the run is the one of before (newest N)", async () => {
    const s = freshState();
    const d = deps(fakeDb(), READ_AT);
    await runCycle(s, d, { maxRewrites: 2 });
    expect(d.rewrite).toHaveBeenCalledTimes(2);
    expect(s.daily).toBeUndefined();
  });
});

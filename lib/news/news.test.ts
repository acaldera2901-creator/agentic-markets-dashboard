// lib/news/news.test.ts (#NEWS-FOTMOB-PROD-1026) — the read side of the news
// without the network: the state the page derives from the two tables, the
// mapping note → row (Rome time, relative time, language), the links to the
// board and the three surfaces' selections. The five rows are the real notes
// of the watcher's dry run of 2026-10-26 (preview-news/note-reali-dryrun-26-10.json),
// shortened; nothing here reads a database.
import { describe, expect, it } from "vitest";
import { cardFromRow, feedFromTable, ITEMS_SQL, MAX_ITEMS, STALE_MS, STATE_SQL, type NewsItemRow, type NewsStateRow } from "./table";
import { newsEnabled, readNews } from "./read.server";
import { matchTeams } from "./teams";
import { matchesForNote, notesForMatch, relativeLabel, rowFor, rowsFor, stateMessage, stripCards, timeRome, updatedLine } from "./view";
import { newsCopy } from "./copy";

const NOW = Date.parse("2026-10-26T12:47:00Z"); // 13:47 in Rome (CET from 25/10)
const MIN = 60_000;
const H = 60 * MIN;

const row = (p: Partial<NewsItemRow> & { guid_hash: string; published_at: string }): NewsItemRow => ({
  source: "FotMob",
  source_url: `https://www.fotmob.com/news/${p.guid_hash}`,
  rewritten_en: { title: `EN ${p.guid_hash}`, body: "Body en." },
  rewritten_it: { title: `IT ${p.guid_hash}`, body: "Corpo it." },
  teams: [],
  rewrite_model: "claude-haiku-5-5 · prompt v5",
  rewritten_at: "2026-10-26T12:43:12.701Z",
  ...p,
});

const ROWS: NewsItemRow[] = [
  row({ guid_hash: "madrid", published_at: "2026-10-26T12:09:49.000Z", teams: ["Real Madrid", "Barcelona"], rewritten_en: { title: "Real Madrid beat Barcelona 2-1, Mourinho not satisfied", body: "Real Madrid beat Barcelona 2-1 on Sunday." }, rewritten_it: { title: "Il Real Madrid batte il Barcellona 2-1", body: "Il Real Madrid ha battuto il Barcellona 2-1 domenica." } }),
  row({ guid_hash: "mufc", published_at: "2026-10-26T11:43:30.000Z", teams: ["Manchester United", "Bournemouth"] }),
  row({ guid_hash: "lafc", published_at: "2026-10-26T10:14:25.000Z", teams: ["Los Angeles FC", "LA Galaxy"] }),
  row({ guid_hash: "b04", published_at: "2026-10-26T09:38:22.000Z", teams: ["Bayer Leverkusen", "Hoffenheim"] }),
  row({ guid_hash: "totw", published_at: "2026-10-26T09:31:24.000Z", teams: ["Manchester City"] }),
];
const STATE: NewsStateRow = { enabled: true, last_run_at: new Date(NOW - 4 * MIN).toISOString(), last_error: null, source_status: "ok" };

describe("table · the state the page derives", () => {
  it("ok: the notes newest first, «Updated at» = the last watcher run", () => {
    const f = feedFromTable(STATE, [...ROWS].reverse(), NOW);
    expect(f.state).toBe("ok");
    if (f.state !== "ok") return;
    expect(f.cards.map((c) => c.guid)).toEqual(["madrid", "mufc", "lafc", "b04", "totw"]);
    expect(f.updatedAt).toBe(NOW - 4 * MIN);
    expect(f.cards[0].note).toMatchObject({ kind: "ai", en: { title: /Mourinho/ }, it: { title: /Barcellona/ } });
    expect(f.cards[0].teams).toEqual(["Real Madrid", "Barcelona"]);
  });
  it("empty: the watcher runs, nothing rewritten yet", () => {
    expect(feedFromTable(STATE, [], NOW)).toEqual({ state: "empty", updatedAt: NOW - 4 * MIN });
  });
  it("paused: switched off, blocked, no run for 2 h, or no state row at all", () => {
    expect(feedFromTable({ ...STATE, enabled: false }, ROWS, NOW)).toEqual({ state: "paused", since: NOW - 4 * MIN });
    expect(feedFromTable({ ...STATE, source_status: "blocked" }, ROWS, NOW).state).toBe("paused");
    expect(feedFromTable({ ...STATE, last_run_at: new Date(NOW - STALE_MS - MIN).toISOString() }, ROWS, NOW).state).toBe("paused");
    expect(feedFromTable({ ...STATE, last_run_at: new Date(NOW - STALE_MS + MIN).toISOString() }, ROWS, NOW).state).toBe("ok");
    expect(feedFromTable(null, ROWS, NOW)).toEqual({ state: "paused", since: null });
  });
  it("a rejected or malformed row is dropped, never patched; JSON text is read", () => {
    expect(cardFromRow(row({ guid_hash: "r", published_at: "2026-10-26T10:00:00Z", rewrite_model: "rejected · copy · haiku" }))).toBeNull();
    expect(cardFromRow(row({ guid_hash: "u", published_at: "2026-10-26T10:00:00Z", source_url: "javascript:alert(1)" }))).toBeNull();
    expect(cardFromRow(row({ guid_hash: "d", published_at: "yesterday" }))).toBeNull();
    expect(cardFromRow(row({ guid_hash: "e", published_at: "2026-10-26T10:00:00Z", rewritten_it: { title: "", body: "x" } }))).toBeNull();
    const s = cardFromRow(row({ guid_hash: "s", published_at: "2026-10-26T10:00:00Z", rewritten_en: JSON.stringify({ title: "T", body: "B" }) }));
    expect(s?.note.en).toEqual({ title: "T", body: "B" });
  });
  it(`shows at most ${MAX_ITEMS} notes; the two reads are SELECTs on the two tables only`, () => {
    const many = Array.from({ length: 30 }, (_, i) => row({ guid_hash: `g${i}`, published_at: new Date(NOW - i * MIN).toISOString() }));
    const f = feedFromTable(STATE, many, NOW);
    expect(f.state === "ok" && f.cards.length).toBe(MAX_ITEMS);
    expect(STATE_SQL).toMatch(/^SELECT .* FROM news_state WHERE id = 1$/);
    expect(ITEMS_SQL).toMatch(/^SELECT .* FROM news_items WHERE .* ORDER BY published_at DESC LIMIT 20$/);
    expect(ITEMS_SQL).toContain("rewrite_model NOT LIKE 'rejected · %'");
  });
});

describe("read.server · the switch and a failed read", () => {
  it("NEWS_FOTMOB_ENABLED is on only with an explicit yes", () => {
    for (const v of ["1", "true", "YES", " on "]) expect(newsEnabled({ NEWS_FOTMOB_ENABLED: v })).toBe(true);
    for (const v of ["0", "false", "", "maybe", undefined]) expect(newsEnabled({ NEWS_FOTMOB_ENABLED: v })).toBe(false);
  });
  it("a read error is the «error» state, never an exception; the items are not read when the switch is off", async () => {
    const boom = async () => { throw new Error("relation news_state does not exist"); };
    expect(await readNews(NOW, boom as never)).toEqual({ state: "error" });
    const asked: string[] = [];
    const off = (async (sql: string) => { asked.push(sql); return sql === STATE_SQL ? [{ ...STATE, enabled: false }] : ROWS; }) as never;
    expect((await readNews(NOW, off)).state).toBe("paused");
    expect(asked).toEqual([STATE_SQL]);
    const on = (async (sql: string) => (sql === STATE_SQL ? [STATE] : ROWS)) as never;
    expect((await readNews(NOW, on)).state).toBe("ok");
  });
});

describe("view · note → row", () => {
  const feed = feedFromTable(STATE, ROWS, NOW);
  const cards = feed.state === "ok" ? feed.cards : [];
  it("Rome time, whatever the visitor's clock: 12:09Z → 13:09 (CET on 26/10/2026)", () => {
    expect(timeRome(cards[0].t)).toBe("13:09");
    expect(timeRome(Date.parse("2026-10-24T12:09:00Z"))).toBe("14:09"); // still CEST the day before the change
  });
  it("«x minutes ago» only once «now» is known; the day for a note not of today", () => {
    const r = rowFor(cards[0], "en", NOW);
    expect(r).toMatchObject({ key: "madrid", time: "13:09", ago: "37 minutes ago", iso: "2026-10-26T12:09:49.000Z", source: "FotMob", textLang: "en", english: false, kind: "risultato" });
    expect(r.image).toEqual({ src: "/news/news-01-risultato.webp", width: 1200, height: 675 });
    expect(rowFor(cards[1], "en", NOW)).toMatchObject({ kind: "generica", image: { src: "/news/news-07-generica.webp" } }); // «EN mufc» / «Body en.»: no words of any kind
    // a list: the generic rows after Madrid alternate 07 / 01 so no two neighbours share a picture («EN totw» reads as an award)
    expect(rowsFor(cards, "en", NOW).map((r) => r.kind)).toEqual(["risultato", "generica", "risultato", "generica", "premi"]);
    expect(rowFor(cards[0], "en", null).ago).toBe("");
    expect(relativeLabel(NOW - 3 * H, NOW, "en")).toBe("3 hours ago");
    expect(relativeLabel(NOW - 26 * H, NOW, "it")).toBe("ieri");
    const old = cardFromRow(row({ guid_hash: "old", published_at: "2026-10-23T09:00:00Z" }))!;
    expect(rowFor(old, "en", NOW).ago).toBe("3 days ago");
  });
  it("IT reads the Italian text; the other nine read English, tagged", () => {
    expect(rowFor(cards[0], "it", NOW)).toMatchObject({ title: "Il Real Madrid batte il Barcellona 2-1", textLang: "it", english: false, ago: "37 minuti fa" });
    expect(rowFor(cards[0], "de", NOW)).toMatchObject({ title: /Mourinho/, textLang: "en", english: true });
    expect(rowFor(cards[0], "xx", NOW).textLang).toBe("en");
  });
  it("header line and state message for every state", () => {
    const c = newsCopy("en");
    expect(updatedLine(feed, "en", c)).toBe("Updated at 13:43");
    expect(updatedLine({ state: "empty", updatedAt: NOW - 4 * MIN }, "it")).toBe("Aggiornato alle 13:43");
    expect(updatedLine({ state: "paused", since: NOW - 3 * H }, "en", c)).toBe("News paused · Last update at 10:47");
    expect(updatedLine({ state: "paused", since: null }, "en", c)).toBe("News paused");
    expect(updatedLine({ state: "error" }, "en", c)).toBe("");
    expect(stateMessage(feed, c)).toBeNull();
    expect(stateMessage({ state: "empty", updatedAt: NOW }, c)).toBe(c.pending);
    expect(stateMessage({ state: "paused", since: null }, c)).toBe(c.paused);
    expect(stateMessage({ state: "error" }, c)).toBe(c.error);
    expect(stateMessage({ state: "off" }, c)).toBeNull();
  });
  it("the strip shows three at most, newest first, and nothing in any other state", () => {
    expect(stripCards(feed).map((c) => c.guid)).toEqual(["madrid", "mufc", "lafc"]);
    expect(stripCards({ state: "empty", updatedAt: NOW })).toEqual([]);
    expect(stripCards({ state: "paused", since: null })).toEqual([]);
  });
});

describe("view · links to the board, by team name only", () => {
  const board = [
    { id: "558548", home: "AC Milan", away: "FC Internazionale Milano" },
    { id: "1", home: "Inter Miami CF", away: "FC Cincinnati" },
    { id: "2", home: "Manchester United", away: "Tottenham Hotspur" },
    { id: "3", home: "RCD Espanyol de Barcelona", away: "Girona" },
  ];
  const feed = feedFromTable(STATE, ROWS, NOW);
  const cards = feed.state === "ok" ? feed.cards : [];
  it("a note on Manchester United links the United match; «Barcelona» never links Espanyol de Barcelona; LAFC links nothing", () => {
    expect(matchesForNote(cards[1], board).map((m) => m.id)).toEqual(["2"]);
    expect(matchesForNote(cards[0], board)).toEqual([]);
    expect(matchesForNote(cards[2], board)).toEqual([]);
    expect(matchesForNote(cards[0], [])).toEqual([]);
  });
  it("«Internazionale Milano» and «AC Milan» find the derby, before a match naming one team only; «Inter Miami» is not «Inter»", () => {
    const derby = cardFromRow(row({ guid_hash: "derby", published_at: "2026-10-26T12:20:00Z", teams: ["AC Milan", "Internazionale Milano"] }))!;
    expect(matchesForNote(derby, board).map((m) => m.id)).toEqual(["558548"]);
    const week = [{ id: "a", home: "AC Milan", away: "Bologna FC 1909" }, { id: "b", home: "Venezia FC", away: "FC Internazionale Milano" }, ...board];
    expect(matchesForNote(derby, week).map((m) => m.id)).toEqual(["558548", "a"]);
    expect(matchTeams("Messi scores for Inter Miami", ["FC Internazionale Milano", "Inter Miami CF"])).toEqual(new Set(["Inter Miami CF"]));
  });
  it("the match sheet: the notes naming either team, newest first", () => {
    const derby = cardFromRow(row({ guid_hash: "derby", published_at: "2026-10-26T12:20:00Z", teams: ["AC Milan", "Internazionale Milano"] }))!;
    const older = cardFromRow(row({ guid_hash: "milan-old", published_at: "2026-10-25T12:20:00Z", teams: ["Milan"] }))!;
    expect(notesForMatch([older, ...cards, derby], "AC Milan", "FC Internazionale Milano").map((c) => c.guid)).toEqual(["derby", "milan-old"]);
    expect(notesForMatch(cards, "Juventus FC", "SSC Napoli")).toEqual([]);
  });
});

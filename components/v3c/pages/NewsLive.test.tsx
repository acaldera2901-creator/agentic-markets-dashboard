// components/v3c/pages/NewsLive.test.tsx (#REDESIGN-V3C news) — the live notes
// as the visitor sees them: label, source, link out, no image, empty/paused/error
// states (newswatch: read from news_items) (news2: never an original headline), «Most moved» says «News at», never a cause.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MostMoved, NewsLiveList, noteText } from "./NewsLive";
import { V3cNewsIndex } from "./News";
import type { NewsCard, NewsPage } from "@/lib/v3c/news/news.server";

const t = Date.parse("2026-10-07T08:57:00Z");
const ai: NewsCard = { guid: "g1", url: "https://www.fotmob.com/topnews/1-a", source: "FotMob", t, note: { kind: "ai", en: { title: "Lautaro available for Inter", body: "Inter said he trained fully." }, it: { title: "Lautaro disponibile", body: "Allenamento completo." }, model: "m" }, teams: ["Inter"] };
const ai2: NewsCard = { guid: "g2", url: "https://www.fotmob.com/embed/news/2-b", source: "SI via FotMob", t: t - 3_600_000, note: { kind: "ai", en: { title: "Arsenal lose a player to injury", body: "It happened late in the international break." }, it: { title: "Arsenal, un infortunio", body: "Durante la sosta." }, model: "m" }, teams: ["Arsenal"] };
const ok = (links: NewsPage["links"] = {}): NewsPage => ({ feed: { state: "ok", updatedAt: t, cards: [ai, ai2] }, links, movers: [] });

describe("NewsLiveList", () => {
  it("each note: source, AI label, link to the original (nofollow, new tab), no image", () => {
    const { container } = render(<NewsLiveList live={ok({ g1: [{ id: "oddsapi:x", home: "Inter", away: "Torino", league: "Serie A" }] })} />);
    expect(screen.getByText("Lautaro available for Inter")).toBeTruthy();
    expect(screen.getByText("Rewritten with AI from FotMob")).toBeTruthy();
    expect(screen.getByText("Rewritten with AI from SI via FotMob")).toBeTruthy();
    expect(container.textContent).not.toMatch(/not rewritten/i);
    const out = [...container.querySelectorAll("a[target=_blank]")];
    expect(out.map((a) => a.getAttribute("href"))).toEqual([ai.url, ai2.url]);
    for (const a of out) expect(a.getAttribute("rel")).toBe("nofollow noopener noreferrer");
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('a[href="/match/oddsapi%3Ax"]')).toBeTruthy();
    expect(screen.getByText(/info@betredge.com/)).toBeTruthy();
    expect(screen.getByRole("group", { name: "Filter the news" })).toBeTruthy();
  });
  it("watcher alive but nothing written yet → «news is on its way», no list, no takedown line", () => {
    const { container } = render(<NewsLiveList live={{ feed: { state: "empty", updatedAt: t }, links: {}, movers: null }} />);
    expect(screen.getByRole("status").textContent).toMatch(/on its way/);
    expect(container.querySelector("ol")).toBeNull();
    expect(container.textContent).not.toMatch(/FotMob|info@/);
  });
  it("switched off, blocked or watcher silent → «paused», no list, nothing from FotMob", () => {
    const { container } = render(<NewsLiveList live={{ feed: { state: "paused", since: t }, links: {}, movers: null }} />);
    expect(screen.getByRole("status").textContent).toMatch(/paused/);
    expect(container.querySelector("ol")).toBeNull();
    expect(container.textContent).not.toMatch(/FotMob|info@/);
  });
  it("Italian reads the Italian rewrite", () => {
    // lang comes from the provider default (EN) in this harness; noteText is the contract
    expect(noteText(ai, "it")).toEqual({ title: "Lautaro disponibile", body: "Allenamento completo.", english: false });
    expect(noteText(ai, "de").english).toBe(true);
  });
  it("table unreadable → the error state, no list", () => {
    const { container } = render(<NewsLiveList live={{ feed: { state: "error" }, links: {}, movers: null }} />);
    expect(screen.getByRole("status").textContent).toMatch(/unavailable right now/);
    expect(container.querySelector("ol")).toBeNull();
  });
});

describe("MostMoved", () => {
  it("«News at hh:mm» next to the move, never «because»", () => {
    const { container } = render(<MostMoved cards={[ai]} movers={[{ id: "a", home: "Inter", away: "Torino", league: "Serie A", kickoff: "2026-10-08T18:00:00Z", outcome: "home", from: 1.6, to: 1.67, stepAt: t, news: { guid: "g1", t } }, { id: "b", home: "X", away: "Y", league: null, kickoff: "2026-10-08T18:00:00Z", outcome: "draw", from: 3, to: 3.2, stepAt: t, news: null }]} />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/News at \d\d:57/); // local time zone of the test machine
    expect(text).toContain("1.60 → 1.67");
    expect(text).toContain("No news near this move");
    expect(text).not.toMatch(/because|caused|due to/i);
  });
});

describe("News page · the three states from the watcher's table", () => {
  const posts = [{ slug: "how-odds-work", title: "How odds work", description: "Implied probability in one page.", date: "2026-10-01T08:00:00Z" }];
  it("normal: «Updated at hh:mm» from the watcher, the notes, then our guides", () => {
    const { container } = render(<V3cNewsIndex posts={posts} live={ok()} />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/Updated at \d\d:57/);
    expect(text).toContain("2 notes");
    expect(text).toContain("Lautaro available for Inter");
    expect(container.querySelector('a[href="/blog/how-odds-work"]')).toBeTruthy();
  });
  it("paused: «News paused · Last update at hh:mm», no note, the guides stay", () => {
    const { container } = render(<V3cNewsIndex posts={posts} live={{ feed: { state: "paused", since: t }, links: {}, movers: null }} />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/News paused/);
    expect(text).toMatch(/Last update at \d\d:57/);
    expect(text).not.toContain("Lautaro");
    expect(container.querySelector('a[href="/blog/how-odds-work"]')).toBeTruthy();
  });
  it("empty: the watcher runs, nothing written yet → «on its way» and the guides", () => {
    const { container } = render(<V3cNewsIndex posts={posts} live={{ feed: { state: "empty", updatedAt: t }, links: {}, movers: null }} />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/on its way/);
    expect(text).toMatch(/Updated at \d\d:57/);
    expect(text).not.toContain("0 notes");
    expect(container.querySelector('a[href="/blog/how-odds-work"]')).toBeTruthy();
    expect(container.querySelector("a[target=_blank]")).toBeNull();
  });
});

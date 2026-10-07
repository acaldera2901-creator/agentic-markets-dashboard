// components/v3c/pages/NewsLive.test.tsx (#REDESIGN-V3C news) — the live notes
// as the visitor sees them: label, source, link out, no image, error state,
// «Most moved» says «News at», never a cause.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MostMoved, NewsLiveList } from "./NewsLive";
import type { NewsCard, NewsPage } from "@/lib/v3c/news/news.server";

const t = Date.parse("2026-10-07T08:57:00Z");
const ai: NewsCard = { guid: "g1", url: "https://www.fotmob.com/topnews/1-a", source: "FotMob", t, note: { kind: "ai", en: { title: "Lautaro available for Inter", body: "Inter said he trained fully." }, it: { title: "Lautaro disponibile", body: "Allenamento completo." }, model: "m" } };
const head: NewsCard = { guid: "g2", url: "https://www.fotmob.com/topnews/2-b", source: "FotMob", t: t - 3_600_000, note: { kind: "headline", title: "Original FotMob headline", reason: "no-key" } };
const ok = (links: NewsPage["links"] = {}): NewsPage => ({ feed: { state: "ok", fetchedAt: t, cards: [ai, head] }, links, movers: [] });

describe("NewsLiveList", () => {
  it("each note: source, AI label or «not rewritten», link to the original (nofollow, new tab), no image", () => {
    const { container } = render(<NewsLiveList live={ok({ g1: [{ id: "oddsapi:x", home: "Inter", away: "Torino", league: "Serie A" }] })} />);
    expect(screen.getByText("Lautaro available for Inter")).toBeTruthy();
    expect(screen.getByText("Rewritten with AI from FotMob")).toBeTruthy();
    expect(screen.getByText("Headline from FotMob, not rewritten")).toBeTruthy();
    const out = [...container.querySelectorAll("a[target=_blank]")];
    expect(out.map((a) => a.getAttribute("href"))).toEqual([ai.url, head.url]);
    for (const a of out) expect(a.getAttribute("rel")).toBe("nofollow noopener noreferrer");
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('a[href="/match/oddsapi%3Ax"]')).toBeTruthy();
    expect(screen.getByText(/info@betredge.com/)).toBeTruthy();
    expect(screen.getByRole("group", { name: "Filter the news" })).toBeTruthy();
  });
  it("feed down → the error state, no list", () => {
    const { container } = render(<NewsLiveList live={{ feed: { state: "error", checkedAt: t }, links: {}, movers: null }} />);
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

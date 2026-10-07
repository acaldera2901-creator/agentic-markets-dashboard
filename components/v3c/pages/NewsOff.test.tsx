// components/v3c/pages/NewsOff.test.tsx (#REDESIGN-V3C final2) — News with
// NEWS_FOTMOB_ENABLED unset (production): our guides only, nothing from FotMob,
// no original headline, no «notes are coming» promise; the server sends nothing out.
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { V3cNewsIndex } from "./News";
import { newsEnabled, newsPage } from "@/lib/v3c/news/news.server";

const posts = [{ slug: "how-odds-work", title: "How odds work", description: "Implied probability in one page.", date: "2026-10-01T08:00:00Z" }];

describe("News · feed off", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("variable absent → off; the server fetches nothing and returns no card", async () => {
    vi.stubEnv("NEWS_FOTMOB_ENABLED", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(newsEnabled({})).toBe(false);
    const p = await newsPage();
    expect(p).toEqual({ feed: { state: "off" }, links: {}, movers: null });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("the page: the guides, the tools aside, nothing else", () => {
    const { container } = render(<V3cNewsIndex posts={posts} live={null} />);
    const text = container.textContent ?? "";
    expect(container.querySelector('a[href="/blog/how-odds-work"]')).toBeTruthy();
    expect(text).not.toMatch(/FotMob|not rewritten|Rewritten with AI|match notes|Not live yet/i);
    expect(container.querySelector("a[target=_blank]")).toBeNull();
  });

  it("an «off» feed passed by mistake renders the same clean page", () => {
    const { container } = render(<V3cNewsIndex posts={posts} live={{ feed: { state: "off" }, links: {}, movers: null }} />);
    expect(container.textContent ?? "").not.toMatch(/FotMob|Match notes/i);
  });
});

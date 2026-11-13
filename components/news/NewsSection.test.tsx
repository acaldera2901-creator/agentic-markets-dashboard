// #SEO-AEO-1106: /blog must stay cacheable (ISR). connection() in NewsSection made the whole page dynamic (private/no-store, MISS, TTFB 0.7–1.5 s).
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const connection = vi.fn(async () => {});
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), connection }));
const getNews = vi.fn(async () => ({ state: "off" as const }));
vi.mock("@/lib/news/read.server", () => ({ getNews, newsEnabled: () => true }));
vi.mock("@/lib/news/per-note.server", () => ({ noteImage: () => null }));

const { NewsSection } = await import("./NewsSection");

describe("NewsSection keeps /blog static (ISR)", () => {
  it("does not call connection() (no dynamic opt-in), still reads the feed", async () => {
    await NewsSection();
    expect(connection).not.toHaveBeenCalled();
    expect(getNews).toHaveBeenCalledTimes(1);
  });
  it("the blog index revalidates every 60 s, and nothing in it forces dynamic rendering", () => {
    const src = readFileSync(join(__dirname, "../../app/blog/page.tsx"), "utf8");
    expect(src).toMatch(/export const revalidate = 60;/);
    expect(src).not.toMatch(/force-dynamic|connection\(|cookies\(|headers\(/);
  });
});

// #REDESIGN-V3C news2 · /v3c/blog with the live news ON is rendered at REQUEST time:
// the rewrite credential (Vercel OIDC, injected only into Functions) is read at
// runtime, and no request leaves for FotMob while `next build` prerenders.
// Bug (07/10, preview betredge-6dntrp4kx): the page was ISR-prerendered at build, the
// rewrites failed there (no usable OIDC at build) and «News is on its way» was baked in.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const order: string[] = [];

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn(async () => void order.push("connection")) }));
vi.mock("@/components/v3c/pages/Frame", () => ({
  V3cFrame: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/blog", () => ({ listPublishedPosts: async () => [] }));
vi.mock("@/lib/v3c/board-data.server", () => ({ v3cProductOn: () => true }));
vi.mock("@/lib/v3c/news/news.server", () => ({
  newsEnabled: () => process.env.NEWS_FOTMOB_ENABLED === "1",
  newsPage: vi.fn(async () => {
    order.push("newsPage");
    return { feed: { state: "pending" }, links: {}, movers: null };
  }),
}));

import { connection } from "next/server";
import Page from "./page";

beforeEach(() => {
  order.length = 0;
  vi.mocked(connection).mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe("/v3c/blog — when the live news is decided", () => {
  it("news ON: waits for a request (connection) BEFORE reading the news", async () => {
    vi.stubEnv("NEWS_FOTMOB_ENABLED", "1");
    await Page();
    expect(order).toEqual(["connection", "newsPage"]);
  });

  it("news OFF: no connection(), the page stays static/ISR as on main", async () => {
    vi.stubEnv("NEWS_FOTMOB_ENABLED", "");
    await Page();
    expect(connection).not.toHaveBeenCalled();
    expect(order).toEqual([]);
  });
});

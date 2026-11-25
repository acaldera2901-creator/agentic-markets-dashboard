import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { WireFeed } from "@/lib/news/view";
import { NewsList } from "./NewsList";

const { recover } = vi.hoisted(() => ({
  recover: vi.fn<(_enabled: boolean) => WireFeed | null>(),
}));
vi.mock("./use-news", () => ({
  useNewsFeed: recover,
  useSiteLang: () => "en",
  useNow: () => null,
  useBoardMatches: () => [],
}));
vi.mock("./NewsProfileEntry", () => ({ NewsProfileEntry: () => null }));

it("recovers a build snapshot and exposes a status when the source fails", () => {
  recover.mockReturnValue(null);
  const { rerender } = render(<NewsList initialFeed={null} />);
  expect(screen.getByRole("status").textContent).toMatch(/Loading the latest news/);
  expect(recover).toHaveBeenLastCalledWith(true);

  recover.mockReturnValue({ state: "error" });
  rerender(<NewsList initialFeed={null} />);
  expect(screen.getByRole("status").textContent).toMatch(/feed is unavailable/);
});

it("uses a server-rendered feed state without requesting the endpoint again", () => {
  recover.mockReturnValue(null);
  render(<NewsList initialFeed={{ state: "paused", since: null }} />);
  expect(document.querySelector("#news")?.getAttribute("data-state")).toBe("paused");
  expect(recover).toHaveBeenLastCalledWith(false);
});

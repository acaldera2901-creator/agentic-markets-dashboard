// #CLS-NEWS-RESERVE — spazio riservato alla striscia news mentre il feed carica (solo production).
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

async function load(env: string | undefined, feed: unknown) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", env as string);
  vi.doMock("@/components/news/use-news", () => ({
    useNewsFeed: () => feed,
    useNow: () => Date.now(),
    boardHref: () => "#",
  }));
  return (await import("./ClassicNewsStrip")).ClassicNewsStrip;
}

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe("ClassicNewsStrip reserve", () => {
  it("production + feed non ancora arrivato → segnaposto", async () => {
    const C = await load("production", null);
    const { container } = render(<C lang="en" football={[]} />);
    expect(container.querySelector(".brc-news-reserve")).not.toBeNull();
  });
  it("non production → niente segnaposto", async () => {
    const C = await load("preview", null);
    const { container } = render(<C lang="en" football={[]} />);
    expect(container.firstChild).toBeNull();
  });
  it("feed arrivato ma vuoto/non ok → collassa (niente segnaposto)", async () => {
    const C = await load("production", { state: "off", cards: [], updatedAt: 0 });
    const { container } = render(<C lang="en" football={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

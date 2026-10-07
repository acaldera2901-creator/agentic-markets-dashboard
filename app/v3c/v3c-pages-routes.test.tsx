// #REDESIGN-V3C pages · come si accendono News/Books/Pro/Metodo/community/legali.
import { afterEach, describe, expect, it, vi } from "vitest";
import { V3C_PAGE_PATHS } from "@/lib/v3c/pages-routes";
import { v3cRewrites } from "@/lib/v3c/rewrites";

vi.mock("server-only", () => ({}));
// next/font non gira in vitest: la cornice è un passacarte
vi.mock("@/components/v3c/pages/Frame", () => ({
  V3cFrame: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("../app/page", () => ({
  default: function Dashboard() {
    return null;
  },
}));

afterEach(() => vi.unstubAllEnvs());

describe("rewrite delle pagine", () => {
  it("spento: nessuna rewrite", () => {
    for (const f of [undefined, "", "0", "false"]) expect(v3cRewrites(f)).toEqual([]);
  });
  it("acceso: ogni URL di oggi → /v3c<URL>, in beforeFiles, in una sola lista senza doppioni", () => {
    const m = v3cRewrites("1");
    expect(Array.isArray(m)).toBe(false);
    const bf = (m as { beforeFiles: { source: string; destination: string }[] })
      .beforeFiles;
    expect(bf.slice(0, 2).map((r) => r.source)).toEqual(["/", "/predictions"]);
    for (const p of V3C_PAGE_PATHS) expect(bf).toContainEqual({ source: p, destination: `/v3c${p}` });
    expect(new Set(bf.map((r) => r.source)).size).toBe(bf.length);
    expect(bf.find((r) => r.source === "/blog/:slug")?.destination).toBe(
      "/v3c/blog/:slug",
    );
  });
});

// una rewrite serve i metadata della destinazione: devono essere quelli di oggi
describe("le destinazioni hanno i metadata delle pagine di oggi", () => {
  it.each([
    ["blog", () => import("../blog/page"), () => import("./blog/page")],
    [
      "how-it-works",
      () => import("../how-it-works/page"),
      () => import("./how-it-works/page"),
    ],
    [
      "leaderboard",
      () => import("../leaderboard/page"),
      () => import("./leaderboard/page"),
    ],
    ["invite", () => import("../invite/page"), () => import("./invite/page")],
    [
      "privacy",
      () => import("../privacy/page"),
      () => import("./privacy/page"),
    ],
    ["terms", () => import("../terms/page"), () => import("./terms/page")],
    [
      "partners (layout)",
      () => import("../partners/layout"),
      () => import("./partners/page"),
    ],
    [
      "community (layout)",
      () => import("../community/layout"),
      () => import("./community/page"),
    ],
  ])("%s", async (n, today, v3c) => {
    const [a, b] = await Promise.all([today(), v3c()]);
    // fixui2 N5: leaderboard, invite and community add only noindex/nofollow (legal hold); the rest is today's
    const held = /^(leaderboard|invite|community)/.test(n);
    expect((b as { metadata: unknown }).metadata).toEqual(
      held
        ? { ...(a as { metadata: object }).metadata, robots: { index: false, follow: false } }
        : (a as { metadata: unknown }).metadata,
    );
  });

  it("blog/[slug]: generateMetadata è la stessa funzione, riga per riga", async () => {
    const [a, b] = await Promise.all([
      import("../blog/[slug]/page"),
      import("./blog/[slug]/page"),
    ]);
    const src = (f: unknown) =>
      String(f).replace(/__vite_ssr_import_\d+__/g, "m").replace(/\s+/g, "").replace(/,([)}\]])/g, "$1");
    expect(src(b.generateMetadata)).toBe(src(a.generateMetadata));
  });
});

describe("/v3c/* a flag spento è un 404", () => {
  it.each([
    ["how-it-works", () => import("./how-it-works/page")],
    ["leaderboard", () => import("./leaderboard/page")],
    ["invite", () => import("./invite/page")],
    ["community", () => import("./community/page")],
    ["partners", () => import("./partners/page")],
    ["pricing", () => import("./pricing/page")],
  ])("%s", async (_n, load) => {
    vi.stubEnv("NEXT_PUBLIC_REDESIGN", "");
    const Page = (await load()).default as () => unknown;
    await expect(Promise.resolve().then(() => Page())).rejects.toThrow(
      "NEXT_HTTP_ERROR_FALLBACK;404",
    );
  });
});

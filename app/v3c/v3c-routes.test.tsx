// #REDESIGN-V3C F3 · come si accende il redesign su "/" e "/predictions".
// Flag spento: nessuna rewrite, /v3c risponde 404, le pagine di oggi non sono
// toccate (app/page.tsx e app/predictions/page.tsx sono fuori dal diff).
// Flag acceso: rewrite beforeFiles verso /v3c, con metadata IDENTICI.
import type { Metadata } from "next";
import { EN_TITLES } from "@/lib/v3c/doc-titles";
import { afterEach, describe, expect, it, vi } from "vitest";
import { v3cRewrites } from "@/lib/v3c/rewrites";
import { V3C_PAGE_PATHS } from "@/lib/v3c/pages-routes";

vi.mock("../app/page", () => ({ default: function Dashboard() { return null; } }));
vi.mock("@/components/v3c/record/RecordPage", () => ({ RecordPage: function RecordPage() { return null; } }));
vi.mock("@/components/v3c/tools/Hub", () => ({ V3cToolsHub: function V3cToolsHub() { return null; } }));
vi.mock("@/components/v3c/tools/ToolPage", () => ({ V3cToolPage: function V3cToolPage() { return null; } }));
vi.mock("@/components/v3c/pages/V3cBoardPage", () => ({ V3cBoardPage: function V3cBoardPage() { return null; } }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

afterEach(() => vi.unstubAllEnvs());

const sp = Promise.resolve({});

describe("rewrite del redesign (next.config.ts)", () => {
  it("spento (assente, vuoto, 0, false): nessuna rewrite", () => {
    for (const v of [undefined, "", "0", "false", "off"]) expect(v3cRewrites(v)).toEqual([]);
  });
  it("acceso: / e /predictions servono /v3c, prima del filesystem", () => {
    expect(v3cRewrites("1")).toEqual({
      beforeFiles: [
        { source: "/", destination: "/v3c" },
        { source: "/predictions", destination: "/v3c/predictions" },
        { source: "/match/:id", destination: "/v3c/match/:id" },
        { source: "/match/:id/og.png", destination: "/v3c/match/:id/og.png" },
        { source: "/tools/:tool/og.png", destination: "/v3c/tools/:tool/og.png" },
        { source: "/:lang(it|es|fr|de|pt|nl|pl|tr|sv|ru)/tools/:tool/og.png", destination: "/v3c/:lang/tools/:tool/og.png" },
        { source: "/price-check", destination: "/v3c/price-check" },
        { source: "/record", destination: "/v3c/record" },
        { source: "/tools", destination: "/v3c/tools" },
        { source: "/tools/:tool", destination: "/v3c/tools/:tool" },
        { source: "/:lang(it|es|fr|de|pt|nl|pl|tr|sv|ru)/tools", destination: "/v3c/:lang/tools" },
        { source: "/:lang(it|es|fr|de|pt|nl|pl|tr|sv|ru)/tools/:tool", destination: "/v3c/:lang/tools/:tool" },
        ...V3C_PAGE_PATHS.map((p) => ({ source: p, destination: `/v3c${p}` })),
      ],
      // polish: le URL sconosciute → 404 illustrato v3c (status 404 vero)
      fallback: [{ source: "/:path((?!api/|_next/|brand/|images/|icons/).*)", destination: "/v3c/lost" }],
    });
  });
});

describe("le destinazioni: canonical di oggi, title e description del redesign (fixui B4/L5)", () => {
  // fixui: a flag acceso / e /predictions non si presentano più come «predictions» né come probabilità
  // «calibrated» (POSITIONING §2; vietato nel tennis). Canonical invariati; il sito di oggi non cambia.
  const BANNED = /predictions?|calibrat/i;
  it("home: canonical /, nessun claim vietato", async () => {
    const [today, v3c] = await Promise.all([import("../page"), import("./page")]);
    expect(v3c.metadata.alternates).toEqual(today.metadata.alternates);
    expect(String(v3c.metadata.title)).toBe(EN_TITLES.home);
    expect(`${v3c.metadata.title} ${v3c.metadata.description}`).not.toMatch(BANNED);
    expect(String(v3c.metadata.description)).toMatch(/^Price check for football and tennis odds/);
  });
  it("predictions: canonical /predictions, nessun claim vietato", async () => {
    const [today, v3c] = await Promise.all([import("../predictions/page"), import("./predictions/page")]);
    expect(v3c.metadata.alternates).toEqual(today.metadata.alternates);
    expect(String(v3c.metadata.title)).toBe(EN_TITLES.board);
    expect(`${v3c.metadata.title} ${v3c.metadata.description}`).not.toMatch(BANNED);
  });
});

describe("/v3c a flag spento è un 404, a flag acceso la board", () => {
  it.each([
    ["home", () => import("./page")],
    ["predictions", () => import("./predictions/page")],
  ])("%s", async (surface, load) => {
    const mod = await load();
    vi.stubEnv("NEXT_PUBLIC_REDESIGN", "");
    await expect(mod.default({ searchParams: sp })).rejects.toThrow("NEXT_NOT_FOUND");
    vi.stubEnv("NEXT_PUBLIC_REDESIGN", "1");
    const el = (await mod.default({ searchParams: sp })) as { props: { children: { props: { surface?: string } }[] } };
    expect(el.props.children[1].props.surface).toBe(surface);
  });
});

describe("/v3c/record (F6)", () => {
  it("a flag spento è un 404, a flag acceso il registro", async () => {
    const mod = await import("./record/page");
    vi.stubEnv("NEXT_PUBLIC_REDESIGN", "");
    await expect(mod.default({ searchParams: sp })).rejects.toThrow("NEXT_NOT_FOUND");
    vi.stubEnv("NEXT_PUBLIC_REDESIGN", "1");
    const el = (await mod.default({ searchParams: sp })) as { props: { children: { type: { name?: string } }[] } };
    expect(el.props.children[1].type.name).toBe("RecordPage");
  });
  it("canonical /record, title descrittivo (fixui M8)", async () => {
    const v3c = await import("./record/page");
    expect(v3c.metadata.alternates).toEqual({ canonical: "/record" });
    expect(v3c.metadata.title).toBe("Track record: every pick sealed before kick-off | BetRedge");
  });
});

describe("/v3c/tools* (F5, portati allo schema delle rewrite)", () => {
  const tool = { params: Promise.resolve({ tool: "ev-calculator" }) };
  const lang = { params: Promise.resolve({ lang: "it" }) };
  const langTool = { params: Promise.resolve({ lang: "it", tool: "kelly-criterion" }) };
  it.each([
    ["hub", () => import("./tools/page"), undefined, "V3cToolsHub"],
    ["tool", () => import("./tools/[tool]/page"), tool, "V3cToolPage"],
    ["hub it", () => import("./[lang]/tools/page"), lang, "V3cToolsHub"],
    ["tool it", () => import("./[lang]/tools/[tool]/page"), langTool, "V3cToolPage"],
  ] as const)("%s: spento 404, acceso la pagina v3c", async (_n, load, props, name) => {
    const mod = (await load()) as { default: (p?: unknown) => unknown };
    vi.stubEnv("NEXT_PUBLIC_REDESIGN", "");
    await expect(Promise.resolve().then(() => mod.default(props))).rejects.toThrow("NEXT_NOT_FOUND");
    vi.stubEnv("NEXT_PUBLIC_REDESIGN", "1");
    const el = (await mod.default(props)) as { type: { name?: string } };
    expect(el.type.name).toBe(name);
  });
  it("metadata identici alle pagine di oggi", async () => {
    const [a, b] = await Promise.all([import("../tools/page"), import("./tools/page")]);
    // fixui M8: l'hub v3c aggiunge og:image/twitter (prima non ne aveva); il resto identico a oggi
    const { openGraph: aOg, ...aRest } = a.metadata;
    const { openGraph: bOg, twitter: bTw, ...bRest } = b.metadata;
    expect(bRest).toEqual(aRest);
    expect(bOg).toMatchObject(aOg as Record<string, unknown>);
    expect((bOg as { images?: unknown[] }).images).toEqual([expect.objectContaining({ url: "/tools/probability-calculator/og.png" })]);
    expect(bTw).toMatchObject({ card: "summary_large_image" });
    // polish-2: identici salvo l'immagine — og:image/twitter:image puntano all'og.png PUBBLICO (mai /v3c/…)
    const sameButImage = async (today: Metadata, v3c: Metadata, ogPath: string) => {
      const { openGraph: tOg, ...tRest } = today;
      const { openGraph: vOg, twitter: vTw, ...vRest } = v3c;
      expect(vRest).toEqual({ ...tRest, twitter: undefined }); // today: nessun twitter proprio (eredita la root)
      const { images, ...vOgRest } = (vOg ?? {}) as Record<string, unknown>;
      expect(vOgRest).toMatchObject(tOg as Record<string, unknown>);
      expect(images).toEqual([expect.objectContaining({ url: ogPath, width: 1200, height: 630 })]);
      expect(vTw).toMatchObject({ card: "summary_large_image", images: [expect.objectContaining({ url: ogPath })] });
      expect(JSON.stringify(v3c)).not.toContain("/v3c");
    };
    const [c, d] = await Promise.all([import("../tools/[tool]/page"), import("./tools/[tool]/page")]);
    await sameButImage(await c.generateMetadata(tool), await d.generateMetadata(tool), "/tools/ev-calculator/og.png");
    const [e, f] = await Promise.all([import("../[lang]/tools/[tool]/page"), import("./[lang]/tools/[tool]/page")]);
    await sameButImage(await e.generateMetadata(langTool), await f.generateMetadata(langTool), "/it/tools/kelly-criterion/og.png");
    const [g, h] = await Promise.all([import("../[lang]/tools/page"), import("./[lang]/tools/page")]);
    const { openGraph: gOg, ...gRest } = await g.generateMetadata(lang);
    const { openGraph: hOg, twitter: _hTw, ...hRest } = await h.generateMetadata(lang);
    void _hTw;
    expect(hRest).toEqual(gRest);
    expect(hOg).toMatchObject(gOg as Record<string, unknown>);
    expect((hOg as { images?: unknown[] }).images).toEqual([expect.objectContaining({ url: "/it/tools/probability-calculator/og.png" })]);
  });
  it("le pagine tool di oggi non importano nulla del redesign", async () => {
    const fs = await import("node:fs");
    for (const f of ["app/tools/page.tsx", "app/tools/[tool]/page.tsx", "app/[lang]/tools/page.tsx", "app/[lang]/tools/[tool]/page.tsx"]) {
      expect(fs.readFileSync(f, "utf8")).not.toMatch(/v3c|redesign/i);
    }
  });
});

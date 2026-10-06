// #REDESIGN-V3C F3 · come si accende il redesign su "/" e "/predictions".
// Flag spento: nessuna rewrite, /v3c risponde 404, le pagine di oggi non sono
// toccate (app/page.tsx e app/predictions/page.tsx sono fuori dal diff).
// Flag acceso: rewrite beforeFiles verso /v3c, con metadata IDENTICI.
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
        { source: "/price-check", destination: "/v3c/price-check" },
        { source: "/record", destination: "/v3c/record" },
        { source: "/tools", destination: "/v3c/tools" },
        { source: "/tools/:tool", destination: "/v3c/tools/:tool" },
        { source: "/:lang(it|es|fr|de|pt|nl|pl|tr|sv|ru)/tools", destination: "/v3c/:lang/tools" },
        { source: "/:lang(it|es|fr|de|pt|nl|pl|tr|sv|ru)/tools/:tool", destination: "/v3c/:lang/tools/:tool" },
        ...V3C_PAGE_PATHS.map((p) => ({ source: p, destination: `/v3c${p}` })),
      ],
    });
  });
});

describe("le destinazioni hanno i metadata delle pagine di oggi", () => {
  it("home: description e canonical identici", async () => {
    const [today, v3c] = await Promise.all([import("../page"), import("./page")]);
    expect(v3c.metadata).toEqual(today.metadata);
  });
  it("predictions: title, description e canonical identici", async () => {
    const [today, v3c] = await Promise.all([import("../predictions/page"), import("./predictions/page")]);
    expect(v3c.metadata).toEqual(today.metadata);
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
  it("canonical /record, lo stesso titolo del Track Record di oggi", async () => {
    const [today, v3c] = await Promise.all([import("../history/page"), import("./record/page")]);
    expect(v3c.metadata.alternates).toEqual({ canonical: "/record" });
    expect(v3c.metadata.title).toBe(today.metadata.title);
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
    expect(b.metadata).toEqual(a.metadata);
    const [c, d] = await Promise.all([import("../tools/[tool]/page"), import("./tools/[tool]/page")]);
    expect(await d.generateMetadata(tool)).toEqual(await c.generateMetadata(tool));
    const [e, f] = await Promise.all([import("../[lang]/tools/[tool]/page"), import("./[lang]/tools/[tool]/page")]);
    expect(await f.generateMetadata(langTool)).toEqual(await e.generateMetadata(langTool));
    const [g, h] = await Promise.all([import("../[lang]/tools/page"), import("./[lang]/tools/page")]);
    expect(await h.generateMetadata(lang)).toEqual(await g.generateMetadata(lang));
  });
  it("le pagine tool di oggi non importano nulla del redesign", async () => {
    const fs = await import("node:fs");
    for (const f of ["app/tools/page.tsx", "app/tools/[tool]/page.tsx", "app/[lang]/tools/page.tsx", "app/[lang]/tools/[tool]/page.tsx"]) {
      expect(fs.readFileSync(f, "utf8")).not.toMatch(/v3c|redesign/i);
    }
  });
});

// #REDESIGN-V3C F3 · come si accende il redesign su "/" e "/predictions".
// Flag spento: nessuna rewrite, /v3c risponde 404, le pagine di oggi non sono
// toccate (app/page.tsx e app/predictions/page.tsx sono fuori dal diff).
// Flag acceso: rewrite beforeFiles verso /v3c, con metadata IDENTICI.
import { afterEach, describe, expect, it, vi } from "vitest";
import { v3cRewrites } from "@/lib/v3c/rewrites";

vi.mock("../app/page", () => ({ default: function Dashboard() { return null; } }));
vi.mock("@/components/v3c/record/RecordPage", () => ({ RecordPage: function RecordPage() { return null; } }));
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

// #REDESIGN-V3C F4 · /match/[id] e /price-check esistono SOLO a flag acceso.
// Spento: nessuna rewrite (v3c-routes.test.tsx) e le destinazioni sono 404,
// senza toccare il DB. Acceso: la partita sconosciuta è un 404 vero.
import { afterEach, describe, expect, it, vi } from "vitest";

const fetchFixture = vi.fn();
vi.mock("@/lib/v3c/line-movement-service", () => ({ fetchFixture: (id: string) => fetchFixture(id) }));
vi.mock("@/components/v3c/match/MatchPage", () => ({ V3cMatchPage: function V3cMatchPage() { return null; } }));
vi.mock("@/components/v3c/match/PriceCheck", () => ({ PriceCheck: function PriceCheck() { return null; } }));
vi.mock("@/components/v3c/V3cChrome", () => ({ V3cChrome: function V3cChrome() { return null; } }));
vi.mock("@/components/v3c/fonts", () => ({ v3cFontClass: "" }));
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  fetchFixture.mockReset();
});

const sp = Promise.resolve({});

describe("/v3c/match/[id]", () => {
  it("flag spento: 404 senza leggere il DB", async () => {
    const mod = await import("./match/[id]/page");
    vi.stubEnv("NEXT_PUBLIC_REDESIGN", "");
    await expect(mod.default({ params: Promise.resolve({ id: "oddsapi:x" }), searchParams: sp })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(fetchFixture).not.toHaveBeenCalled();
    expect(await mod.generateMetadata({ params: Promise.resolve({ id: "oddsapi:x" }), searchParams: sp })).toEqual({});
  });
  it("flag acceso: partita sconosciuta = 404, nota = pagina con canonical /match/…", async () => {
    const mod = await import("./match/[id]/page");
    vi.stubEnv("NEXT_PUBLIC_REDESIGN", "1");
    fetchFixture.mockResolvedValueOnce(null);
    await expect(mod.default({ params: Promise.resolve({ id: "nope" }), searchParams: sp })).rejects.toThrow("NEXT_NOT_FOUND");
    fetchFixture.mockResolvedValue({ home: "Genoa", away: "Fiorentina", kickoff: "2026-10-10T13:00:00Z" });
    const el = (await mod.default({ params: Promise.resolve({ id: "oddsapi%3Aabc" }), searchParams: sp })) as { props: { id: string } };
    expect(el.props.id).toBe("oddsapi:abc");
    const meta = await mod.generateMetadata({ params: Promise.resolve({ id: "oddsapi:abc" }), searchParams: sp });
    expect(meta.alternates?.canonical).toBe("/match/oddsapi%3Aabc");
  });
});

describe("/v3c/price-check", () => {
  it("flag spento: 404; acceso: la pagina", async () => {
    const mod = await import("./price-check/page");
    vi.stubEnv("NEXT_PUBLIC_REDESIGN", "");
    await expect(mod.default({ searchParams: sp })).rejects.toThrow("NEXT_NOT_FOUND");
    vi.stubEnv("NEXT_PUBLIC_REDESIGN", "1");
    await expect(mod.default({ searchParams: sp })).resolves.toBeTruthy();
    expect(mod.metadata.alternates?.canonical).toBe("/price-check");
  });
});

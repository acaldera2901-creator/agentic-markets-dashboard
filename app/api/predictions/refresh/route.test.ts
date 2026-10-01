import { it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const ordine: string[] = [];
const syncTennisPredictionsToUnified = vi.fn(async () => { ordine.push("tennis"); return { synced: 3 }; });
const ingestPartnerTennis = vi.fn(async () => { ordine.push("ingest"); return {}; });
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- la firma serve a leggere mock.calls
const registraPrezziPartner = vi.fn(async (..._a: number[]) => { ordine.push("prezzi"); return {}; });
vi.mock("@/lib/tennis-adapter", () => ({ syncTennisPredictionsToUnified }));
vi.mock("@/lib/partner-fixtures", () => ({ ingestPartnerTennis }));
vi.mock("@/lib/partner-prezzi", () => ({ registraPrezziPartner }));
vi.mock("@/lib/publication-gate", () => ({ emptySyncReport: () => ({ synced: 0 }) }));
vi.mock("@/lib/admin-auth", () => ({
  verifyBearer: (r: Request, s?: string) => Boolean(s) && r.headers.get("authorization") === `Bearer ${s}`,
}));

function req() {
  return new Request("https://x/api/predictions/refresh", {
    headers: { authorization: "Bearer sekret" },
  }) as unknown as NextRequest;
}

beforeEach(() => {
  ordine.length = 0;
  vi.clearAllMocks();
  process.env.CRON_SECRET = "sekret";
  process.env.NEXT_PUBLIC_BASE_URL = "https://x";
  vi.stubGlobal("fetch", vi.fn(async () => { ordine.push("football"); return new Response("{}"); }));
});

it("#REFRESH-1001: il sync tennis gira PRIMA dei prezzi partner", async () => {
  const { GET } = await import("./route");
  await GET(req());
  expect(ordine).toEqual(["football", "ingest", "tennis", "prezzi"]);
});

it("i prezzi ricevono una scadenza entro il maxDuration della route", async () => {
  const { GET, maxDuration } = await import("./route");
  const prima = Date.now();
  await GET(req());
  const scadenza = registraPrezziPartner.mock.calls[0][1];
  expect(scadenza).toBeGreaterThan(prima);
  expect(scadenza).toBeLessThan(prima + maxDuration * 1000);
});

it("un errore dei prezzi non tocca il tennis gia' scritto", async () => {
  registraPrezziPartner.mockRejectedValueOnce(new Error("lento"));
  const { GET } = await import("./route");
  const body = await (await GET(req())).json();
  expect(body.tennis.synced).toBe(3);
  expect(body.prezzi).toEqual({ error: "Error: lento" });
});

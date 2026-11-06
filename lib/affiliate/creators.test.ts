// #CREATOR-OFFERS-1031 (B) — raggruppamento KPI (puro) e guardie delle rotte admin (nessun DB).
import { afterEach, describe, expect, it, vi } from "vitest";
import { groupCreatorKpis, type Row } from "./creators";

const isAdminAuthorized = vi.hoisted(() => vi.fn(async () => false));
const affiliateRpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin-auth", async (orig) => ({ ...(await orig<typeof import("@/lib/admin-auth")>()), isAdminAuthorized }));
vi.mock("@/lib/affiliate/rpc", () => ({ affiliateRpc }));
vi.mock("@/lib/db", () => ({ dbQueryStrict: vi.fn(), dbQuery: vi.fn(), dbExecute: vi.fn(), getSupabaseAdminClient: vi.fn() }));
afterEach(() => vi.clearAllMocks());

const base = { code: "C", identifier: "c@x.io", pro_grant_expires_at: null };
const row = (affiliate_id: number, cohort: Row["cohort"], month: string | null, n: number): Row => ({
  ...base, affiliate_id, cohort, month,
  ...(month ? { clicks: n, signups: n, activated: 0, paying: n, mrr_usd: n * 10.1, commission_usd: n * 2.02, shadow_rows: 0 } : {}),
});

describe("groupCreatorKpis", () => {
  it("raggruppa per creator, ordina i mesi, somma per coorte e mese; creator senza attività restano con months vuoto", () => {
    const out = groupCreatorKpis([
      row(1, "creator_human", "2026-11", 2),
      row(1, "creator_human", "2026-10", 1),
      row(2, "creator_human", "2026-11", 3),
      row(3, "creator_agent", "2026-11", 1),
      row(4, "creator_agent", null, 0),
    ]);
    expect(out.creators.map((c) => [c.affiliate_id, c.months.map((m) => m.month)])).toEqual([
      [1, ["2026-10", "2026-11"]], [2, ["2026-11"]], [3, ["2026-11"]], [4, []],
    ]);
    expect(out.cohorts.creator_human).toEqual([
      expect.objectContaining({ month: "2026-10", paying: 1, mrr_usd: 10.1 }),
      expect.objectContaining({ month: "2026-11", paying: 5, mrr_usd: 50.5, commission_usd: 10.1 }),
    ]);
    expect(out.cohorts.creator_agent).toEqual([expect.objectContaining({ month: "2026-11", paying: 1 })]);
  });
  it("valori numerici serializzati come stringa (numeric) diventano numeri", () => {
    const r = { ...row(1, "standard", "2026-11", 1), mrr_usd: "29.99" as unknown as number };
    expect(groupCreatorKpis([r]).creators[0].months[0].mrr_usd).toBe(29.99);
  });
});

describe("rotte admin creator: auth", () => {
  it("senza admin → 401 e nessuna scrittura", async () => {
    const grants = await import("@/app/api/admin/affiliate/creator-grants/route");
    const kpi = await import("@/app/api/admin/affiliate/creators/route");
    const cohort = await import("@/app/api/admin/affiliate/affiliates/[id]/cohort/route");
    const r = (m = "POST") => new Request("https://x/y", { method: m, body: m === "POST" ? "{}" : undefined }) as never;
    expect((await grants.POST(r())).status).toBe(401);
    expect((await kpi.GET(r("GET"))).status).toBe(401);
    expect((await cohort.POST(r(), { params: Promise.resolve({ id: "1" }) })).status).toBe(401);
    expect(affiliateRpc).not.toHaveBeenCalled();
  });
  it("grant via Bearer senza operatore dichiarato → 400; identifier mancante → 400", async () => {
    vi.stubEnv("ADMIN_SECRET", "s");
    isAdminAuthorized.mockResolvedValue(true);
    const { POST } = await import("@/app/api/admin/affiliate/creator-grants/route");
    const mk = (headers: Record<string, string>, body: unknown) =>
      new Request("https://x/y", { method: "POST", headers: { authorization: "Bearer s", ...headers }, body: JSON.stringify(body) }) as never;
    expect(await (await POST(mk({}, { identifier: "a@x.io" }))).json()).toEqual({ error: "actor_required" });
    expect((await POST(mk({ "x-admin-actor": "andrea" }, { identifier: "  " }))).status).toBe(400);
    expect(affiliateRpc).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});

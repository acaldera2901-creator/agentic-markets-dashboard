// #AFFILIATE-V2-CRYPTO-1007 PR-5 — /api/affiliate/me: IDOR, mascheramento lato
// server, cancel_code mai cancel_reason, errore ≠ «non iscritto».
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionPlan = vi.fn();
const dbQueryStrict = vi.fn();
vi.mock("@/lib/auth", () => ({ getSessionPlan }));
vi.mock("@/lib/db", () => ({ dbQueryStrict, dbQuery: vi.fn(), dbExecute: vi.fn() }));

const ADDR = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
const AFFS: Record<string, number> = { "alice@x.io": 11, "bob@x.io": 22 };

function req(who: string | null, qs = "") {
  return new Request(`https://x/api/affiliate/me${qs}`, { headers: who ? { "x-test-who": who } : {} });
}

let sqlSeen: { sql: string; params: unknown[] }[];

beforeEach(() => {
  vi.clearAllMocks();
  sqlSeen = [];
  getSessionPlan.mockImplementation(async (r: Request) => {
    const who = r.headers.get("x-test-who");
    return who ? { identifier: who, plan: "free" } : null;
  });
  dbQueryStrict.mockImplementation(async (sql: string, params: unknown[]) => {
    sqlSeen.push({ sql, params });
    if (/FROM affiliates\b/.test(sql)) {
      const id = AFFS[String(params[0])];
      return id
        ? [{ id, identifier: params[0], code: "C" + id, status: "active", terms_version: "v1", created_at: "2026-10-01", payee_legal_name: "Alice L", payee_country: "GB", payee_sanctions_declared_at: "2026-10-02", payee_tax_declared_at: "2026-10-02" }]
        : [];
    }
    if (/FROM affiliate_wallets/.test(sql)) {
      return [{ id: 1, coin: "USDT", network: "polygon", address: ADDR, created_at: "2026-10-01", usable_after: "2999-01-01", screening_result: "not_screened" }];
    }
    if (/HAVING SUM\(amount_usd\) > 0/.test(sql)) {
      return [{ n: 6 }];
    }
    if (/GROUP BY status, kind/.test(sql)) {
      return [{ status: "payable", kind: "first", total: "23.39", n: 2, next_after: null }];
    }
    if (/FROM affiliate_commissions c/.test(sql)) {
      return [
        { id: 9, referred_identifier: "carla.verdi@gmail.com", kind: "first", created_at: "x", net_usd: "50.00", amount_usd: "10.00", status: "payable", income_at: "x", payable_after: "x", paid_out_at: null },
      ];
    }
    if (/FROM affiliate_payouts/.test(sql)) {
      return [
        { id: 3, period_month: "2026-10-01", amount_usd: "55.00", coin: "USDT", network: "polygon", amount_coin: null, status: "cancelled", tx_hash: null, paid_at: null, cancel_code: "admin_cancelled", cancel_reason: "SEGRETO-ADMIN" },
      ];
    }
    throw new Error(`unexpected sql ${sql}`);
  });
});

describe("GET /api/affiliate/me", () => {
  it("401 senza login", async () => {
    const { GET } = await import("./route");
    expect((await GET(req(null))).status).toBe(401);
  });

  it("errore DB sulla sessione → 503, non 401 (non è «non loggato»)", async () => {
    getSessionPlan.mockRejectedValueOnce(new Error("db down"));
    const { GET } = await import("./route");
    const res = await GET(req("alice@x.io"));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "session unavailable" });
  });

  it("non iscritto → 200 enrolled:false", async () => {
    const { GET } = await import("./route");
    const body = await (await GET(req("nobody@x.io"))).json();
    expect(body.enrolled).toBe(false);
  });

  it("errore di lettura → 500, MAI enrolled:false (non si offre l'iscrizione su un errore)", async () => {
    dbQueryStrict.mockRejectedValueOnce(new Error("db down"));
    const { GET } = await import("./route");
    const res = await GET(req("alice@x.io"));
    expect(res.status).toBe(500);
    expect(await res.json()).not.toHaveProperty("enrolled");
  });

  it("IDOR: ogni query del pannello usa l'affiliato della sessione, e un ?affiliate_id non cambia niente", async () => {
    const { GET } = await import("./route");
    await GET(req("alice@x.io", "?affiliate_id=22&id=22"));
    const scoped = sqlSeen.filter((q) => /affiliate_(wallets|commissions|payouts)/.test(q.sql));
    expect(scoped.length).toBe(5);
    for (const q of scoped) {
      expect(q.sql).toMatch(/affiliate_id = \$1/);
      expect(q.params[0]).toBe(11);
    }
  });

  it("mascheramento lato server e niente testo libero admin", async () => {
    const { GET } = await import("./route");
    const body = await (await GET(req("alice@x.io"))).json();
    const raw = JSON.stringify(body);
    expect(raw).not.toContain(ADDR);
    expect(raw).not.toContain("carla");
    expect(raw).not.toContain("SEGRETO-ADMIN");
    expect(body.wallet).toMatchObject({ state: "cooldown", address_masked: "0x5aAe…eAed" });
    expect(body.commissions.items[0].referred).toBe("c***@g***.com");
    expect(body.payouts[0]).toMatchObject({ status: "cancelled", cancel_code: "admin_cancelled" });
    expect(body.ledger).toMatchObject({ payable: 23.39, min_payout_usd: 50 });
    expect(body.rails).toEqual({ coins: ["USDT", "USDC"], networks: ["polygon"] });
  });

  it("cursore della paginazione passato come intero, spazzatura ignorata", async () => {
    const { GET } = await import("./route");
    await GET(req("alice@x.io", "?cursor=120"));
    await GET(req("alice@x.io", "?cursor=1;DROP"));
    const pages = sqlSeen.filter((q) => /FROM affiliate_commissions c/.test(q.sql));
    expect(pages[0].params).toEqual([11, 120, 21]);
    expect(pages[1].params).toEqual([11, null, 21]);
  });
});

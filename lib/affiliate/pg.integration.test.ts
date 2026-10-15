// @vitest-environment node
// #AFFILIATE-V2-CRYPTO-1007 — le rotte affiliato contro un Postgres VERO.
//
// Gira solo con AFFILIATE_PG_TEST_URL (un Postgres locale USA E GETTA, mai un DB
// reale): applica le migration affiliate_v2 dal repo, emula `exec_sql` con la
// stessa funzione di produzione e la RPC di Supabase con una SELECT sulla
// funzione. In CI la variabile non c'è e il file si salta.
//   AFFILIATE_PG_TEST_URL=postgres://postgres@127.0.0.1:54331/postgres npx vitest run lib/affiliate/pg.integration.test.ts
// Il DB deve essere vuoto e usa e getta (initdb). I ruoli anon / authenticated /
// service_role che le migration nominano nei GRANT/REVOKE li crea il test se
// mancano; `profiles` è uno stub con le sole colonne lette qui (l'indice UNIQUE
// sul codice lo porta la migration, come in produzione).
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const URL_ = process.env.AFFILIATE_PG_TEST_URL;

const h = vi.hoisted(() => ({ sql: null as null | import("postgres").Sql }));

vi.mock("@/lib/auth", () => ({
  getSessionPlan: async (r: Request) => {
    const who = r.headers.get("x-test-who");
    return who ? { identifier: who, plan: "free" } : null;
  },
}));
vi.mock("@/lib/email", async (orig) => ({
  ...(await orig<typeof import("@/lib/email")>()),
  sendEmail: vi.fn(async () => undefined),
}));
vi.mock("@/lib/db", async () => {
  const { interpolate } = await vi.importActual<typeof import("@/lib/db")>("@/lib/db");
  const run = async (q: string, params: unknown[] = []) => {
    const rows = await h.sql!.unsafe("SELECT exec_sql($1) AS r", [interpolate(q, params)]);
    return (rows[0].r as unknown[]) ?? [];
  };
  return {
    interpolate,
    dbQuery: run,
    dbQueryStrict: run,
    dbExecute: run,
    getSupabaseAdminClient: () => ({
      rpc: async (fn: string, args: Record<string, unknown>) => {
        try {
          const named = Object.keys(args).map((k, i) => `${k} => $${i + 1}`).join(", ");
          const call = interpolate(`SELECT ${fn}(${named}) AS r`, Object.values(args));
          const rows = await h.sql!.unsafe(call);
          return { data: rows[0].r, error: null };
        } catch (e) {
          return { data: null, error: { message: String(e) } };
        }
      },
    }),
  };
});

const ROOT = path.resolve(__dirname, "../..");
const MIGRATIONS = readdirSync(path.join(ROOT, "supabase/migrations"))
  .filter((f) => /^2026\d+_affiliate_v2.*\.sql$/.test(f))
  .sort();

const A1 = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
const A2 = "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359";

function req(url: string, method: string, who: string | null, body?: unknown) {
  return new Request(`https://x${url}`, {
    method,
    headers: { "x-forwarded-for": `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`, ...(who ? { "x-test-who": who } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const walletBody = (address: string) => ({
  address,
  last6: address.slice(-6),
  payee_legal_name: "Alice Liddell",
  payee_country: "GB",
  declarations: { sanctions: true, tax: true },
  network_ack: true,
});

describe.skipIf(!URL_)("affiliate v2 su Postgres vero", () => {
  beforeAll(async () => {
    const postgres = (await import("postgres")).default;
    h.sql = postgres(URL_!, { max: 4, onnotice: () => {} });
    const sql = h.sql;
    await sql.unsafe(`
      DO $r$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
      END $r$;
      CREATE TABLE IF NOT EXISTS profiles (
        identifier text PRIMARY KEY, referral_code text, referred_by text, language text,
        updated_at timestamptz);
      CREATE OR REPLACE FUNCTION public.exec_sql(query text) RETURNS jsonb LANGUAGE plpgsql AS $$
      DECLARE result jsonb;
      BEGIN
        BEGIN
          EXECUTE format('SELECT coalesce(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (%s) t', query) INTO result;
          RETURN result;
        EXCEPTION WHEN OTHERS THEN
          EXECUTE query;
          RETURN '[]'::jsonb;
        END;
      END; $$;`);
    for (const f of MIGRATIONS) await sql.unsafe(readFileSync(path.join(ROOT, "supabase/migrations", f), "utf8"));
  });
  afterAll(async () => {
    await h.sql?.end();
  });
  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("AFFILIATE_MODE", "shadow");
    vi.stubEnv("AFFILIATE_TERMS_VERSION", "2026-11-v1");
    await h.sql!.unsafe(`
      TRUNCATE affiliate_commissions, affiliate_payouts, affiliate_wallets, affiliate_attributions,
               affiliate_clicks, affiliates, profiles RESTART IDENTITY CASCADE;
      INSERT INTO profiles(identifier, referral_code, language) VALUES
        ('alice@x.io', NULL, 'it'), ('bob@x.io', 'BOBBY', 'en');`);
  });

  it("migration: i file affiliate_v2 riapplicati senza errori (idempotente)", async () => {
    for (const f of MIGRATIONS) await h.sql!.unsafe(readFileSync(path.join(ROOT, "supabase/migrations", f), "utf8"));
    expect(MIGRATIONS.length).toBeGreaterThanOrEqual(2);
  });

  it("iscrizione → wallet → pannello, tutto su SQL vero", async () => {
    const join = await import("@/app/api/affiliate/join/route");
    const wallet = await import("@/app/api/affiliate/wallet/route");
    const me = await import("@/app/api/affiliate/me/route");

    const j = await join.POST(req("/api/affiliate/join", "POST", "alice@x.io", { code: "alice", terms_version: "2026-11-v1", age: true, onerous_ack: true }));
    expect(j.status).toBe(200);
    const [a] = await h.sql!`SELECT code, onerous_ack_version, onerous_ack_at IS NOT NULL AS ack FROM affiliates`;
    expect(a).toEqual({ code: "ALICE", onerous_ack_version: "2026-11-v1", ack: true });

    const put = await wallet.PUT(req("/api/affiliate/wallet", "PUT", "alice@x.io", walletBody(A1)));
    expect(put.status).toBe(200);
    expect((await put.json()).wallet).toMatchObject({ state: "cooldown", address_masked: "0x5aAe…eAed" });

    const panel = await (await me.GET(req("/api/affiliate/me", "GET", "alice@x.io"))).json();
    expect(panel).toMatchObject({ enrolled: true, affiliate: { code: "ALICE" }, payee: { name: "Alice Liddell", country: "GB" } });
    expect(JSON.stringify(panel)).not.toContain(A1);

    const [w] = await h.sql!`SELECT screening_result, (usable_after - created_at) = interval '72 hours' AS cd FROM affiliate_wallets WHERE revoked_at IS NULL`;
    expect(w).toEqual({ screening_result: "not_screened", cd: true });
  });

  it("IDOR: Bob non vede né tocca il wallet di Alice", async () => {
    const join = await import("@/app/api/affiliate/join/route");
    const wallet = await import("@/app/api/affiliate/wallet/route");
    const me = await import("@/app/api/affiliate/me/route");
    await join.POST(req("/api/affiliate/join", "POST", "alice@x.io", { code: "alice", terms_version: "2026-11-v1", age: true, onerous_ack: true }));
    await join.POST(req("/api/affiliate/join", "POST", "bob@x.io", { code: "bobby", terms_version: "2026-11-v1", age: true, onerous_ack: true }));
    await wallet.PUT(req("/api/affiliate/wallet", "PUT", "alice@x.io", walletBody(A1)));

    const bobPanel = await (await me.GET(req("/api/affiliate/me", "GET", "bob@x.io"))).json();
    expect(bobPanel.wallet.state).toBe("none");
    const del = await wallet.DELETE(req("/api/affiliate/wallet", "DELETE", "bob@x.io"));
    expect(del.status).toBe(404); // Bob non ha wallet; quello di Alice resta
    const [n] = await h.sql!`SELECT count(*)::int AS n FROM affiliate_wallets w JOIN affiliates a ON a.id = w.affiliate_id WHERE a.code = 'ALICE' AND w.revoked_at IS NULL`;
    expect(n.n).toBe(1);
  });

  it("indice UNIQUE sul codice referral: lo porta la migration (in prod esiste già, fuori dal repo)", async () => {
    const [i] = await h.sql!`SELECT indexdef FROM pg_indexes WHERE indexname = 'uq_profiles_referral_code'`;
    expect(i.indexdef).toContain("upper(referral_code)");
  });

  it("KYC spento + dichiarazioni inviate: salva (QA F8, prima 500 sul CHECK)", async () => {
    vi.stubEnv("AFFILIATE_KYC_AT_WALLET", "off");
    const join = await import("@/app/api/affiliate/join/route");
    const wallet = await import("@/app/api/affiliate/wallet/route");
    await join.POST(req("/api/affiliate/join", "POST", "alice@x.io", { code: "alice", terms_version: "2026-11-v1", age: true, onerous_ack: true }));
    const { payee_legal_name: _n, payee_country: _c, ...rest } = walletBody(A1);
    void _n; void _c;
    const put = await wallet.PUT(req("/api/affiliate/wallet", "PUT", "alice@x.io", rest));
    expect(put.status).toBe(200);
  });

  it("suspended: PUT rifiutato, nessuna riga scritta", async () => {
    const join = await import("@/app/api/affiliate/join/route");
    const wallet = await import("@/app/api/affiliate/wallet/route");
    await join.POST(req("/api/affiliate/join", "POST", "alice@x.io", { code: "alice", terms_version: "2026-11-v1", age: true, onerous_ack: true }));
    await h.sql!`UPDATE affiliates SET status = 'suspended'`;
    const put = await wallet.PUT(req("/api/affiliate/wallet", "PUT", "alice@x.io", walletBody(A1)));
    expect(put.status).toBe(403);
    const [n] = await h.sql!`SELECT count(*)::int AS n FROM affiliate_wallets`;
    expect(n.n).toBe(0);
  });

  it("cambio wallet con payout in preparazione: annullato e commissioni sbloccate, in una transazione", async () => {
    const join = await import("@/app/api/affiliate/join/route");
    const wallet = await import("@/app/api/affiliate/wallet/route");
    const me = await import("@/app/api/affiliate/me/route");
    await join.POST(req("/api/affiliate/join", "POST", "alice@x.io", { code: "alice", terms_version: "2026-11-v1", age: true, onerous_ack: true }));
    await wallet.PUT(req("/api/affiliate/wallet", "PUT", "alice@x.io", walletBody(A1)));
    await h.sql!.unsafe(`
      INSERT INTO affiliate_payouts(affiliate_id, period_month, amount_usd, coin, network, wallet_id, to_address, created_by)
        SELECT affiliate_id, date_trunc('month', now())::date, 60, 'USDT', 'polygon', id, address, 'admin'
          FROM affiliate_wallets WHERE revoked_at IS NULL;
      INSERT INTO affiliate_commissions(affiliate_id, referred_identifier, rail, rail_payment_ref, kind, gross_usd, net_usd, rate, amount_usd, renewal_index, status, paid_at, payable_after, payout_id)
        VALUES (1, 'carla.verdi@gmail.com', 'paygate', 'o1', 'first', 300, 300, 0.2, 60, 0, 'in_payout', now() - interval '90 days', now() - interval '30 days', 1);`);
    const put = await wallet.PUT(req("/api/affiliate/wallet", "PUT", "alice@x.io", walletBody(A2)));
    expect((await put.json()).cancelled_payouts).toBe(1);
    const panel = await (await me.GET(req("/api/affiliate/me", "GET", "alice@x.io"))).json();
    expect(panel.payouts[0]).toMatchObject({ status: "cancelled", cancel_code: "wallet_changed" });
    expect(panel.ledger).toMatchObject({ payable: 60, in_payout: 0 });
    expect(panel.commissions.items[0]).toMatchObject({ referred: "c***@g***.com", status: "payable" });
  });
});

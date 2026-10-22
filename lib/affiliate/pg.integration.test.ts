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

const h = vi.hoisted(() => ({ sql: null as null | import("postgres").Sql, chainTo: "", chainAmount: 0, screen: "none" as "none" | "clear" }));

vi.mock("@/lib/auth", () => ({
  getSessionPlan: async (r: Request) => {
    const who = r.headers.get("x-test-who");
    return who ? { identifier: who, plan: "free" } : null;
  },
}));
vi.mock("@/lib/admin-auth", () => ({ isAdminAuthorized: async () => true }));
// Catena finta (nessuna rete): una ricevuta USDT valida dal wallet di uscita al
// destinatario indicato in h.chainTo, con 101 conferme.
vi.mock("@/lib/affiliate/payout-verify", async (orig) => {
  const real = await orig<typeof import("@/lib/affiliate/payout-verify")>();
  const pad = (a: string) => `0x${"0".repeat(24)}${a.slice(2).toLowerCase()}`;
  return {
    ...real,
    jsonRpc: () => async (method: string) => {
      if (method === "eth_chainId") return "0x89";
      if (method === "eth_blockNumber") return "0xf42a4";
      if (method === "eth_getBlockByNumber") return { number: "0xf42a0" };
      if (method === "eth_getTransactionByHash") return { nonce: "0x2a", from: "0x1111111111111111111111111111111111111111" };
      return {
        status: "0x1",
        blockNumber: "0xf4240",
        logs: [{ address: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f", topics: [real.TRANSFER_TOPIC, pad("0x1111111111111111111111111111111111111111"), pad(h.chainTo)], data: `0x${(h.chainAmount * 1e6).toString(16).padStart(64, "0")}` }],
      };
    },
  };
});
// Nessun provider di screening reale: di default come in prod (not_screened);
// gli scenari payout accendono un provider finto «clear».
vi.mock("@/lib/affiliate/screening", async (orig) => {
  const real = await orig<typeof import("@/lib/affiliate/screening")>();
  return {
    ...real,
    screenPayoutAddress: async () => (h.screen === "clear" ? { kind: "clear", provider: "test" } : { kind: "not_screened" }),
  };
});
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
    // Come in produzione: dbQuery inghiotte l'errore e restituisce [].
    dbQuery: (q: string, params: unknown[] = []) => run(q, params).catch(() => []),
    dbQueryStrict: run,
    dbExecute: run,
    getSupabaseAdminClient: () => ({
      rpc: async (fn: string, args: Record<string, unknown>) => {
        try {
          // Come PostgREST: gli array JSON diventano array Postgres.
          const lit = (v: unknown): string =>
            Array.isArray(v) ? `ARRAY[${v.map(lit).join(",")}]` : interpolate("$1", [v]);
          const named = Object.entries(args).map(([k, v]) => `${k} => ${lit(v)}`).join(", ");
          const call = `SELECT ${fn}(${named}) AS r`;
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
    headers: { origin: "https://x", "x-forwarded-for": `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`, ...(who ? { "x-test-who": who } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const walletBody = (address: string) => ({
  coin: "USDT",
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
      CREATE TABLE IF NOT EXISTS affiliate_clicks (id bigserial PRIMARY KEY, link_id uuid, book_key text, clicked_at timestamptz DEFAULT now());
      INSERT INTO affiliate_clicks(book_key) SELECT 'existing-bo-click' WHERE NOT EXISTS (SELECT 1 FROM affiliate_clicks);
      CREATE TABLE IF NOT EXISTS profiles (
        identifier text PRIMARY KEY, referral_code text, referred_by text, language text,
        updated_at timestamptz, created_at timestamptz DEFAULT now());
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
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
    h.screen = "none";
    vi.stubEnv("AFFILIATE_MODE", "shadow");
    vi.stubEnv("AFFILIATE_TERMS_VERSION", "2026-11-v1");
    vi.stubEnv("AFFILIATE_PAYOUTS", "live");
    vi.stubEnv("AFFILIATE_PAYOUT_FROM", "0x1111111111111111111111111111111111111111");
    await h.sql!.unsafe(`
      TRUNCATE affiliate_commissions, affiliate_payouts, affiliate_wallets, affiliate_attributions,
               affiliate_referral_clicks, affiliates, profiles RESTART IDENTITY CASCADE;
      INSERT INTO profiles(identifier, referral_code, language) VALUES
        ('alice@x.io', NULL, 'it'), ('bob@x.io', 'BOBBY', 'en');`);
  });

  it("migration: i file affiliate_v2 riapplicati senza errori (idempotente)", async () => {
    for (const f of MIGRATIONS) await h.sql!.unsafe(readFileSync(path.join(ROOT, "supabase/migrations", f), "utf8"));
    expect(MIGRATIONS.length).toBeGreaterThanOrEqual(2);
    const legacy = await h.sql!`SELECT book_key FROM affiliate_clicks`;
    expect(legacy).toEqual([{book_key:"existing-bo-click"}]);
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

  // ── PR-9: payout admin ─────────────────────────────────────────────────────
  /** Alice iscritta, wallet screenato e fuori cooldown, 60 $ maturati. */
  async function payableAlice(address = A1) {
    h.screen = "clear";
    const join = await import("@/app/api/affiliate/join/route");
    const wallet = await import("@/app/api/affiliate/wallet/route");
    await join.POST(req("/api/affiliate/join", "POST", "alice@x.io", { code: "alice", terms_version: "2026-11-v1", age: true, onerous_ack: true }));
    await wallet.PUT(req("/api/affiliate/wallet", "PUT", "alice@x.io", walletBody(address)));
    await h.sql!.unsafe(`
      UPDATE affiliate_wallets SET created_at = now() - interval '10 days', usable_after = now() - interval '7 days',
             screening_result = 'clear', screened_at = now(), screening_provider = 'test';
      INSERT INTO affiliate_commissions(affiliate_id, referred_identifier, rail, rail_payment_ref, kind, gross_usd, net_usd, rate, amount_usd, renewal_index, status, paid_at, payable_after)
        VALUES (1, 'carla.verdi@gmail.com', 'paygate', 'o1', 'first', 300, 300, 0.2, 60, 0, 'payable', now() - interval '90 days', now() - interval '30 days');`);
  }
  const month = () => new Date().toISOString().slice(0, 7);
  const H = `0x${"c3".repeat(32)}`;

  it("PR-9 end-to-end: lista → crea → tx verificata → paid, e l'affiliato lo vede", async () => {
    await payableAlice();
    const admin = await import("@/app/api/admin/affiliate/payouts/route");
    const txr = await import("@/app/api/admin/affiliate/payouts/[id]/tx/route");
    const me = await import("@/app/api/affiliate/me/route");
    const list = await (await admin.GET(req(`/api/admin/affiliate/payouts?month=${month()}`, "GET", null) as never)).json();
    expect(list.rows[0]).toMatchObject({ code: "ALICE", eligible: true, balance_usd: 60, wallet: { address: A1 } });
    expect(list.summary).toMatchObject({ eligible_count: 1, eligible_total_usd: 60 });

    const created = await admin.POST(req("/api/admin/affiliate/payouts", "POST", null, { month: month(), ids: [1], expected_total: "60.00" }) as never);
    expect(created.status).toBe(200);
    const [p] = await h.sql!`SELECT id, status, to_address FROM affiliate_payouts`;
    expect(p).toMatchObject({ status: "created", to_address: A1 });

    h.chainTo = A1;
    h.chainAmount = 60;
    const t = await txr.POST(req(`/x`, "POST", null, { hash: H }) as never, { params: Promise.resolve({ id: String(p.id) }) });
    expect(await t.json()).toMatchObject({ outcome: "paid" });
    const panel = await (await me.GET(req("/api/affiliate/me", "GET", "alice@x.io"))).json();
    expect(panel.payouts[0]).toMatchObject({ status: "paid", amount_coin: 60, tx_hash: H });
    const [nonce] = await h.sql!`SELECT tx_nonce, tx_block, tx_from FROM affiliate_payouts`;
    expect(nonce.tx_from).toBe("0x1111111111111111111111111111111111111111"); // QA S3
    expect(Number(nonce.tx_nonce)).toBe(42); // QA N1: nonce letto on-chain e salvato
    expect(Number(nonce.tx_block)).toBe(1_000_000); // QA R3: blocco di registrazione
    expect(panel.ledger).toMatchObject({ paid: 60, payable: 0, in_payout: 0 });
  });

  it("PR-9 corsa: due «Crea payout» concorrenti → uno solo creato", async () => {
    await payableAlice();
    const admin = await import("@/app/api/admin/affiliate/payouts/route");
    const body = { month: month(), ids: [1], expected_total: "60.00" };
    const [a, b] = await Promise.all([
      admin.POST(req("/x", "POST", null, body) as never),
      admin.POST(req("/x", "POST", null, body) as never),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const [n] = await h.sql!`SELECT count(*)::int AS n FROM affiliate_payouts`;
    expect(n.n).toBe(1);
  });

  it("PR-9 tx verso il destinatario sbagliato: rifiutato, payout resta created", async () => {
    await payableAlice();
    const admin = await import("@/app/api/admin/affiliate/payouts/route");
    const txr = await import("@/app/api/admin/affiliate/payouts/[id]/tx/route");
    await admin.POST(req("/x", "POST", null, { month: month(), ids: [1], expected_total: "60.00" }) as never);
    h.chainTo = A2;
    h.chainAmount = 60;
    const t = await txr.POST(req(`/x`, "POST", null, { hash: H }) as never, { params: Promise.resolve({ id: "1" }) });
    expect(await t.json()).toEqual({ outcome: "rejected", reason: "wrong_recipient" });
    const [p] = await h.sql!`SELECT status, tx_hash FROM affiliate_payouts`;
    expect(p).toEqual({ status: "created", tx_hash: null });
  });

  it("PR-9 cambio wallet dopo la creazione: payout annullato, la tx sul vecchio indirizzo non si registra", async () => {
    await payableAlice();
    const admin = await import("@/app/api/admin/affiliate/payouts/route");
    const txr = await import("@/app/api/admin/affiliate/payouts/[id]/tx/route");
    const wallet = await import("@/app/api/affiliate/wallet/route");
    await admin.POST(req("/x", "POST", null, { month: month(), ids: [1], expected_total: "60.00" }) as never);
    await wallet.PUT(req("/api/affiliate/wallet", "PUT", "alice@x.io", walletBody(A2)));
    h.chainTo = A1;
    h.chainAmount = 60;
    const t = await txr.POST(req(`/x`, "POST", null, { hash: H }) as never, { params: Promise.resolve({ id: "1" }) });
    expect(t.status).toBe(409);
    expect(await t.json()).toEqual({ error: "cancelled", cancel_code: "wallet_changed" });
  });

  it("PR-9 senza provider di screening: la creazione è rifiutata anche se il wallet risulta clear (QA F13)", async () => {
    await payableAlice();
    h.screen = "none";
    const admin = await import("@/app/api/admin/affiliate/payouts/route");
    const r = await admin.POST(req("/x", "POST", null, { month: month(), ids: [1], expected_total: "60.00" }) as never);
    expect(await r.json()).toMatchObject({ error: "not_screened", affiliate_id: 1 });
    const [n] = await h.sql!`SELECT count(*)::int AS n FROM affiliate_payouts`;
    expect(n.n).toBe(0);
  });

  it("PR-9 sospensione dopo la creazione: payout annullato dal trigger, tx rifiutata (QA F4)", async () => {
    await payableAlice();
    const admin = await import("@/app/api/admin/affiliate/payouts/route");
    const txr = await import("@/app/api/admin/affiliate/payouts/[id]/tx/route");
    await admin.POST(req("/x", "POST", null, { month: month(), ids: [1], expected_total: "60.00" }) as never);
    await h.sql!`UPDATE affiliates SET status = 'suspended'`;
    h.chainTo = A1;
    h.chainAmount = 60;
    const t = await txr.POST(req(`/x`, "POST", null, { hash: H }) as never, { params: Promise.resolve({ id: "1" }) });
    expect(await t.json()).toEqual({ error: "cancelled", cancel_code: "affiliate_suspended" });
  });

  it("PR-9 suspended: non pagabile, la creazione è rifiutata", async () => {
    await payableAlice();
    await h.sql!`UPDATE affiliates SET status = 'suspended'`;
    const admin = await import("@/app/api/admin/affiliate/payouts/route");
    const r = await admin.POST(req("/x", "POST", null, { month: month(), ids: [1], expected_total: "60.00" }) as never);
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ error: "not_eligible", items: [{ affiliate_id: 1, reasons: ["suspended"] }] });
  });

  it("matures only due live commissions and leaves shadow, future and review cases untouched",async()=>{
    const join=await import("@/app/api/affiliate/join/route");
    expect((await join.POST(req("/api/affiliate/join","POST","alice@x.io",{code:"alice",terms_version:"2026-11-v1",age:true,onerous_ack:true}))).status).toBe(200);
    await h.sql!`INSERT INTO affiliate_attributions(referred_identifier,affiliate_id,attributed_at,status) SELECT 'ok@x.io',id,now(),'valid' FROM affiliates`;
    await h.sql!`INSERT INTO affiliate_attributions(referred_identifier,affiliate_id,attributed_at,status) SELECT 'review@x.io',id,now(),'fraud_review' FROM affiliates`;
    for(const [ref,status,who,due] of [['due','pending','ok@x.io',true],['shadow','shadow','ok@x.io',true],['future','pending','ok@x.io',false],['review','pending','review@x.io',true]]){
      await h.sql!`INSERT INTO affiliate_commissions(affiliate_id,referred_identifier,rail,rail_payment_ref,kind,gross_usd,net_usd,rate,amount_usd,renewal_index,status,paid_at,payable_after)
      SELECT id,${who},'crypto',${ref},'first',100,100,0.2,20,${['due','shadow','future','review'].indexOf(String(ref))},${status},now()-interval '70 days',${due?new Date(Date.now()-86400000):new Date(Date.now()+86400000)} FROM affiliates`;
    }
    const first=await h.sql!`SELECT affiliate_mature_commissions() AS result`;
    expect(first[0].result).toEqual({ok:true,matured:1});
    expect((await h.sql!`SELECT affiliate_mature_commissions() AS result`)[0].result).toEqual({ok:true,matured:0});
    expect(await h.sql!`SELECT rail_payment_ref FROM affiliate_commissions WHERE status='payable'`).toEqual([{rail_payment_ref:'due'}]);
  });

  it("rollback preserves existing BO clicks and can be reapplied",async()=>{
    await h.sql!`DELETE FROM profiles`;
    await h.sql!.unsafe(readFileSync(path.join(ROOT,"scripts/affiliate-v2/rollback_gate_b.sql"),"utf8"));
    expect(await h.sql!`SELECT book_key FROM affiliate_clicks`).toEqual([{book_key:"existing-bo-click"}]);
    for (const f of MIGRATIONS) await h.sql!.unsafe(readFileSync(path.join(ROOT,"supabase/migrations",f),"utf8"));
  });

  // #AFFILIATE-REVERSAL-1022 — storni su SQL vero: CHECK, UNIQUE, lock, maturazione.
  // Affiliato e commissione inseriti a mano: il test non dipende dall'iscrizione.
  async function aliceWithCommission(status: string, paidDaysAgo: number, amount = 20) {
    await h.sql!`INSERT INTO affiliates(identifier, code, terms_version, terms_accepted_at, age_confirmed_at, onerous_ack_version, onerous_ack_at) VALUES ('alice@x.io','ALICE','t',now(),now(),'t',now())`;
    await h.sql!`INSERT INTO affiliate_attributions(referred_identifier,affiliate_id,attributed_at,status) SELECT 'ref@x.io',id,now(),'valid' FROM affiliates`;
    await h.sql!`INSERT INTO affiliate_commissions(affiliate_id,referred_identifier,rail,rail_payment_ref,kind,gross_usd,net_usd,rate,amount_usd,renewal_index,status,paid_at,payable_after)
      SELECT id,'ref@x.io','shopify','o1','first',100,100,${amount / 100},${amount},0,${status},now()-make_interval(days=>${paidDaysAgo}),now()-make_interval(days=>${paidDaysAgo})+interval '60 days' FROM affiliates`;
    return (await import("@/lib/affiliate/reversal")).reverseAffiliateCommissionSafe;
  }
  const rows = () => h.sql!`SELECT kind, rail_event_ref AS ev, amount_usd::float8 AS amt, status FROM affiliate_commissions ORDER BY id`;
  const paying = async (mode: "live" | "shadow") => {
    const { payingReferredSql } = await import("@/lib/affiliate/tiers");
    return (await h.sql!.unsafe(payingReferredSql(mode).sql.replace("$1", "1")))[0].n;
  };
  const ev = (eventRef: string, refundedGrossUsd: number | null) => ({ rail: "shopify" as const, paymentRef: "o1", eventRef, refundedGrossUsd });

  it("R1 storno totale dentro l'hold: originale reversed, mai maturato, redelivery idempotente, fuori dallo scaglione", async () => {
    vi.stubEnv("AFFILIATE_MODE", "live");
    const reverse = await aliceWithCommission("pending", 70);
    expect(await paying("live")).toBe(1);
    expect(await reverse(ev("r1", null))).toEqual({ written: true, reason: "reversal" });
    expect(await reverse(ev("r1", null))).toEqual({ written: false, reason: "duplicate" });
    expect(await rows()).toEqual([
      { kind: "first", ev: "", amt: 20, status: "reversed" },
      { kind: "reversal", ev: "r1", amt: -20, status: "reversed" },
    ]);
    expect((await h.sql!`SELECT affiliate_mature_commissions() AS r`)[0].r).toEqual({ ok: true, matured: 0 });
    expect(await paying("live")).toBe(0);
  });

  it("R1 parziale poi totale: la parziale matura con l'originale, il totale chiude il residuo senza superarlo", async () => {
    vi.stubEnv("AFFILIATE_MODE", "live");
    const reverse = await aliceWithCommission("pending", 10);
    expect(await reverse(ev("r1", 25))).toEqual({ written: true, reason: "reversal" });
    expect(await rows()).toEqual([
      { kind: "first", ev: "", amt: 20, status: "pending" },
      { kind: "reversal", ev: "r1", amt: -5, status: "pending" },
    ]);
    expect(await paying("live")).toBe(1);
    expect(await reverse(ev("r2", null))).toEqual({ written: true, reason: "reversal" });
    expect(await rows()).toEqual([
      { kind: "first", ev: "", amt: 20, status: "reversed" },
      { kind: "reversal", ev: "r1", amt: -5, status: "reversed" },
      { kind: "reversal", ev: "r2", amt: -15, status: "reversed" },
    ]);
    expect(await reverse(ev("r3", 10))).toEqual({ written: false, reason: "original_reversed" });
  });

  it("R1 parziale dentro l'hold matura insieme all'originale (saldo netto)", async () => {
    vi.stubEnv("AFFILIATE_MODE", "live");
    const reverse = await aliceWithCommission("pending", 70);
    await reverse(ev("r1", 50));
    expect((await h.sql!`SELECT affiliate_mature_commissions() AS r`)[0].r).toEqual({ ok: true, matured: 2 });
    const [bal] = await h.sql!`SELECT SUM(amount_usd)::float8 AS b FROM affiliate_commissions WHERE status = 'payable'`;
    expect(bal.b).toBe(10);
  });

  it("R1 dopo la maturazione: clawback negativo payable che scala il saldo; oltre 120 gg nessuna azione", async () => {
    vi.stubEnv("AFFILIATE_MODE", "live");
    const reverse = await aliceWithCommission("payable", 70);
    expect(await reverse(ev("r1", 50))).toEqual({ written: true, reason: "clawback" });
    const [bal] = await h.sql!`SELECT SUM(amount_usd)::float8 AS b FROM affiliate_commissions WHERE status = 'payable'`;
    expect(bal.b).toBe(10);
    expect(await paying("live")).toBe(1);
    expect(await reverse(ev("r2", null))).toEqual({ written: true, reason: "clawback" });
    expect(await paying("live")).toBe(0);
    await h.sql!`DELETE FROM affiliate_commissions WHERE kind = 'clawback'`;
    await h.sql!`UPDATE affiliate_commissions SET paid_at = now() - interval '121 days' WHERE kind = 'first'`;
    expect(await reverse(ev("r3", null))).toEqual({ written: false, reason: "outside_clawback_window" });
  });

  it("R1 tre rimborsi che sommano il lordo chiudono il residuo: nessun centesimo orfano nello scaglione", async () => {
    vi.stubEnv("AFFILIATE_MODE", "live");
    const reverse = await aliceWithCommission("payable", 70, 7);
    await reverse(ev("r1", 33.33));
    await reverse(ev("r2", 33.33));
    await reverse(ev("r3", 33.34));
    expect((await rows()).map((r) => r.amt)).toEqual([7, -2.33, -2.33, -2.34]);
    expect(await paying("live")).toBe(0);
  });

  it("R1 corse (review Codex): stesso rimborso x2 a cavallo della maturazione e rimborsi diversi concorrenti non superano il residuo", async () => {
    vi.stubEnv("AFFILIATE_MODE", "live");
    const reverse = await aliceWithCommission("pending", 70);
    const results = await Promise.all([
      reverse(ev("r1", 50)),
      h.sql!`SELECT affiliate_mature_commissions() AS r`,
      reverse(ev("r1", 50)),
      reverse(ev("r2", 60)),
      reverse(ev("r3", 60)),
    ]);
    expect(results.filter((r) => (r as { written?: boolean }).written === true).length).toBeGreaterThanOrEqual(2);
    const all = await rows();
    expect(all.filter((r) => r.ev === "r1").length).toBeLessThanOrEqual(1); // mai due righe per lo stesso evento
    const reversed = all.filter((r) => r.kind !== "first").reduce((s, r) => s + -r.amt, 0);
    expect(Math.round(reversed * 100) / 100).toBe(20);
    // Nessuno storno `pending` orfano accanto a un originale già maturato.
    const [orig] = all;
    if (orig.status === "payable") expect(all.some((r) => r.kind === "reversal" && r.status === "pending")).toBe(false);
  });

  it("R1 maturazione concorrente a uno storno parziale non committato: vede lo storno (review Codex #2)", async () => {
    vi.stubEnv("AFFILIATE_MODE", "live");
    await aliceWithCommission("pending", 70);
    let maturity: Promise<unknown> | null = null;
    await h.sql!.begin(async (tx) => {
      await tx`SELECT affiliate_reverse_commission('shopify','o1','r1',50,120)`;
      maturity = h.sql!`SELECT affiliate_mature_commissions() AS r`.execute(); // parte ORA (le query postgres.js sono lazy)
      await new Promise((r) => setTimeout(r, 150)); // la maturazione resta in attesa del lock
    });
    const [m] = (await maturity!) as { r: unknown }[];
    expect(m.r).toEqual({ ok: true, matured: 2 });
    expect(await rows()).toEqual([
      { kind: "first", ev: "", amt: 20, status: "payable" },
      { kind: "reversal", ev: "r1", amt: -10, status: "payable" },
    ]);
  });

  it("R1 endpoint admin (rimborso manuale PayGate/crypto): valida l'input e storna", async () => {
    vi.stubEnv("AFFILIATE_MODE", "live");
    await aliceWithCommission("pending", 5);
    await h.sql!`UPDATE affiliate_commissions SET rail = 'paygate', rail_payment_ref = 'pg-1'`;
    const admin = await import("@/app/api/admin/affiliate/reverse/route");
    const bad = await admin.POST(req("/x", "POST", null, { rail: "admin", payment_ref: "pg-1", event_ref: "m1" }) as never);
    expect(bad.status).toBe(400);
    const ok = await admin.POST(req("/x", "POST", null, { rail: "paygate", payment_ref: "pg-1", event_ref: "m1" }) as never);
    expect(await ok.json()).toEqual({ written: true, reason: "reversal" });
    expect((await rows()).map((r) => r.ev)).toEqual(["", "m1"]);
    // Rigiocare la stessa event_ref (es. da un alert) non storna due volte.
    const again = await admin.POST(req("/x", "POST", null, { rail: "paygate", payment_ref: "pg-1", event_ref: "m1" }) as never);
    expect(await again.json()).toEqual({ written: false, reason: "duplicate" });
  });

});

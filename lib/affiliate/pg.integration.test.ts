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
vi.mock("@/lib/admin-auth", () => ({
  isAdminAuthorized: async () => true,
  // #AFFILIATE-OPS-1022: «Bearer bo» simula il backoffice (ADMIN_SECRET giusto).
  verifyBearer: (r: Request) => r.headers.get("authorization") === "Bearer bo",
}));
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
    vi.stubEnv("AFFILIATE_TERMS_VERSION", "aff-2026-10-22-v3");
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

    const j = await join.POST(req("/api/affiliate/join", "POST", "alice@x.io", { code: "alice", terms_version: "aff-2026-10-22-v3", age: true, onerous_ack: true }));
    expect(j.status).toBe(200);
    const [a] = await h.sql!`SELECT code, onerous_ack_version, onerous_ack_at IS NOT NULL AS ack FROM affiliates`;
    expect(a).toEqual({ code: "ALICE", onerous_ack_version: "aff-2026-10-22-v3", ack: true });

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
    await join.POST(req("/api/affiliate/join", "POST", "alice@x.io", { code: "alice", terms_version: "aff-2026-10-22-v3", age: true, onerous_ack: true }));
    await join.POST(req("/api/affiliate/join", "POST", "bob@x.io", { code: "bobby", terms_version: "aff-2026-10-22-v3", age: true, onerous_ack: true }));
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
    await join.POST(req("/api/affiliate/join", "POST", "alice@x.io", { code: "alice", terms_version: "aff-2026-10-22-v3", age: true, onerous_ack: true }));
    const { payee_legal_name: _n, payee_country: _c, ...rest } = walletBody(A1);
    void _n; void _c;
    const put = await wallet.PUT(req("/api/affiliate/wallet", "PUT", "alice@x.io", rest));
    expect(put.status).toBe(200);
  });

  it("suspended: PUT rifiutato, nessuna riga scritta", async () => {
    const join = await import("@/app/api/affiliate/join/route");
    const wallet = await import("@/app/api/affiliate/wallet/route");
    await join.POST(req("/api/affiliate/join", "POST", "alice@x.io", { code: "alice", terms_version: "aff-2026-10-22-v3", age: true, onerous_ack: true }));
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
    await join.POST(req("/api/affiliate/join", "POST", "alice@x.io", { code: "alice", terms_version: "aff-2026-10-22-v3", age: true, onerous_ack: true }));
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
    await join.POST(req("/api/affiliate/join", "POST", "alice@x.io", { code: "alice", terms_version: "aff-2026-10-22-v3", age: true, onerous_ack: true }));
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
    // Review indipendente P1-2: l'hash di un payout `created` si registra solo dopo la marca del
    // secondo operatore (quattro occhi). Qui la si simula; il flusso completo è nei test OPS.
    await h.sql!`UPDATE affiliate_payouts SET sent_marked_at = now(), sent_marked_by = 'bo:b@maven' WHERE id = ${p.id}`;
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
    expect((await join.POST(req("/api/affiliate/join","POST","alice@x.io",{code:"alice",terms_version:"aff-2026-10-22-v3",age:true,onerous_ack:true}))).status).toBe(200);
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

  // #AFFILIATE-RECONCILE-1022 — la query di riconciliazione su SQL vero. Le
  // tabelle dei rail sono stub con le sole colonne lette dal ledger e da qui.
  async function railStubs(extra: string) {
    await h.sql!.unsafe(`
      CREATE TABLE IF NOT EXISTS paygate_orders (id text PRIMARY KEY, identifier text, amount_usd numeric, coin text, granted_at timestamptz);
      CREATE TABLE IF NOT EXISTS paypal_orders (id text PRIMARY KEY, identifier text, amount_usd numeric, status text, granted_at timestamptz);
      CREATE TABLE IF NOT EXISTS shopify_events (event_id text PRIMARY KEY, event_type text, identifier text, amount numeric, status text, last_error text, processed_at timestamptz DEFAULT now());
      TRUNCATE paygate_orders, paypal_orders, shopify_events;
      INSERT INTO affiliates(identifier, code, terms_version, terms_accepted_at, age_confirmed_at, onerous_ack_version, onerous_ack_at)
        VALUES ('alice@x.io','ALICE','t',now(),now(),'t',now());
      ${extra}`);
    return (await import("@/lib/affiliate/reconcile")).reconcileAffiliateLedger;
  }

  it("R3 riconciliazione: recupera solo i pagamenti recuperabili, in ordine di incasso, una volta sola; Shopify solo segnalato", async () => {
    vi.stubEnv("AFFILIATE_MODE", "shadow");
    const reconcileAffiliateLedger = await railStubs(`
      INSERT INTO profiles(identifier, referred_by, created_at) VALUES
        ('ref@x.io', ' alice ', now() - interval '10 days'),
        ('old@x.io', 'ALICE', now() - interval '50 days'),
        ('late@x.io', 'ALICE', now() - interval '100 days'),
        ('void@x.io', 'ALICE', now() - interval '10 days'),
        ('shop@x.io', 'ALICE', now() - interval '10 days'),
        ('nobody@x.io', NULL, now() - interval '10 days');
      INSERT INTO affiliate_attributions(referred_identifier, affiliate_id, attributed_at, status) SELECT 'void@x.io', id, now(), 'void' FROM affiliates;
      INSERT INTO paygate_orders VALUES
        ('pg-1','ref@x.io',14.99,NULL,now() - interval '2 days'),
        ('cr-1','ref@x.io',14.99,'USDT',now() - interval '1 day'),
        ('pg-old','old@x.io',14.99,NULL,now() - interval '40 days'),
        ('pg-late','late@x.io',14.99,NULL,now() - interval '1 day'),
        ('pg-void','void@x.io',14.99,NULL,now() - interval '1 day'),
        ('pg-now','ref@x.io',14.99,NULL,now() - interval '5 minutes'),
        ('pg-nobody','nobody@x.io',14.99,NULL,now() - interval '1 day');
      INSERT INTO paypal_orders VALUES ('pp-1','ref@x.io',14.99,'refunded',now() - interval '1 day');
      INSERT INTO shopify_events(event_id,event_type,identifier,amount,status,processed_at) VALUES
        ('s-1','orders/paid','shop@x.io',29.99,'granted',now() - interval '3 days');`);
    const first = await reconcileAffiliateLedger();
    expect(first).toMatchObject({ checked: 2, written: 2, shopify_manual: ["s-1"], truncated: false });
    expect(await h.sql!`SELECT rail, rail_payment_ref AS ref, kind, renewal_index AS i, amount_usd::float8 AS amt, status
                         FROM affiliate_commissions ORDER BY renewal_index`).toEqual([
      { rail: "paygate", ref: "pg-1", kind: "first", i: 0, amt: 3, status: "shadow" },
      { rail: "crypto", ref: "cr-1", kind: "renewal", i: 1, amt: 1.05, status: "shadow" },
    ]);
    // attributed_at = incasso che converte (pg-1), non il momento del recupero.
    const [a] = await h.sql!`SELECT attributed_at < now() - interval '1 day' AS at_payment FROM affiliate_attributions WHERE referred_identifier = 'ref@x.io'`;
    expect(a.at_payment).toBe(true);
    // Idempotente: resta solo lo Shopify da verificare.
    expect(await reconcileAffiliateLedger()).toMatchObject({ checked: 0, written: 0, shopify_manual: ["s-1"] });
  });

  it("R3 (review Codex) un pagamento perso PRIMA di uno già registrato si recupera al suo indice, non resta bloccato", async () => {
    vi.stubEnv("AFFILIATE_MODE", "shadow");
    const reconcileAffiliateLedger = await railStubs(`
      INSERT INTO profiles(identifier, referred_by, created_at) VALUES ('ref@x.io', 'ALICE', now() - interval '20 days');
      INSERT INTO paygate_orders VALUES ('pg-a','ref@x.io',14.99,NULL,now() - interval '10 days'), ('pg-b','ref@x.io',14.99,NULL,now() - interval '1 day');
      -- A ha creato l'attribuzione (un istante DOPO il suo grant) ma la riga è andata persa; B è nel ledger all'indice 1.
      INSERT INTO affiliate_attributions(referred_identifier, affiliate_id, attributed_at, status) SELECT 'ref@x.io', id, now() - interval '10 days' + interval '1 second', 'valid' FROM affiliates;
      INSERT INTO affiliate_commissions(affiliate_id,referred_identifier,rail,rail_payment_ref,kind,gross_usd,net_usd,rate,amount_usd,renewal_index,status,paid_at,payable_after)
        SELECT id,'ref@x.io','paygate','pg-b','renewal',14.99,14.99,0.07,1.05,1,'shadow',now() - interval '1 day',now() + interval '59 days' FROM affiliates;`);
    expect(await reconcileAffiliateLedger()).toMatchObject({ written: 1 });
    expect(await h.sql!`SELECT rail_payment_ref AS ref, kind, renewal_index AS i FROM affiliate_commissions ORDER BY renewal_index`).toEqual([
      { ref: "pg-a", kind: "first", i: 0 },
      { ref: "pg-b", kind: "renewal", i: 1 },
    ]);
  });

  it("R3 (review Codex #2) un rinnovo perso il cui indice è già preso da un successivo si accoda invece di restare perso", async () => {
    vi.stubEnv("AFFILIATE_MODE", "shadow");
    const reconcileAffiliateLedger = await railStubs(`
      INSERT INTO profiles(identifier, referred_by, created_at) VALUES ('ref@x.io', 'ALICE', now() - interval '30 days');
      INSERT INTO paygate_orders VALUES ('pg-a','ref@x.io',14.99,NULL,now() - interval '20 days'), ('pg-b','ref@x.io',14.99,NULL,now() - interval '10 days'), ('pg-c','ref@x.io',14.99,NULL,now() - interval '1 day');
      INSERT INTO affiliate_attributions(referred_identifier, affiliate_id, attributed_at, status) SELECT 'ref@x.io', id, now() - interval '20 days', 'valid' FROM affiliates;
      INSERT INTO affiliate_commissions(affiliate_id,referred_identifier,rail,rail_payment_ref,kind,gross_usd,net_usd,rate,amount_usd,renewal_index,status,paid_at,payable_after)
        SELECT id,'ref@x.io','paygate','pg-a','first',14.99,14.99,0.2,3,0,'shadow',now() - interval '20 days',now() + interval '40 days' FROM affiliates
        UNION ALL
        SELECT id,'ref@x.io','paygate','pg-c','renewal',14.99,14.99,0.07,1.05,1,'shadow',now() - interval '1 day',now() + interval '59 days' FROM affiliates;`);
    expect(await reconcileAffiliateLedger()).toMatchObject({ written: 1 });
    expect(await h.sql!`SELECT rail_payment_ref AS ref, kind, renewal_index AS i FROM affiliate_commissions ORDER BY renewal_index`).toEqual([
      { ref: "pg-a", kind: "first", i: 0 },
      { ref: "pg-c", kind: "renewal", i: 1 },
      { ref: "pg-b", kind: "renewal", i: 2 },
    ]);
  });

  // #AFFILIATE-FINGERPRINTS-1022 — dalla scrittura del fingerprint al verdetto del ledger.
  it("R4 stesso IP di affiliato e referito entro 24h → attribuzione fraud_review (commissione ferma, non rifiutata)", async () => {
    vi.stubEnv("AFFILIATE_MODE", "shadow");
    vi.stubEnv("AFFILIATE_HASH_SECRET", "x".repeat(32));
    await h.sql!.unsafe(`
      CREATE TABLE IF NOT EXISTS paygate_orders (id text PRIMARY KEY, identifier text, amount_usd numeric, coin text, granted_at timestamptz);
      CREATE TABLE IF NOT EXISTS paypal_orders (id text PRIMARY KEY, identifier text, amount_usd numeric, status text, granted_at timestamptz);
      CREATE TABLE IF NOT EXISTS shopify_events (event_id text PRIMARY KEY, event_type text, identifier text, amount numeric, status text, last_error text, processed_at timestamptz DEFAULT now());
      TRUNCATE affiliate_payer_fingerprints;
      INSERT INTO affiliates(identifier, code, terms_version, terms_accepted_at, age_confirmed_at, onerous_ack_version, onerous_ack_at)
        VALUES ('alice@x.io','ALICE','t',now(),now(),'t',now());
      INSERT INTO profiles(identifier, referred_by, created_at) VALUES ('ref@x.io','ALICE',now() - interval '1 day'), ('other@x.io','ALICE',now() - interval '1 day');`);
    const { recordIpFingerprintSafe } = await import("@/lib/affiliate/fingerprints");
    const { recordAffiliateCommissionSafe } = await import("@/lib/affiliate/ledger");
    const H = 3_600_000;
    const t0 = Date.now();
    // Alice vista il giorno -3 e di nuovo poco fa; Ref si registra subito dopo dallo stesso IP.
    expect(await recordIpFingerprintSafe("alice@x.io", "9.9.9.9", new Date(t0 - 72 * H))).toBe(true);
    expect(await recordIpFingerprintSafe("alice@x.io", "9.9.9.9", new Date(t0 - 2 * H))).toBe(true);
    expect(await recordIpFingerprintSafe("Ref@x.io", "9.9.9.9", new Date(t0 - 1 * H))).toBe(true);
    // Other: stesso IP, ma a 28 h dalla visita recente di Alice e a 42 h da quella vecchia → nessun segnale.
    expect(await recordIpFingerprintSafe("other@x.io", "9.9.9.9", new Date(t0 - 30 * H))).toBe(true);
    // Ripetere lo stesso giorno non duplica né sposta la prima vista del giorno.
    expect(await recordIpFingerprintSafe("alice@x.io", "9.9.9.9", new Date(t0))).toBe(true);
    const [c] = await h.sql!`SELECT COUNT(*)::int AS n FROM affiliate_payer_fingerprints WHERE identifier = 'alice@x.io'`;
    expect(c.n).toBeLessThanOrEqual(4);
    const pay = (identifier: string, ref: string) =>
      recordAffiliateCommissionSafe({ identifier, rail: "paygate", paymentRef: ref, grossUsd: 14.99, paidAt: new Date() });
    expect(await pay("ref@x.io", "pg-1")).toEqual({ written: true, reason: "shadow" });
    expect(await pay("other@x.io", "pg-2")).toEqual({ written: true, reason: "shadow" });
    expect(await h.sql!`SELECT referred_identifier AS who, status, status_reason AS why FROM affiliate_attributions ORDER BY 1`).toEqual([
      { who: "other@x.io", status: "valid", why: null },
      { who: "ref@x.io", status: "fraud_review", why: "shared_ip_24h" },
    ]);
    // Conservazione: oltre 90 giorni le righe ip_hash spariscono alla scrittura successiva.
    await h.sql!`UPDATE affiliate_payer_fingerprints SET seen_at = now() - interval '91 days' WHERE identifier = 'other@x.io'`;
    await recordIpFingerprintSafe("new@x.io", "7.7.7.7");
    expect((await h.sql!`SELECT DISTINCT identifier FROM affiliate_payer_fingerprints ORDER BY 1`).map((r) => r.identifier)).toEqual(["alice@x.io", "new@x.io", "ref@x.io"]);
    await h.sql!`TRUNCATE affiliate_payer_fingerprints`; // non sporcare il test di rollback
  });

  // #AFFILIATE-OPS-1022 — strumenti operatore su SQL vero (screening manuale,
  // quattro occhi, payout marcato, sospensione, fraud_review, export, click).
  function bo(actor: string | null, body?: unknown, method = "POST", url = "/x") {
    return new Request(`https://x${url}`, {
      method,
      headers: { authorization: "Bearer bo", ...(actor ? { "x-admin-actor": actor } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }) as never;
  }
  const idp = (id: number | string) => ({ params: Promise.resolve({ id: String(id) }) });

  it("OPS payout senza provider: screening manuale → crea (A) → approva+marca (B≠A) → non annullabile → paid anche da sospeso", async () => {
    await payableAlice();
    h.screen = "none";
    await h.sql!`UPDATE affiliate_wallets SET screening_result = 'not_screened', screened_at = NULL, screening_provider = NULL`;
    const admin = await import("@/app/api/admin/affiliate/payouts/route");
    const screen = await import("@/app/api/admin/affiliate/wallets/[id]/screening/route");
    const mark = await import("@/app/api/admin/affiliate/payouts/[id]/mark-sent/route");
    const unmark = await import("@/app/api/admin/affiliate/payouts/[id]/unmark-sent/route");
    const cancel = await import("@/app/api/admin/affiliate/payouts/[id]/cancel/route");
    const status = await import("@/app/api/admin/affiliate/affiliates/[id]/status/route");
    const txr = await import("@/app/api/admin/affiliate/payouts/[id]/tx/route");
    const body = { month: month(), ids: [1], expected_total: "60.00" };

    expect(await (await admin.POST(bo("anna@maven", body))).json()).toMatchObject({ error: "not_eligible", items: [{ reasons: ["not_screened"] }] });
    expect((await screen.POST(bo(null, { result: "clear", reason: "ok" }), idp(1))).status).toBe(400); // operatore obbligatorio
    const s = await screen.POST(bo("anna@maven", { result: "clear", reason: "OFAC/EU: indirizzo e nome Alice Liddell GB, nessun match" }), idp(1));
    expect(await s.json()).toMatchObject({ ok: true, screening_result: "clear" });
    const [w] = await h.sql!`SELECT screening_provider, screened_by FROM affiliate_wallets WHERE id = 1`;
    expect(w).toEqual({ screening_provider: "manual", screened_by: "bo:anna@maven" });

    expect((await admin.POST(bo("anna@maven", body))).status).toBe(200);
    const [p] = await h.sql!`SELECT id, created_by FROM affiliate_payouts`;
    expect(p.created_by).toBe("bo:anna@maven");
    // Quattro occhi: chi prepara non approva; il cookie condiviso non è una persona.
    expect(await (await mark.POST(bo("anna@maven"), idp(p.id))).json()).toMatchObject({ error: "same_person" });
    expect(await (await mark.POST(req("/x", "POST", null, {}) as never, idp(p.id))).json()).toMatchObject({ error: "named_operators_required" });
    expect(await (await mark.POST(bo("michele@maven"), idp(p.id))).json()).toMatchObject({ ok: true, already: false, to_address: A1 });
    expect(await (await mark.POST(bo("michele@maven"), idp(p.id))).json()).toMatchObject({ ok: true, already: true });

    // R-C: marcato → non si annulla, né a mano né per cambio wallet o sospensione.
    expect(await (await cancel.POST(req("/x", "POST", null, { reason: "ops" }) as never, idp(p.id))).json()).toMatchObject({ error: "marked_sent" });
    const wallet = await import("@/app/api/affiliate/wallet/route");
    await wallet.PUT(req("/api/affiliate/wallet", "PUT", "alice@x.io", walletBody(A2)));
    expect(await (await status.POST(bo("michele@maven", { status: "suspended", reason: "verifica" }), idp(1))).json()).toMatchObject({ ok: true, cancelled_payout_ids: [] });
    expect((await h.sql!`SELECT status FROM affiliate_payouts`)[0].status).toBe("created");
    h.chainTo = A1;
    h.chainAmount = 60;
    const t = await txr.POST(req("/x", "POST", null, { hash: H }) as never, idp(p.id));
    expect(await t.json()).toMatchObject({ outcome: "paid" });
    expect(await (await unmark.POST(bo("michele@maven", { reason: "x" + "yz" }), idp(p.id))).json()).toMatchObject({ error: "not_created" });

    const log = await h.sql!`SELECT actor, action FROM affiliate_admin_actions ORDER BY id`;
    expect(log).toEqual([
      { actor: "bo:anna@maven", action: "wallet_screened" },
      { actor: "bo:michele@maven", action: "payout_marked_sent" },
      { actor: "bo:michele@maven", action: "affiliate_status" },
    ]);
    await expect(h.sql!`UPDATE affiliate_admin_actions SET actor = 'x'`).rejects.toThrow(/append-only/);
    await expect(h.sql!`DELETE FROM affiliate_admin_actions`).rejects.toThrow(/append-only/);
  });

  it("OPS blocked / scaduto / unmark: niente payout su indirizzo bloccato; la marca tolta riapre l'annullo", async () => {
    await payableAlice();
    h.screen = "none";
    const admin = await import("@/app/api/admin/affiliate/payouts/route");
    const screen = await import("@/app/api/admin/affiliate/wallets/[id]/screening/route");
    const mark = await import("@/app/api/admin/affiliate/payouts/[id]/mark-sent/route");
    const unmark = await import("@/app/api/admin/affiliate/payouts/[id]/unmark-sent/route");
    const cancel = await import("@/app/api/admin/affiliate/payouts/[id]/cancel/route");
    const body = { month: month(), ids: [1], expected_total: "60.00" };
    await screen.POST(bo("anna@maven", { result: "blocked", reason: "match lista sanzioni" }), idp(1));
    const rows = await (await admin.GET(req(`/x?month=${month()}`, "GET", null) as never)).json();
    expect(rows.rows[0].reasons).toContain("address_blocked");
    expect((await admin.POST(bo("anna@maven", body))).status).toBe(409);

    await screen.POST(bo("anna@maven", { result: "clear", reason: "falso positivo verificato" }), idp(1));
    await h.sql!`UPDATE affiliate_wallets SET screened_at = now() - interval '31 days'`;
    const stale = await (await admin.GET(req(`/x?month=${month()}`, "GET", null) as never)).json();
    expect(stale.rows[0].reasons).toContain("screening_stale");
    expect((await admin.POST(bo("anna@maven", body))).status).toBe(409);

    await screen.POST(bo("anna@maven", { result: "clear", reason: "ricontrollo" }), idp(1));
    expect((await admin.POST(bo("anna@maven", body))).status).toBe(200);
    await mark.POST(bo("michele@maven"), idp(1));
    expect(await (await unmark.POST(bo("michele@maven", { reason: "nessun invio partito" }), idp(1))).json()).toMatchObject({ ok: true, already: false });
    expect(await (await cancel.POST(req("/x", "POST", null, { reason: "rifare" }) as never, idp(1))).json()).toMatchObject({ ok: true });
    // Il blocco annulla un payout in preparazione non marcato.
    expect((await admin.POST(bo("anna@maven", body))).status).toBe(200);
    expect(await (await screen.POST(bo("anna@maven", { result: "blocked", reason: "nuovo match" }), idp(1))).json()).toMatchObject({ cancelled_payout_ids: [2] });
    expect((await h.sql!`SELECT status FROM affiliate_commissions`)[0].status).toBe("payable");
  });

  it("OPS (review Codex) sospeso con payout marcato: smarcare lo annulla, e non si rimarca", async () => {
    await payableAlice();
    h.screen = "none";
    const admin = await import("@/app/api/admin/affiliate/payouts/route");
    const screen = await import("@/app/api/admin/affiliate/wallets/[id]/screening/route");
    const mark = await import("@/app/api/admin/affiliate/payouts/[id]/mark-sent/route");
    const unmark = await import("@/app/api/admin/affiliate/payouts/[id]/unmark-sent/route");
    const status = await import("@/app/api/admin/affiliate/affiliates/[id]/status/route");
    await screen.POST(bo("anna@maven", { result: "clear", reason: "nessun match" }), idp(1));
    await admin.POST(bo("anna@maven", { month: month(), ids: [1], expected_total: "60.00" }));
    await mark.POST(bo("michele@maven"), idp(1));
    await status.POST(bo("anna@maven", { status: "suspended", reason: "verifica" }), idp(1));
    expect(await (await unmark.POST(bo("michele@maven", { reason: "nessun invio partito" }), idp(1))).json()).toMatchObject({ ok: true, cancelled_payout_ids: [1] });
    expect(await (await mark.POST(bo("michele@maven"), idp(1))).json()).toMatchObject({ error: "not_created" });
    expect((await h.sql!`SELECT status FROM affiliate_commissions`)[0].status).toBe("payable");
  });

  it("OPS (review indipendente) quattro occhi non aggirabili: hash solo dopo la marca, stesso operatore anche con maiuscole, cookie non decide, screening scaduto", async () => {
    await payableAlice();
    h.screen = "none";
    const admin = await import("@/app/api/admin/affiliate/payouts/route");
    const screen = await import("@/app/api/admin/affiliate/wallets/[id]/screening/route");
    const mark = await import("@/app/api/admin/affiliate/payouts/[id]/mark-sent/route");
    const unmark = await import("@/app/api/admin/affiliate/payouts/[id]/unmark-sent/route");
    const txr = await import("@/app/api/admin/affiliate/payouts/[id]/tx/route");
    const cookie = (b: unknown) => req("/x", "POST", null, b) as never;
    // P2-4: il cookie condiviso non può dichiarare «clear» (decisione sanzioni nominale); «blocked» sì.
    expect(await (await screen.POST(cookie({ result: "clear", reason: "nessun match" }), idp(1))).json()).toMatchObject({ error: "named_operators_required" });
    expect(await (await screen.POST(cookie({ result: "blocked", reason: "match da verificare" }), idp(1))).json()).toMatchObject({ ok: true });
    await screen.POST(bo("anna@maven", { result: "clear", reason: "OFAC/EU nessun match" }), idp(1));
    expect((await admin.POST(bo("anna@maven", { month: month(), ids: [1], expected_total: "60.00" }))).status).toBe(200);
    // P1-2: chi ha preparato non registra l'hash senza la marca di un secondo operatore.
    h.chainTo = A1;
    h.chainAmount = 60;
    const t = await txr.POST(req("/x", "POST", null, { hash: H }) as never, idp(1));
    expect(t.status).toBe(409);
    expect(await t.json()).toEqual({ error: "not_marked" });
    expect((await h.sql!`SELECT status, tx_hash FROM affiliate_payouts`)[0]).toEqual({ status: "created", tx_hash: null });
    // P2-3: stessa persona con maiuscole/spazi diversi; nit: «admin-cookie» dichiarato via Bearer.
    expect(await (await mark.POST(bo("Anna@Maven"), idp(1))).json()).toMatchObject({ error: "same_person" });
    expect(await (await mark.POST(bo("admin-cookie"), idp(1))).json()).toMatchObject({ error: "named_operators_required" });
    // Nit: la marca ricontrolla che la decisione manuale non sia scaduta (30 gg).
    await h.sql!`UPDATE affiliate_wallets SET screened_at = now() - interval '31 days'`;
    expect(await (await mark.POST(bo("michele@maven"), idp(1))).json()).toMatchObject({ error: "screening_stale" });
    await h.sql!`UPDATE affiliate_wallets SET screened_at = now()`;
    expect(await (await mark.POST(bo("michele@maven"), idp(1))).json()).toMatchObject({ ok: true, already: false });
    // P2-4: togliere la marca (= «nessun fondo è partito») è una dichiarazione nominale.
    expect(await (await unmark.POST(cookie({ reason: "nessun invio" }), idp(1))).json()).toMatchObject({ error: "named_operators_required" });
    expect((await h.sql!`SELECT sent_marked_by FROM affiliate_payouts`)[0].sent_marked_by).toBe("bo:michele@maven");
    expect(await (await txr.POST(req("/x", "POST", null, { hash: H }) as never, idp(1))).json()).toMatchObject({ outcome: "paid" });
  });

  it("OPS (review indipendente nit) storno con p_clawback_days NULL: errore, non finestra disattivata", async () => {
    await expect(h.sql!`SELECT affiliate_reverse_commission('paygate','p1','e1',NULL,NULL)`).rejects.toThrow(/clawback/);
  });

  it("OPS fraud_review: void annulla le commissioni ferme; valid le fa maturare; terminated è definitivo", async () => {
    await h.sql!.unsafe(`
      INSERT INTO affiliates(identifier, code, terms_version, terms_accepted_at, age_confirmed_at, onerous_ack_version, onerous_ack_at)
        VALUES ('alice@x.io','ALICE','t',now(),now(),'t',now());
      INSERT INTO affiliate_attributions(referred_identifier, affiliate_id, source, attributed_at, status, status_reason)
        VALUES ('r1@x.io',1,'signup_ref',now(),'fraud_review','shared_ip_24h'), ('r2@x.io',1,'signup_ref',now(),'fraud_review','shared_ip_24h');
      INSERT INTO affiliate_commissions(affiliate_id, referred_identifier, rail, rail_payment_ref, kind, gross_usd, net_usd, rate, amount_usd, renewal_index, status, paid_at, payable_after)
        VALUES (1,'r1@x.io','paygate','p1','first',50,50,0.2,10,0,'pending',now() - interval '70 days',now() - interval '10 days'),
               (1,'r2@x.io','paygate','p2','first',50,50,0.2,10,0,'pending',now() - interval '70 days',now() - interval '10 days');`);
    const review = await import("@/app/api/admin/affiliate/attributions/review/route");
    const status = await import("@/app/api/admin/affiliate/affiliates/[id]/status/route");
    expect(await (await review.POST(bo("anna@maven", { referred_identifier: "R1@x.io", decision: "void", reason: "stesso device" }))).json()).toMatchObject({ ok: true, voided_commissions: 1 });
    expect(await (await review.POST(bo("anna@maven", { referred_identifier: "r1@x.io", decision: "valid", reason: "ripensato" }))).json()).toMatchObject({ error: "not_in_review" });
    expect(await (await review.POST(bo("anna@maven", { referred_identifier: "r2@x.io", decision: "valid", reason: "coinquilini verificati" }))).json()).toMatchObject({ ok: true });
    expect((await h.sql!`SELECT affiliate_mature_commissions() AS r`)[0].r).toEqual({ ok: true, matured: 1 });
    expect(await h.sql!`SELECT referred_identifier AS who, status FROM affiliate_commissions ORDER BY 1`).toEqual([
      { who: "r1@x.io", status: "void" },
      { who: "r2@x.io", status: "payable" },
    ]);
    expect((await review.POST(bo("anna@maven", { referred_identifier: "nobody@x.io", decision: "void", reason: "xyz" }))).status).toBe(404);
    await status.POST(bo("anna@maven", { status: "terminated", reason: "violazione §5" }), idp(1));
    expect(await (await status.POST(bo("anna@maven", { status: "active", reason: "errore" }), idp(1))).json()).toMatchObject({ error: "terminated_is_final" });
  });

  it("OPS export + click: CSV del ledger senza formule, click contati solo per un affiliato attivo", async () => {
    await h.sql!.unsafe(`
      INSERT INTO affiliates(identifier, code, terms_version, terms_accepted_at, age_confirmed_at, onerous_ack_version, onerous_ack_at, status)
        VALUES ('alice@x.io','ALICE','t',now(),now(),'t',now(),'active'), ('sus@x.io','SUS','t',now(),now(),'t',now(),'suspended');
      INSERT INTO affiliate_commissions(affiliate_id, referred_identifier, rail, rail_payment_ref, kind, gross_usd, net_usd, rate, amount_usd, renewal_index, status, paid_at, payable_after)
        VALUES (1,'=cmd@x.io','paygate','p1','first',50,50,0.2,10,0,'pending',now(),now() + interval '60 days');`);
    vi.stubEnv("AFFILIATE_HASH_SECRET", "k".repeat(32));
    const { recordReferralClickSafe } = await import("@/lib/affiliate/clicks");
    await recordReferralClickSafe("ALICE", "1.1.1.1", "UA", "/?ref=ALICE&utm_source=ig&utm_campaign=launch");
    await recordReferralClickSafe("ALICE", "1.1.1.1", "UA", "/?ref=ALICE&utm_source=ig&utm_campaign=launch");
    await recordReferralClickSafe("SUS", "1.1.1.1", "UA", "/?ref=SUS");
    await recordReferralClickSafe("NOPE", "1.1.1.1", "UA", "/?ref=NOPE");
    const exp = await import("@/app/api/admin/affiliate/export/route");
    const get = (q: string) => exp.GET(req(`/api/admin/affiliate/export?${q}`, "GET", null) as never);
    const clicks = await (await get("kind=clicks")).json();
    expect(clicks.rows).toEqual([expect.objectContaining({ code: "ALICE", utm_source: "ig", utm_campaign: "launch", clicks: 2, unique_ip_day: 1 })]);
    const aff = await (await get("kind=affiliates&status=active")).json();
    expect(aff.rows).toEqual([expect.objectContaining({ code: "ALICE", pending_usd: 10, clicks_30d: 2 })]);
    const csv = await get("kind=commissions&format=csv&affiliate_id=1");
    expect(csv.headers.get("content-type")).toMatch(/text\/csv/);
    const text = await csv.text();
    expect(text.split("\n")[0]).toMatch(/^id,affiliate_id,code,referred_identifier/);
    expect(text).toContain(",'=cmd@x.io,");
    // Review indipendente P2-7: oltre il limite si tagliano le righe più VECCHIE, non le più recenti.
    await h.sql!.unsafe(`INSERT INTO affiliate_commissions(affiliate_id, referred_identifier, rail, rail_payment_ref, kind, gross_usd, net_usd, rate, amount_usd, renewal_index, status, paid_at, payable_after)
      VALUES (1,'b@x.io','paygate','p2','first',50,50,0.2,10,0,'pending',now(),now() + interval '60 days')`);
    expect((await (await get("kind=commissions")).json()).rows.map((r: { id: number }) => r.id)).toEqual([2, 1]);
    expect((await get("kind=nope")).status).toBe(400);
    expect((await get("kind=commissions&from=2026-13-01")).status).toBe(400);
  });

  it("RETENTION click /r/CODE: il cron cancella solo le righe oltre i 90 giorni, idempotente, niente accesso da anon", async () => {
    await h.sql!.unsafe(`
      INSERT INTO affiliates(identifier, code, terms_version, terms_accepted_at, age_confirmed_at, onerous_ack_version, onerous_ack_at, status)
        VALUES ('alice@x.io','ALICE','t',now(),now(),'t',now(),'active');
      INSERT INTO affiliate_referral_clicks(affiliate_id, clicked_at, ip_hash, landing) VALUES
        (1, now() - interval '91 days', 'h-old', '/'), (1, now() - interval '90 days 1 minute', 'h-edge', '/'),
        (1, now() - interval '89 days', 'h-keep', '/'), (1, now(), 'h-new', '/');`);
    const { GET } = await import("@/app/api/cron/affiliate-clicks-retention/route");
    // verifyBearer è mockato in testa al file: «Bearer bo» passa.
    const run = () => GET(new Request("https://x/api/cron/affiliate-clicks-retention", { headers: { authorization: "Bearer bo" } }));
    const r1 = await run();
    expect(r1.status).toBe(200);
    expect(await r1.json()).toEqual({ ok: true, purged: 2, retention_days: 90 });
    expect((await h.sql!`SELECT ip_hash FROM affiliate_referral_clicks ORDER BY id`).map((r) => r.ip_hash)).toEqual(["h-keep", "h-new"]);
    expect(await (await run()).json()).toEqual({ ok: true, purged: 0, retention_days: 90 });
    const [g] = await h.sql!`SELECT has_function_privilege('anon','public.affiliate_purge_clicks()','EXECUTE') AS anon,
                                    has_function_privilege('service_role','public.affiliate_purge_clicks()','EXECUTE') AS svc`;
    expect(g).toEqual({ anon: false, svc: true });
  });
});

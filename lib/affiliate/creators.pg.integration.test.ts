// @vitest-environment node
// #CREATOR-OFFERS-1031 (B) — mese Pro creator, coorti, KPI mensili e rollup dei
// click contro un Postgres VERO (stesso schema di pg.integration.test.ts).
// Gira solo con AFFILIATE_PG_TEST_URL (Postgres locale usa e getta): crea un
// database proprio e lo cancella alla fine, così non tocca quello della suite
// principale e le due suite possono girare in parallelo.
//   AFFILIATE_PG_TEST_URL=postgres://postgres@127.0.0.1:54331/postgres npx vitest run lib/affiliate/creators.pg.integration.test.ts
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const URL_ = process.env.AFFILIATE_PG_TEST_URL;
const DB = `creator_it_${process.pid}`;

const h = vi.hoisted(() => ({ sql: null as null | import("postgres").Sql, sent: [] as string[] }));

vi.mock("@/lib/admin-auth", () => ({
  isAdminAuthorized: async () => true,
  verifyBearer: (r: Request) => r.headers.get("authorization") === "Bearer bo",
}));
vi.mock("@/lib/notify", () => ({ sendTransactional: async (o: { to: string }) => { h.sent.push(o.to); } }));
vi.mock("@/lib/db", async () => {
  const { interpolate } = await vi.importActual<typeof import("@/lib/db")>("@/lib/db");
  const run = async (q: string, params: unknown[] = []) => {
    const rows = await h.sql!.unsafe("SELECT exec_sql($1) AS r", [interpolate(q, params)]);
    return (rows[0].r as unknown[]) ?? [];
  };
  return {
    interpolate,
    dbQuery: (q: string, params: unknown[] = []) => run(q, params).catch(() => []),
    dbQueryStrict: run,
    dbExecute: run,
    getSupabaseAdminClient: () => ({
      rpc: async (fn: string, args: Record<string, unknown>) => {
        try {
          const named = Object.entries(args).map(([k, v]) => `${k} => ${interpolate("$1", [v])}`).join(", ");
          const rows = await h.sql!.unsafe(`SELECT ${fn}(${named}) AS r`);
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
const applyAll = async () => {
  for (const f of MIGRATIONS) await h.sql!.unsafe(readFileSync(path.join(ROOT, "supabase/migrations", f), "utf8"));
};

const opHeaders = { authorization: "Bearer bo", "x-admin-actor": "andrea@maven" };
const post = (url: string, body: unknown) =>
  new Request(`https://x${url}`, { method: "POST", headers: opHeaders, body: JSON.stringify(body) }) as never;
const get = (url: string) => new Request(`https://x${url}`, { headers: opHeaders }) as never;

const profile = (identifier: string, plan: string, source: string | null, expiresSql: string) =>
  h.sql!.unsafe(`INSERT INTO profiles(identifier, plan, plan_source, plan_expires_at, language)
                 VALUES ('${identifier}', '${plan}', ${source ? `'${source}'` : "NULL"}, ${expiresSql}, 'en')`);
const prof = async (identifier: string) =>
  (await h.sql!`SELECT plan, plan_source, plan_expires_at FROM profiles WHERE identifier = ${identifier}`)[0];
const days = (d: Date) => (d.getTime() - Date.now()) / 86_400_000;

describe.skipIf(!URL_)("creator grants + KPI su Postgres vero", () => {
  beforeAll(async () => {
    const u = new URL(URL_!);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)) {
      throw new Error("Affiliate integration tests require disposable localhost Postgres");
    }
    const postgres = (await import("postgres")).default;
    const admin = postgres(URL_!, { max: 1, onnotice: () => {} });
    await admin.unsafe(`DROP DATABASE IF EXISTS ${DB}`);
    await admin.unsafe(`CREATE DATABASE ${DB}`);
    await admin.end();
    u.pathname = `/${DB}`;
    h.sql = postgres(u.toString(), { max: 4, onnotice: () => {} });
    await h.sql.unsafe(`
      DO $r$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
      END $r$;
      CREATE TABLE IF NOT EXISTS affiliate_clicks (id bigserial PRIMARY KEY, link_id uuid, book_key text, clicked_at timestamptz DEFAULT now());
      CREATE TABLE profiles (
        identifier text PRIMARY KEY, name text, referral_code text, referred_by text, language text,
        plan text NOT NULL DEFAULT 'free', requested_plan text, plan_source text, plan_expires_at timestamptz,
        updated_at timestamptz, created_at timestamptz DEFAULT now());
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
    await applyAll();
  });
  afterAll(async () => {
    await h.sql?.end();
    if (!URL_) return;
    const postgres = (await import("postgres")).default;
    const admin = postgres(URL_, { max: 1, onnotice: () => {} });
    await admin.unsafe(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`);
    await admin.end();
  });
  beforeEach(async () => {
    vi.resetModules();
    h.sent.length = 0;
    await h.sql!.unsafe(`
      TRUNCATE creator_grants, affiliate_click_months, affiliate_commissions, affiliate_attributions,
               affiliate_referral_clicks, affiliates, profiles RESTART IDENTITY CASCADE;`);
  });

  it("migration riapplicabile (idempotente)", async () => {
    await applyAll();
    expect(MIGRATIONS.some((f) => f.includes("creator_grants_kpi"))).toBe(true);
  });

  it("grant: free → premium 30 giorni, registra chi; il secondo è un no-op", async () => {
    await profile("crea@x.io", "free", null, "NULL");
    const { POST } = await import("@/app/api/admin/affiliate/creator-grants/route");
    const r1 = await POST(post("/api/admin/affiliate/creator-grants", { identifier: " Crea@X.io ", note: "IG creator" }));
    expect(r1.status).toBe(200);
    expect(await r1.json()).toMatchObject({ ok: true, already: false, identifier: "crea@x.io", previous_plan: "free" });
    const p1 = await prof("crea@x.io");
    expect(p1).toMatchObject({ plan: "premium", plan_source: "manual" });
    expect(days(p1.plan_expires_at)).toBeGreaterThan(29.99);
    expect(days(p1.plan_expires_at)).toBeLessThan(30.01);
    expect(await h.sql!`SELECT identifier, granted_by, previous_plan, note FROM creator_grants`).toEqual([
      { identifier: "crea@x.io", granted_by: "bo:andrea@maven", previous_plan: "free", note: "IG creator" },
    ]);
    expect(h.sent).toEqual(["crea@x.io"]);

    const r2 = await POST(post("/api/admin/affiliate/creator-grants", { identifier: "crea@x.io" }));
    expect(await r2.json()).toMatchObject({ ok: true, already: true });
    expect((await prof("crea@x.io")).plan_expires_at).toEqual(p1.plan_expires_at);
    expect(h.sent).toEqual(["crea@x.io"]); // nessuna seconda email
    // anche dopo la scadenza: una volta per sempre
    await h.sql!`UPDATE profiles SET plan = 'free', plan_expires_at = now() - interval '1 day'`;
    expect(await (await POST(post("/x", { identifier: "crea@x.io" }))).json()).toMatchObject({ already: true });
    expect((await prof("crea@x.io")).plan).toBe("free");
  });

  it("grant: rifiuta abbonamenti pagati attivi, admin, pending, profili inesistenti; un pagato scaduto riceve 30 giorni", async () => {
    await profile("stripe@x.io", "premium", "stripe", "now() + interval '10 days'");
    await profile("usdt@x.io", "base", "manual", "now() + interval '10 days'");
    await profile("legacy@x.io", "premium", null, "NULL");
    await profile("adm@x.io", "admin_full", null, "NULL");
    await profile("pend@x.io", "pending_payment", null, "NULL");
    await profile("old@x.io", "premium", "paygate", "now() - interval '3 days'");
    const { POST } = await import("@/app/api/admin/affiliate/creator-grants/route");
    const call = async (identifier: string) => {
      const r = await POST(post("/x", { identifier }));
      return [r.status, (await r.json()).error];
    };
    expect(await call("stripe@x.io")).toEqual([409, "paid_plan_active"]);
    expect(await call("usdt@x.io")).toEqual([409, "paid_plan_active"]);
    expect(await call("legacy@x.io")).toEqual([409, "paid_plan_active"]);
    expect(await call("adm@x.io")).toEqual([409, "admin_plan"]);
    expect(await call("pend@x.io")).toEqual([409, "pending_payment"]);
    expect(await call("nobody@x.io")).toEqual([404, "not_found"]);
    expect(await h.sql!`SELECT count(*)::int AS n FROM creator_grants`).toEqual([{ n: 0 }]);
    expect(await prof("stripe@x.io")).toMatchObject({ plan: "premium", plan_source: "stripe" });
    expect(days((await prof("stripe@x.io")).plan_expires_at)).toBeLessThan(10.01);

    expect(await call("old@x.io")).toEqual([200, undefined]);
    expect(days((await prof("old@x.io")).plan_expires_at)).toBeGreaterThan(29.99);
  });

  it("grant: un regalo referral attivo viene esteso (mai accorciato)", async () => {
    await profile("ref@x.io", "premium", "referral", "now() + interval '10 days'");
    const { grantCreatorPro } = await import("@/lib/plan-grant");
    expect(await grantCreatorPro("ref@x.io", "admin-cookie")).toMatchObject({ ok: true, already: false, previous_plan: "premium" });
    const d = days((await prof("ref@x.io")).plan_expires_at);
    expect(d).toBeGreaterThan(39.99);
    expect(d).toBeLessThan(40.01);
  });

  it("grant: due chiamate concorrenti → un solo grant", async () => {
    await profile("race@x.io", "free", null, "NULL");
    const { grantCreatorPro } = await import("@/lib/plan-grant");
    const out = await Promise.all([grantCreatorPro("race@x.io", "a1"), grantCreatorPro("race@x.io", "a2")]);
    expect(out.map((o) => (o.ok ? o.already : "err")).sort()).toEqual([false, true]);
    expect(await h.sql!`SELECT count(*)::int AS n FROM creator_grants`).toEqual([{ n: 1 }]);
  });

  it("creator_grants è append-only e chiusa ad anon", async () => {
    await profile("ao@x.io", "free", null, "NULL");
    const { grantCreatorPro } = await import("@/lib/plan-grant");
    await grantCreatorPro("ao@x.io", "admin-cookie");
    await expect(h.sql!`UPDATE creator_grants SET expires_at = now() + interval '99 days'`).rejects.toThrow(/append-only/);
    await expect(h.sql!`DELETE FROM creator_grants`).rejects.toThrow(/append-only/);
    const [g] = await h.sql!`SELECT has_table_privilege('anon','public.creator_grants','SELECT') AS t,
                                    has_table_privilege('anon','public.affiliate_creator_monthly','SELECT') AS v,
                                    has_function_privilege('anon','public.affiliate_grant_creator_pro(text,text,text)','EXECUTE') AS f`;
    expect(g).toEqual({ t: false, v: false, f: false });
  });

  it("coorte: default standard, la cambia solo l'endpoint admin, valori validati", async () => {
    await h.sql!.unsafe(`INSERT INTO affiliates(identifier, code, terms_version, terms_accepted_at, age_confirmed_at, onerous_ack_version, onerous_ack_at, status)
                         VALUES ('crea@x.io','CREA','t',now(),now(),'t',now(),'active')`);
    expect((await h.sql!`SELECT cohort FROM affiliates`)[0].cohort).toBe("standard");
    const { POST } = await import("@/app/api/admin/affiliate/affiliates/[id]/cohort/route");
    const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
    expect((await POST(post("/x", { cohort: "robot" }), ctx("1"))).status).toBe(400);
    expect((await POST(post("/x", { cohort: "creator_agent" }), ctx("9"))).status).toBe(404);
    expect(await (await POST(post("/x", { cohort: "creator_agent" }), ctx("1"))).json()).toMatchObject({ ok: true, changed: true, previous: "standard" });
    expect((await h.sql!`SELECT cohort FROM affiliates`)[0].cohort).toBe("creator_agent");
    await expect(h.sql!`UPDATE affiliates SET cohort = 'vip'`).rejects.toThrow(/check/i);
  });

  it("retention: i click cancellati diventano conteggi mensili, senza doppioni, e la vista li somma", async () => {
    await h.sql!.unsafe(`
      INSERT INTO affiliates(identifier, code, terms_version, terms_accepted_at, age_confirmed_at, onerous_ack_version, onerous_ack_at, status)
        VALUES ('crea@x.io','CREA','t',now(),now(),'t',now(),'active');
      INSERT INTO affiliate_referral_clicks(affiliate_id, clicked_at, ip_hash, landing) VALUES
        (1, '2026-01-10T10:00:00Z', 'a', '/'), (1, '2026-01-31T23:59:00Z', 'b', '/'),
        (1, '2026-02-02T00:00:00Z', 'c', '/'), (1, now(), 'live', '/');`);
    const { GET } = await import("@/app/api/cron/affiliate-clicks-retention/route");
    vi.stubEnv("CRON_SECRET", "x");
    const run = async () => (await GET(new Request("https://x/c", { headers: { authorization: "Bearer bo" } }))).json();
    expect(await run()).toEqual({ ok: true, purged: 3, retention_days: 90 });
    expect(await run()).toEqual({ ok: true, purged: 0, retention_days: 90 });
    expect(await h.sql!`SELECT affiliate_id::int, to_char(month,'YYYY-MM') AS m, clicks::int FROM affiliate_click_months ORDER BY month`).toEqual([
      { affiliate_id: 1, m: "2026-01", clicks: 2 },
      { affiliate_id: 1, m: "2026-02", clicks: 1 },
    ]);
    // nuovo giro con un altro click vecchio dello stesso mese → si somma
    await h.sql!`INSERT INTO affiliate_referral_clicks(affiliate_id, clicked_at) VALUES (1, '2026-01-15T00:00:00Z')`;
    expect(await run()).toEqual({ ok: true, purged: 1, retention_days: 90 });
    const view = await h.sql!`SELECT to_char(month,'YYYY-MM') AS m, clicks::int FROM affiliate_creator_monthly ORDER BY month`;
    expect(view.slice(0, 2)).toEqual([{ m: "2026-01", clicks: 3 }, { m: "2026-02", clicks: 1 }]);
    expect(view.at(-1)).toMatchObject({ clicks: 1 }); // il click vivo del mese corrente
    expect((await h.sql!`SELECT ip_hash FROM affiliate_referral_clicks`).map((r) => r.ip_hash)).toEqual(["live"]);
  });

  it("KPI: signup, attivati, paganti dopo gli storni, MRR, commissione, shadow; endpoint per coorte", async () => {
    await h.sql!.unsafe(`
      INSERT INTO affiliates(identifier, code, terms_version, terms_accepted_at, age_confirmed_at, onerous_ack_version, onerous_ack_at, status, cohort) VALUES
        ('h@x.io','HUMAN','t',now(),now(),'t',now(),'active','creator_human'),
        ('a@x.io','AGENT','t',now(),now(),'t',now(),'active','creator_agent'),
        ('s@x.io','STD','t',now(),now(),'t',now(),'active','standard');
      INSERT INTO affiliate_attributions(referred_identifier, affiliate_id, source, attributed_at, status) VALUES
        ('r1@x.io',1,'signup_ref', date_trunc('month', now()) + interval '1 hour','valid'),
        ('r2@x.io',1,'signup_ref', date_trunc('month', now()) + interval '2 hour','valid'),
        ('r3@x.io',1,'signup_ref', date_trunc('month', now()) + interval '3 hour','valid'),
        ('r4@x.io',1,'signup_ref', date_trunc('month', now()) + interval '4 hour','self_referral'),
        ('r5@x.io',2,'signup_ref', date_trunc('month', now()) + interval '1 hour','valid');
      INSERT INTO affiliate_commissions(affiliate_id,referred_identifier,rail,rail_payment_ref,kind,gross_usd,net_usd,rate,amount_usd,renewal_index,status,paid_at,payable_after) VALUES
        (1,'r1@x.io','crypto','p1','first',30,29,0.2,5.80,0,'pending',date_trunc('month', now()) + interval '5 hour', now()),
        (1,'r2@x.io','crypto','p2','first',30,29,0.2,5.80,0,'pending',date_trunc('month', now()) + interval '5 hour', now()),
        (1,'r3@x.io','crypto','p3','first',30,29,0.2,5.80,0,'void',   date_trunc('month', now()) + interval '5 hour', now()),
        (1,'r1@x.io','crypto','p0','renewal',30,29,0.1,2.90,1,'paid', date_trunc('month', now()) - interval '20 days', now()),
        (2,'r5@x.io','crypto','p5','first',30,29,0.2,5.80,0,'shadow', date_trunc('month', now()) + interval '5 hour', now());
      -- storno totale post-maturazione del pagamento di r2: non è più pagante
      INSERT INTO affiliate_commissions(affiliate_id,referred_identifier,rail,rail_payment_ref,rail_event_ref,kind,gross_usd,net_usd,rate,amount_usd,renewal_index,status,paid_at,payable_after,reverses_id)
        VALUES (1,'r2@x.io','crypto','p2','refund-1','reversal',-30,-29,0.2,-5.80,0,'pending',date_trunc('month', now()) + interval '6 hour', now(), 2);`);
    const cur = (await h.sql!`SELECT to_char(date_trunc('month', now() AT TIME ZONE 'UTC'),'YYYY-MM') AS m`)[0].m;
    const v = await h.sql!`SELECT code, to_char(month,'YYYY-MM') AS m, clicks::int, signups::int, activated::int, paying::int,
                                  mrr_usd::float, commission_usd::float, shadow_rows::int
                             FROM affiliate_creator_monthly WHERE to_char(month,'YYYY-MM') = ${cur} ORDER BY affiliate_id`;
    expect(v).toEqual([
      { code: "HUMAN", m: cur, clicks: 0, signups: 3, activated: 1, paying: 1, mrr_usd: 29, commission_usd: 5.8, shadow_rows: 0 },
      { code: "AGENT", m: cur, clicks: 0, signups: 1, activated: 1, paying: 1, mrr_usd: 29, commission_usd: 5.8, shadow_rows: 1 },
    ]);

    const { GET } = await import("@/app/api/admin/affiliate/creators/route");
    const human = await (await GET(get("/api/admin/affiliate/creators?cohort=creator_human&months=2"))).json();
    expect(human.creators).toHaveLength(1);
    expect(human.creators[0]).toMatchObject({ code: "HUMAN", cohort: "creator_human", identifier: "h@x.io", pro_grant_expires_at: null });
    expect(human.creators[0].months.map((m: { month: string; paying: number }) => [m.month, m.paying])).toEqual([
      [expect.any(String), 1], // mese scorso: il rinnovo di r1
      [cur, 1],
    ]);
    expect(Object.keys(human.cohorts)).toEqual(["creator_human"]);

    const all = await (await GET(get("/api/admin/affiliate/creators?months=1"))).json();
    expect(all.creators.map((c: { code: string; months: unknown[] }) => [c.code, c.months.length])).toEqual([["HUMAN", 1], ["AGENT", 1], ["STD", 0]]);
    expect(all.cohorts.creator_agent).toEqual([expect.objectContaining({ month: cur, signups: 1, shadow_rows: 1 })]);

    expect((await GET(get("/x?cohort=vip"))).status).toBe(400);
    expect((await GET(get("/x?months=0"))).status).toBe(400);
    expect((await GET(get("/x?months=25"))).status).toBe(400);
  });

  it("rollback 1102: rifiuta con righe; a tabelle vuote toglie tutto e la migration si riapplica", async () => {
    const rb = readFileSync(path.join(ROOT, "scripts/affiliate-v2/rollback_creator_grants_kpi_1102.sql"), "utf8");
    await profile("rb@x.io", "free", null, "NULL");
    const { grantCreatorPro } = await import("@/lib/plan-grant");
    await grantCreatorPro("rb@x.io", "admin-cookie");
    await expect(h.sql!.unsafe(rb)).rejects.toThrow(/rifiutato/);
    await h.sql!`TRUNCATE creator_grants`;
    await h.sql!.unsafe(rb);
    expect(await h.sql!`SELECT to_regclass('public.creator_grants') AS t, to_regclass('public.affiliate_creator_monthly') AS v`).toEqual([{ t: null, v: null }]);
    expect(await h.sql!`SELECT column_name FROM information_schema.columns WHERE table_name='affiliates' AND column_name='cohort'`).toEqual([]);
    await applyAll();
    expect(await h.sql!`SELECT to_regclass('public.creator_grants')::text AS t`).toEqual([{ t: "creator_grants" }]);
  });
});

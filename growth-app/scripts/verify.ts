// Cross-check: the snapshot's key numbers vs INDEPENDENT SQL, written apart
// from core/sql.ts (different formulation: one plain count per number, explicit
// [start, T] bounds, T = the snapshot's dbNow). Read-only transaction.
//
//   npm run verify -- --env-file ~/Desktop/agentic-markets/.env
//
// Prints a markdown table; exit code 1 on any mismatch.

import { PAID_CHANNELS, type GrowthWindow, splitPaying } from "../core/kpi";
import { normalize } from "../core/model";
import { connect } from "../data/live-source";
import { assertSnapshot } from "../data/snapshot-source";
import snapshotJson from "../data/snapshot.json";
import { readEnvKey } from "./env";

const snap = assertSnapshot(snapshotJson);
const T = snap.dbNow;
const PAID = PAID_CHANNELS.map((c) => `'${c}'`).join(",");

// Window start, computed differently from core/kpi.ts (from a literal T, not now()).
function startExpr(w: GrowthWindow): string {
  const t = `'${T}'::timestamptz`;
  if (w === "today") return `((${t} AT TIME ZONE 'Europe/Rome')::date::timestamp AT TIME ZONE 'Europe/Rome')`;
  return `(${t} - interval '${w === "7d" ? 7 : 30} days')`;
}
const between = (col: string, w: GrowthWindow) => `${col} >= ${startExpr(w)} AND ${col} <= '${T}'::timestamptz`;

interface Check {
  metric: string;
  window: GrowthWindow | "—";
  page: number | null;
  sql: string;
}

function checks(): Check[] {
  const out: Check[] = [];
  for (const w of ["today", "7d", "30d"] as GrowthWindow[]) {
    const d = normalize(w, snap.windows[w]);
    const v = <U,>(r: { ok: true; data: U } | { ok: false }, f: (x: U) => number) => (r.ok ? f(r.data) : null);
    out.push(
      { metric: "Page view", window: w, page: v(d.traffic, (t) => t.page_views), sql: `SELECT count(*) FROM events WHERE event_type='page_view' AND ${between("created_at", w)}` },
      { metric: "Sessioni (con consenso)", window: w, page: v(d.traffic, (t) => t.sessions), sql: `SELECT count(*) FROM (SELECT DISTINCT session_id FROM events WHERE event_type='page_view' AND session_id IS NOT NULL AND ${between("created_at", w)}) s` },
      { metric: "Signup avviati (eventi)", window: w, page: v(d.funnelEvents, (f) => f.signup_started), sql: `SELECT count(*) FROM events WHERE event_type='signup_started' AND ${between("created_at", w)}` },
      { metric: "Signup completati (eventi)", window: w, page: v(d.funnelEvents, (f) => f.signup_completed), sql: `SELECT count(*) FROM events WHERE event_type='signup_completed' AND ${between("created_at", w)}` },
      { metric: "Nuovi profili", window: w, page: v(d.newProfiles, (p) => p.new_profiles), sql: `SELECT count(*) FROM profiles WHERE ${between("created_at", w)}` },
      { metric: "Account attivati", window: w, page: v(d.newProfiles, (p) => p.activated), sql: `SELECT count(*) FROM profiles WHERE activated_at IS NOT NULL AND ${between("created_at", w)}` },
      { metric: "Click partner", window: w, page: v(d.funnelEvents, (f) => f.partner_click), sql: `SELECT count(*) FROM events WHERE event_type='partner_click' AND ${between("created_at", w)}` },
      { metric: "Card aperte", window: w, page: v(d.funnelEvents, (f) => f.card_open), sql: `SELECT count(*) FROM events WHERE event_type='card_open' AND ${between("created_at", w)}` },
      { metric: "Errori client", window: w, page: v(d.funnelEvents, (f) => f.client_error), sql: `SELECT count(*) FROM events WHERE event_type='client_error' AND ${between("created_at", w)}` },
      { metric: "Ordini pagati Paygate+PayPal", window: w, page: v(d.revenue, (r) => r.orders_w), sql: `SELECT (SELECT count(*) FROM paygate_orders WHERE ${between("paid_at", w)}) + (SELECT count(*) FROM paypal_orders WHERE ${between("paid_at", w)})` },
    );
  }
  const d = normalize("7d", snap.windows["7d"]);
  const pay = d.plans.ok ? splitPaying(d.plans.data) : null;
  const notExpired = `(plan_expires_at IS NULL OR plan_expires_at >= '${T}'::timestamptz)`;
  out.push(
    { metric: "Paganti verificati", window: "—", page: pay?.verified ?? null, sql: `SELECT count(*) FROM profiles WHERE plan IN ('base','premium') AND plan_source IN (${PAID}) AND ${notExpired}` },
    { metric: "Paganti incl. comp", window: "—", page: pay?.inclComp ?? null, sql: `SELECT count(*) FROM profiles WHERE plan IN ('base','premium')` },
    { metric: "Comp / manuali / senza fonte", window: "—", page: pay?.comp ?? null, sql: `SELECT count(*) FROM profiles WHERE plan IN ('base','premium') AND (plan_source IS NULL OR plan_source NOT IN (${PAID}))` },
    { metric: "Free", window: "—", page: pay?.free ?? null, sql: `SELECT count(*) FROM profiles WHERE plan = 'free'` },
    { metric: "Account team (admin_full)", window: "—", page: pay?.team ?? null, sql: `SELECT count(*) FROM profiles WHERE plan = 'admin_full'` },
    { metric: "Incassato Paygate+PayPal totale (cent USD)", window: "—", page: d.revenue.ok ? Math.round(d.revenue.data.usd_all * 100) : null, sql: `SELECT round(100 * ((SELECT coalesce(sum(amount_usd),0) FROM paygate_orders WHERE paid_at IS NOT NULL) + (SELECT coalesce(sum(amount_usd),0) FROM paypal_orders WHERE paid_at IS NOT NULL)))` },
    { metric: "Ordini pagati totali", window: "—", page: d.revenue.ok ? d.revenue.data.orders_all : null, sql: `SELECT (SELECT count(*) FROM paygate_orders WHERE paid_at IS NOT NULL) + (SELECT count(*) FROM paypal_orders WHERE paid_at IS NOT NULL)` },
    { metric: "Ordini Shopify pagati totali", window: "—", page: d.shopify.ok ? d.shopify.data.orders_all : null, sql: `SELECT count(*) FROM shopify_events WHERE event_type = 'orders/paid'` },
    { metric: "Brier servito ×10⁴ (arrotondato)", window: "—", page: d.calibration.ok && d.calibration.data.brier !== null ? Math.round(d.calibration.data.brier * 1e4) : null,
      // Direct per-row formula instead of the CROSS JOIN of core/sql.ts.
      sql: `SELECT round(1e4 * avg((p_home - (result='home')::int)^2 + (p_draw - (result='draw')::int)^2 + (p_away - (result='away')::int)^2)) FROM (SELECT p_home, p_draw, p_away, result FROM prediction_log WHERE result IN ('home','draw','away') ORDER BY settled_at DESC LIMIT 20000) r` },
  );
  return out;
}

async function main() {
  const url = readEnvKey("DATABASE_URL");
  if (!url) throw new Error("DATABASE_URL non trovata (env o --env-file)");
  const sql = connect(url);
  let bad = 0;
  try {
    const list = checks();
    const got = await sql.begin("read only", async (tx) => {
      const vals: number[] = [];
      for (const c of list) {
        const [row] = await tx.unsafe(c.sql);
        vals.push(Number(Object.values(row)[0]));
      }
      return vals;
    });
    console.log(`Snapshot dbNow: ${T}\n`);
    console.log("| Metrica | Finestra | Pagina (snapshot) | SQL indipendente | Esito |");
    console.log("|---|---|---:|---:|---|");
    list.forEach((c, i) => {
      const ok = c.page !== null && c.page === got[i];
      if (!ok) bad++;
      console.log(`| ${c.metric} | ${c.window} | ${c.page ?? "n/d"} | ${got[i]} | ${ok ? "OK" : "DIVERSO"} |`);
    });
    console.log(`\n${list.length - bad}/${list.length} uguali`);
  } finally {
    await sql.end();
  }
  if (bad) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

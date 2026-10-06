// Cross-check: the snapshot's key numbers vs INDEPENDENT SQL, written apart
// from core/sql.ts (different formulation: one plain count per number, explicit
// [start, T] bounds, T = the snapshot's dbNow). Read-only transaction.
//
//   npm run verify -- --env-file ~/Desktop/agentic-markets/.env
//
// Prints a markdown table; exit code 1 on any mismatch.

import { chainTotals, normalizeChain } from "../core/channels";
import {
  BURST_MIN,
  BURST_SLOT_SECONDS,
  type EntryMeta,
  type HumanEstimate,
  NO_COUNTRY_SPIKE_SHARE,
  NO_SESSION_COUNTRIES,
  classifyBuckets,
  entryLabel,
  foldInternal,
  noCountrySpike,
  splitEntries,
} from "../core/estimate";
import { PAID_CHANNELS, type GrowthWindow, splitPaying } from "../core/kpi";
import { normalize } from "../core/model";
import { coarsenLabel } from "../core/privacy";
import { ANOMALY_BASELINE_DAYS, ANOMALY_SIGMA, SERIES_METRICS, type SeriesMetric, anomalies, compare, normalizeSeries } from "../core/series";
import { SERIES_HISTORY_DAYS } from "../core/sql";
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
const HAS_SOURCE = ["utm_source", "src", "crm", "ref", "ref_host"].map((k) => `coalesce(meta->>'${k}', '') <> ''`).join(" OR ");
const HAS_KEY_NO_HOST = ["utm_source", "src", "crm", "ref"].map((k) => `coalesce(meta->>'${k}', '') <> ''`).join(" OR ");
const LISTED_SQL = NO_SESSION_COUNTRIES.map((c) => `'${c}'`).join(",");

interface Check {
  metric: string;
  window: GrowthWindow | "—";
  page: number | null;
  sql: string;
}

function checks(): Check[] {
  const out: Check[] = [];
  for (const w of ["today", "7d", "30d"] as GrowthWindow[]) {
    const d = normalize(w, snap.windows[w], { asOf: T, series: snap.series, chain: snap.chain?.[w] });
    const v = <U,>(r: { ok: true; data: U } | { ok: false }, f: (x: U) => number) => (r.ok ? f(r.data) : null);
    out.push(
      { metric: "Page view", window: w, page: v(d.traffic, (t) => t.page_views), sql: `SELECT count(*) FROM events WHERE event_type='page_view' AND ${between("created_at", w)}` },
      { metric: "Sessioni (con consenso)", window: w, page: v(d.traffic, (t) => t.sessions), sql: `SELECT count(*) FROM (SELECT DISTINCT session_id FROM events WHERE event_type='page_view' AND session_id IS NOT NULL AND ${between("created_at", w)}) s` },
      { metric: "Signup avviati (eventi)", window: w, page: v(d.funnelEvents, (f) => f.signup_started), sql: `SELECT count(*) FROM events WHERE event_type='signup_started' AND ${between("created_at", w)}` },
      { metric: "Signup completati (eventi)", window: w, page: v(d.funnelEvents, (f) => f.signup_completed), sql: `SELECT count(*) FROM events WHERE event_type='signup_completed' AND ${between("created_at", w)}` },
      { metric: "Nuovi profili", window: w, page: v(d.newProfiles, (p) => p.new_profiles), sql: `SELECT count(*) FROM profiles WHERE ${between("created_at", w)}` },
      // count(col) counts non-NULL values: a different formulation from FILTER (WHERE … IS NOT NULL).
      { metric: "Signup completati (profili dal form)", window: w, page: v(d.newProfiles, (p) => p.signups), sql: `SELECT count(tos_accepted_at) FROM profiles WHERE ${between("created_at", w)}` },
      { metric: "Ordini Shopify pagati", window: w, page: v(d.shopify, (s) => s.orders_w), sql: `SELECT count(DISTINCT event_id) FROM shopify_events WHERE event_type='orders/paid' AND ${between("processed_at", w)}` },
      { metric: "Rimborsi Shopify", window: w, page: v(d.shopify, (s) => s.refunds_w), sql: `SELECT count(DISTINCT event_id) FROM shopify_events WHERE event_type='refunds/create' AND ${between("processed_at", w)}` },
      { metric: "Account attivati", window: w, page: v(d.newProfiles, (p) => p.activated), sql: `SELECT count(*) FROM profiles WHERE activated_at IS NOT NULL AND ${between("created_at", w)}` },
      { metric: "Click partner", window: w, page: v(d.funnelEvents, (f) => f.partner_click), sql: `SELECT count(*) FROM events WHERE event_type='partner_click' AND ${between("created_at", w)}` },
      { metric: "Card aperte", window: w, page: v(d.funnelEvents, (f) => f.card_open), sql: `SELECT count(*) FROM events WHERE event_type='card_open' AND ${between("created_at", w)}` },
      { metric: "Errori client", window: w, page: v(d.funnelEvents, (f) => f.client_error), sql: `SELECT count(*) FROM events WHERE event_type='client_error' AND ${between("created_at", w)}` },
      { metric: "Ordini pagati Paygate+PayPal", window: w, page: v(d.revenue, (r) => r.orders_w), sql: `SELECT (SELECT count(*) FROM paygate_orders WHERE ${between("paid_at", w)}) + (SELECT count(*) FROM paypal_orders WHERE ${between("paid_at", w)})` },
      // v4 — entries: a key-by-key OR instead of the coalesce chain of core/sql.ts.
      { metric: "Ingressi con fonte (Σ)", window: w, page: v(d.entries, (rows) => rows.reduce((s, r) => s + r.entries, 0)), sql: `SELECT count(*) FROM events WHERE event_type='page_view' AND ${between("created_at", w)} AND (${HAS_SOURCE})` },
      { metric: "Page view senza fonte", window: w, page: d.entries.ok && d.traffic.ok ? d.traffic.data.page_views - d.entries.data.reduce((s, r) => s + r.entries, 0) : null, sql: `SELECT count(*) FROM events WHERE event_type='page_view' AND ${between("created_at", w)} AND NOT (${HAS_SOURCE})` },
      // v4 — the estimate's simplest class, as a plain count.
      { metric: "Stima: esclusi senza paese", window: w, page: v(d.humanTraffic, (h) => h.excl_no_country), sql: `SELECT count(*) FROM events WHERE event_type='page_view' AND ${between("created_at", w)} AND coalesce(country, '') = ''` },
      // v5 — spike flag (share without country > threshold), computed in SQL with integer arithmetic.
      { metric: `Avviso picco senza paese (>${NO_COUNTRY_SPIKE_SHARE * 100}%) 1=sì`, window: w, page: v(d.humanTraffic, (h) => (noCountrySpike(h.excl_no_country, h.page_views).spike ? 1 : 0)),
        sql: `SELECT (count(*) FILTER (WHERE coalesce(country, '') = '') * 10 > ${NO_COUNTRY_SPIKE_SHARE * 10} * count(*))::int FROM events WHERE event_type='page_view' AND ${between("created_at", w)}` },
      // v5 — internal entries: a regex on the raw host, only when no utm/src/crm/ref (not foldInternal()).
      { metric: "Ingressi interni (esclusi)", window: w, page: v(d.entries, (rows) => splitEntries(rows).internal),
        sql: `SELECT count(*) FROM events WHERE event_type='page_view' AND ${between("created_at", w)} AND NOT (${HAS_KEY_NO_HOST})
          AND (lower(meta->>'ref_host') ~ '^betredge-studio[^.]*[.]([^.]+[.])*chatgpt[.]site$' OR lower(meta->>'ref_host') ~ '^betredge[^.]*[.]vercel[.]app$')` },
      { metric: "Ingressi con fonte esterna (Σ, interni esclusi)", window: w, page: v(d.entries, (rows) => splitEntries(rows).external.reduce((s, r) => s + r.entries, 0)),
        sql: `SELECT count(*) FROM events WHERE event_type='page_view' AND ${between("created_at", w)} AND (${HAS_SOURCE})
          AND NOT (NOT (${HAS_KEY_NO_HOST}) AND (lower(meta->>'ref_host') ~ '^betredge-studio[^.]*[.]([^.]+[.])*chatgpt[.]site$' OR lower(meta->>'ref_host') ~ '^betredge[^.]*[.]vercel[.]app$'))` },
      { metric: "Aperture menu partner", window: w, page: v(d.funnelEvents, (f) => f.partner_menu_open), sql: `SELECT count(*) FROM events WHERE event_type='partner_menu_open' AND ${between("created_at", w)}` },
    );
  }
  const d = normalize("7d", snap.windows["7d"], { asOf: T, series: snap.series, chain: snap.chain?.["7d"] });
  const pay = d.plans.ok ? splitPaying(d.plans.data) : null;
  const notExpired = `(plan_expires_at IS NULL OR plan_expires_at >= '${T}'::timestamptz)`;
  out.push(
    { metric: "Paganti verificati", window: "—", page: pay?.verified ?? null, sql: `SELECT count(*) FROM profiles WHERE plan IN ('base','premium') AND plan_source IN (${PAID}) AND ${notExpired}` },
    { metric: "Paganti incl. comp", window: "—", page: pay?.inclComp ?? null, sql: `SELECT count(*) FROM profiles WHERE plan IN ('base','premium')` },
    { metric: "Comp / manuali / senza fonte", window: "—", page: pay?.comp ?? null, sql: `SELECT count(*) FROM profiles WHERE plan IN ('base','premium') AND (plan_source IS NULL OR plan_source NOT IN (${PAID}))` },
    { metric: "Scaduti non ancora declassati", window: "—", page: pay?.expiredNotSwept ?? null, sql: `SELECT count(*) FROM profiles WHERE plan IN ('base','premium') AND plan_source IN (${PAID}) AND plan_expires_at < '${T}'::timestamptz` },
    { metric: "Free", window: "—", page: pay?.free ?? null, sql: `SELECT count(*) FROM profiles WHERE plan = 'free'` },
    { metric: "Account team (admin_full)", window: "—", page: pay?.team ?? null, sql: `SELECT count(*) FROM profiles WHERE plan = 'admin_full'` },
    { metric: "Incassato Paygate+PayPal totale (cent USD)", window: "—", page: d.revenue.ok ? Math.round(d.revenue.data.usd_all * 100) : null, sql: `SELECT round(100 * ((SELECT coalesce(sum(amount_usd),0) FROM paygate_orders WHERE paid_at IS NOT NULL) + (SELECT coalesce(sum(amount_usd),0) FROM paypal_orders WHERE paid_at IS NOT NULL)))` },
    { metric: "Ordini pagati totali", window: "—", page: d.revenue.ok ? d.revenue.data.orders_all : null, sql: `SELECT (SELECT count(*) FROM paygate_orders WHERE paid_at IS NOT NULL) + (SELECT count(*) FROM paypal_orders WHERE paid_at IS NOT NULL)` },
    { metric: "Ordini Shopify pagati totali", window: "—", page: d.shopify.ok ? d.shopify.data.orders_all : null, sql: `SELECT count(*) FROM shopify_events WHERE event_type = 'orders/paid'` },
    { metric: "Rimborsi Shopify totali", window: "—", page: d.shopify.ok ? d.shopify.data.refunds_all : null, sql: `SELECT count(*) FROM shopify_events WHERE event_type = 'refunds/create' AND processed_at <= '${T}'::timestamptz` },
    { metric: "Brier servito ×10⁴ (arrotondato)", window: "—", page: d.calibration.ok && d.calibration.data.brier !== null ? Math.round(d.calibration.data.brier * 1e4) : null,
      // Direct per-row formula instead of the CROSS JOIN of core/sql.ts.
      sql: `SELECT round(1e4 * avg((p_home - (result='home')::int)^2 + (p_draw - (result='draw')::int)^2 + (p_away - (result='away')::int)^2)) FROM (SELECT p_home, p_draw, p_away, result FROM prediction_log WHERE result IN ('home','draw','away') ORDER BY settled_at DESC LIMIT 20000) r` },
  );
  return out;
}

// ─── Filone A: series, comparisons, anomalies, source chain ──────────────────
// Independent formulation: day = date(timezone('Europe/Rome', ts)); day bounds
// from integer date arithmetic on T's Rome date (core uses date_trunc − interval
// and JS calendar math); anomalies via SQL window functions (core: TS loop).

const ROME_T = `('${T}'::timestamptz AT TIME ZONE 'Europe/Rome')::date`;
const romeMidnight = (dayOffset: number) => `timezone('Europe/Rome', (${ROME_T} - ${dayOffset})::timestamp)`;
const dayRange = (col: string, fromAgo: number, toAgo: number) => `${col} >= ${romeMidnight(fromAgo)} AND ${col} < ${romeMidnight(toAgo)}`;
const dayOf = (col: string) => `date(timezone('Europe/Rome', ${col}))`;

/** Per Rome day (only days with data), over [fromAgo, toAgo) days before T's Rome day. */
function dailySql(m: SeriesMetric, fromAgo = SERIES_HISTORY_DAYS, toAgo = 0): string {
  const r = (col: string) => dayRange(col, fromAgo, toAgo);
  const ev = (type: string) => `SELECT ${dayOf("created_at")} AS day, count(*) AS n FROM events WHERE event_type='${type}' AND ${r("created_at")} GROUP BY 1`;
  switch (m) {
    case "page_views": return ev("page_view");
    case "signup_started": return ev("signup_started");
    case "signup_completed": return ev("signup_completed");
    case "partner_click": return ev("partner_click");
    case "client_error": return ev("client_error");
    case "sessions":
      return `SELECT day, count(*) AS n FROM (SELECT DISTINCT ${dayOf("created_at")} AS day, session_id FROM events WHERE event_type='page_view' AND session_id IS NOT NULL AND ${r("created_at")}) x GROUP BY 1`;
    case "new_profiles":
      return `SELECT ${dayOf("created_at")} AS day, count(*) AS n FROM profiles WHERE ${r("created_at")} GROUP BY 1`;
    case "paid_orders":
      return `SELECT day, count(*) AS n FROM (
        SELECT ${dayOf("paid_at")} AS day FROM paygate_orders WHERE paid_at IS NOT NULL AND ${r("paid_at")}
        UNION ALL SELECT ${dayOf("paid_at")} FROM paypal_orders WHERE paid_at IS NOT NULL AND ${r("paid_at")}
        UNION ALL SELECT ${dayOf("processed_at")} FROM shopify_events WHERE event_type='orders/paid' AND ${r("processed_at")}) o GROUP BY 1`;
    case "page_views_no_country":
      return `SELECT ${dayOf("created_at")} AS day, count(*) AS n FROM events WHERE event_type='page_view' AND coalesce(country, '') = '' AND ${r("created_at")} GROUP BY 1`;
    case "probably_human":
      // GROUP BY bucket (country, date_bin slot) instead of the window function of core/sql.ts;
      // the day of a bucket is the day of its first row (a mismatch would show if a slot crossed midnight).
      return `SELECT day, sum(h) AS n FROM (
        SELECT ${dayOf("min(created_at)")} AS day,
          sum((session_id IS NOT NULL)::int)
          + CASE WHEN country IN (${LISTED_SQL}) OR sum((session_id IS NULL)::int) >= ${BURST_MIN} THEN 0 ELSE sum((session_id IS NULL)::int) END AS h
        FROM events WHERE event_type='page_view' AND coalesce(country, '') <> '' AND ${r("created_at")}
        GROUP BY country, date_bin('${BURST_SLOT_SECONDS} seconds', created_at, timestamptz '1970-01-01 00:00:00+00')) b GROUP BY 1`;
  }
}

/** Period total as one plain count with timestamp bounds (no per-day grouping, except sessions-per-day). */
function periodSql(m: SeriesMetric, fromAgo: number, toAgo: number): string {
  const r = (col: string) => dayRange(col, fromAgo, toAgo);
  const ev = (type: string) => `SELECT count(*) FROM events WHERE event_type='${type}' AND ${r("created_at")}`;
  switch (m) {
    case "page_views": return ev("page_view");
    case "signup_started": return ev("signup_started");
    case "signup_completed": return ev("signup_completed");
    case "partner_click": return ev("partner_click");
    case "client_error": return ev("client_error");
    case "sessions":
      return `SELECT count(DISTINCT (${dayOf("created_at")}, session_id)) FROM events WHERE event_type='page_view' AND session_id IS NOT NULL AND ${r("created_at")}`;
    case "new_profiles": return `SELECT count(*) FROM profiles WHERE ${r("created_at")}`;
    case "page_views_no_country":
      return `SELECT count(*) FROM events WHERE event_type='page_view' AND coalesce(country, '') = '' AND ${r("created_at")}`;
    case "probably_human":
      return `SELECT coalesce(sum(n), 0) FROM (${dailySql(m, fromAgo, toAgo)}) x`;
    case "paid_orders":
      return `SELECT (SELECT count(*) FROM paygate_orders WHERE paid_at IS NOT NULL AND ${r("paid_at")})
        + (SELECT count(*) FROM paypal_orders WHERE paid_at IS NOT NULL AND ${r("paid_at")})
        + (SELECT count(*) FROM shopify_events WHERE event_type='orders/paid' AND ${r("processed_at")})`;
  }
}

/** Anomaly count among the last n days, with window functions over a dense day grid. */
function anomalySql(m: SeriesMetric, n: number): string {
  return `WITH g AS (SELECT (${ROME_T} - k) AS day FROM generate_series(1, ${SERIES_HISTORY_DAYS}) k),
      v AS (SELECT g.day, coalesce(x.n, 0)::float AS n FROM g LEFT JOIN (${dailySql(m)}) x ON x.day = g.day),
      f AS (SELECT min(day) FILTER (WHERE n > 0) AS first FROM v),
      z AS (SELECT day, n, avg(n) OVER w AS mu, stddev_samp(n) OVER w AS sd, count(*) OVER w AS c FROM v
            WINDOW w AS (ORDER BY day ROWS BETWEEN ${ANOMALY_BASELINE_DAYS} PRECEDING AND 1 PRECEDING))
    SELECT count(*) FROM z, f
    WHERE z.c = ${ANOMALY_BASELINE_DAYS} AND z.day >= f.first + ${ANOMALY_BASELINE_DAYS} AND z.day >= ${ROME_T} - ${n}
      AND z.sd > 0 AND abs(z.n - z.mu) > ${ANOMALY_SIGMA} * z.sd`;
}

const trends = snap.series ? normalizeSeries(snap.series, T) : null;

function extraChecks(): Check[] {
  const out: Check[] = [];
  if (!trends) return out;
  for (const n of [7, 30]) {
    const w: GrowthWindow = n === 7 ? "7d" : "30d";
    for (const m of SERIES_METRICS) {
      const v = trends.values[m.key];
      const c = v ? compare(v, n) : null;
      out.push(
        { metric: `${m.label} — periodo (${n}g interi)`, window: w, page: c?.current ?? null, sql: periodSql(m.key, n, 0) },
        { metric: `${m.label} — periodo precedente`, window: w, page: c?.previous ?? null, sql: periodSql(m.key, 2 * n, n) },
        { metric: `${m.label} — n. anomalie`, window: w, page: v ? anomalies(v, trends.days, n).length : null, sql: anomalySql(m.key, n) },
      );
    }
  }
  for (const w of ["today", "7d", "30d"] as GrowthWindow[]) {
    const ch = snap.chain?.[w] ? normalizeChain(snap.chain[w]) : null;
    const t = ch?.ok ? chainTotals(ch.data) : null;
    out.push(
      { metric: "Catena: Σ sessioni", window: w, page: t?.sessions ?? null, sql: `SELECT count(DISTINCT session_id) FROM events WHERE event_type='page_view' AND ${between("created_at", w)}` },
      { metric: "Catena: Σ signup avviati", window: w, page: t?.signup_started ?? null, sql: `SELECT count(*) FROM events WHERE event_type='signup_started' AND ${between("created_at", w)}` },
      { metric: "Catena: Σ signup completati", window: w, page: t?.signup_completed ?? null, sql: `SELECT count(*) FROM events WHERE event_type='signup_completed' AND ${between("created_at", w)}` },
      { metric: "Catena: Σ profili", window: w, page: t?.profiles ?? null, sql: `SELECT count(*) FROM profiles WHERE ${between("created_at", w)}` },
      { metric: "Catena: Σ paganti", window: w, page: t?.paying ?? null, sql: `SELECT count(*) FROM profiles WHERE ${between("created_at", w)} AND plan IN ('base','premium') AND plan_source = ANY(ARRAY[${PAID}]) AND NOT coalesce(plan_expires_at < '${T}'::timestamptz, false)` },
      { metric: "Catena: profili senza attribuzione", window: w, page: t?.profilesUnattributed ?? null, sql: `SELECT count(*) FROM profiles WHERE acquisition IS NULL AND ${between("created_at", w)}` },
    );
  }
  return out;
}

type Tx = Parameters<Parameters<ReturnType<typeof connect>["begin"]>[1]>[0];

/** Every day of every series, and every cell of every chain row. Returns the number of mismatches. */
async function bulkChecks(tx: Tx): Promise<number> {
  let bad = 0;
  console.log("\n| Controllo per cella | Finestra | Celle | Uguali | Divergenze |");
  console.log("|---|---|---:|---:|---|");
  if (!trends) {
    console.log("| Serie giornaliere | — | 0 | 0 | SNAPSHOT SENZA SERIE |");
    return 1;
  }
  for (const m of SERIES_METRICS) {
    const rows = await tx.unsafe(`SELECT to_char(day, 'YYYY-MM-DD') AS d, n::int AS n FROM (${dailySql(m.key)}) x`);
    const sqlByDay = new Map(rows.map((r) => [String(r.d), Number(r.n)]));
    const v = trends.values[m.key];
    const diffs = trends.days.filter((d, i) => v === null || v[i] !== (sqlByDay.get(d) ?? 0));
    const extra = [...sqlByDay.keys()].filter((d) => !trends.days.includes(d));
    bad += diffs.length + extra.length;
    const list = [...diffs, ...extra.map((d) => `${d} (fuori lista)`)];
    console.log(`| Serie «${m.label}», ogni giorno | ${trends.days[0]} → ${trends.days.at(-1)} | ${trends.days.length} | ${trends.days.length - diffs.length} | ${list.length ? list.slice(0, 5).join(", ") : "0"} |`);
  }

  // Chain, per source label: an independent row-level formulation, then the
  // same privacy coarsening as the page (core/privacy.ts defines the label).
  const COLS = ["sessions", "signup_started", "signup_completed", "profiles", "paying"] as const;
  for (const w of ["today", "7d", "30d"] as GrowthWindow[]) {
    const lbl = `CASE WHEN coalesce(meta->>'utm_source','') <> '' THEN meta->>'utm_source'
      WHEN coalesce(meta->>'src','') <> '' THEN 'src:' || (meta->>'src')
      WHEN coalesce(meta->>'crm','') <> '' THEN 'crm:' || (meta->>'crm')
      WHEN coalesce(meta->>'ref','') <> '' THEN 'ref:' || (meta->>'ref')
      WHEN coalesce(meta->>'ref_host','') <> '' THEN 'referrer:' || (meta->>'ref_host') END`;
    const sess = `SELECT session_id, max(${lbl}) AS l FROM events WHERE event_type='page_view' AND session_id IS NOT NULL AND ${between("created_at", w)} GROUP BY session_id`;
    const q1 = `SELECT coalesce(l, '(diretto / nessuna fonte)') AS source, count(*)::int AS sessions FROM (${sess}) s GROUP BY 1`;
    const q2 = `SELECT CASE WHEN e.session_id IS NULL THEN '(signup senza sessione)'
          WHEN s.session_id IS NULL THEN '(sessione senza page_view nella finestra)'
          ELSE coalesce(s.l, '(diretto / nessuna fonte)') END AS source,
        sum((e.event_type='signup_started')::int)::int AS signup_started,
        sum((e.event_type='signup_completed')::int)::int AS signup_completed
      FROM events e LEFT JOIN (${sess}) s ON s.session_id = e.session_id
      WHERE e.event_type IN ('signup_started','signup_completed') AND ${between("e.created_at", w)} GROUP BY 1`;
    const q3 = `SELECT CASE WHEN acquisition IS NULL THEN '(non registrata)'
          WHEN coalesce(acquisition->>'utm_source','') <> '' THEN acquisition->>'utm_source'
          WHEN substring(acquisition->>'referrer' from '://([^/]+)') IS NOT NULL THEN 'referrer:' || substring(acquisition->>'referrer' from '://([^/]+)')
          ELSE '(diretto / nessuna fonte)' END AS source,
        count(*)::int AS profiles,
        sum((plan IN ('base','premium') AND plan_source = ANY(ARRAY[${PAID}]) AND NOT coalesce(plan_expires_at < '${T}'::timestamptz, false))::int)::int AS paying
      FROM profiles WHERE ${between("created_at", w)} GROUP BY 1`;
    const sqlRows = new Map<string, Record<string, number>>();
    for (const q of [q1, q2, q3]) {
      for (const r of await tx.unsafe(q)) {
        const k = coarsenLabel(String(r.source));
        const acc = sqlRows.get(k) ?? Object.fromEntries(COLS.map((c) => [c, 0]));
        for (const c of COLS) if (r[c] !== undefined) acc[c] += Number(r[c]);
        sqlRows.set(k, acc);
      }
    }
    const ch = snap.chain?.[w] ? normalizeChain(snap.chain[w]) : null;
    const page = new Map((ch?.ok ? ch.data : []).map((r) => [r.source, r]));
    const labels = new Set([...sqlRows.keys(), ...page.keys()]);
    const diffs: string[] = [];
    for (const l of labels) {
      for (const c of COLS) {
        const a = page.get(l)?.[c] ?? 0;
        const b = sqlRows.get(l)?.[c] ?? 0;
        if (a !== b) diffs.push(`${l}.${c} ${a}≠${b}`);
      }
    }
    if (!ch?.ok) diffs.unshift("catena assente nello snapshot");
    bad += diffs.length;
    const cells = labels.size * COLS.length;
    console.log(`| Catena per fonte (${labels.size} fonti × ${COLS.length} colonne) | ${w} | ${cells} | ${cells - diffs.length} | ${diffs.length ? diffs.slice(0, 5).join(", ") : "0"} |`);
  }
  bad += await v4Checks(tx);
  return bad;
}

/**
 * v4: the STIMATO filter recomputed in TypeScript (core/estimate.ts
 * classifyBuckets) from page views grouped by country and date_bin slot — the
 * page computes it with window functions in SQL. Entries per source: grouped
 * by the raw meta keys, labelled with entryLabel() + the page's privacy rule.
 */
async function v4Checks(tx: Tx): Promise<number> {
  let bad = 0;
  for (const w of ["today", "7d", "30d"] as GrowthWindow[]) {
    const d = normalize(w, snap.windows[w], { asOf: T, series: snap.series, chain: snap.chain?.[w] });
    const buckets = await tx.unsafe(`SELECT country,
        (extract(epoch FROM date_bin('${BURST_SLOT_SECONDS} seconds', created_at, timestamptz '1970-01-01 00:00:00+00')) / ${BURST_SLOT_SECONDS})::bigint AS slot,
        sum((session_id IS NULL)::int)::int AS no_s, sum((session_id IS NOT NULL)::int)::int AS with_s
      FROM events WHERE event_type='page_view' AND ${between("created_at", w)} GROUP BY 1, 2`);
    const ref: HumanEstimate = classifyBuckets(
      buckets.map((r) => ({ country: r.country === null ? null : String(r.country), slot: Number(r.slot), noSession: Number(r.no_s), withSession: Number(r.with_s) })),
    );
    const fields = Object.keys(ref) as (keyof HumanEstimate)[];
    const got = d.humanTraffic.ok ? d.humanTraffic.data : null;
    const diffs = got ? fields.filter((f) => got[f] !== ref[f]).map((f) => `${f} ${got[f]}≠${ref[f]}`) : fields.map((f) => `${f} assente`);
    bad += diffs.length;
    console.log(`| Stima «probabilmente umani»: ${fields.map((f) => `${f}=${ref[f]}`).join(" ")} | ${w} | ${fields.length} | ${fields.length - diffs.length} | ${diffs.length ? diffs.join(", ") : "0"} |`);

    const keyRows = await tx.unsafe(`SELECT meta->>'utm_source' AS utm_source, meta->>'src' AS src, meta->>'crm' AS crm, meta->>'ref' AS ref, meta->>'ref_host' AS ref_host, count(*)::int AS n
      FROM events WHERE event_type='page_view' AND ${between("created_at", w)} GROUP BY 1, 2, 3, 4, 5`);
    const sqlBy = new Map<string, number>();
    for (const r of keyRows) {
      const l = entryLabel(r as EntryMeta);
      if (l === null) continue;
      const k = coarsenLabel(foldInternal(l));
      sqlBy.set(k, (sqlBy.get(k) ?? 0) + Number(r.n));
    }
    const page = new Map((d.entries.ok ? d.entries.data : []).map((r) => [r.source, r.entries]));
    const labels = new Set([...sqlBy.keys(), ...page.keys()]);
    const ed = [...labels].filter((l) => (page.get(l) ?? 0) !== (sqlBy.get(l) ?? 0)).map((l) => `${l} ${page.get(l) ?? 0}≠${sqlBy.get(l) ?? 0}`);
    if (!d.entries.ok) ed.unshift("ingressi assenti nello snapshot");
    bad += ed.length;
    console.log(`| Ingressi per fonte (${labels.size} fonti) | ${w} | ${labels.size} | ${labels.size - ed.length} | ${ed.length ? ed.slice(0, 5).join(", ") : "0"} |`);
  }
  return bad;
}

async function main() {
  const url = readEnvKey("DATABASE_URL");
  if (!url) throw new Error("DATABASE_URL non trovata (env o --env-file)");
  const sql = connect(url);
  let bad = 0;
  try {
    const list = [...checks(), ...extraChecks()];
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
    const bulkBad = await sql.begin("read only", (tx) => bulkChecks(tx));
    console.log(`\nControlli per cella: ${bulkBad} divergenze`);
    bad += bulkBad;
  } finally {
    await sql.end();
  }
  if (bad) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

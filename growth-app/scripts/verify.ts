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
  splitFolded,
} from "../core/estimate";
import { PAID_CHANNELS, type GrowthWindow, splitPaying } from "../core/kpi";
import { normalize } from "../core/model";
import { coarsenLabel } from "../core/privacy";
import { type ForecastRow, calibrationOf, dedupErrors, lastBeforeKickoff } from "../core/quality";
import { ANOMALY_BASELINE_DAYS, ANOMALY_SIGMA, SERIES_METRICS, type SeriesMetric, anomalies, compare, normalizeSeries } from "../core/series";
import { CLIENT_ERROR_DEDUP_SECONDS, SERIES_HISTORY_DAYS } from "../core/sql";
import { INTERNAL } from "../data/internal";
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
const LISTED_SQL = NO_SESSION_COUNTRIES.map((c) => `'${c}'`).join(",");

// ─── v7: independent formulations of the internal/test rules ─────────────────
// The page excludes by the id lists of content/internal-accounts.json (= ANY(array)).
// Here: IN (text list) for profiles, and orders re-linked to internal profiles
// through the buyer identifier (inside SQL only, never selected) + the test-price
// rule, so a stale or wrong order list shows up as DIVERSO.
const inIds = (col: string, ids: string[]) => (ids.length ? `${col}::text IN (${ids.map((i) => `'${i}'`).join(",")})` : "false");
const INTERNAL_PROFILE = (a: string) => inIds(`${a}.id`, INTERNAL.accounts);
const MIN_PRICE = 14.99;
/** An order (alias o, with identifier/amount_usd) that belongs to no internal profile and is not a test price. */
const EXTERNAL_ORDER = (o: string, priced = true) =>
  `NOT EXISTS (SELECT 1 FROM profiles ip WHERE ip.identifier = ${o}.identifier AND ${INTERNAL_PROFILE("ip")})${priced ? ` AND NOT coalesce(${o}.amount_usd < ${MIN_PRICE}, false)` : ""}`;
/** The profile (alias p) has a paid order recorded anywhere (Stripe: a subscription id). */
const HAS_PAID_ORDER = (p: string) => `(EXISTS (SELECT 1 FROM paygate_orders o WHERE o.identifier = ${p}.identifier AND o.paid_at IS NOT NULL)
  OR EXISTS (SELECT 1 FROM paypal_orders o WHERE o.identifier = ${p}.identifier AND o.paid_at IS NOT NULL)
  OR EXISTS (SELECT 1 FROM shopify_events s WHERE s.identifier = ${p}.identifier AND s.event_type = 'orders/paid')
  OR (${p}.plan_source = 'stripe' AND ${p}.stripe_subscription_id IS NOT NULL))`;
const EXTERNAL_PAYING = (p: string) =>
  `${p}.plan IN ('base','premium') AND ${p}.plan_source IN (${PAID}) AND (${p}.plan_expires_at IS NULL OR ${p}.plan_expires_at >= '${T}'::timestamptz) AND NOT ${INTERNAL_PROFILE(p)} AND ${HAS_PAID_ORDER(p)}`;
// Internal/test source label, as a regex on the label string (core/estimate.ts uses list lookups + JS regexes).
const INTERNAL_LABEL_RE = String.raw`^((src:|crm:)?(pr-check|test123|qa|3dcoldmail)|referrer:(localhost|127[.][0-9]+[.][0-9]+[.][0-9]+|betredge-studio[^.]*[.]([^.]+[.])*chatgpt[.]site|betredge[^.]*[.]vercel[.]app)(:[0-9]+)?[.]?)$`;
const isInternalLabelSql = (l: string) => `coalesce(${l}, '') ~* '${INTERNAL_LABEL_RE}'`;
/** Entry/session label from the raw meta keys, same precedence as the page, written as CASE. */
const LABEL_CASE = `CASE WHEN coalesce(meta->>'utm_source','') <> '' THEN meta->>'utm_source'
      WHEN coalesce(meta->>'src','') <> '' THEN 'src:' || (meta->>'src')
      WHEN coalesce(meta->>'crm','') <> '' THEN 'crm:' || (meta->>'crm')
      WHEN coalesce(meta->>'ref','') <> '' THEN 'ref:' || (meta->>'ref')
      WHEN coalesce(meta->>'ref_host','') <> '' THEN 'referrer:' || (meta->>'ref_host') END`;
/** A client_error (alias e) that repeats an identical one at most 5 s earlier, inside [from, T]. */
const DUP_ERROR = (e: string, from: string) => `EXISTS (SELECT 1 FROM events d WHERE d.event_type = 'client_error'
    AND d.session_id IS NOT DISTINCT FROM ${e}.session_id AND d.meta->>'message' IS NOT DISTINCT FROM ${e}.meta->>'message'
    AND d.meta->>'digest' IS NOT DISTINCT FROM ${e}.meta->>'digest' AND d.meta->>'path' IS NOT DISTINCT FROM ${e}.meta->>'path'
    AND d.created_at >= ${from} AND (d.created_at < ${e}.created_at OR (d.created_at = ${e}.created_at AND d.id < ${e}.id))
    AND d.created_at >= ${e}.created_at - interval '${CLIENT_ERROR_DEDUP_SECONDS} seconds')`;

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
      { metric: "Errori client (eventi grezzi)", window: w, page: v(d.funnelEvents, (f) => f.client_error), sql: `SELECT count(*) FROM events WHERE event_type='client_error' AND ${between("created_at", w)}` },
      // v7 — dedup as NOT EXISTS of an identical error ≤ 5 s before (the page uses lag()).
      { metric: "Errori client (deduplicati 5 s)", window: w, page: v(d.funnelEvents, (f) => f.client_error_dedup),
        sql: `SELECT count(*) FROM events e WHERE e.event_type='client_error' AND ${between("e.created_at", w)} AND NOT ${DUP_ERROR("e", startExpr(w))}` },
      // v7 — only signup_started without session (v6 summed signup_completed too: 57 instead of 49).
      { metric: "Signup avviati senza sessione", window: w, page: v(d.funnelEvents, (f) => f.signup_started_no_session), sql: `SELECT count(*) - count(session_id) FROM events WHERE event_type='signup_started' AND ${between("created_at", w)}` },
      { metric: "Card aperte con sessione", window: w, page: v(d.funnelEvents, (f) => f.card_open_with_session), sql: `SELECT count(session_id) FROM events WHERE event_type='card_open' AND ${between("created_at", w)}` },
      { metric: "Sessioni con card aperte", window: w, page: v(d.funnelEvents, (f) => f.card_open_sessions), sql: `SELECT count(*) FROM (SELECT DISTINCT session_id FROM events WHERE event_type='card_open' AND session_id IS NOT NULL AND ${between("created_at", w)}) s` },
      // v7 — external orders: re-linked to internal profiles by identifier + test price (the page uses the order-id list).
      { metric: "Ordini esterni pagati Paygate+PayPal", window: w, page: v(d.revenue, (r) => r.orders_w),
        sql: `SELECT (SELECT count(*) FROM paygate_orders o WHERE ${between("o.paid_at", w)} AND ${EXTERNAL_ORDER("o")}) + (SELECT count(*) FROM paypal_orders o WHERE ${between("o.paid_at", w)} AND ${EXTERNAL_ORDER("o")})` },
      { metric: "Ordini interni/test pagati Paygate+PayPal", window: w, page: v(d.revenue, (r) => r.internal_orders_w),
        sql: `SELECT (SELECT count(*) FROM paygate_orders o WHERE ${between("o.paid_at", w)} AND NOT (${EXTERNAL_ORDER("o")})) + (SELECT count(*) FROM paypal_orders o WHERE ${between("o.paid_at", w)} AND NOT (${EXTERNAL_ORDER("o")}))` },
      { metric: "Incassato esterno (cent USD)", window: w, page: v(d.revenue, (r) => Math.round(r.usd_w * 100)),
        sql: `SELECT round(100 * ((SELECT coalesce(sum(amount_usd),0) FROM paygate_orders o WHERE ${between("o.paid_at", w)} AND ${EXTERNAL_ORDER("o")}) + (SELECT coalesce(sum(amount_usd),0) FROM paypal_orders o WHERE ${between("o.paid_at", w)} AND ${EXTERNAL_ORDER("o")})))` },
      // v7 — the internal/test fold: a regex on the label string (the page: list lookup + JS regexes in foldInternal).
      { metric: "Ingressi interni/test (esclusi)", window: w, page: v(d.entries, (rows) => splitEntries(rows).internal),
        sql: `SELECT count(*) FROM (SELECT ${LABEL_CASE} AS l FROM events WHERE event_type='page_view' AND ${between("created_at", w)}) x WHERE ${isInternalLabelSql("l")}` },
      { metric: "Sessioni per fonte: interni/test (esclusi)", window: w, page: v(d.sources, (rows) => splitFolded(rows, (r) => r.source, (r) => r.sessions).internal),
        sql: `SELECT count(*) FROM (SELECT session_id, max(${LABEL_CASE}) AS l FROM events WHERE event_type='page_view' AND session_id IS NOT NULL AND ${between("created_at", w)} GROUP BY 1) s WHERE ${isInternalLabelSql("l")}` },
      { metric: "Sessioni per fonte: Σ esterne", window: w, page: v(d.sources, (rows) => splitFolded(rows, (r) => r.source, (r) => r.sessions).external.reduce((s, r) => s + r.sessions, 0)),
        sql: `SELECT count(*) FROM (SELECT session_id, max(${LABEL_CASE}) AS l FROM events WHERE event_type='page_view' AND session_id IS NOT NULL AND ${between("created_at", w)} GROUP BY 1) s WHERE NOT ${isInternalLabelSql("l")}` },
      { metric: "Nuovi signup per canale: interni/test (esclusi)", window: w, page: v(d.channels, (rows) => splitFolded(rows, (r) => r.channel, (r) => r.n).internal),
        sql: `SELECT count(*) FROM profiles WHERE ${between("created_at", w)} AND acquisition IS NOT NULL AND ${isInternalLabelSql(`CASE WHEN coalesce(acquisition->>'utm_source','') <> '' THEN acquisition->>'utm_source' ELSE 'referrer:' || substring(acquisition->>'referrer' from '://([^/]+)') END`)}` },
      { metric: "Abbonamenti pagati scaduti (esterni)", window: w, page: v(d.lapsed, (l) => l.lapsed),
        sql: `SELECT count(*) FROM profiles p WHERE p.plan_source IN (${PAID}) AND NOT ${INTERNAL_PROFILE("p")} AND p.plan_expires_at >= ${startExpr(w)} AND p.plan_expires_at < '${T}'::timestamptz` },
      { metric: "Ordini pagati Paygate+PayPal (tutti, interni inclusi)", window: w, page: v(d.revenue, (r) => r.orders_w + r.internal_orders_w), sql: `SELECT (SELECT count(*) FROM paygate_orders WHERE ${between("paid_at", w)}) + (SELECT count(*) FROM paypal_orders WHERE ${between("paid_at", w)})` },
      // v4 — entries: a key-by-key OR instead of the coalesce chain of core/sql.ts.
      { metric: "Ingressi con fonte (Σ)", window: w, page: v(d.entries, (rows) => rows.reduce((s, r) => s + r.entries, 0)), sql: `SELECT count(*) FROM events WHERE event_type='page_view' AND ${between("created_at", w)} AND (${HAS_SOURCE})` },
      { metric: "Page view senza fonte", window: w, page: d.entries.ok && d.traffic.ok ? d.traffic.data.page_views - d.entries.data.reduce((s, r) => s + r.entries, 0) : null, sql: `SELECT count(*) FROM events WHERE event_type='page_view' AND ${between("created_at", w)} AND NOT (${HAS_SOURCE})` },
      // v4 — the estimate's simplest class, as a plain count.
      { metric: "Stima: esclusi senza paese", window: w, page: v(d.humanTraffic, (h) => h.excl_no_country), sql: `SELECT count(*) FROM events WHERE event_type='page_view' AND ${between("created_at", w)} AND coalesce(country, '') = ''` },
      // v5 — spike flag (share without country > threshold), computed in SQL with integer arithmetic.
      { metric: `Avviso picco senza paese (>${NO_COUNTRY_SPIKE_SHARE * 100}%) 1=sì`, window: w, page: v(d.humanTraffic, (h) => (noCountrySpike(h.excl_no_country, h.page_views).spike ? 1 : 0)),
        sql: `SELECT (count(*) FILTER (WHERE coalesce(country, '') = '') * 10 > ${NO_COUNTRY_SPIKE_SHARE * 10} * count(*))::int FROM events WHERE event_type='page_view' AND ${between("created_at", w)}` },
      { metric: "Ingressi con fonte esterna (Σ, interni/test esclusi)", window: w, page: v(d.entries, (rows) => splitEntries(rows).external.reduce((s, r) => s + r.entries, 0)),
        sql: `SELECT count(*) FROM (SELECT ${LABEL_CASE} AS l FROM events WHERE event_type='page_view' AND ${between("created_at", w)}) x WHERE l IS NOT NULL AND NOT ${isInternalLabelSql("l")}` },
      { metric: "Aperture menu partner", window: w, page: v(d.funnelEvents, (f) => f.partner_menu_open), sql: `SELECT count(*) FROM events WHERE event_type='partner_menu_open' AND ${between("created_at", w)}` },
    );
  }
  const d = normalize("7d", snap.windows["7d"], { asOf: T, series: snap.series, chain: snap.chain?.["7d"] });
  const pay = d.plans.ok ? splitPaying(d.plans.data) : null;
  const notExpired = `(plan_expires_at IS NULL OR plan_expires_at >= '${T}'::timestamptz)`;
  const PLAN_ROW = `plan IN ('base','premium','admin_full')`;
  const rev = d.revenue.ok ? d.revenue.data : null;
  const cal = d.calibration.ok ? d.calibration.data : null;
  const r6 = (x: number | null | undefined) => (x === null || x === undefined ? null : Math.round(x * 1e6));
  out.push(
    // v7 — «Clienti esterni paganti»: the payment is re-checked by joining the orders on the identifier (the page uses the id lists).
    { metric: "Clienti esterni paganti", window: "—", page: pay?.external ?? null, sql: `SELECT count(*) FROM profiles p WHERE ${EXTERNAL_PAYING("p")}` },
    { metric: "Esterni con piano a pagamento senza ordine pagato", window: "—", page: pay?.externalNoPayment ?? null,
      sql: `SELECT count(*) FROM profiles p WHERE p.plan IN ('base','premium') AND p.plan_source IN (${PAID}) AND ${notExpired.replace(/plan_expires_at/g, "p.plan_expires_at")} AND NOT ${INTERNAL_PROFILE("p")} AND NOT ${HAS_PAID_ORDER("p")}` },
    { metric: "Account interni/test con piano", window: "—", page: pay?.internalWithPlan ?? null, sql: `SELECT count(*) FROM profiles p WHERE p.${PLAN_ROW} AND ${INTERNAL_PROFILE("p")}` },
    { metric: "…di cui admin_full", window: "—", page: pay?.internalAdminFull ?? null, sql: `SELECT count(*) FROM profiles p WHERE p.plan = 'admin_full' AND ${INTERNAL_PROFILE("p")}` },
    { metric: "Base/premium in tutto", window: "—", page: pay?.inclComp ?? null, sql: `SELECT count(*) FROM profiles WHERE plan IN ('base','premium')` },
    { metric: "Comp esterni / manuali / senza fonte", window: "—", page: pay?.comp ?? null, sql: `SELECT count(*) FROM profiles p WHERE p.plan IN ('base','premium') AND (p.plan_source IS NULL OR p.plan_source NOT IN (${PAID})) AND NOT ${INTERNAL_PROFILE("p")}` },
    { metric: "Scaduti esterni non ancora declassati", window: "—", page: pay?.expiredNotSwept ?? null, sql: `SELECT count(*) FROM profiles p WHERE p.plan IN ('base','premium') AND p.plan_source IN (${PAID}) AND p.plan_expires_at < '${T}'::timestamptz AND NOT ${INTERNAL_PROFILE("p")}` },
    { metric: "Free", window: "—", page: pay?.free ?? null, sql: `SELECT count(*) FROM profiles WHERE plan = 'free'` },
    { metric: "Free interni/test", window: "—", page: pay?.freeInternal ?? null, sql: `SELECT count(*) FROM profiles p WHERE p.plan = 'free' AND ${INTERNAL_PROFILE("p")}` },
    { metric: "Account team (admin_full)", window: "—", page: pay?.team ?? null, sql: `SELECT count(*) FROM profiles WHERE plan = 'admin_full'` },
    { metric: "Incassato esterno totale (cent USD)", window: "—", page: rev ? Math.round(rev.usd_all * 100) : null,
      sql: `SELECT round(100 * ((SELECT coalesce(sum(amount_usd),0) FROM paygate_orders o WHERE o.paid_at IS NOT NULL AND ${EXTERNAL_ORDER("o")}) + (SELECT coalesce(sum(amount_usd),0) FROM paypal_orders o WHERE o.paid_at IS NOT NULL AND ${EXTERNAL_ORDER("o")})))` },
    { metric: "Cassa interna/test totale (cent USD)", window: "—", page: rev ? Math.round(rev.internal_usd_all * 100) : null,
      sql: `SELECT round(100 * ((SELECT coalesce(sum(amount_usd),0) FROM paygate_orders o WHERE o.paid_at IS NOT NULL AND NOT (${EXTERNAL_ORDER("o")})) + (SELECT coalesce(sum(amount_usd),0) FROM paypal_orders o WHERE o.paid_at IS NOT NULL AND NOT (${EXTERNAL_ORDER("o")}))))` },
    { metric: "Ordini esterni pagati totali", window: "—", page: rev?.orders_all ?? null,
      sql: `SELECT (SELECT count(*) FROM paygate_orders o WHERE o.paid_at IS NOT NULL AND ${EXTERNAL_ORDER("o")}) + (SELECT count(*) FROM paypal_orders o WHERE o.paid_at IS NOT NULL AND ${EXTERNAL_ORDER("o")})` },
    { metric: "Ordini interni/test pagati totali", window: "—", page: rev?.internal_orders_all ?? null,
      sql: `SELECT (SELECT count(*) FROM paygate_orders o WHERE o.paid_at IS NOT NULL AND NOT (${EXTERNAL_ORDER("o")})) + (SELECT count(*) FROM paypal_orders o WHERE o.paid_at IS NOT NULL AND NOT (${EXTERNAL_ORDER("o")}))` },
    { metric: "Ordini esterni annuali", window: "—", page: rev?.annual_all ?? null,
      sql: `SELECT (SELECT count(*) FROM paygate_orders o WHERE o.paid_at IS NOT NULL AND o.period = 'annual' AND ${EXTERNAL_ORDER("o")}) + (SELECT count(*) FROM paypal_orders o WHERE o.paid_at IS NOT NULL AND o.period = 'annual' AND ${EXTERNAL_ORDER("o")})` },
    { metric: "Accessi esterni concessi senza pagamento", window: "—", page: rev?.granted_unpaid ?? null,
      sql: `SELECT (SELECT count(*) FROM paygate_orders o WHERE o.granted_at IS NOT NULL AND o.paid_at IS NULL AND ${EXTERNAL_ORDER("o")}) + (SELECT count(*) FROM paypal_orders o WHERE o.granted_at IS NOT NULL AND o.paid_at IS NULL AND ${EXTERNAL_ORDER("o")})` },
    { metric: "Accessi interni/test concessi senza pagamento", window: "—", page: rev?.internal_granted_unpaid ?? null,
      sql: `SELECT (SELECT count(*) FROM paygate_orders o WHERE o.granted_at IS NOT NULL AND o.paid_at IS NULL AND NOT (${EXTERNAL_ORDER("o")})) + (SELECT count(*) FROM paypal_orders o WHERE o.granted_at IS NOT NULL AND o.paid_at IS NULL AND NOT (${EXTERNAL_ORDER("o")}))` },
    { metric: "Ordini Shopify esterni pagati totali", window: "—", page: d.shopify.ok ? d.shopify.data.orders_all : null, sql: `SELECT count(*) FROM shopify_events o WHERE o.event_type = 'orders/paid' AND ${EXTERNAL_ORDER("o", false)}` },
    { metric: "Ordini Shopify interni/test", window: "—", page: d.shopify.ok ? d.shopify.data.internal_orders_all : null, sql: `SELECT count(*) FROM shopify_events o WHERE o.event_type = 'orders/paid' AND NOT (${EXTERNAL_ORDER("o", false)})` },
    { metric: "Rimborsi Shopify totali", window: "—", page: d.shopify.ok ? d.shopify.data.refunds_all : null, sql: `SELECT count(*) FROM shopify_events WHERE event_type = 'refunds/create' AND processed_at <= '${T}'::timestamptz` },
    // v7 — Brier per match with row_number() (the page: DISTINCT ON), settled and computed up to T.
    ...(["matches", "market_matches"] as const).map((k) => ({
      metric: `Calibrazione: ${k === "matches" ? "partite" : "partite con mercato"}`, window: "—" as const, page: cal ? cal[k] : null,
      sql: `${PER_MATCH} SELECT count(*) FROM last ${k === "market_matches" ? "WHERE market_p_home IS NOT NULL AND market_p_draw IS NOT NULL AND market_p_away IS NOT NULL" : ""}`,
    })),
    { metric: "Brier per partita ×10⁶", window: "—", page: r6(cal?.brier), sql: `${PER_MATCH} SELECT round(1e6 * avg(${BRIER3("p")})) FROM last` },
    { metric: "Brier modello sulle partite col mercato ×10⁶", window: "—", page: r6(cal?.brier_same), sql: `${PER_MATCH} SELECT round(1e6 * avg(${BRIER3("p")})) FROM last WHERE ${HAS_MARKET}` },
    { metric: "Brier mercato stesse partite ×10⁶", window: "—", page: r6(cal?.brier_market), sql: `${PER_MATCH} SELECT round(1e6 * avg(${BRIER3("market_p")})) FROM last WHERE ${HAS_MARKET}` },
  );
  return out;
}

const HAS_MARKET = "market_p_home IS NOT NULL AND market_p_draw IS NOT NULL AND market_p_away IS NOT NULL";
const BRIER3 = (pre: string) => `power(${pre}_home - CASE WHEN result = 'home' THEN 1 ELSE 0 END, 2) + power(${pre}_draw - CASE WHEN result = 'draw' THEN 1 ELSE 0 END, 2) + power(${pre}_away - CASE WHEN result = 'away' THEN 1 ELSE 0 END, 2)`;
/** One forecast per match: the latest computed before kick-off, by row_number(); settled and computed by T. */
const PER_MATCH = `WITH ranked AS (
    SELECT *, row_number() OVER (PARTITION BY match_id ORDER BY computed_at DESC, id DESC) AS rn
    FROM prediction_log WHERE result IN ('home','draw','away') AND computed_at < kickoff AND settled_at <= '${T}'::timestamptz),
  last AS (SELECT * FROM ranked WHERE rn = 1)`;

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
    case "client_error":
      // v7: deduplicated, the previous identical error looked up from the start of the series (as the page).
      return `SELECT ${dayOf("e.created_at")} AS day, count(*) AS n FROM events e WHERE e.event_type='client_error' AND ${r("e.created_at")}
        AND NOT ${DUP_ERROR("e", romeMidnight(SERIES_HISTORY_DAYS))} GROUP BY 1`;
    case "sessions":
      return `SELECT day, count(*) AS n FROM (SELECT DISTINCT ${dayOf("created_at")} AS day, session_id FROM events WHERE event_type='page_view' AND session_id IS NOT NULL AND ${r("created_at")}) x GROUP BY 1`;
    case "new_profiles":
      return `SELECT ${dayOf("created_at")} AS day, count(*) AS n FROM profiles WHERE ${r("created_at")} GROUP BY 1`;
    case "paid_orders":
      // v7: orders of internal/test accounts excluded (re-linked by identifier + test price).
      return `SELECT day, count(*) AS n FROM (
        SELECT ${dayOf("paid_at")} AS day FROM paygate_orders o WHERE paid_at IS NOT NULL AND ${r("paid_at")} AND ${EXTERNAL_ORDER("o")}
        UNION ALL SELECT ${dayOf("paid_at")} FROM paypal_orders o WHERE paid_at IS NOT NULL AND ${r("paid_at")} AND ${EXTERNAL_ORDER("o")}
        UNION ALL SELECT ${dayOf("processed_at")} FROM shopify_events o WHERE event_type='orders/paid' AND ${r("processed_at")} AND ${EXTERNAL_ORDER("o", false)}) o GROUP BY 1`;
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
    case "client_error":
      return `SELECT count(*) FROM events e WHERE e.event_type='client_error' AND ${r("e.created_at")} AND NOT ${DUP_ERROR("e", romeMidnight(SERIES_HISTORY_DAYS))}`;
    case "sessions":
      return `SELECT count(DISTINCT (${dayOf("created_at")}, session_id)) FROM events WHERE event_type='page_view' AND session_id IS NOT NULL AND ${r("created_at")}`;
    case "new_profiles": return `SELECT count(*) FROM profiles WHERE ${r("created_at")}`;
    case "page_views_no_country":
      return `SELECT count(*) FROM events WHERE event_type='page_view' AND coalesce(country, '') = '' AND ${r("created_at")}`;
    case "probably_human":
      return `SELECT coalesce(sum(n), 0) FROM (${dailySql(m, fromAgo, toAgo)}) x`;
    case "paid_orders":
      return `SELECT (SELECT count(*) FROM paygate_orders o WHERE paid_at IS NOT NULL AND ${r("paid_at")} AND ${EXTERNAL_ORDER("o")})
        + (SELECT count(*) FROM paypal_orders o WHERE paid_at IS NOT NULL AND ${r("paid_at")} AND ${EXTERNAL_ORDER("o")})
        + (SELECT count(*) FROM shopify_events o WHERE event_type='orders/paid' AND ${r("processed_at")} AND ${EXTERNAL_ORDER("o", false)})`;
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
    // v7 — totals WITHOUT the internal/test row; the internal row checked on its own.
    const sess = `SELECT session_id, max(${LABEL_CASE}) AS l FROM events WHERE event_type='page_view' AND session_id IS NOT NULL AND ${between("created_at", w)} GROUP BY 1`;
    const internalSess = `SELECT session_id FROM (${sess}) s WHERE ${isInternalLabelSql("l")}`;
    const profLabel = `CASE WHEN acquisition IS NULL THEN NULL WHEN coalesce(acquisition->>'utm_source','') <> '' THEN acquisition->>'utm_source' ELSE 'referrer:' || substring(acquisition->>'referrer' from '://([^/]+)') END`;
    const sig = (type: string, internal: boolean) =>
      `SELECT count(*) FROM events e WHERE e.event_type='${type}' AND ${between("e.created_at", w)} AND ${internal ? "" : "NOT "}coalesce(e.session_id IN (${internalSess}), false)`;
    out.push(
      { metric: "Catena: Σ sessioni (esterne)", window: w, page: t?.sessions ?? null, sql: `SELECT count(*) FROM (${sess}) s WHERE NOT ${isInternalLabelSql("l")}` },
      { metric: "Catena: Σ signup avviati (esterni)", window: w, page: t?.signup_started ?? null, sql: sig("signup_started", false) },
      { metric: "Catena: Σ signup completati (esterni)", window: w, page: t?.signup_completed ?? null, sql: sig("signup_completed", false) },
      { metric: "Catena: Σ profili (esterni)", window: w, page: t?.profiles ?? null, sql: `SELECT count(*) FROM profiles WHERE ${between("created_at", w)} AND NOT ${isInternalLabelSql(profLabel)}` },
      { metric: "Catena: Σ paganti esterni (oggi)", window: w, page: t?.paying ?? null, sql: `SELECT count(*) FROM profiles p WHERE ${between("p.created_at", w)} AND ${EXTERNAL_PAYING("p")} AND NOT ${isInternalLabelSql(profLabel.replace(/acquisition/g, "p.acquisition"))}` },
      { metric: "Catena: profili senza attribuzione", window: w, page: t?.profilesUnattributed ?? null, sql: `SELECT count(*) FROM profiles WHERE acquisition IS NULL AND ${between("created_at", w)}` },
      { metric: "Catena: sessioni interne/test (escluse)", window: w, page: t ? (t.internal?.sessions ?? 0) : null, sql: `SELECT count(*) FROM (${internalSess}) x` },
      { metric: "Catena: signup avviati in sessioni interne/test", window: w, page: t ? (t.internal?.signup_started ?? 0) : null, sql: sig("signup_started", true) },
      { metric: "Catena: profili con fonte interna/test", window: w, page: t ? (t.internal?.profiles ?? 0) : null, sql: `SELECT count(*) FROM profiles WHERE ${between("created_at", w)} AND ${isInternalLabelSql(profLabel)}` },
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
        sum((${EXTERNAL_PAYING("p")})::int)::int AS paying
      FROM profiles p WHERE ${between("created_at", w)} GROUP BY 1`;
    const sqlRows = new Map<string, Record<string, number>>();
    for (const q of [q1, q2, q3]) {
      for (const r of await tx.unsafe(q)) {
        // The page's label rules (fold, then privacy); the counts are this file's own SQL.
        const k = coarsenLabel(foldInternal(String(r.source)));
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
  bad += await v7Checks(tx);
  return bad;
}

/**
 * v7: the two quality rules recomputed in TypeScript (core/quality.ts) from the
 * raw rows — the page computes them in SQL with lag() and DISTINCT ON.
 */
async function v7Checks(tx: Tx): Promise<number> {
  let bad = 0;
  for (const w of ["today", "7d", "30d"] as GrowthWindow[]) {
    const d = normalize(w, snap.windows[w], { asOf: T, series: snap.series, chain: snap.chain?.[w] });
    const rows = await tx.unsafe(`SELECT id::int AS id, extract(epoch FROM created_at) * 1000 AS t, session_id, meta->>'message' AS message, meta->>'digest' AS digest, meta->>'path' AS path
      FROM events WHERE event_type='client_error' AND ${between("created_at", w)}`);
    const ref = dedupErrors(rows.map((r) => ({ id: Number(r.id), t: Number(r.t), session: r.session_id as string | null, message: r.message as string | null, digest: r.digest as string | null, path: r.path as string | null })));
    const page = d.funnelEvents.ok ? d.funnelEvents.data.client_error_dedup : null;
    const ok = page === ref.length;
    if (!ok) bad++;
    console.log(`| Errori client deduplicati, ricalcolo TS (core/quality.ts) su ${rows.length} righe | ${w} | 1 | ${ok ? 1 : 0} | ${ok ? "0" : `${page}≠${ref.length}`} |`);
  }
  const pl = await tx.unsafe(`SELECT id::bigint AS id, match_id, extract(epoch FROM computed_at) * 1000 AS c, extract(epoch FROM kickoff) * 1000 AS k,
      p_home, p_draw, p_away, market_p_home, market_p_draw, market_p_away, result
    FROM prediction_log WHERE result IN ('home','draw','away') AND settled_at <= '${T}'::timestamptz`);
  const fr: ForecastRow[] = pl.map((r) => ({
    id: Number(r.id),
    match_id: String(r.match_id),
    computed_at: Number(r.c),
    kickoff: r.k === null ? NaN : Number(r.k),
    p: [Number(r.p_home), Number(r.p_draw), Number(r.p_away)],
    market: r.market_p_home === null || r.market_p_draw === null || r.market_p_away === null ? null : [Number(r.market_p_home), Number(r.market_p_draw), Number(r.market_p_away)],
    result: r.result as ForecastRow["result"],
  }));
  const ref = calibrationOf(lastBeforeKickoff(fr));
  const got = snap.windows["7d"].calibration.ok ? normalize("7d", snap.windows["7d"], { asOf: T, series: snap.series, chain: snap.chain?.["7d"] }).calibration : null;
  const g = got?.ok ? got.data : null;
  const keys = ["matches", "brier", "ece", "market_matches", "brier_same", "brier_market"] as const;
  const r6 = (x: number | null | undefined) => (x === null || x === undefined ? null : Math.round(x * 1e6));
  const diffs = keys.filter((k) => !g || r6(g[k]) !== r6(ref[k])).map((k) => `${k} ${g ? g[k] : "assente"}≠${ref[k]}`);
  bad += diffs.length;
  console.log(`| Calibrazione per partita, ricalcolo TS su ${fr.length} righe: ${keys.map((k) => `${k}=${typeof ref[k] === "number" && !Number.isInteger(ref[k]) ? (ref[k] as number).toFixed(6) : ref[k]}`).join(" ")} | — | ${keys.length} | ${keys.length - diffs.length} | ${diffs.length ? diffs.join(", ") : "0"} |`);
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

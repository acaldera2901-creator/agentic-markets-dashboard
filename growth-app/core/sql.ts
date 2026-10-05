// Read-only aggregate SQL — the same queries as PR #516 (lib/growth/queries.ts),
// kept as pure strings so any adapter (live DB, snapshot generator, a future
// CRM backend) runs exactly the same definitions.
//
// Rules: SELECT only, aggregates only, no personal data (no identifier / name /
// email / profile id is selected). The window start comes from windowStartSql(),
// a closed set of constants — nothing user-supplied is interpolated.

import { BURST_MIN, BURST_SLOT_SECONDS, NO_SESSION_COUNTRIES } from "./estimate";
import { PAID_CHANNELS, type GrowthWindow, windowStartSql } from "./kpi";

const PAID_SQL_LIST = PAID_CHANNELS.map((c) => `'${c}'`).join(",");
const NO_SESSION_COUNTRIES_SQL = NO_SESSION_COUNTRIES.map((c) => `'${c}'`).join(",");

// Widget hosts that are our own previews/dev, not a partner site.
const WIDGET_PREVIEW_HOST_RE = String.raw`(^$|^localhost$|^127\.|\.vercel\.app$)`;

/** Queries that must return exactly one row (zero rows = read failure). */
export const SCALAR_KEYS = ["traffic", "funnelEvents", "newProfiles", "revenue", "shopify", "lapsed", "freshness", "calibration", "humanTraffic"] as const;
/** Queries that return a list (zero rows = genuinely nothing). */
export const LIST_KEYS = ["sources", "channels", "plans", "partners", "widget", "entries"] as const;
export type QueryKey = (typeof SCALAR_KEYS)[number] | (typeof LIST_KEYS)[number];

export function buildSql(w: GrowthWindow): Record<QueryKey, string> {
  const W = windowStartSql(w);
  return {
    traffic: `SELECT count(*)::int AS page_views,
        count(*) FILTER (WHERE session_id IS NULL)::int AS page_views_no_session,
        count(DISTINCT session_id)::int AS sessions,
        count(DISTINCT session_id) FILTER (WHERE meta->>'path' ~ '^(/[a-z]{2})?/tools')::int AS tools_sessions,
        count(DISTINCT session_id) FILTER (WHERE meta->>'path' ~ '^(/[a-z]{2})?/predictions')::int AS predictions_sessions
      FROM events WHERE event_type = 'page_view' AND created_at >= ${W}`,

    // One source per session: the landing page_view carries the utm/ref keys,
    // the following page_views of the same session carry none.
    sources: `SELECT coalesce(src, '(nessuna fonte)') AS source, count(*)::int AS sessions FROM (
        SELECT session_id, max(coalesce(
          nullif(meta->>'utm_source', ''),
          'src:' || nullif(meta->>'src', ''),
          'crm:' || nullif(meta->>'crm', ''),
          'ref:' || nullif(meta->>'ref', ''),
          'referrer:' || nullif(meta->>'ref_host', ''))) AS src
        FROM events
        WHERE event_type = 'page_view' AND session_id IS NOT NULL AND created_at >= ${W}
        GROUP BY session_id) s
      GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 15`,

    // Entry page views WITH a source: the tracker puts utm/src/crm/ref/ref_host
    // only on the landing page_view, consent or not. Counts pages, not people.
    // Page views with no source key are not here: a direct entry and a later
    // page of the same visit are indistinguishable (no entry flag in meta).
    entries: `SELECT src AS source, count(*)::int AS entries FROM (
        SELECT coalesce(
          nullif(meta->>'utm_source', ''),
          'src:' || nullif(meta->>'src', ''),
          'crm:' || nullif(meta->>'crm', ''),
          'ref:' || nullif(meta->>'ref', ''),
          'referrer:' || nullif(meta->>'ref_host', '')) AS src
        FROM events WHERE event_type = 'page_view' AND created_at >= ${W}) e
      WHERE src IS NOT NULL
      GROUP BY 1 ORDER BY 2 DESC, 1`,

    // ESTIMATE (core/estimate.ts): page views minus the non-human classes of
    // #SESSIONI-1006, exclusive in this order — no country; no session and a
    // listed country; no session inside a burst (same country, fixed slot).
    humanTraffic: `WITH pv AS (
        SELECT nullif(country, '') AS country, session_id IS NULL AS no_sid,
          floor(extract(epoch FROM created_at) / ${BURST_SLOT_SECONDS})::bigint AS slot
        FROM events WHERE event_type = 'page_view' AND created_at >= ${W}),
      c AS (
        SELECT country, no_sid, country IN (${NO_SESSION_COUNTRIES_SQL}) AS listed,
          count(*) FILTER (WHERE no_sid) OVER (PARTITION BY country, slot) AS burst_n
        FROM pv)
      SELECT count(*)::int AS page_views,
        count(*) FILTER (WHERE country IS NULL)::int AS excl_no_country,
        count(*) FILTER (WHERE country IS NOT NULL AND no_sid AND listed)::int AS excl_country,
        count(*) FILTER (WHERE country IS NOT NULL AND no_sid AND NOT listed AND burst_n >= ${BURST_MIN})::int AS excl_burst,
        count(*) FILTER (WHERE country IS NOT NULL AND NOT (no_sid AND (listed OR burst_n >= ${BURST_MIN})))::int AS probably_human
      FROM c`,

    funnelEvents: `SELECT
        count(*) FILTER (WHERE event_type = 'signup_started')::int AS signup_started,
        count(*) FILTER (WHERE event_type = 'signup_completed')::int AS signup_completed,
        count(*) FILTER (WHERE event_type IN ('signup_started','signup_completed') AND session_id IS NULL)::int AS signup_no_session,
        count(*) FILTER (WHERE event_type = 'signup_popup_shown')::int AS popup_shown,
        count(*) FILTER (WHERE event_type = 'signup_popup_cta_click')::int AS popup_cta,
        count(*) FILTER (WHERE event_type = 'signup_popup_dismissed')::int AS popup_dismissed,
        count(*) FILTER (WHERE event_type = 'plan_view')::int AS plan_view,
        count(*) FILTER (WHERE event_type = 'plan_cta_click')::int AS plan_cta_click,
        count(*) FILTER (WHERE event_type = 'checkout_opened')::int AS checkout_opened,
        count(*) FILTER (WHERE event_type = 'card_open')::int AS card_open,
        count(DISTINCT session_id) FILTER (WHERE event_type = 'card_open')::int AS card_open_sessions,
        count(*) FILTER (WHERE event_type = 'partner_click')::int AS partner_click,
        count(*) FILTER (WHERE event_type = 'partner_menu_open')::int AS partner_menu_open,
        count(*) FILTER (WHERE event_type = 'client_error')::int AS client_error
      FROM events WHERE created_at >= ${W} AND event_type IN (
        'signup_started','signup_completed','signup_popup_shown','signup_popup_cta_click',
        'signup_popup_dismissed','plan_view','plan_cta_click','checkout_opened','card_open',
        'partner_click','partner_menu_open','client_error')`,

    // signups = rows inserted by the signup form (app/api/auth register): it is
    // the only insert path that sets tos_accepted_at (founder grant does not).
    newProfiles: `SELECT count(*)::int AS new_profiles,
        count(*) FILTER (WHERE tos_accepted_at IS NOT NULL)::int AS signups,
        count(*) FILTER (WHERE activated_at IS NOT NULL)::int AS activated,
        count(*) FILTER (WHERE referred_by IS NOT NULL)::int AS referred,
        count(*) FILTER (WHERE acquisition IS NULL)::int AS no_acquisition
      FROM profiles WHERE created_at >= ${W}`,

    channels: `SELECT coalesce(
          nullif(acquisition->>'utm_source', ''),
          CASE WHEN nullif(acquisition->>'referrer', '') IS NOT NULL
               THEN 'referrer:' || split_part(split_part(acquisition->>'referrer', '://', 2), '/', 1) END,
          CASE WHEN acquisition IS NULL THEN '(non registrata)' ELSE '(diretto / nessuna fonte)' END) AS channel,
        count(*)::int AS n
      FROM profiles WHERE created_at >= ${W} GROUP BY 1 ORDER BY 2 DESC, 1`,

    plans: `SELECT plan, plan_source,
        (plan_expires_at IS NOT NULL AND plan_expires_at < now()) AS expired,
        count(*)::int AS n
      FROM profiles GROUP BY 1, 2, 3`,

    // "Incassato" = paid_at set (money confirmed), same rule as the torre
    // (tools/control_center/checks/business.py). granted_at without paid_at is
    // an access granted with no recorded payment: counted apart, not summed.
    revenue: `WITH o AS (
        SELECT amount_usd, period, paid_at FROM paygate_orders WHERE paid_at IS NOT NULL
        UNION ALL
        SELECT amount_usd, period, paid_at FROM paypal_orders WHERE paid_at IS NOT NULL)
      SELECT count(*)::int AS orders_all,
        coalesce(sum(amount_usd), 0)::float AS usd_all,
        count(*) FILTER (WHERE paid_at >= ${W})::int AS orders_w,
        coalesce(sum(amount_usd) FILTER (WHERE paid_at >= ${W}), 0)::float AS usd_w,
        count(*) FILTER (WHERE period = 'annual')::int AS annual_all,
        (SELECT count(*) FROM paygate_orders WHERE granted_at IS NOT NULL AND paid_at IS NULL)::int
          + (SELECT count(*) FROM paypal_orders WHERE granted_at IS NOT NULL AND paid_at IS NULL)::int AS granted_unpaid
      FROM o`,

    // event_id is the Shopify order id (PRIMARY KEY): the webhook drops
    // redeliveries, so one row = one paid order. Refunds are their own rows
    // (refunds/create), counted apart and never subtracted.
    shopify: `SELECT count(*) FILTER (WHERE event_type = 'orders/paid')::int AS orders_all,
        coalesce(sum(amount) FILTER (WHERE event_type = 'orders/paid'), 0)::float AS amount_all,
        count(*) FILTER (WHERE event_type = 'orders/paid' AND processed_at >= ${W})::int AS orders_w,
        coalesce(sum(amount) FILTER (WHERE event_type = 'orders/paid' AND processed_at >= ${W}), 0)::float AS amount_w,
        count(*) FILTER (WHERE event_type = 'refunds/create')::int AS refunds_all,
        count(*) FILTER (WHERE event_type = 'refunds/create' AND processed_at >= ${W})::int AS refunds_w
      FROM shopify_events WHERE event_type IN ('orders/paid', 'refunds/create')`,

    partners: `SELECT partner_id, count(*)::int AS clicks
      FROM events WHERE event_type = 'partner_click' AND partner_id IS NOT NULL AND created_at >= ${W}
      GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 10`,

    widget: `SELECT meta->>'host' AS host,
        count(*) FILTER (WHERE event_type = 'widget_view')::int AS views,
        count(*) FILTER (WHERE event_type = 'widget_click')::int AS clicks
      FROM events
      WHERE event_type IN ('widget_view','widget_click') AND created_at >= ${W}
        AND coalesce(meta->>'host', '') !~ '${WIDGET_PREVIEW_HOST_RE}'
      GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 10`,

    // Paid subscriptions whose plan_expires_at fell inside the window and was
    // not pushed forward by a renewal.
    lapsed: `SELECT count(*)::int AS lapsed
      FROM profiles
      WHERE plan_source IN (${PAID_SQL_LIST})
        AND plan_expires_at >= ${W} AND plan_expires_at < now()`,

    // Not windowed: the age of the newest row right now.
    freshness: `SELECT
        (SELECT extract(epoch FROM now() - captured_at) FROM odds_snapshots ORDER BY id DESC LIMIT 1)::float AS odds_age_s,
        (SELECT extract(epoch FROM now() - max(computed_at)) FROM match_predictions)::float AS football_age_s,
        (SELECT extract(epoch FROM now() - max(computed_at)) FROM tennis_predictions)::float AS tennis_age_s,
        (SELECT count(*) FROM error_patterns_log WHERE logged_at > now() - interval '24 hours')::int AS error_patterns_24h`,

    // Same definition as GET /api/research/calibration ("served" block).
    calibration: `WITH r AS (
        SELECT p_home, p_draw, p_away, result FROM prediction_log
        WHERE result IN ('home','draw','away') ORDER BY settled_at DESC LIMIT 20000),
      x AS (
        SELECT k, CASE k WHEN 0 THEN p_home WHEN 1 THEN p_draw ELSE p_away END AS p,
          ((CASE result WHEN 'home' THEN 0 WHEN 'draw' THEN 1 ELSE 2 END) = k)::int AS y
        FROM r CROSS JOIN generate_series(0, 2) k),
      b AS (
        SELECT k, least(9, floor(p * 10))::int AS bin, count(*) AS n, avg(p) AS pm, avg(y) AS ym
        FROM x GROUP BY 1, 2)
      SELECT (SELECT count(*) FROM r)::int AS n,
        ((SELECT sum((p - y) ^ 2) FROM x) / nullif((SELECT count(*) FROM r), 0))::float AS brier,
        ((SELECT sum(n * abs(pm - ym)) FROM b) / nullif((SELECT count(*) FROM r), 0) / 3)::float AS ece`,
  };
}

// ─── Filone A: daily series + source chain (additions) ───────────────────────

/** Complete Europe/Rome days fetched for the series: 30 shown + 30 to compare against. */
export const SERIES_HISTORY_DAYS = 60;

/** Start of today in Europe/Rome — the series stop here: today is partial and excluded. */
const ROME_TODAY0 = "(date_trunc('day', now() AT TIME ZONE 'Europe/Rome') AT TIME ZONE 'Europe/Rome')";
const ROME_DAY0 = `((date_trunc('day', now() AT TIME ZONE 'Europe/Rome') - interval '${SERIES_HISTORY_DAYS} days') AT TIME ZONE 'Europe/Rome')`;
const romeDay = (col: string) => `to_char((${col} AT TIME ZONE 'Europe/Rome')::date, 'YYYY-MM-DD')`;
const seriesRange = (col: string) => `${col} >= ${ROME_DAY0} AND ${col} < ${ROME_TODAY0}`;

export const SERIES_KEYS = ["seriesEvents", "seriesProfiles", "seriesOrders"] as const;
export type SeriesQueryKey = (typeof SERIES_KEYS)[number];

/**
 * One row per Europe/Rome day that HAS data (sparse): core/series.ts fills the
 * missing days with a real 0 — only when the query itself succeeded.
 * "sessions" = distinct consented session_id per day (a session across
 * midnight counts on both days).
 */
export function buildSeriesSql(): Record<SeriesQueryKey, string> {
  return {
    seriesEvents: `SELECT ${romeDay("created_at")} AS day,
        count(*) FILTER (WHERE event_type = 'page_view')::int AS page_views,
        count(DISTINCT session_id) FILTER (WHERE event_type = 'page_view')::int AS sessions,
        count(*) FILTER (WHERE event_type = 'signup_started')::int AS signup_started,
        count(*) FILTER (WHERE event_type = 'signup_completed')::int AS signup_completed,
        count(*) FILTER (WHERE event_type = 'partner_click')::int AS partner_click,
        count(*) FILTER (WHERE event_type = 'client_error')::int AS client_error
      FROM events
      WHERE event_type IN ('page_view','signup_started','signup_completed','partner_click','client_error')
        AND ${seriesRange("created_at")}
      GROUP BY 1 ORDER BY 1`,

    seriesProfiles: `SELECT ${romeDay("created_at")} AS day, count(*)::int AS new_profiles
      FROM profiles WHERE ${seriesRange("created_at")} GROUP BY 1 ORDER BY 1`,

    // Same scope as the funnel's "Ordini pagati": Paygate + PayPal (paid_at) + Shopify orders/paid.
    seriesOrders: `SELECT day, count(*)::int AS paid_orders FROM (
        SELECT ${romeDay("paid_at")} AS day FROM paygate_orders WHERE paid_at IS NOT NULL AND ${seriesRange("paid_at")}
        UNION ALL
        SELECT ${romeDay("paid_at")} FROM paypal_orders WHERE paid_at IS NOT NULL AND ${seriesRange("paid_at")}
        UNION ALL
        SELECT ${romeDay("processed_at")} FROM shopify_events WHERE event_type = 'orders/paid' AND ${seriesRange("processed_at")}) o
      GROUP BY 1 ORDER BY 1`,
  };
}

/**
 * Source chain for a window: source → sessions → signups → profiles → paying.
 * Two attribution bases, joined on the source label:
 *  - sessions / signup events: the landing page_view of a CONSENTED session
 *    (same label rule as `sources` above); signups without session_id, or whose
 *    session has no page_view in the window, get their own explicit rows.
 *  - profiles / paying: profiles.acquisition (NULL for every pre-attribution
 *    profile → "(non registrata)").
 * Referrer labels carry the raw host: core/channels.ts coarsens them to the
 * registrable domain (core/privacy.ts) and sums the rows that collapse.
 */
export function buildChainSql(w: GrowthWindow): string {
  const W = windowStartSql(w);
  return `WITH sess AS (
        SELECT session_id, max(coalesce(
          nullif(meta->>'utm_source', ''),
          'src:' || nullif(meta->>'src', ''),
          'crm:' || nullif(meta->>'crm', ''),
          'ref:' || nullif(meta->>'ref', ''),
          'referrer:' || nullif(meta->>'ref_host', ''))) AS src
        FROM events
        WHERE event_type = 'page_view' AND session_id IS NOT NULL AND created_at >= ${W}
        GROUP BY session_id),
      sig AS (
        SELECT session_id,
          count(*) FILTER (WHERE event_type = 'signup_started') AS st,
          count(*) FILTER (WHERE event_type = 'signup_completed') AS co
        FROM events
        WHERE event_type IN ('signup_started','signup_completed') AND created_at >= ${W}
        GROUP BY session_id),
      ev AS (
        SELECT CASE
            WHEN s.session_id IS NULL AND g.session_id IS NULL THEN '(signup senza sessione)'
            WHEN s.session_id IS NULL THEN '(sessione senza page_view nella finestra)'
            ELSE coalesce(s.src, '(diretto / nessuna fonte)') END AS source,
          count(s.session_id)::int AS sessions,
          coalesce(sum(g.st), 0)::int AS signup_started,
          coalesce(sum(g.co), 0)::int AS signup_completed
        FROM sess s FULL JOIN sig g ON g.session_id = s.session_id
        GROUP BY 1),
      pr AS (
        SELECT CASE WHEN acquisition IS NULL THEN '(non registrata)' ELSE coalesce(
            nullif(acquisition->>'utm_source', ''),
            'referrer:' || nullif(split_part(split_part(acquisition->>'referrer', '://', 2), '/', 1), ''),
            '(diretto / nessuna fonte)') END AS source,
          count(*)::int AS profiles,
          count(*) FILTER (WHERE plan IN ('base','premium') AND plan_source IN (${PAID_SQL_LIST})
            AND (plan_expires_at IS NULL OR plan_expires_at >= now()))::int AS paying
        FROM profiles WHERE created_at >= ${W}
        GROUP BY 1)
      SELECT coalesce(ev.source, pr.source) AS source,
        coalesce(ev.sessions, 0) AS sessions,
        coalesce(ev.signup_started, 0) AS signup_started,
        coalesce(ev.signup_completed, 0) AS signup_completed,
        coalesce(pr.profiles, 0) AS profiles,
        coalesce(pr.paying, 0) AS paying
      FROM ev FULL JOIN pr ON pr.source = ev.source
      ORDER BY 2 DESC, 5 DESC, 1`;
}

// Read-only aggregate SQL — the same queries as PR #516 (lib/growth/queries.ts),
// kept as pure strings so any adapter (live DB, snapshot generator, a future
// CRM backend) runs exactly the same definitions.
//
// Rules: SELECT only, aggregates only, no personal data (no identifier / name /
// email / profile id is selected). The window start comes from windowStartSql(),
// a closed set of constants — nothing user-supplied is interpolated.

import { PAID_CHANNELS, type GrowthWindow, windowStartSql } from "./kpi";

const PAID_SQL_LIST = PAID_CHANNELS.map((c) => `'${c}'`).join(",");

// Widget hosts that are our own previews/dev, not a partner site.
const WIDGET_PREVIEW_HOST_RE = String.raw`(^$|^localhost$|^127\.|\.vercel\.app$)`;

/** Queries that must return exactly one row (zero rows = read failure). */
export const SCALAR_KEYS = ["traffic", "funnelEvents", "newProfiles", "revenue", "shopify", "lapsed", "freshness", "calibration"] as const;
/** Queries that return a list (zero rows = genuinely nothing). */
export const LIST_KEYS = ["sources", "channels", "plans", "partners", "widget"] as const;
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

    newProfiles: `SELECT count(*)::int AS new_profiles,
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

    shopify: `SELECT count(*)::int AS orders_all,
        coalesce(sum(amount), 0)::float AS amount_all,
        count(*) FILTER (WHERE processed_at >= ${W})::int AS orders_w,
        coalesce(sum(amount) FILTER (WHERE processed_at >= ${W}), 0)::float AS amount_w
      FROM shopify_events WHERE event_type = 'orders/paid'`,

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

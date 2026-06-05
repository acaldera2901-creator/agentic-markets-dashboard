import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { dbQuery } from "@/lib/db";
import { OPERATING_COSTS, monthlyBurnEur } from "@/lib/operating-costs";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  return isAdminAuthorized(req);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [
    totalEvents,
    eventsByType,
    byCountry,
    byLanguage,
    byPlan,
    partnerClicks,
    conversions,
    recentEvents,
    betsStats,
    leaderboardStats,
    partnerRequests,
    clientStats,
    pendingActivations,
  ] = await Promise.all([
    dbQuery<{ n: string }>("SELECT COUNT(*) as n FROM events"),
    dbQuery<{ event_type: string; n: string }>(
      "SELECT event_type, COUNT(*) as n FROM events GROUP BY event_type ORDER BY n DESC"
    ),
    dbQuery<{ country: string; n: string }>(
      "SELECT COALESCE(country, 'unknown') as country, COUNT(*) as n FROM events GROUP BY country ORDER BY n DESC LIMIT 20"
    ),
    dbQuery<{ language: string; n: string }>(
      "SELECT COALESCE(language, 'unknown') as language, COUNT(*) as n FROM events GROUP BY language ORDER BY n DESC"
    ),
    dbQuery<{ plan: string; n: string }>(
      "SELECT COALESCE(plan, 'none') as plan, COUNT(*) as n FROM events WHERE plan IS NOT NULL GROUP BY plan ORDER BY n DESC"
    ),
    dbQuery<{ partner_id: string; n: string }>(
      "SELECT partner_id, COUNT(*) as n FROM events WHERE event_type = 'partner_click' AND partner_id IS NOT NULL GROUP BY partner_id ORDER BY n DESC LIMIT 20"
    ),
    dbQuery<{ n: string; revenue: string }>(
      "SELECT COUNT(*) as n, COALESCE(SUM(value), 0) as revenue FROM events WHERE event_type = 'conversion'"
    ),
    dbQuery<{ event_type: string; country: string; language: string; plan: string; created_at: string }>(
      "SELECT event_type, country, language, plan, created_at FROM events ORDER BY created_at DESC LIMIT 50"
    ),
    dbQuery<{ total: string; wins: string; losses: string; pending: string }>(
      `SELECT COUNT(*) as total,
        COUNT(*) FILTER (WHERE status='won') as wins,
        COUNT(*) FILTER (WHERE status='lost') as losses,
        COUNT(*) FILTER (WHERE status='pending') as pending
       FROM bets`
    ),
    dbQuery<{ n: string }>("SELECT COUNT(*) as n FROM leaderboard"),
    dbQuery<{ n: string; latest: string }>(
      "SELECT COUNT(*) as n, MAX(created_at) as latest FROM partner_requests"
    ),
    // Real clients from the server-authoritative profiles table (P0 #1).
    dbQuery<{ total: string; free: string; pending: string; base: string; premium: string; new_7d: string; new_30d: string }>(
      `SELECT COUNT(*) as total,
        COUNT(*) FILTER (WHERE plan='free') as free,
        COUNT(*) FILTER (WHERE plan='pending_payment') as pending,
        COUNT(*) FILTER (WHERE plan='base') as base,
        COUNT(*) FILTER (WHERE plan IN ('premium','admin_full')) as premium,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as new_7d,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as new_30d
       FROM profiles`
    ),
    // Pending payment activations — actionable list for the admin.
    dbQuery<{ identifier: string; requested_plan: string; tx_hash: string; created_at: string }>(
      "SELECT identifier, requested_plan, tx_hash, created_at FROM profiles WHERE plan='pending_payment' ORDER BY updated_at DESC LIMIT 50"
    ),
  ]);

  return NextResponse.json({
    overview: {
      total_events: Number(totalEvents[0]?.n ?? 0),
      total_conversions: Number(conversions[0]?.n ?? 0),
      total_revenue_eur: Number(conversions[0]?.revenue ?? 0),
      leaderboard_users: Number(leaderboardStats[0]?.n ?? 0),
      partner_requests: Number(partnerRequests[0]?.n ?? 0),
    },
    bets: {
      total: Number(betsStats[0]?.total ?? 0),
      wins: Number(betsStats[0]?.wins ?? 0),
      losses: Number(betsStats[0]?.losses ?? 0),
      pending: Number(betsStats[0]?.pending ?? 0),
    },
    clients: {
      total: Number(clientStats[0]?.total ?? 0),
      free: Number(clientStats[0]?.free ?? 0),
      pending_payment: Number(clientStats[0]?.pending ?? 0),
      base: Number(clientStats[0]?.base ?? 0),
      premium: Number(clientStats[0]?.premium ?? 0),
      paying: Number(clientStats[0]?.base ?? 0) + Number(clientStats[0]?.premium ?? 0),
      new_7d: Number(clientStats[0]?.new_7d ?? 0),
      new_30d: Number(clientStats[0]?.new_30d ?? 0),
    },
    pending_activations: pendingActivations.map((r) => ({
      identifier: r.identifier,
      requested_plan: r.requested_plan,
      tx_hash: r.tx_hash,
      created_at: r.created_at,
    })),
    finance: {
      monthly_burn_eur: monthlyBurnEur(),
      total_revenue_eur: Number(conversions[0]?.revenue ?? 0),
      net_eur: Number(conversions[0]?.revenue ?? 0) - monthlyBurnEur(),
      costs: OPERATING_COSTS.filter((c) => c.monthly_eur > 0).map((c) => ({
        label: c.label,
        category: c.category,
        monthly_eur: c.monthly_eur,
      })),
    },
    events_by_type: eventsByType.map((r) => ({ type: r.event_type, count: Number(r.n) })),
    by_country: byCountry.map((r) => ({ country: r.country, count: Number(r.n) })),
    by_language: byLanguage.map((r) => ({ language: r.language, count: Number(r.n) })),
    by_plan: byPlan.map((r) => ({ plan: r.plan, count: Number(r.n) })),
    partner_clicks: partnerClicks.map((r) => ({ partner: r.partner_id, clicks: Number(r.n) })),
    recent_events: recentEvents,
    generated_at: new Date().toISOString(),
  });
}

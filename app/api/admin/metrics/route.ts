import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";
const DB_URL = process.env.DATABASE_URL ?? "";

function isAuthorized(req: NextRequest): boolean {
  if (!ADMIN_SECRET) return false;
  const cookie = req.cookies.get("admin_token")?.value;
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "");
  return cookie === ADMIN_SECRET || bearer === ADMIN_SECRET;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function q<T = Record<string, any>>(sql: string): Promise<T[]> {
  if (!DB_URL) return [];
  try {
    const { neon } = await import("@neondatabase/serverless");
    const db = neon(DB_URL);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((await (db as any).query(sql)) ?? []) as T[];
  } catch {
    return [];
  }
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
  ] = await Promise.all([
    q<{ n: string }>("SELECT COUNT(*) as n FROM events"),
    q<{ event_type: string; n: string }>(
      "SELECT event_type, COUNT(*) as n FROM events GROUP BY event_type ORDER BY n DESC"
    ),
    q<{ country: string; n: string }>(
      "SELECT COALESCE(country, 'unknown') as country, COUNT(*) as n FROM events GROUP BY country ORDER BY n DESC LIMIT 20"
    ),
    q<{ language: string; n: string }>(
      "SELECT COALESCE(language, 'unknown') as language, COUNT(*) as n FROM events GROUP BY language ORDER BY n DESC"
    ),
    q<{ plan: string; n: string }>(
      "SELECT COALESCE(plan, 'none') as plan, COUNT(*) as n FROM events WHERE plan IS NOT NULL GROUP BY plan ORDER BY n DESC"
    ),
    q<{ partner_id: string; n: string }>(
      "SELECT partner_id, COUNT(*) as n FROM events WHERE event_type = 'partner_click' AND partner_id IS NOT NULL GROUP BY partner_id ORDER BY n DESC LIMIT 20"
    ),
    q<{ n: string; revenue: string }>(
      "SELECT COUNT(*) as n, COALESCE(SUM(value), 0) as revenue FROM events WHERE event_type = 'conversion'"
    ),
    q<{ event_type: string; country: string; language: string; plan: string; created_at: string }>(
      "SELECT event_type, country, language, plan, created_at FROM events ORDER BY created_at DESC LIMIT 50"
    ),
    q<{ total: string; wins: string; losses: string; pending: string; total_pnl: string }>(
      `SELECT COUNT(*) as total,
        COUNT(*) FILTER (WHERE status='won') as wins,
        COUNT(*) FILTER (WHERE status='lost') as losses,
        COUNT(*) FILTER (WHERE status='pending') as pending,
        COALESCE(SUM(CASE WHEN status='won' THEN stake*(odds-1) WHEN status='lost' THEN -stake ELSE 0 END), 0) as total_pnl
       FROM bets`
    ),
    q<{ n: string }>("SELECT COUNT(*) as n FROM leaderboard"),
    q<{ n: string; latest: string }>(
      "SELECT COUNT(*) as n, MAX(created_at) as latest FROM partner_requests"
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
      pnl: Number(betsStats[0]?.total_pnl ?? 0),
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

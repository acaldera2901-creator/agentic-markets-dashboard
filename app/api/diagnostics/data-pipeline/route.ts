import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { safeEqual } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

type CountRow = { count: string };
type LeagueRow = {
  league: string | null;
  total: string;
  with_odds: string;
  with_edge: string;
  latest_computed_at: string | null;
  next_kickoff: string | null;
};
type HeartbeatRow = {
  agent_name: string;
  last_seen: string | null;
  status_detail: string | null;
};

function isAuthorized(req: Request): boolean {
  // Gate on RESEARCH_SECRET only — accepting CRON_SECRET too widened the
  // credential surface for a route that dumps DB topology (#BUGCHECK-0617).
  const secret = process.env.RESEARCH_SECRET;
  // Default-deny: diagnostics expose DB state — never fail open on missing env.
  if (!secret) return false;
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "");
  return safeEqual(bearer, secret);
}

async function safeQuery<T>(query: string): Promise<T[]> {
  try {
    return await dbQuery<T>(query);
  } catch {
    return [];
  }
}

function envStatus() {
  return {
    supabase_url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabase_service_role: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    football_data_org: Boolean(process.env.FOOTBALL_DATA_ORG_API_KEY),
    odds_api: Boolean(process.env.ODDS_API_KEY),
    api_football: Boolean(process.env.API_FOOTBALL_KEY || process.env.RAPIDAPI_KEY),
    redis: Boolean(
      process.env.KV_URL ||
      process.env.KV_REST_API_TOKEN ||
      process.env.UPSTASH_REDIS_REST_URL ||
      process.env.UPSTASH_REDIS_REST_TOKEN
    ),
    cron_secret: Boolean(process.env.CRON_SECRET),
    research_secret: Boolean(process.env.RESEARCH_SECRET),
    tennis_demo_mode: process.env.TENNIS_DEMO_MODE === "true",
  };
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [
    footballActive,
    footballExpired,
    footballByLeague,
    unifiedActive,
    unifiedHistory,
    tennisPredictions,
    tennisBets,
    heartbeats,
  ] = await Promise.all([
    safeQuery<CountRow>(`SELECT COUNT(*)::text AS count FROM match_predictions WHERE kickoff > NOW()`),
    safeQuery<CountRow>(`SELECT COUNT(*)::text AS count FROM match_predictions WHERE kickoff <= NOW()`),
    safeQuery<LeagueRow>(`
      SELECT
        league,
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE odds_home IS NOT NULL OR odds_draw IS NOT NULL OR odds_away IS NOT NULL)::text AS with_odds,
        COUNT(*) FILTER (WHERE edge IS NOT NULL)::text AS with_edge,
        MAX(computed_at)::text AS latest_computed_at,
        MIN(kickoff) FILTER (WHERE kickoff > NOW())::text AS next_kickoff
      FROM match_predictions
      GROUP BY league
      ORDER BY COUNT(*) DESC
    `),
    safeQuery<CountRow>(`
      SELECT COUNT(*)::text AS count FROM unified_predictions
      WHERE is_historical = FALSE AND starts_at > NOW() AND expires_at > NOW() AND published_at IS NOT NULL
    `),
    safeQuery<CountRow>(`
      SELECT COUNT(*)::text AS count FROM unified_predictions
      WHERE is_historical = TRUE OR settled_at IS NOT NULL OR status IN ('settled','won','lost','void','pending_settlement')
    `),
    safeQuery<CountRow>(`SELECT COUNT(*)::text AS count FROM tennis_predictions WHERE scheduled_at > NOW()`),
    safeQuery<CountRow>(`SELECT COUNT(*)::text AS count FROM tennis_bets`),
    safeQuery<HeartbeatRow>(`SELECT agent_name, last_seen::text, status_detail FROM agent_heartbeats ORDER BY agent_name ASC`),
  ]);

  const activeFootballCount = Number(footballActive[0]?.count ?? 0);
  const tennisPredictionCount = Number(tennisPredictions[0]?.count ?? 0);

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    env: envStatus(),
    football: {
      active_predictions: activeFootballCount,
      expired_predictions: Number(footballExpired[0]?.count ?? 0),
      by_league: footballByLeague,
      likely_issue:
        activeFootballCount <= 1
          ? "Too few active football rows. Check cron auth forwarding, provider fixture coverage, odds matching, and per-league diagnostics."
          : null,
    },
    unified: {
      active_predictions: Number(unifiedActive[0]?.count ?? 0),
      historical_predictions: Number(unifiedHistory[0]?.count ?? 0),
    },
    tennis: {
      active_predictions: tennisPredictionCount,
      bets: Number(tennisBets[0]?.count ?? 0),
      ready_for_live: tennisPredictionCount > 0,
      required_before_live:
        tennisPredictionCount > 0
          ? []
          : ["real fixture feed", "real odds feed", "surface/player model writer", "Redis or Supabase persistence", "settlement/history writer"],
    },
    agents: {
      heartbeat_rows: heartbeats.length,
      agents: heartbeats,
      likely_issue:
        heartbeats.length === 0
          ? "No agent heartbeats in Supabase. Check that Python workers have DASHBOARD_URL or SUPABASE_URL configured."
          : null,
    },
  });
}

import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

type PredictionRow = {
  total: string;
  active: string;
  historical: string;
  paper: string;
  verified: string;
  latest_updated_at: string | null;
};

type HeartbeatRow = {
  agent_name: string;
  last_seen: string | null;
  status_detail: string | null;
};

const EXPECTED_WORLD_CUP_MATCHES = 104;

function authorized(req: Request): boolean {
  const secret = process.env.RESEARCH_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function safeQuery<T>(sql: string, values: unknown[] = []): Promise<T[]> {
  try {
    return await dbQuery<T>(sql, values);
  } catch {
    return [];
  }
}

function parseDetail(detail: string | null): unknown {
  if (!detail) return null;
  try {
    return JSON.parse(detail);
  } catch {
    return detail;
  }
}

function envEnabled(name: string): boolean {
  return Boolean(process.env[name]);
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [matchRows, unifiedRows, heartbeatRows] = await Promise.all([
    safeQuery<PredictionRow>(`
      SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE kickoff > NOW())::text AS active,
        COUNT(*) FILTER (WHERE kickoff <= NOW())::text AS historical,
        '0'::text AS paper,
        '0'::text AS verified,
        MAX(computed_at)::text AS latest_updated_at
      FROM match_predictions
      WHERE league = 'WC' OR league_name ILIKE '%World Cup%'
    `),
    safeQuery<PredictionRow>(`
      SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (
          WHERE starts_at > NOW()
            AND expires_at > NOW()
            AND published_at IS NOT NULL
            AND is_historical = FALSE
        )::text AS active,
        COUNT(*) FILTER (WHERE is_historical = TRUE)::text AS historical,
        COUNT(*) FILTER (WHERE is_paper = TRUE OR signal_type = 'paper')::text AS paper,
        COUNT(*) FILTER (WHERE is_verified = TRUE OR signal_type = 'verified')::text AS verified,
        MAX(updated_at)::text AS latest_updated_at
      FROM unified_predictions
      WHERE competition ILIKE '%World Cup%' OR world_cup_stage IS NOT NULL
    `),
    safeQuery<HeartbeatRow>(`
      SELECT agent_name, last_seen::text AS last_seen, status_detail
      FROM agent_heartbeats
      WHERE agent_name IN ('DataCollector', 'ModelAgent', 'AnalystAgent', 'ResultSettlementAgent')
      ORDER BY last_seen DESC
    `),
  ]);

  const match = matchRows[0] ?? {
    total: "0",
    active: "0",
    historical: "0",
    paper: "0",
    verified: "0",
    latest_updated_at: null,
  };
  const unified = unifiedRows[0] ?? {
    total: "0",
    active: "0",
    historical: "0",
    paper: "0",
    verified: "0",
    latest_updated_at: null,
  };

  const heartbeats = heartbeatRows.map((row) => ({
    ...row,
    detail: parseDetail(row.status_detail),
  }));

  const dataCollectorDetail = heartbeats.find((row) => row.agent_name === "DataCollector")?.detail;
  const worldCupDetail =
    typeof dataCollectorDetail === "object" && dataCollectorDetail && "world_cup" in dataCollectorDetail
      ? (dataCollectorDetail as { world_cup?: unknown }).world_cup
      : null;
  const latestContextDetail = heartbeats
    .map((row) => row.detail)
    .find((detail) =>
      typeof detail === "object" &&
      detail !== null &&
      "type" in detail &&
      (detail as { type?: string }).type === "world_cup_context"
    );
  const latestNationalModelGate = heartbeats
    .map((row) => row.detail)
    .find((detail) =>
      typeof detail === "object" &&
      detail !== null &&
      "blocked_reason" in detail &&
      String((detail as { blocked_reason?: string }).blocked_reason).includes("national")
    );
  const latestDataQualityDetail = heartbeats
    .map((row) => row.detail)
    .find((detail) =>
      typeof detail === "object" &&
      detail !== null &&
      "type" in detail &&
      (detail as { type?: string }).type === "world_cup_data_quality"
    );

  const env = {
    football_data_org: envEnabled("FOOTBALL_DATA_ORG_API_KEY"),
    api_football: envEnabled("API_FOOTBALL_KEY"),
    odds_api: envEnabled("ODDS_API_KEY"),
    matchbook: envEnabled("MATCHBOOK_USERNAME") && envEnabled("MATCHBOOK_PASSWORD"),
    supabase: envEnabled("SUPABASE_URL") && envEnabled("SUPABASE_SERVICE_ROLE_KEY"),
    research_secret: envEnabled("RESEARCH_SECRET"),
  };

  const fixturesLoaded = Number(match.total) || Number(unified.total) || 0;
  const activePredictions = Number(match.active) + Number(unified.active);
  const settledOrHistorical = Number(match.historical) + Number(unified.historical);

  const readiness = {
    fixture_feed: env.football_data_org || env.api_football,
    odds_feed: env.odds_api || env.matchbook,
    national_team_model: false,
    venue_context: false,
    data_quality_scoring: Boolean(latestDataQualityDetail),
    odds_snapshots: Boolean(
      latestDataQualityDetail &&
        typeof latestDataQualityDetail === "object" &&
        (latestDataQualityDetail as { odds_snapshot?: unknown }).odds_snapshot
    ),
    squad_news: false,
    travel_rest_weather: false,
    group_table_logic: false,
    settlement: settledOrHistorical > 0,
    history: Number(unified.historical) > 0,
  };

  const requiredMissing = Object.entries(readiness)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return NextResponse.json(
    {
      generated_at: new Date().toISOString(),
      world_cup: {
        competition_code: "WC",
        competition_name: "FIFA World Cup 2026",
        expected_matches: EXPECTED_WORLD_CUP_MATCHES,
        dates: {
          starts_at: "2026-06-11",
          ends_at: "2026-07-19",
        },
        status: requiredMissing.length ? "monitor_only" : "signal_ready",
        readiness,
        blocked_reason: requiredMissing.length ? requiredMissing.join(", ") : null,
        counts: {
          fixtures_loaded: fixturesLoaded,
          active_predictions: activePredictions,
          match_predictions: match,
          unified_predictions: unified,
        },
        provider_env: env,
        latest_agent_world_cup_detail: worldCupDetail,
        latest_context_detail: latestContextDetail ?? null,
        latest_national_model_gate: latestNationalModelGate ?? null,
        latest_data_quality_detail: latestDataQualityDetail ?? null,
        agent_heartbeats: heartbeats,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

import { dbQuery } from "@/lib/db";

// ─── World Cup readiness — single source of truth ─────────────────────────────
//
// Extracted from app/api/diagnostics/world-cup/route.ts so the publication gate
// (lib/publication-gate.ts) and the diagnostics endpoint derive `monitor_only` /
// `signal_ready` from the SAME readiness map. While any readiness gate is false,
// World Cup rows must never be published as market signals (AM-CODE-REVIEW-001 #6).

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

export const EXPECTED_WORLD_CUP_MATCHES = 104;

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

// A readiness gate sourced from a heartbeat is only trusted while the heartbeat
// is fresh — a dead agent must never hold a gate true (fail-closed).
const HEARTBEAT_FRESH_MS = 15 * 60 * 1000;

function isHeartbeatFresh(row: (HeartbeatRow & { detail: unknown }) | undefined): boolean {
  if (!row?.last_seen) return false;
  const lastSeen = new Date(row.last_seen).getTime();
  return !Number.isNaN(lastSeen) && Date.now() - lastSeen <= HEARTBEAT_FRESH_MS;
}

function heartbeatReadiness(
  row: (HeartbeatRow & { detail: unknown }) | undefined
): { national_team_model: boolean; venue_context: boolean; group_table_logic: boolean } {
  const closed = { national_team_model: false, venue_context: false, group_table_logic: false };
  if (!isHeartbeatFresh(row)) return closed;

  const detail = row!.detail;
  if (typeof detail !== "object" || detail === null) return closed;
  const worldCup = (detail as { world_cup?: unknown }).world_cup;
  if (typeof worldCup !== "object" || worldCup === null) return closed;
  const readiness = (worldCup as { readiness?: unknown }).readiness;
  if (typeof readiness !== "object" || readiness === null) return closed;

  // Real heartbeat shape (core/world_cup_registry.py) nests the booleans under
  // readiness.gates; accept the flat shape too for forward-compatibility.
  const nested = (readiness as { gates?: unknown }).gates;
  const gates = (typeof nested === "object" && nested !== null ? nested : readiness) as {
    national_team_model?: unknown;
    venue_context?: unknown;
    stage_context?: unknown;
  };
  return {
    national_team_model: gates.national_team_model === true,
    venue_context: gates.venue_context === true,
    // Python computes group/stage inference as `stage_context` (infer_stage).
    group_table_logic: gates.stage_context === true,
  };
}

// travel/rest/weather completeness is measured by the ModelAgent as
// venue_context_quality (0..1) inside its world_cup_data_quality detail.
function modelVenueQualityReady(
  row: (HeartbeatRow & { detail: unknown }) | undefined,
  threshold = 0.7
): boolean {
  if (!isHeartbeatFresh(row)) return false;
  const detail = row!.detail;
  if (typeof detail !== "object" || detail === null) return false;
  const quality = (detail as { venue_context_quality?: unknown }).venue_context_quality;
  return typeof quality === "number" && quality >= threshold;
}

export type WorldCupDiagnostics = {
  competition_code: "WC";
  competition_name: string;
  expected_matches: number;
  dates: { starts_at: string; ends_at: string };
  status: "monitor_only" | "signal_ready";
  readiness: Record<string, boolean>;
  blocked_reason: string | null;
  counts: {
    fixtures_loaded: number;
    active_predictions: number;
    match_predictions: PredictionRow;
    unified_predictions: PredictionRow;
  };
  provider_env: Record<string, boolean>;
  latest_agent_world_cup_detail: unknown;
  latest_context_detail: unknown;
  latest_national_model_gate: unknown;
  latest_data_quality_detail: unknown;
  agent_heartbeats: Array<HeartbeatRow & { detail: unknown }>;
};

export async function buildWorldCupDiagnostics(): Promise<WorldCupDiagnostics> {
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

  const emptyCounts: PredictionRow = {
    total: "0",
    active: "0",
    historical: "0",
    paper: "0",
    verified: "0",
    latest_updated_at: null,
  };
  const match = matchRows[0] ?? emptyCounts;
  const unified = unifiedRows[0] ?? emptyCounts;

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

  // Readiness gates driven by the live Python heartbeats (fail-closed: a
  // missing/stale/garbled heartbeat can never hold a gate true).
  const dataCollectorRow = heartbeats.find((row) => row.agent_name === "DataCollector");
  const modelAgentRow = heartbeats.find((row) => row.agent_name === "ModelAgent");
  const dcReadiness = heartbeatReadiness(dataCollectorRow);

  const readiness = {
    fixture_feed: env.football_data_org || env.api_football,
    odds_feed: env.odds_api || env.matchbook,
    national_team_model: dcReadiness.national_team_model,
    venue_context: dcReadiness.venue_context,
    data_quality_scoring: Boolean(latestDataQualityDetail),
    odds_snapshots: Boolean(
      latestDataQualityDetail &&
        typeof latestDataQualityDetail === "object" &&
        (latestDataQualityDetail as { odds_snapshot?: unknown }).odds_snapshot
    ),
    squad_news: false,
    travel_rest_weather: modelVenueQualityReady(modelAgentRow),
    group_table_logic: dcReadiness.group_table_logic,
    settlement: settledOrHistorical > 0,
    history: Number(unified.historical) > 0,
  };

  const requiredMissing = Object.entries(readiness)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return {
    competition_code: "WC",
    competition_name: "FIFA World Cup 2026",
    expected_matches: EXPECTED_WORLD_CUP_MATCHES,
    dates: { starts_at: "2026-06-11", ends_at: "2026-07-19" },
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
  };
}

// Used by the publication gate. Defensive: any failure while computing readiness
// must block WC signals (fail-closed), never allow them.
export async function isWorldCupSignalReady(): Promise<boolean> {
  try {
    const diag = await buildWorldCupDiagnostics();
    return diag.status === "signal_ready";
  } catch {
    return false;
  }
}

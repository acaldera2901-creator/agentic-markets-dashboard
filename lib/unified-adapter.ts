import { dbQuery } from "@/lib/db";
import {
  gateCandidate,
  recordVerdict,
  emptySyncReport,
  type SyncReport,
} from "@/lib/publication-gate";
import { isWorldCupSignalReady } from "@/lib/world-cup-readiness";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UnifiedPrediction = {
  id: string;
  external_event_id: string | null;
  sport: string;
  competition: string;
  league: string | null;
  event_name: string;
  home_team: string | null;
  away_team: string | null;
  player_one: string | null;
  player_two: string | null;
  market: string;
  pick: string | null;
  bookmaker: string;
  odds: number | null;
  fair_odds: number | null;
  edge_percent: number | null;
  confidence_score: number | null;
  risk_level: string;
  stake_suggestion: number | null;
  closing_odds: number | null;
  closing_line_value: number | null;
  status: string;
  signal_type: string;
  source: string;
  model_version: string;
  plan_access: string;
  is_historical: boolean;
  is_live: boolean;
  is_paper: boolean;
  is_verified: boolean;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  starts_at: string;
  expires_at: string;
  settled_at: string | null;
  result: string | null;
  // P&L/stake/ROI intentionally absent: the product serves calibrated
  // probabilities and hit-rate, never money metrics derived from bets.
  notes: string | null;
  explanation: string | null;
  world_cup_stage: string | null;
  group_name: string | null;
  venue: string | null;
  neutral_venue: boolean;
  team_news_summary: string | null;
  market_movement_summary: string | null;
  source_table: string | null;
  source_id: string | null;
};

type MatchPredictionRow = {
  id: number;
  match_id: string;
  league: string;
  league_name: string;
  home_team: string;
  away_team: string;
  kickoff: string;
  p_home: number;
  p_draw: number;
  p_away: number;
  odds_home: number | null;
  odds_draw: number | null;
  odds_away: number | null;
  edge: number | null;
  best_selection: string | null;
  enrichment: {
    form_home?: string;
    form_away?: string;
    xg_home?: number;
    xga_home?: number;
    xg_away?: number;
    xga_away?: number;
    npxg_home?: number;
    npxg_away?: number;
    injuries_home?: string[];
    injuries_away?: string[];
    research?: string;
    match_type?: string;
    api_advice?: string;
  } | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WORLD_CUP_KEYWORDS = ["world cup", "fifa", "wc 2026", "wc2026"];

function detectCompetition(league: string, leagueName: string): string {
  const lower = leagueName.toLowerCase();
  if (WORLD_CUP_KEYWORDS.some((k) => lower.includes(k))) return "World Cup";
  if (league === "CL") return "Champions League";
  if (league === "EL") return "Europa League";
  return leagueName;
}

function detectWorldCupStage(leagueName: string): string | null {
  const lower = leagueName.toLowerCase();
  if (!WORLD_CUP_KEYWORDS.some((k) => lower.includes(k))) return null;
  if (lower.includes("final") && !lower.includes("semi") && !lower.includes("quarter")) return "final";
  if (lower.includes("semi")) return "semi";
  if (lower.includes("quarter")) return "quarter";
  if (lower.includes("round of 16") || lower.includes("round16")) return "round16";
  return "group";
}

function computeStatus(kickoff: string): string {
  const hoursUntil = (new Date(kickoff).getTime() - Date.now()) / 3_600_000;
  if (hoursUntil > 24) return "upcoming";
  if (hoursUntil > 0) return "open";
  return "pending_settlement";
}

function computeRisk(edge: number | null): string {
  if (edge == null) return "medium";
  if (edge > 0.04) return "low";
  if (edge > 0.02) return "medium";
  return "high";
}

function pickOdds(row: MatchPredictionRow): number | null {
  if (row.best_selection === "HOME") return row.odds_home;
  if (row.best_selection === "DRAW") return row.odds_draw;
  if (row.best_selection === "AWAY") return row.odds_away;
  return null;
}

function pickProb(row: MatchPredictionRow): number | null {
  if (row.best_selection === "HOME") return row.p_home;
  if (row.best_selection === "DRAW") return row.p_draw;
  if (row.best_selection === "AWAY") return row.p_away;
  return null;
}

function generateFootballExplanation(row: MatchPredictionRow): string {
  const pick = row.best_selection ?? "N/A";
  const odds = pickOdds(row);
  const hasRealMarket = odds != null && row.edge != null;
  const prob = pickProb(row);
  const confidence = prob != null ? `${Math.round(prob * 100)}%` : "unknown";
  const enr = row.enrichment;

  const formNote =
    enr?.form_home && enr?.form_away
      ? ` Recent form: ${row.home_team} ${enr.form_home}, ${row.away_team} ${enr.form_away}.`
      : "";

  const injuryNote =
    (enr?.injuries_home?.length ?? 0) > 0 || (enr?.injuries_away?.length ?? 0) > 0
      ? " Injury data considered."
      : "";

  const xgNote =
    enr?.xg_home != null || enr?.xg_away != null
      ? " Understat xG/npxG context considered."
      : "";

  const adviceNote = enr?.api_advice ? ` External model note: ${enr.api_advice}.` : "";

  // Only claim an "edge over the market" when there is a real market price.
  const headline = hasRealMarket
    ? `Football Live V4 signal. Pick: ${pick} | Edge: ${(row.edge! * 100).toFixed(1)}% over implied market probability | Model confidence: ${confidence}.`
    : `Football Live V4 estimate. Model lean: ${pick} | Model confidence: ${confidence}. No live market price available, so no market edge is claimed.`;

  return (
    headline +
    formNote +
    xgNote +
    injuryNote +
    adviceNote +
    " This signal is informational and does not guarantee an outcome. Bet responsibly."
  );
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

function matchPredictionToUnifiedInsert(row: MatchPredictionRow) {
  const competition = detectCompetition(row.league, row.league_name);
  const odds = pickOdds(row);
  const prob = pickProb(row);
  const fairOdds = prob != null && prob > 0 ? Math.round((1 / prob) * 100) / 100 : null;
  const confidence = prob != null ? Math.round(prob * 100) : null;
  const neutral = row.enrichment?.match_type === "NEUTRAL_VENUE";

  // A real value-bet requires real market odds AND a real computed edge.
  // Without them this is a model estimate (paper), never an edge over the market:
  // do not emit a fabricated edge, a real bookmaker, or is_paper=false.
  const hasRealMarket = odds != null && row.edge != null;
  const edgePct = hasRealMarket ? Math.round(row.edge! * 10000) / 100 : null;

  const teamNews =
    (row.enrichment?.injuries_home?.length ?? 0) > 0 ||
    (row.enrichment?.injuries_away?.length ?? 0) > 0
      ? `${row.home_team}: ${row.enrichment?.injuries_home?.join(", ") || "none"} | ${row.away_team}: ${row.enrichment?.injuries_away?.join(", ") || "none"}`
      : null;

  return {
    external_event_id: row.match_id,
    sport: "football",
    competition,
    league: row.league,
    event_name: `${row.home_team} vs ${row.away_team}`,
    home_team: row.home_team,
    away_team: row.away_team,
    market: "1X2",
    pick: row.best_selection,
    bookmaker: hasRealMarket ? "market composite" : "no market",
    odds: hasRealMarket && odds != null ? Math.round(odds * 100) / 100 : null,
    fair_odds: fairOdds,
    edge_percent: edgePct,
    confidence_score: confidence,
    risk_level: hasRealMarket ? computeRisk(row.edge) : "medium",
    status: computeStatus(row.kickoff),
    signal_type: hasRealMarket ? "signal" : "paper",
    source: "model",
    model_version: "football-live-v4-xg-market",
    plan_access: "base",
    is_historical: false,
    is_live: false,
    is_paper: !hasRealMarket,
    is_verified: false,
    is_demo: false,
    published_at: new Date().toISOString(),
    starts_at: row.kickoff,
    expires_at: row.kickoff, // prediction expires when match starts; stale cleanup uses this
    explanation: generateFootballExplanation(row),
    neutral_venue: neutral,
    team_news_summary: teamNews,
    world_cup_stage: detectWorldCupStage(row.league_name),
    source_table: "match_predictions",
    source_id: row.match_id,
  };
}

// ─── Sync function (called after every football model refresh) ────────────────
//
// Every candidate passes through the Safe Publication Gate v1 before touching
// unified_predictions: stale/invalid rows are rejected, rows without a real
// market or with World Cup readiness still monitor_only are forced to paper.

export async function syncMatchPredictionsToUnified(): Promise<SyncReport> {
  const rows = await dbQuery<MatchPredictionRow>(
    `SELECT id, match_id, league, league_name, home_team, away_team, kickoff,
            p_home, p_draw, p_away, odds_home, odds_draw, odds_away,
            edge, best_selection, enrichment
     FROM match_predictions
     WHERE kickoff > NOW() - INTERVAL '1 hour'
     ORDER BY kickoff ASC
     LIMIT 200`
  );

  const wcSignalReady = await isWorldCupSignalReady();
  const report = emptySyncReport();

  for (const row of rows) {
    const d = matchPredictionToUnifiedInsert(row);

    const verdict = gateCandidate(
      {
        startsAt: row.kickoff,
        pick: row.best_selection,
        odds: pickOdds(row),
        edge: row.edge,
        isWorldCup: d.competition === "World Cup" || d.world_cup_stage != null,
      },
      { worldCupSignalReady: wcSignalReady }
    );
    recordVerdict(report, verdict);
    if (!verdict.publish) continue;

    // The gate is authoritative on the published label: it can only ever
    // downgrade signal→paper (e.g. WC monitor_only), never upgrade.
    d.signal_type = verdict.signalType;
    d.is_paper = verdict.isPaper;
    await dbQuery(
      `INSERT INTO unified_predictions (
        external_event_id, sport, competition, league, event_name,
        home_team, away_team, market, pick, bookmaker,
        odds, fair_odds, edge_percent, confidence_score, risk_level,
        status, signal_type, source, model_version, plan_access,
        is_historical, is_live, is_paper, is_verified, is_demo,
        published_at, starts_at, expires_at, explanation,
        neutral_venue, team_news_summary, world_cup_stage, source_table, source_id
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34
      )
      ON CONFLICT (source_table, source_id) WHERE source_table IS NOT NULL DO UPDATE SET
        odds              = EXCLUDED.odds,
        fair_odds         = EXCLUDED.fair_odds,
        edge_percent      = EXCLUDED.edge_percent,
        confidence_score  = EXCLUDED.confidence_score,
        risk_level        = EXCLUDED.risk_level,
        status            = EXCLUDED.status,
        signal_type       = EXCLUDED.signal_type,
        is_paper          = EXCLUDED.is_paper,
        explanation       = EXCLUDED.explanation,
        team_news_summary = EXCLUDED.team_news_summary,
        neutral_venue     = EXCLUDED.neutral_venue,
        world_cup_stage   = EXCLUDED.world_cup_stage,
        updated_at        = NOW()
      WHERE unified_predictions.settled_at IS NULL`,
      [
        d.external_event_id, d.sport, d.competition, d.league, d.event_name,
        d.home_team, d.away_team, d.market, d.pick, d.bookmaker,
        d.odds, d.fair_odds, d.edge_percent, d.confidence_score, d.risk_level,
        d.status, d.signal_type, d.source, d.model_version, d.plan_access,
        d.is_historical, d.is_live, d.is_paper, d.is_verified, d.is_demo,
        d.published_at, d.starts_at, d.expires_at, d.explanation,
        d.neutral_venue, d.team_news_summary, d.world_cup_stage, d.source_table, d.source_id,
      ]
    );
  }

  await dbQuery(
    `UPDATE unified_predictions
     SET status = 'pending_settlement', updated_at = NOW()
     WHERE is_historical = FALSE
       AND expires_at < NOW()
       AND status IN ('open', 'upcoming')
       AND settled_at IS NULL`
  );

  return report;
}

// ─── Access control (applied in API routes) ───────────────────────────────────

export function applyAccessControl(
  row: UnifiedPrediction,
  planAccess: string
): Partial<UnifiedPrediction> {
  if (planAccess === "base" || planAccess === "premium") return row;

  if (planAccess === "free") {
    return {
      id: row.id,
      sport: row.sport,
      competition: row.competition,
      league: row.league,
      event_name: row.event_name,
      home_team: row.home_team,
      away_team: row.away_team,
      starts_at: row.starts_at,
      status: row.status,
      signal_type: row.signal_type,
      plan_access: row.plan_access,
      is_paper: row.is_paper,
      is_demo: row.is_demo,
    };
  }

  // Public / locked visitor
  return {
    id: row.id,
    sport: row.sport,
    competition: row.competition,
    event_name: row.event_name,
    home_team: row.home_team,
    away_team: row.away_team,
    starts_at: row.starts_at,
    status: row.status,
    plan_access: row.plan_access,
  };
}

import { dbQuery } from "@/lib/db";

// Mirror of lib/unified-adapter.ts (football) for tennis: maps the Python-fed
// tennis_predictions table into the served unified_predictions table (sport=tennis).
// Same honesty rule (P0): a value-bet needs real market odds AND a real edge; the
// ESPN tennis feed has no odds, so every row is an honest model ESTIMATE — never a
// fabricated edge. Distinct source_table so its dedup key never touches football rows.

type TennisPredictionRow = {
  match_id: string;
  tournament: string | null;
  surface: string | null;
  player1: string;
  player2: string;
  scheduled_at: string | null;
  p1: number | null;
  p2: number | null;
  odds_p1: number | null;
  odds_p2: number | null;
  edge: number | null;
  best_selection: string | null;
  model_version: string | null;
  serve_form_p1: number | null;
  serve_form_p2: number | null;
  return_form_p1: number | null;
  return_form_p2: number | null;
  feature_quality: number | null;
};

function computeStatus(scheduledAt: string | null): string {
  if (!scheduledAt) return "upcoming";
  const t = new Date(scheduledAt).getTime();
  if (Number.isNaN(t)) return "upcoming";
  const hours = (t - Date.now()) / 3_600_000;
  if (hours > 24) return "upcoming";
  if (hours > 0) return "open";
  return "pending_settlement";
}

function tennisPredictionToUnifiedInsert(row: TennisPredictionRow) {
  const p1 = row.p1 ?? 0;
  const p2 = row.p2 ?? 0;
  const pickP1 = row.best_selection ? row.best_selection === row.player1 : p1 >= p2;
  const pick = pickP1 ? row.player1 : row.player2;
  const prob = pickP1 ? p1 : p2;
  const odds = pickP1 ? row.odds_p1 : row.odds_p2;

  const hasRealMarket = odds != null && row.edge != null;
  const fairOdds = prob > 0 ? Math.round((1 / prob) * 100) / 100 : null;
  const confidence = prob > 0 ? Math.round(prob * 100) : null;
  const surface = row.surface ? row.surface[0].toUpperCase() + row.surface.slice(1) : "n/a";
  const featureSummary = row.feature_quality != null
    ? ` Feature quality ${Math.round(row.feature_quality * 100)}%.`
    : "";
  const serveReturnSummary =
    row.serve_form_p1 != null && row.serve_form_p2 != null && row.return_form_p1 != null && row.return_form_p2 != null
      ? ` Serve/return: ${row.player1} ${(row.serve_form_p1 * 100).toFixed(1)}%/${(row.return_form_p1 * 100).toFixed(1)}%, ${row.player2} ${(row.serve_form_p2 * 100).toFixed(1)}%/${(row.return_form_p2 * 100).toFixed(1)}%.`
      : "";

  const explanation =
    `Surface-Elo model (${surface}). Lean: ${pick} at ${confidence ?? "?"}% win probability.` +
    serveReturnSummary +
    featureSummary +
    (hasRealMarket ? "" : " No live market price available, so no market edge is claimed.") +
    " Informational only and does not guarantee an outcome. Bet responsibly.";

  return {
    external_event_id: row.match_id,
    sport: "tennis",
    competition: row.tournament ?? "Tennis",
    league: row.tournament ?? "Tennis",
    event_name: `${row.player1} vs ${row.player2}`,
    home_team: row.player1,
    away_team: row.player2,
    market: "ML",
    pick,
    bookmaker: hasRealMarket ? "market composite" : "no market",
    odds: hasRealMarket && odds != null ? Math.round(odds * 100) / 100 : null,
    fair_odds: fairOdds,
    edge_percent: hasRealMarket ? Math.round((row.edge ?? 0) * 10000) / 100 : null,
    confidence_score: confidence,
    risk_level: "medium",
    status: computeStatus(row.scheduled_at),
    signal_type: hasRealMarket ? "signal" : "paper",
    source: "model",
    model_version: row.model_version ?? "tennis-elo-v1",
    plan_access: "base",
    is_historical: false,
    is_live: false,
    is_paper: !hasRealMarket,
    is_verified: false,
    is_demo: false,
    published_at: new Date().toISOString(),
    starts_at: row.scheduled_at,
    expires_at: row.scheduled_at,
    explanation,
    neutral_venue: false,
    team_news_summary: null,
    world_cup_stage: null,
    source_table: "tennis_predictions",
    source_id: row.match_id,
  };
}

// Called from the refresh cron, right after the football refresh, so a single
// scheduled job keeps unified_predictions populated for every sport.
export async function syncTennisPredictionsToUnified(): Promise<number> {
  const rows = await dbQuery<TennisPredictionRow>(
    `SELECT match_id, tournament, surface, player1, player2, scheduled_at,
            p1, p2, odds_p1, odds_p2, edge, best_selection, model_version,
            serve_form_p1, serve_form_p2, return_form_p1, return_form_p2, feature_quality
     FROM tennis_predictions
     WHERE scheduled_at > NOW() - INTERVAL '3 hours'
       AND winner IS NULL
     ORDER BY scheduled_at ASC
     LIMIT 200`
  );

  let synced = 0;
  for (const row of rows) {
    const d = tennisPredictionToUnifiedInsert(row);
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
        pick              = EXCLUDED.pick,
        odds              = EXCLUDED.odds,
        fair_odds         = EXCLUDED.fair_odds,
        edge_percent      = EXCLUDED.edge_percent,
        confidence_score  = EXCLUDED.confidence_score,
        risk_level        = EXCLUDED.risk_level,
        status            = EXCLUDED.status,
        signal_type       = EXCLUDED.signal_type,
        explanation       = EXCLUDED.explanation,
        starts_at         = EXCLUDED.starts_at,
        expires_at        = EXCLUDED.expires_at,
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
    synced++;
  }
  return synced;
}

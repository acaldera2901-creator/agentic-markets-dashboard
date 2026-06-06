import { dbQuery } from "@/lib/db";
import type { MarketProb, TripleProb } from "@/lib/poisson-model";

// Append-only snapshot of every served football prediction (PROPOSAL A).
// Fail-soft by construction: a logging failure must NEVER break the serve, so
// every write is wrapped and only logs a warning. The table is analytics-only
// (migration 004), read exclusively by offline calibration tooling.

export interface PredictionSnapshot {
  matchId: string;
  league: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  kickoff: string;
  served: TripleProb;
  model: TripleProb;
  lambdaHome: number | null;
  lambdaAway: number | null;
  oddsHome: number | null;
  oddsDraw: number | null;
  oddsAway: number | null;
  market: MarketProb | null;
  modelVersion: string;
  blendAlpha: number | null;
}

export async function logPredictionSnapshot(s: PredictionSnapshot): Promise<void> {
  try {
    await dbQuery(
      `INSERT INTO prediction_log (
         match_id, league, home_team, away_team, kickoff,
         p_home, p_draw, p_away,
         model_p_home, model_p_draw, model_p_away,
         lambda_home, lambda_away,
         odds_home, odds_draw, odds_away,
         market_p_home, market_p_draw, market_p_away,
         model_version, blend_alpha, computed_at
       ) VALUES (
         $1,$2,$3,$4,$5,
         $6,$7,$8,
         $9,$10,$11,
         $12,$13,
         $14,$15,$16,
         $17,$18,$19,
         $20,$21,NOW()
       )
       ON CONFLICT (match_id, model_version, computed_at) DO NOTHING`,
      [
        s.matchId, s.league, s.homeTeam, s.awayTeam, s.kickoff,
        s.served.pHome, s.served.pDraw, s.served.pAway,
        s.model.pHome, s.model.pDraw, s.model.pAway,
        s.lambdaHome, s.lambdaAway,
        s.oddsHome, s.oddsDraw, s.oddsAway,
        s.market?.home ?? null, s.market?.draw ?? null, s.market?.away ?? null,
        s.modelVersion, s.blendAlpha,
      ]
    );
  } catch (e) {
    console.error("[prediction-log] snapshot write failed (non-blocking):", String(e));
  }
}

// Settlement: write the realized 1X2 result onto every still-open snapshot of a
// finished match. Idempotent (only touches rows where result IS NULL). Fail-soft.
export async function settlePredictionLog(
  matchId: string,
  homeScore: number,
  awayScore: number
): Promise<void> {
  const result =
    homeScore === awayScore ? "draw" : homeScore > awayScore ? "home" : "away";
  try {
    await dbQuery(
      `UPDATE prediction_log
         SET result = $1, home_score = $2, away_score = $3, settled_at = NOW()
       WHERE match_id = $4 AND result IS NULL`,
      [result, homeScore, awayScore, matchId]
    );
  } catch (e) {
    console.error("[prediction-log] settlement write failed (non-blocking):", String(e));
  }
}

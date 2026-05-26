import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";

export async function GET() {
  const rows = await dbQuery(`
    SELECT
      mp.match_id, mp.league, mp.league_name, mp.home_team, mp.away_team,
      mp.kickoff, mp.p_home, mp.p_draw, mp.p_away,
      mp.odds_home, mp.odds_draw, mp.odds_away,
      mp.edge, mp.best_selection,
      mp.home_score, mp.away_score, mp.match_status,
      b.selection  AS bet_selection,
      b.status     AS bet_status,
      b.stake      AS bet_stake,
      b.odds       AS bet_odds
    FROM match_predictions mp
    LEFT JOIN bets b ON b.match_external_id = mp.match_id
    WHERE mp.kickoff >= NOW() - INTERVAL '30 days'
      AND mp.kickoff  < NOW()
    ORDER BY mp.kickoff DESC
    LIMIT 300
  `);

  const withBets = rows.filter((r) => r.bet_status);
  const won = withBets.filter((r) => r.bet_status === "won").length;
  const lost = withBets.filter((r) => r.bet_status === "lost").length;

  const avgEdge = withBets.length > 0
    ? (withBets.reduce((s, r) => s + Number(r.edge ?? 0), 0) / withBets.length * 100).toFixed(2)
    : "0.00";

  const totalStaked = withBets.reduce((s, r) => s + Number(r.bet_stake ?? 0), 0);
  const totalReturn = withBets.reduce((s, r) => {
    if (r.bet_status === "won") return s + Number(r.bet_stake ?? 0) * (Number(r.bet_odds ?? 1) - 1);
    if (r.bet_status === "lost") return s - Number(r.bet_stake ?? 0);
    return s;
  }, 0);

  const accuracy =
    withBets.length > 0 ? ((won / withBets.length) * 100).toFixed(1) : "0.0";
  const roi =
    totalStaked > 0 ? ((totalReturn / totalStaked) * 100).toFixed(1) : "0.0";

  // model "would have been correct": best_selection matches the outcome implied by the bet
  const modelCorrect = withBets.filter(
    (r) => r.bet_status === "won" && r.bet_selection === r.best_selection
  ).length;
  const modelAccuracy =
    withBets.length > 0 ? ((modelCorrect / withBets.length) * 100).toFixed(1) : "0.0";

  return NextResponse.json({
    history: rows,
    stats: {
      total_matches: rows.length,
      bets_placed: withBets.length,
      won,
      lost,
      pending: withBets.filter((r) => r.bet_status === "pending").length,
      accuracy,
      roi,
      model_accuracy: modelAccuracy,
      total_return: totalReturn.toFixed(2),
      avg_clv: avgEdge,
    },
  });
}

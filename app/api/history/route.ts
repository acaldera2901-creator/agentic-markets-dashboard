import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";

// Public track record (visible to every plan, including logged-out visitors).
// Sourced directly from settled `bets` — the model's real results on real matches.
// match_predictions is empty between seasons, so we read bets straight, not via a join.
export async function GET() {
  const rows = await dbQuery<{
    match_id: string;
    home_team: string;
    away_team: string;
    kickoff: string | null;
    league: string | null;
    bet_selection: string | null;
    bet_status: string | null;
    bet_stake: number | null;
    bet_odds: number | null;
    profit_loss: number | null;
  }>(`
    SELECT match_external_id AS match_id, home_team, away_team, kickoff, league,
           selection AS bet_selection, status AS bet_status,
           stake AS bet_stake, odds AS bet_odds, profit_loss
    FROM bets
    WHERE status IN ('won', 'lost', 'void')
    ORDER BY kickoff DESC NULLS LAST
    LIMIT 100
  `);

  const won = rows.filter((r) => r.bet_status === "won").length;
  const lost = rows.filter((r) => r.bet_status === "lost").length;
  const settled = won + lost;

  const totalStaked = rows.reduce((s, r) => s + Number(r.bet_stake ?? 0), 0);
  const totalReturn = rows.reduce((s, r) => {
    if (r.profit_loss != null) return s + Number(r.profit_loss);
    if (r.bet_status === "won") return s + Number(r.bet_stake ?? 0) * (Number(r.bet_odds ?? 1) - 1);
    if (r.bet_status === "lost") return s - Number(r.bet_stake ?? 0);
    return s;
  }, 0);

  const accuracy = settled > 0 ? ((won / settled) * 100).toFixed(1) : "0.0";
  const roi = totalStaked > 0 ? ((totalReturn / totalStaked) * 100).toFixed(1) : "0.0";

  return NextResponse.json({
    history: rows,
    stats: {
      total_matches: rows.length,
      bets_placed: rows.length,
      won,
      lost,
      pending: 0,
      accuracy,
      roi,
      model_accuracy: accuracy,
      total_return: totalReturn.toFixed(2),
      avg_clv: "0.00",
    },
  });
}

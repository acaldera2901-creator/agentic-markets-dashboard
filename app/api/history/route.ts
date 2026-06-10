import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { getSessionPlan } from "@/lib/auth";

// Public track record (visible to every plan, including logged-out visitors).
// Sourced directly from settled `bets` — the model's real results on real matches.
// match_predictions is empty between seasons, so we read bets straight, not via a join.
//
// MEDIUM-1: the PICK (selection) and odds are gated product. Anonymous/free
// viewers see the settled outcome with the pick LOCKED (parity with the v2
// projection in lib/access-projection); only paid tiers get selection + odds.
export async function GET(req: Request) {
  const ctx = await getSessionPlan(req).catch(() => null);
  const isPaid = !!ctx && ["base", "premium", "admin_full"].includes(ctx.plan);

  const rows = await dbQuery<{
    match_id: string;
    home_team: string;
    away_team: string;
    kickoff: string | null;
    league: string | null;
    bet_selection: string | null;
    bet_status: string | null;
    bet_odds: number | null;
  }>(`
    SELECT match_external_id AS match_id, home_team, away_team, kickoff, league,
           selection AS bet_selection, status AS bet_status,
           odds AS bet_odds
    FROM bets
    WHERE status IN ('won', 'lost', 'void')
    ORDER BY kickoff DESC NULLS LAST
    LIMIT 100
  `);

  const won = rows.filter((r) => r.bet_status === "won").length;
  const lost = rows.filter((r) => r.bet_status === "lost").length;
  const settled = won + lost;

  // Gate the pick + odds for non-paid viewers (outcome + matchup stay public).
  const history = isPaid
    ? rows
    : rows.map((r) => ({ ...r, bet_selection: null, bet_odds: null }));

  // Product line: calibrated probabilities, not edge/profit. The public track
  // record exposes hit-rate only — no money metrics (P&L/ROI/stake) ever.
  const accuracy = settled > 0 ? ((won / settled) * 100).toFixed(1) : "0.0";

  return NextResponse.json({
    history,
    stats: {
      total_matches: rows.length,
      bets_placed: rows.length,
      won,
      lost,
      pending: 0,
      accuracy,
      model_accuracy: accuracy,
    },
  });
}

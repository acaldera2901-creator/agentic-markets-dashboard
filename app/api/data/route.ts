import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { requireAccess } from "@/lib/auth";
import { stripPremiumEnrichment } from "@/lib/enrichment-gate";

export const dynamic = "force-dynamic";

interface StatRow {
  total: string;
  won: string;
  lost: string;
  pending: string;
  avg_odds: string;
}

export async function GET(req: Request) {
  const { ctx, deny } = await requireAccess(req);
  if (deny) return deny;
  // #PRELAUNCH-AUDIT: Deep Analysis (xG/infortuni/venue/lambdas/soft…) è Pro-only.
  // requireAccess garantisce base+, quindi isPaid=true; strippo i blocchi premium ai
  // non-Pro come fa /api/predictions (prima /api/data serviva l'enrichment grezzo).
  const isPro = ctx?.plan === "premium" || ctx?.plan === "admin_full";
  // Product line: calibrated probabilities, not edge/profit. No money metrics
  // (profit_loss/stake/P&L) are ever selected or serialized to the client.
  const [bets, stats, leagueStats] = await Promise.all([
    dbQuery(`
      SELECT b.id, b.match_external_id, b.selection, b.odds,
             b.status, b.placed_at, b.settled_at, b.paper, b.thesis,
             COALESCE(mp.home_team, b.home_team) AS home_team,
             COALESCE(mp.away_team, b.away_team) AS away_team,
             COALESCE(mp.league, b.league) AS league,
             mp.league_name,
             COALESCE(mp.kickoff::text, b.kickoff) AS kickoff,
             mp.enrichment
      FROM bets b
      LEFT JOIN match_predictions mp ON b.match_external_id::text = mp.match_id::text
      ORDER BY b.placed_at DESC
      LIMIT 100
    `),
    dbQuery<StatRow>(`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('pending','won','lost')) as total,
        COUNT(*) FILTER (WHERE status = 'won') as won,
        COUNT(*) FILTER (WHERE status = 'lost') as lost,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        AVG(odds) FILTER (WHERE status IN ('pending','won','lost')) as avg_odds
      FROM bets
    `),
    dbQuery(`
      SELECT
        COALESCE(mp.league, 'unknown') as league,
        COUNT(*) as total,
        COUNT(CASE WHEN b.status = 'won' THEN 1 END) as won,
        COUNT(CASE WHEN b.status = 'lost' THEN 1 END) as lost
      FROM bets b
      LEFT JOIN match_predictions mp ON b.match_external_id::text = mp.match_id::text
      GROUP BY COALESCE(mp.league, 'unknown')
      ORDER BY total DESC
    `),
  ]);

  const s = stats[0];
  const total = Number(s?.total ?? 0);

  // Strip dei blocchi Pro-only dall'enrichment di ogni bet per i non-Pro.
  const betsOut = (bets as Array<Record<string, unknown>>).map((b) => ({
    ...b,
    enrichment: stripPremiumEnrichment(
      (b.enrichment ?? null) as Record<string, unknown> | null,
      isPro,
      true // requireAccess garantisce base+ → isPaid
    ),
  }));

  return NextResponse.json({
    bets: betsOut,
    summary: {
      total_bets: total,
      won: Number(s?.won ?? 0),
      lost: Number(s?.lost ?? 0),
      pending: Number(s?.pending ?? 0),
      win_rate: total > 0 ? ((Number(s?.won ?? 0) / total) * 100).toFixed(1) : "0.0",
      avg_odds: Number(s?.avg_odds ?? 0).toFixed(2),
    },
    league_stats: leagueStats,
  });
}

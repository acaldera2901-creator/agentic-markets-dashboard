import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { requireAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface StatRow {
  total: string;
  won: string;
  lost: string;
  pnl: string;
  pending: string;
  avg_odds: string;
  avg_stake: string;
}

export async function GET(req: Request) {
  const { deny } = await requireAccess(req);
  if (deny) return deny;
  const [bets, stats, leaguePnl] = await Promise.all([
    dbQuery(`
      SELECT b.*,
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
        COALESCE(SUM(CASE WHEN status IN ('won','lost') THEN COALESCE(profit_loss, 0) ELSE 0 END), 0) as pnl,
        AVG(odds) FILTER (WHERE status IN ('pending','won','lost')) as avg_odds,
        AVG(stake) FILTER (WHERE status IN ('pending','won','lost')) as avg_stake
      FROM bets
    `),
    dbQuery(`
      SELECT
        COALESCE(mp.league, 'unknown') as league,
        COUNT(*) as total,
        COUNT(CASE WHEN b.status = 'won' THEN 1 END) as won,
        COUNT(CASE WHEN b.status = 'lost' THEN 1 END) as lost,
        COALESCE(SUM(CASE WHEN b.status IN ('won','lost') THEN COALESCE(b.profit_loss, 0) ELSE 0 END), 0) as pnl
      FROM bets b
      LEFT JOIN match_predictions mp ON b.match_external_id::text = mp.match_id::text
      GROUP BY COALESCE(mp.league, 'unknown')
      ORDER BY pnl DESC
    `),
  ]);

  const s = stats[0];
  const total = Number(s?.total ?? 0);

  return NextResponse.json({
    bets,
    summary: {
      total_bets: total,
      won: Number(s?.won ?? 0),
      lost: Number(s?.lost ?? 0),
      pending: Number(s?.pending ?? 0),
      pnl: Number(s?.pnl ?? 0),
      win_rate: total > 0 ? ((Number(s?.won ?? 0) / total) * 100).toFixed(1) : "0.0",
      avg_odds: Number(s?.avg_odds ?? 0).toFixed(2),
      avg_stake: Number(s?.avg_stake ?? 0).toFixed(2),
    },
    league_pnl: leaguePnl,
  });
}

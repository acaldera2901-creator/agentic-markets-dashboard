import { NextResponse } from "next/server";

const DB_URL = process.env.DATABASE_URL;

interface StatRow {
  total: string;
  won: string;
  lost: string;
  pnl: string;
  pending: string;
  avg_odds: string;
  avg_stake: string;
}

async function queryDB<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (!DB_URL) return [];
  try {
    const { neon } = await import("@neondatabase/serverless");
    const db = neon(DB_URL);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((await (db as any).query(sql, params)) ?? []) as T[];
  } catch {
    return [];
  }
}

export async function GET() {
  const [bets, stats, leaguePnl] = await Promise.all([
    queryDB(`
      SELECT b.*, mp.home_team, mp.away_team, mp.league, mp.league_name,
             mp.kickoff, mp.enrichment
      FROM bets b
      LEFT JOIN match_predictions mp ON b.match_external_id::text = mp.match_id::text
      ORDER BY b.placed_at DESC
      LIMIT 100
    `),
    queryDB<StatRow>(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'won' THEN 1 END) as won,
        COUNT(CASE WHEN status = 'lost' THEN 1 END) as lost,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COALESCE(SUM(CASE WHEN status = 'won' THEN stake * (odds - 1) WHEN status = 'lost' THEN -stake ELSE 0 END), 0) as pnl,
        AVG(odds) as avg_odds,
        AVG(stake) as avg_stake
      FROM bets
    `),
    queryDB(`
      SELECT
        COALESCE(mp.league, 'unknown') as league,
        COUNT(*) as total,
        COUNT(CASE WHEN b.status = 'won' THEN 1 END) as won,
        COUNT(CASE WHEN b.status = 'lost' THEN 1 END) as lost,
        COALESCE(SUM(CASE WHEN b.status = 'won' THEN b.stake * (b.odds - 1) WHEN b.status = 'lost' THEN -b.stake ELSE 0 END), 0) as pnl
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

import { NextResponse } from "next/server";

const DB_URL = process.env.DATABASE_URL;

interface StatRow {
  total: string;
  won: string;
  lost: string;
  pnl: string;
}

async function queryDB(_sql: string, _params: unknown[] = []): Promise<unknown[]> {
  if (!DB_URL) return [];
  try {
    // neon() uses tagged template literals — for dynamic queries use neon.query()
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(DB_URL);
    const result = await sql.query(_sql, _params as unknown[]);
    return result as unknown[];
  } catch {
    return [];
  }
}

export async function GET() {
  const [bets, stats] = await Promise.all([
    queryDB("SELECT * FROM bets ORDER BY placed_at DESC LIMIT 50"),
    queryDB(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'won' THEN 1 END) as won,
        COUNT(CASE WHEN status = 'lost' THEN 1 END) as lost,
        COALESCE(SUM(CASE WHEN status = 'won' THEN stake * (odds - 1) WHEN status = 'lost' THEN -stake ELSE 0 END), 0) as pnl
      FROM bets
    `),
  ]);

  const typedStats = stats[0] as StatRow | undefined;

  return NextResponse.json({
    bets,
    summary: {
      total_bets: Number(typedStats?.total ?? 0),
      won: Number(typedStats?.won ?? 0),
      lost: Number(typedStats?.lost ?? 0),
      pnl: Number(typedStats?.pnl ?? 0),
      win_rate:
        typedStats && Number(typedStats.total) > 0
          ? ((Number(typedStats.won) / Number(typedStats.total)) * 100).toFixed(1)
          : "0.0",
    },
  });
}

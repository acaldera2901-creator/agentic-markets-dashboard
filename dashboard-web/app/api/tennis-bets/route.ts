import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DB_URL = process.env.DATABASE_URL;

async function queryDB<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  if (!DB_URL) return [];
  try {
    const { neon } = await import("@neondatabase/serverless");
    const db = neon(DB_URL);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((await (db as any).query(sql)) ?? []) as T[];
  } catch {
    return [];
  }
}

export async function GET() {
  const [bets, stats] = await Promise.all([
    queryDB(`
      SELECT tb.id, tb.match_id, tb.selection, tb.player_name,
             tb.odds, tb.stake, tb.paper, tb.status, tb.profit_loss,
             tb.placed_at, tb.betfair_bet_id,
             tp.tournament, tp.surface, tp.player1, tp.player2,
             tp.scheduled_at
      FROM tennis_bets tb
      LEFT JOIN LATERAL (
        SELECT tournament, surface, player1, player2, scheduled_at
        FROM tennis_predictions
        WHERE match_id = tb.match_id
        ORDER BY computed_at DESC
        LIMIT 1
      ) tp ON true
      ORDER BY tb.placed_at DESC
      LIMIT 200
    `),
    queryDB(`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('pending','won','lost')) as total,
        COUNT(*) FILTER (WHERE status = 'won')    as won,
        COUNT(*) FILTER (WHERE status = 'lost')   as lost,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COALESCE(SUM(CASE WHEN status='won' THEN stake*(odds-1) WHEN status='lost' THEN -stake ELSE 0 END), 0) as pnl
      FROM tennis_bets
    `),
  ]);

  const s = stats[0] as Record<string, string> | undefined;

  return NextResponse.json({
    bets,
    summary: {
      total: Number(s?.total ?? 0),
      won: Number(s?.won ?? 0),
      lost: Number(s?.lost ?? 0),
      pending: Number(s?.pending ?? 0),
      pnl: Number(s?.pnl ?? 0),
    },
  });
}

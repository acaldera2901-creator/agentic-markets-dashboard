import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json() as { emailHash: string; displayName: string };
    if (!body.emailHash || !body.displayName) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }

    await dbQuery(
      `INSERT INTO leaderboard (display_name, email_hash, points, bets_won, bets_total, pnl)
       VALUES ($1, $2, 0, 0, 0, 0)
       ON CONFLICT (email_hash) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = NOW()`,
      [body.displayName, body.emailHash]
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET() {
  // Product line: calibrated probabilities, not edge/profit. The leaderboard
  // ranks by points + hit-rate — no money metrics (P&L) are ever serialized.
  const [systemStats, entries] = await Promise.all([
  dbQuery<{ wins: string; losses: string }>(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'won')  AS wins,
      COUNT(*) FILTER (WHERE status = 'lost') AS losses
    FROM bets
  `),
  dbQuery<{
    id: number;
    display_name: string;
    points: number;
    bets_won: number;
    bets_total: number;
    sport: string;
    joined_at: string;
  }>(
    `SELECT id, display_name, points, bets_won, bets_total, sport, joined_at
     FROM leaderboard ORDER BY points DESC, bets_won DESC`
  ),
  ]);
  const betsWins   = Number(systemStats[0]?.wins ?? 0);
  const betsLosses = Number(systemStats[0]?.losses ?? 0);
  // If bets table has no data, derive system stats from leaderboard entries
  const systemWins = betsWins > 0 ? betsWins : entries.reduce((sum, e) => sum + (e.bets_won ?? 0), 0);
  const systemSettled = betsWins + betsLosses > 0
    ? betsWins + betsLosses
    : entries.reduce((sum, e) => sum + (e.bets_total ?? 0), 0);
  const systemHitRate = systemSettled > 0 ? Math.round((systemWins / systemSettled) * 100) : 0;

  const ranked = entries.map((e, i) => ({
    rank: i + 1,
    name: e.display_name,
    points: e.points,
    bets_won: e.bets_won,
    bets_total: e.bets_total,
    hit_rate: e.bets_total > 0 ? Math.round((e.bets_won / e.bets_total) * 100) : 0,
    sport: e.sport,
    joined_at: e.joined_at,
  }));

  return NextResponse.json({
    leaderboard: ranked,
    system_wins: systemWins,
    system_hit_rate: systemHitRate,
    points_per_win: 10,
    updated_at: new Date().toISOString(),
  });
}

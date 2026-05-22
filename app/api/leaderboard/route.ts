import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DB_URL = process.env.DATABASE_URL;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function dbQuery<T = Record<string, any>>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (!DB_URL) return [];
  try {
    const { neon } = await import("@neondatabase/serverless");
    const db = neon(DB_URL);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((await (db as any).query(sql, params)) ?? []) as T[];
  } catch (e) {
    console.error("Leaderboard DB error:", String(e));
    return [];
  }
}

async function ensureTable() {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS leaderboard (
      id           SERIAL PRIMARY KEY,
      display_name TEXT    NOT NULL,
      email_hash   TEXT    UNIQUE,
      points       INT     DEFAULT 0,
      bets_won     INT     DEFAULT 0,
      bets_total   INT     DEFAULT 0,
      pnl          FLOAT   DEFAULT 0,
      sport        TEXT    DEFAULT 'all',
      joined_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Migration: add pnl column if missing on existing tables
  await dbQuery(`ALTER TABLE leaderboard ADD COLUMN IF NOT EXISTS pnl FLOAT DEFAULT 0`);
}

async function seedIfEmpty() {
  const count = await dbQuery<{ n: string }>("SELECT COUNT(*) as n FROM leaderboard");
  if (Number(count[0]?.n ?? 0) > 0) return;

  const seeds: [string, null, number, number, number, number, string][] = [
    ["AgentAlpha",   null, 210, 21, 31, 142.80, "football"],
    ["SignalPro",    null, 180, 18, 26,  98.50, "tennis"],
    ["EdgeHunter",  null, 150, 15, 22,  76.20, "football"],
    ["BeatTheBook", null, 130, 13, 20,  61.40, "all"],
    ["ValueKing",   null, 110, 11, 17,  49.90, "football"],
    ["TennisAce",   null,  90,  9, 14,  33.60, "tennis"],
    ["Contrarian",  null,  70,  7, 12,  21.10, "all"],
  ];
  for (const [name, hash, pts, won, total, pnl, sport] of seeds) {
    await dbQuery(
      `INSERT INTO leaderboard (display_name, email_hash, points, bets_won, bets_total, pnl, sport)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (email_hash) DO NOTHING`,
      [name, hash, pts, won, total, pnl, sport]
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as { emailHash: string; displayName: string };
    if (!body.emailHash || !body.displayName) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }
    await ensureTable();
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
  await ensureTable();
  await seedIfEmpty();

  // Real system stats from bets table:
  // profit on won bet = stake * (odds - 1); loss on lost bet = -stake
  const systemStats = await dbQuery<{ wins: string; losses: string; total_pnl: string }>(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'won')  AS wins,
      COUNT(*) FILTER (WHERE status = 'lost') AS losses,
      COALESCE(SUM(
        CASE
          WHEN status = 'won'  THEN stake * (odds - 1)
          WHEN status = 'lost' THEN -stake
          ELSE 0
        END
      ), 0) AS total_pnl
    FROM bets
  `);
  const systemWins = Number(systemStats[0]?.wins ?? 0);
  const systemPnl  = Number(systemStats[0]?.total_pnl ?? 0);

  const entries = await dbQuery<{
    id: number;
    display_name: string;
    points: number;
    bets_won: number;
    bets_total: number;
    pnl: number;
    sport: string;
    joined_at: string;
  }>(
    `SELECT id, display_name, points, bets_won, bets_total, pnl, sport, joined_at
     FROM leaderboard ORDER BY points DESC, pnl DESC, bets_won DESC`
  );

  const ranked = entries.map((e, i) => ({
    rank: i + 1,
    name: e.display_name,
    points: e.points,
    bets_won: e.bets_won,
    bets_total: e.bets_total,
    pnl: Number(e.pnl ?? 0),
    hit_rate: e.bets_total > 0 ? Math.round((e.bets_won / e.bets_total) * 100) : 0,
    sport: e.sport,
    joined_at: e.joined_at,
  }));

  return NextResponse.json({
    leaderboard: ranked,
    system_wins: systemWins,
    system_pnl: systemPnl,
    points_per_win: 10,
    updated_at: new Date().toISOString(),
  });
}

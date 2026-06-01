import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { requireAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

type TennisPredictionInput = {
  match_id?: string;
  id?: string;
  player1?: string;
  player2?: string;
  tournament?: string;
  surface?: string;
  round?: string;
  scheduled_at?: string;
  scheduled?: string;
  p1?: number;
  p2?: number;
  odds_p1?: number | null;
  odds_p2?: number | null;
  edge?: number | null;
  best_selection?: string | null;
  model_version?: string;
  model?: string;
  // Elo analysis fields
  elo_p1?: number | null;
  elo_p2?: number | null;
  elo_p1_overall?: number | null;
  elo_p2_overall?: number | null;
  surface_matches_p1?: number | null;
  surface_matches_p2?: number | null;
  elo_raw_p1?: number | null;
  elo_raw_p2?: number | null;
};

type TennisPrediction = ReturnType<typeof normalizePrediction>;

type RedisTennisPayload = {
  predictions?: TennisPredictionInput[];
  computed_at?: string;
};

type DbTennisPrediction = {
  match_id: string;
  tournament: string | null;
  surface: string | null;
  player1: string;
  player2: string;
  scheduled_at: string | null;
  p1: number | null;
  p2: number | null;
  odds_p1: number | null;
  odds_p2: number | null;
  edge: number | null;
  best_selection: string | null;
  model_version: string | null;
  computed_at: string | null;
};


async function getFromRedis(): Promise<RedisTennisPayload | null> {
  const kvUrl = process.env.KV_URL || process.env.UPSTASH_REDIS_REST_URL || "";
  const kvToken =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    "";

  if (!kvUrl || !kvToken) return null;

  try {
    const res = await fetch(`${kvUrl}/get/model:tennis_probs`, {
      headers: { Authorization: `Bearer ${kvToken}` },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.result) return null;
    return JSON.parse(data.result) as RedisTennisPayload;
  } catch {
    return null;
  }
}


async function getFromDb(): Promise<{ predictions: TennisPredictionInput[]; computed_at?: string } | null> {
  const rows = await dbQuery<DbTennisPrediction>(`
    SELECT match_id, tournament, surface, player1, player2, scheduled_at,
           p1, p2, odds_p1, odds_p2, edge, best_selection, model_version, computed_at
    FROM tennis_predictions
    ORDER BY computed_at DESC
    LIMIT 80
  `);
  if (!rows.length) return null;

  return {
    predictions: rows.map((row) => ({
      match_id: row.match_id,
      player1: row.player1,
      player2: row.player2,
      tournament: row.tournament || "",
      surface: row.surface || "hard",
      scheduled_at: row.scheduled_at || "",
      p1: Number(row.p1 ?? 0.5),
      p2: Number(row.p2 ?? 0.5),
      odds_p1: row.odds_p1 == null ? null : Number(row.odds_p1),
      odds_p2: row.odds_p2 == null ? null : Number(row.odds_p2),
      edge: row.edge == null ? null : Number(row.edge),
      best_selection: row.best_selection,
      model_version: row.model_version || "elo_surface_v2",
    })),
    computed_at: rows[0]?.computed_at || undefined,
  };
}

function normalizePrediction(p: TennisPredictionInput) {
  return {
    id: p.match_id || p.id || "",
    player1: p.player1 || "",
    player2: p.player2 || "",
    tournament: p.tournament || "",
    surface: (p.surface || "hard").toUpperCase(),
    round: p.round || "",
    scheduled: p.scheduled_at || p.scheduled || "",
    p1: p.p1 ?? 0.5,
    p2: p.p2 ?? 0.5,
    odds_p1: p.odds_p1 ?? null,
    odds_p2: p.odds_p2 ?? null,
    edge: p.edge ?? null,
    best_selection: p.best_selection ?? null,
    model: p.model_version || p.model || "elo_surface_v2",
    elo_p1: p.elo_p1 ?? null,
    elo_p2: p.elo_p2 ?? null,
    elo_p1_overall: p.elo_p1_overall ?? null,
    elo_p2_overall: p.elo_p2_overall ?? null,
    surface_matches_p1: p.surface_matches_p1 ?? null,
    surface_matches_p2: p.surface_matches_p2 ?? null,
    elo_raw_p1: p.elo_raw_p1 ?? null,
    elo_raw_p2: p.elo_raw_p2 ?? null,
  };
}

export async function GET(req: Request) {
  const { deny } = await requireAccess(req);
  if (deny) return deny;
  const now = new Date().toISOString();

  const redisData = await getFromRedis();

  if (redisData && Array.isArray(redisData.predictions) && redisData.predictions.length > 0) {
    const matches: TennisPrediction[] = redisData.predictions.map(normalizePrediction);
    const summary = {
      total_today: matches.length,
      value_bets: matches.filter((m) => m.edge != null && m.edge > 0.025).length,
      markets_active: matches.length,
      pnl: 0.0,
      source: "live",
    };
    return NextResponse.json({
      matches,
      summary,
      status: "paper",
      computed_at: redisData.computed_at || now,
      source: "redis",
    });
  }

  const dbData = await getFromDb();
  if (dbData && Array.isArray(dbData.predictions) && dbData.predictions.length > 0) {
    const matches: TennisPrediction[] = dbData.predictions.map(normalizePrediction);
    const summary = {
      total_today: matches.length,
      value_bets: matches.filter((m) => m.edge != null && m.edge > 0.025).length,
      markets_active: matches.length,
      pnl: 0.0,
      source: "database",
    };
    return NextResponse.json({
      matches,
      summary,
      status: "signal",
      computed_at: dbData.computed_at || now,
      source: "database",
    });
  }

  return NextResponse.json({
    matches: [],
    summary: { total_today: 0, value_bets: 0, markets_active: 0, pnl: 0.0, source: "none" },
    status: "not_ready",
    computed_at: now,
    source: "none",
    is_placeholder: false,
    readiness: {
      ready_for_live: false,
      required: [
        "real fixture feed",
        "real odds feed",
        "surface/player model writer",
        "Redis or Supabase persistence",
        "settlement/history writer",
      ],
    },
  });
}

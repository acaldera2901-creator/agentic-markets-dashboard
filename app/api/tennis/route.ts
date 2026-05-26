import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";

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

function futureDateISO(daysFromNow: number, hour = 14): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

const PLACEHOLDER_MATCHES = [
  {
    id: "RG2026_SF1",
    player1: "Carlos Alcaraz",
    player2: "Jannik Sinner",
    tournament: "Roland Garros",
    surface: "CLAY",
    round: "SF",
    scheduled: futureDateISO(2, 14),
    p1: 0.52,
    p2: 0.48,
    odds_p1: 1.91,
    odds_p2: 1.95,
    edge: 0.032,
    best_selection: "P1",
    model: "elo_surface_v2",
    elo_p1: 2198.4,
    elo_p2: 2181.2,
    elo_p1_overall: 2142.6,
    elo_p2_overall: 2138.9,
    surface_matches_p1: 87,
    surface_matches_p2: 74,
    elo_raw_p1: 0.5218,
    elo_raw_p2: 0.4782,
  },
  {
    id: "RG2026_SF2",
    player1: "Novak Djokovic",
    player2: "Holger Rune",
    tournament: "Roland Garros",
    surface: "CLAY",
    round: "SF",
    scheduled: futureDateISO(2, 16),
    p1: 0.61,
    p2: 0.39,
    odds_p1: 1.58,
    odds_p2: 2.40,
    edge: 0.018,
    best_selection: "P1",
    model: "elo_surface_v2",
    elo_p1: 2234.1,
    elo_p2: 1967.8,
    elo_p1_overall: 2201.4,
    elo_p2_overall: 1923.5,
    surface_matches_p1: 142,
    surface_matches_p2: 61,
    elo_raw_p1: 0.6088,
    elo_raw_p2: 0.3912,
  },
  {
    id: "RG2026_QF_W1",
    player1: "Iga Swiatek",
    player2: "Coco Gauff",
    tournament: "Roland Garros (W)",
    surface: "CLAY",
    round: "QF",
    scheduled: futureDateISO(3, 11),
    p1: 0.58,
    p2: 0.42,
    odds_p1: 1.68,
    odds_p2: 2.20,
    edge: 0.047,
    best_selection: "P1",
    model: "elo_surface_v2",
    elo_p1: 2216.3,
    elo_p2: 2024.7,
    elo_p1_overall: 2174.8,
    elo_p2_overall: 1998.2,
    surface_matches_p1: 118,
    surface_matches_p2: 52,
    elo_raw_p1: 0.5801,
    elo_raw_p2: 0.4199,
  },
  {
    id: "RG2026_QF_W2",
    player1: "Aryna Sabalenka",
    player2: "Elena Rybakina",
    tournament: "Roland Garros (W)",
    surface: "CLAY",
    round: "QF",
    scheduled: futureDateISO(3, 13),
    p1: 0.49,
    p2: 0.51,
    odds_p1: 2.02,
    odds_p2: 1.82,
    edge: 0.011,
    best_selection: "P2",
    model: "elo_surface_v2",
    elo_p1: 1984.6,
    elo_p2: 2011.3,
    elo_p1_overall: 2047.2,
    elo_p2_overall: 2008.9,
    surface_matches_p1: 38,
    surface_matches_p2: 43,
    elo_raw_p1: 0.4915,
    elo_raw_p2: 0.5085,
  },
  {
    id: "QUEENS2026_R1_1",
    player1: "Taylor Fritz",
    player2: "Alex de Minaur",
    tournament: "Cinch Championships (Queens)",
    surface: "GRASS",
    round: "R16",
    scheduled: futureDateISO(4, 12),
    p1: 0.45,
    p2: 0.55,
    odds_p1: 2.18,
    odds_p2: 1.74,
    edge: 0.0,
    best_selection: null,
    model: "elo_surface_v2",
    elo_p1: 1834.2,
    elo_p2: 1891.6,
    elo_p1_overall: 1902.4,
    elo_p2_overall: 1918.7,
    surface_matches_p1: 29,
    surface_matches_p2: 34,
    elo_raw_p1: 0.4501,
    elo_raw_p2: 0.5499,
  },
  {
    id: "LVIV2026_R1_1",
    player1: "Daria Kasatkina",
    player2: "Madison Keys",
    tournament: "WTA Strasbourg",
    surface: "CLAY",
    round: "QF",
    scheduled: futureDateISO(4, 10),
    p1: 0.54,
    p2: 0.46,
    odds_p1: 1.85,
    odds_p2: 1.99,
    edge: 0.028,
    best_selection: "P1",
    model: "elo_surface_v2",
    elo_p1: 1873.4,
    elo_p2: 1798.1,
    elo_p1_overall: 1841.6,
    elo_p2_overall: 1812.3,
    surface_matches_p1: 67,
    surface_matches_p2: 31,
    elo_raw_p1: 0.5384,
    elo_raw_p2: 0.4616,
  },
];

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

export async function GET() {
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

  // Fallback to placeholder data — live mode requires Redis/Upstash connection
  const summary = {
    total_today: 0,
    value_bets: 0,
    markets_active: 0,
    pnl: 0.0,
    source: "placeholder",
  };

  return NextResponse.json({
    matches: PLACEHOLDER_MATCHES,
    summary,
    status: "offline",
    computed_at: now,
    source: "placeholder",
    is_placeholder: true,
  });
}

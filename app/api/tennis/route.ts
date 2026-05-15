import { NextResponse } from "next/server";

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
};

type TennisPrediction = ReturnType<typeof normalizePrediction>;

type RedisTennisPayload = {
  predictions?: TennisPredictionInput[];
  computed_at?: string;
};

const PLACEHOLDER_MATCHES = [
  {
    id: "RG2026_SF1",
    player1: "Carlos Alcaraz",
    player2: "Jannik Sinner",
    tournament: "Roland Garros",
    surface: "CLAY",
    round: "SF",
    scheduled: "2026-05-14T14:00:00Z",
    p1: 0.52,
    p2: 0.48,
    odds_p1: 1.91,
    odds_p2: 1.95,
    edge: 0.032,
    best_selection: "P1",
    model: "elo_surface_v2",
  },
  {
    id: "RG2026_SF2",
    player1: "Novak Djokovic",
    player2: "Holger Rune",
    tournament: "Roland Garros",
    surface: "CLAY",
    round: "SF",
    scheduled: "2026-05-14T16:30:00Z",
    p1: 0.61,
    p2: 0.39,
    odds_p1: 1.58,
    odds_p2: 2.40,
    edge: 0.018,
    best_selection: "P1",
    model: "elo_surface_v2",
  },
  {
    id: "RG2026_QF_W1",
    player1: "Iga Swiatek",
    player2: "Coco Gauff",
    tournament: "Roland Garros (W)",
    surface: "CLAY",
    round: "QF",
    scheduled: "2026-05-14T11:00:00Z",
    p1: 0.58,
    p2: 0.42,
    odds_p1: 1.68,
    odds_p2: 2.20,
    edge: 0.047,
    best_selection: "P1",
    model: "elo_surface_v2",
  },
  {
    id: "RG2026_QF_W2",
    player1: "Aryna Sabalenka",
    player2: "Elena Rybakina",
    tournament: "Roland Garros (W)",
    surface: "CLAY",
    round: "QF",
    scheduled: "2026-05-14T13:00:00Z",
    p1: 0.49,
    p2: 0.51,
    odds_p1: 2.02,
    odds_p2: 1.82,
    edge: 0.011,
    best_selection: "P2",
    model: "elo_surface_v2",
  },
  {
    id: "QUEENS2026_R1_1",
    player1: "Taylor Fritz",
    player2: "Alex de Minaur",
    tournament: "Cinch Championships (Queens)",
    surface: "GRASS",
    round: "R16",
    scheduled: "2026-05-14T12:00:00Z",
    p1: 0.45,
    p2: 0.55,
    odds_p1: 2.18,
    odds_p2: 1.74,
    edge: 0.0,
    best_selection: null,
    model: "elo_surface_v2",
  },
  {
    id: "LVIV2026_R1_1",
    player1: "Daria Kasatkina",
    player2: "Madison Keys",
    tournament: "WTA Strasbourg",
    surface: "CLAY",
    round: "QF",
    scheduled: "2026-05-14T10:30:00Z",
    p1: 0.54,
    p2: 0.46,
    odds_p1: 1.85,
    odds_p2: 1.99,
    edge: 0.028,
    best_selection: "P1",
    model: "elo_surface_v2",
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

  // Fallback to placeholder data — live mode requires Redis/Upstash connection
  const summary = {
    total_today: 12,
    value_bets: PLACEHOLDER_MATCHES.filter((m) => m.edge != null && m.edge > 0.025).length,
    markets_active: 28,
    pnl: 0.0,
    source: "placeholder",
  };

  return NextResponse.json({
    matches: PLACEHOLDER_MATCHES,
    summary,
    status: "paper",
    computed_at: now,
    source: "placeholder",
  });
}

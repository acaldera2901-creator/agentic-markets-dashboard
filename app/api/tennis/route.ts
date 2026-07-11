import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { resolveAccessState } from "@/lib/auth";
import { isUnlocked } from "@/lib/access-projection";
import type { AccessState } from "@/lib/auth";
import { withAffiliate } from "@/lib/affiliate";
import { surfaceDecision, tennisFloorFor } from "@/lib/surfacing-gate";

export const dynamic = "force-dynamic";

// Per-state projection that PRESERVES the tennis card shape the frontend expects
// (player1/player2/surface/p1/p2/...). When locked, the sensitive numbers are
// nulled (frontend blurs on `locked`); the matchup + tournament stay visible so
// the public board is populated. Distinct from the football projection on purpose.
function projectTennisMatches<T extends { id: string; p1: number; p2: number; scheduled: string; edge?: number | null }>(
  matches: T[],
  state: AccessState,
  country: string | null
): Array<T & { locked: boolean; pick_of_day: boolean }> {
  // Vetrina settimanale (#PLANS-3TIER-1): rank per edge desc (fallback confidence)
  // tra le partite tennis. free sblocca rank<1, base rank<5, premium tutto.
  const rankById = new Map<string, number>();
  [...matches]
    .map((m) => ({ id: m.id, edge: typeof m.edge === "number" ? m.edge : -Infinity, conf: Math.max(m.p1, m.p2) }))
    .sort((a, b) => b.edge - a.edge || b.conf - a.conf)
    .forEach((r, i) => rankById.set(r.id, i));
  return matches.map((m) => {
    const rank = rankById.get(m.id) ?? Infinity;
    const isPotD = rank === 0;
    const unlocked = isUnlocked(state, rank);
    if (unlocked) {
      // Confidence-surfacing gate (10y lab 2026-06-08; segment-aware floors
      // #TENNIS-SEG-FLOOR-1 2026-06-11): below the tournament's floor there is
      // no clear favourite — drop the directional pick (the card shows none).
      // Probability-neutral: p1/p2/confidence are unchanged.
      const confidence = Math.round(Math.max(m.p1, m.p2) * 100);
      const floor = tennisFloorFor((m as { tournament?: string }).tournament);
      const { isPick, belowFloor } = surfaceDecision(confidence, floor);
      const isPro = state === "premium" || state === "admin_full";
      const out: Record<string, unknown> = {
        ...m,
        locked: false,
        pick_of_day: isPotD,
        confidence_score: confidence,
        below_floor: belowFloor,
        pick: isPick
          ? (m.p1 >= m.p2 ? (m as { player1?: string }).player1 : (m as { player2?: string }).player2)
          : null,
      };
      // Deep Analysis tennis (elo, serve/return form, reliability) è PRO-only
      // (#PLANS-3TIER-1): base vede pick/probabilità/edge ma non i blocchi deep.
      if (!isPro) {
        Object.assign(out, {
          elo_p1: null, elo_p2: null, elo_p1_overall: null, elo_p2_overall: null,
          serve_form_p1: null, serve_form_p2: null, return_form_p1: null, return_form_p2: null,
          surface_reliability_p1: null, surface_reliability_p2: null, feature_quality: null,
        });
      }
      return withAffiliate(out, country) as T & { locked: boolean; pick_of_day: boolean };
    }
    // locked: keep matchup + surface visible, blank the numbers the card would show
    return {
      ...m,
      locked: true,
      pick_of_day: isPotD,
      p1: null, p2: null, odds_p1: null, odds_p2: null, edge: null, best_selection: null,
      elo_p1: null, elo_p2: null, elo_p1_overall: null, elo_p2_overall: null,
      serve_form_p1: null, serve_form_p2: null, return_form_p1: null, return_form_p2: null,
      surface_reliability_p1: null, surface_reliability_p2: null, feature_quality: null,
    } as unknown as T & { locked: boolean; pick_of_day: boolean };
  });
}

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
  serve_form_p1?: number | null;
  serve_form_p2?: number | null;
  return_form_p1?: number | null;
  return_form_p2?: number | null;
  surface_reliability_p1?: number | null;
  surface_reliability_p2?: number | null;
  feature_quality?: number | null;
  p1_rest_days?: number | null;
  p2_rest_days?: number | null;
  p1_recent_matches_14d?: number | null;
  p2_recent_matches_14d?: number | null;
  h2h_p1_wins?: number | null;
  h2h_p2_wins?: number | null;
  elo_raw_p1?: number | null;
  elo_raw_p2?: number | null;
};

type TennisPrediction = NonNullable<ReturnType<typeof normalizePrediction>>;

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
  elo_p1: number | null;
  elo_p2: number | null;
  surface_matches_p1: number | null;
  surface_matches_p2: number | null;
  serve_form_p1: number | null;
  serve_form_p2: number | null;
  return_form_p1: number | null;
  return_form_p2: number | null;
  surface_reliability_p1: number | null;
  surface_reliability_p2: number | null;
  feature_quality: number | null;
  p1_rest_days: number | null;
  p2_rest_days: number | null;
  p1_recent_matches_14d: number | null;
  p2_recent_matches_14d: number | null;
  h2h_p1_wins: number | null;
  h2h_p2_wins: number | null;
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
    SELECT * FROM (
      SELECT DISTINCT ON (COALESCE(NULLIF(split_part(tp.match_id, ':', 3), ''), tp.match_id))
             tp.match_id, tp.tournament, tp.surface, tp.player1, tp.player2, tp.scheduled_at,
             tp.p1, tp.p2, tp.odds_p1, tp.odds_p2, tp.edge, tp.best_selection,
             tp.elo_p1, tp.elo_p2, tp.surface_matches_p1, tp.surface_matches_p2,
             tp.serve_form_p1, tp.serve_form_p2, tp.return_form_p1, tp.return_form_p2,
             tp.surface_reliability_p1, tp.surface_reliability_p2, tp.feature_quality,
             tp.p1_rest_days, tp.p2_rest_days, tp.p1_recent_matches_14d, tp.p2_recent_matches_14d,
             tp.h2h_p1_wins, tp.h2h_p2_wins,
             tp.model_version, tp.computed_at
      FROM tennis_predictions tp
      -- #LIVE-1: 5h coprono anche un Bo5 lungo — il match resta visibile
      -- mentre si gioca; al settlement winner si valorizza e la riga esce.
      WHERE tp.scheduled_at > NOW() - INTERVAL '5 hours'
        AND tp.winner IS NULL
        -- Fail-closed (#020 audit): a row without real model probabilities
        -- must never surface — the old ?? 0.5 default would have shown a
        -- fabricated-looking 50/50.
        AND tp.p1 IS NOT NULL
        AND tp.p2 IS NOT NULL
        -- No placeholder matches: ESPN returns 'TBD' players for slots whose
        -- draw isn't made yet — never surface a "TBD vs TBD" card.
        AND upper(btrim(tp.player1)) NOT IN ('TBD', '')
        AND upper(btrim(tp.player2)) NOT IN ('TBD', '')
      ORDER BY COALESCE(NULLIF(split_part(tp.match_id, ':', 3), ''), tp.match_id), tp.computed_at DESC
    ) d
    ORDER BY d.scheduled_at ASC
    LIMIT 80
  `);
  if (!rows.length) return null;

  return {
    predictions: rows.map((row) => ({
      match_id: row.match_id,
      player1: row.player1,
      player2: row.player2,
      tournament: row.tournament || "",
      // Surface is always written by our pipeline (inferred from the real
      // tournament name); never invent "hard" when it is genuinely absent.
      surface: row.surface || "",
      scheduled_at: row.scheduled_at || "",
      // SQL filters p1/p2 IS NOT NULL — no fabricated 0.5 fallback.
      p1: Number(row.p1),
      p2: Number(row.p2),
      odds_p1: row.odds_p1 == null ? null : Number(row.odds_p1),
      odds_p2: row.odds_p2 == null ? null : Number(row.odds_p2),
      edge: row.edge == null ? null : Number(row.edge),
      best_selection: row.best_selection,
      elo_p1: row.elo_p1 == null ? null : Number(row.elo_p1),
      elo_p2: row.elo_p2 == null ? null : Number(row.elo_p2),
      surface_matches_p1: row.surface_matches_p1 == null ? null : Number(row.surface_matches_p1),
      surface_matches_p2: row.surface_matches_p2 == null ? null : Number(row.surface_matches_p2),
      serve_form_p1: row.serve_form_p1 == null ? null : Number(row.serve_form_p1),
      serve_form_p2: row.serve_form_p2 == null ? null : Number(row.serve_form_p2),
      return_form_p1: row.return_form_p1 == null ? null : Number(row.return_form_p1),
      return_form_p2: row.return_form_p2 == null ? null : Number(row.return_form_p2),
      surface_reliability_p1: row.surface_reliability_p1 == null ? null : Number(row.surface_reliability_p1),
      surface_reliability_p2: row.surface_reliability_p2 == null ? null : Number(row.surface_reliability_p2),
      feature_quality: row.feature_quality == null ? null : Number(row.feature_quality),
      p1_rest_days: row.p1_rest_days == null ? null : Number(row.p1_rest_days),
      p2_rest_days: row.p2_rest_days == null ? null : Number(row.p2_rest_days),
      p1_recent_matches_14d: row.p1_recent_matches_14d == null ? null : Number(row.p1_recent_matches_14d),
      p2_recent_matches_14d: row.p2_recent_matches_14d == null ? null : Number(row.p2_recent_matches_14d),
      h2h_p1_wins: row.h2h_p1_wins == null ? null : Number(row.h2h_p1_wins),
      h2h_p2_wins: row.h2h_p2_wins == null ? null : Number(row.h2h_p2_wins),
      model_version: row.model_version || "elo_surface_v2",
    })),
    computed_at: rows[0]?.computed_at || undefined,
  };
}

// Fail-closed (#020 audit): rows without real model probabilities return null
// and are dropped by the callers — the old `?? 0.5` default would have shown a
// fabricated-looking 50/50 to the customer.
function normalizePrediction(p: TennisPredictionInput) {
  if (p.p1 == null || p.p2 == null) return null;
  return {
    id: p.match_id || p.id || "",
    player1: p.player1 || "",
    player2: p.player2 || "",
    tournament: p.tournament || "",
    // Never invent a surface: our pipeline always writes one (inferred from
    // the real tournament name); absent stays visibly absent.
    surface: (p.surface || "").toUpperCase(),
    round: p.round || "",
    scheduled: p.scheduled_at || p.scheduled || "",
    p1: p.p1,
    p2: p.p2,
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
    serve_form_p1: p.serve_form_p1 ?? null,
    serve_form_p2: p.serve_form_p2 ?? null,
    return_form_p1: p.return_form_p1 ?? null,
    return_form_p2: p.return_form_p2 ?? null,
    surface_reliability_p1: p.surface_reliability_p1 ?? null,
    surface_reliability_p2: p.surface_reliability_p2 ?? null,
    feature_quality: p.feature_quality ?? null,
    p1_rest_days: p.p1_rest_days ?? null,
    p2_rest_days: p.p2_rest_days ?? null,
    p1_recent_matches_14d: p.p1_recent_matches_14d ?? null,
    p2_recent_matches_14d: p.p2_recent_matches_14d ?? null,
    h2h_p1_wins: p.h2h_p1_wins ?? null,
    h2h_p2_wins: p.h2h_p2_wins ?? null,
    elo_raw_p1: p.elo_raw_p1 ?? null,
    elo_raw_p2: p.elo_raw_p2 ?? null,
  };
}

export async function GET(req: Request) {
  const { state } = await resolveAccessState(req); // never denies (read)
  // #ITALIA-EU-PARERE: geo per il gate allowlist del bonus-CTA affiliato
  // (withAffiliate). Header Vercel/Cloudflare, server-side.
  const country = req.headers.get("x-vercel-ip-country") || req.headers.get("cf-ipcountry");
  const now = new Date().toISOString();

  const redisData = await getFromRedis();

  if (redisData && Array.isArray(redisData.predictions) && redisData.predictions.length > 0) {
    const matches: TennisPrediction[] = redisData.predictions
      .map(normalizePrediction)
      .filter((m): m is TennisPrediction => m !== null);
    const projected = projectTennisMatches(matches, state, country);
    const summary = {
      total_today: matches.length,
      value_bets: matches.filter((m) => m.edge != null && m.edge > 0.025).length,
      markets_active: matches.length,
      source: "live",
    };
    return NextResponse.json({
      matches: projected,
      summary,
      status: "paper",
      computed_at: redisData.computed_at || now,
      source: "redis",
    });
  }

  const dbData = await getFromDb();
  if (dbData && Array.isArray(dbData.predictions) && dbData.predictions.length > 0) {
    const matches: TennisPrediction[] = dbData.predictions
      .map(normalizePrediction)
      .filter((m): m is TennisPrediction => m !== null);
    const projected = projectTennisMatches(matches, state, country);
    const summary = {
      total_today: matches.length,
      value_bets: matches.filter((m) => m.edge != null && m.edge > 0.025).length,
      markets_active: matches.length,
      source: "database",
    };
    return NextResponse.json({
      matches: projected,
      summary,
      status: "signal",
      computed_at: dbData.computed_at || now,
      source: "database",
    });
  }

  return NextResponse.json({
    matches: [],
    summary: { total_today: 0, value_bets: 0, markets_active: 0, source: "none" },
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

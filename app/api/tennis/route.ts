import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { resolveAccessState } from "@/lib/auth";
import { isUnlocked, showcaseRanking, currentShowcaseDay } from "@/lib/access-projection";
import type { AccessState } from "@/lib/auth";
import { withAffiliate } from "@/lib/affiliate";
import { tennisSurfaceDecision } from "@/lib/surfacing-gate";

export const dynamic = "force-dynamic";

// Per-state projection that PRESERVES the tennis card shape the frontend expects
// (player1/player2/surface/p1/p2/...). When locked, the sensitive numbers are
// nulled (frontend blurs on `locked`); the matchup + tournament stay visible so
// the public board is populated. Distinct from the football projection on purpose.
// The price on the side this route would show as the pick (same p1>=p2 rule used
// below), so the market gate and the displayed pick can never look at different
// sides of the market. #TENNIS-MARKET-GATE-0805.
function pickedTennisOdds(m: {
  p1: number;
  p2: number;
  odds_p1?: number | null;
  odds_p2?: number | null;
}): number | null {
  return (m.p1 >= m.p2 ? m.odds_p1 : m.odds_p2) ?? null;
}

function projectTennisMatches<T extends { id: string; p1: number; p2: number; scheduled: string; edge?: number | null; odds_p1?: number | null; odds_p2?: number | null }>(
  matches: T[],
  state: AccessState
): Array<T & { locked: boolean; pick_of_day: boolean }> {
  // Vetrina GIORNALIERA (#FREE-BASE-DAILY-QUOTA-0831): free 3 per sport, base 7,
  // premium tutto — contate SOLO sulle partite di oggi (`scopeDay`), la stessa
  // regola della board calcio. L'ORDINE è showcaseRanking — pick sopra floor prima, poi
  // confidenza, poi edge (#SHOWCASE-EDGE-0801: l'ordine per edge desc sbloccava
  // righe senza pick e lasciava bloccati i pick; il tennis aveva la stessa riga
  // del football, quindi lo stesso difetto).
  //
  // Qui il floor è quello segment-aware del torneo, la stessa risoluzione usata
  // sotto per decidere se mostrare la direzione: si calcola una volta e la si
  // riusa, così ordine e contenuto della card non possono divergere.
  const rankById = showcaseRanking(
    matches.map((m) => {
      const confidence = Math.round(Math.max(m.p1, m.p2) * 100);
      return {
        id: m.id,
        // #TENNIS-MARKET-GATE-0805: the showcase order must rank by the SAME
        // notion of "surfaced" the card uses, market gate included — otherwise a
        // no-market row would be unlocked ahead of a real pick.
        surfaced: tennisSurfaceDecision(
          confidence,
          (m as { tournament?: string }).tournament,
          pickedTennisOdds(m)
        ).isPick,
        conf: Math.max(m.p1, m.p2),
        edge: typeof m.edge === "number" ? m.edge : null,
        startsAt: m.scheduled,
      };
    }),
    { scopeDay: currentShowcaseDay() }
  );
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
      // #TENNIS-MARKET-GATE-0805: no price on the picked side → no directional
      // pick. `no_market` stays distinct from `below_floor`: below floor means
      // the model has no clear favourite, no-market means we have one but no
      // price to check it against — the copy must not conflate the two.
      const { isPick, belowFloor, noMarket } = tennisSurfaceDecision(
        confidence,
        (m as { tournament?: string }).tournament,
        pickedTennisOdds(m)
      );
      const isPro = state === "premium" || state === "admin_full";
      const out: Record<string, unknown> = {
        ...m,
        locked: false,
        pick_of_day: isPotD,
        confidence_score: confidence,
        below_floor: belowFloor,
        no_market: noMarket,
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
          // #GOLIVE-AUDIT: anche questi feature deep non vanno al tier base (lo
          // spread ...m li passava: elo_raw/h2h/rest/recent-14d/surface_matches
          // codificano il segnale del modello Pro-only).
          surface_matches_p1: null, surface_matches_p2: null,
          p1_rest_days: null, p2_rest_days: null,
          p1_recent_matches_14d: null, p2_recent_matches_14d: null,
          h2h_p1_wins: null, h2h_p2_wins: null,
          elo_raw_p1: null, elo_raw_p2: null,
        });
      }
      return withAffiliate(out) as T & { locked: boolean; pick_of_day: boolean };
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
      // #GOLIVE-AUDIT: lo spread ...m faceva trapelare questi campi anche sulle
      // righe locked (anonimo/free), permettendo di inferire la pick gated.
      surface_matches_p1: null, surface_matches_p2: null,
      p1_rest_days: null, p2_rest_days: null,
      p1_recent_matches_14d: null, p2_recent_matches_14d: null,
      h2h_p1_wins: null, h2h_p2_wins: null,
      elo_raw_p1: null, elo_raw_p2: null,
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


async function getFromDb(): Promise<{ predictions: TennisPredictionInput[]; computed_at?: string; is_fallback?: boolean } | null> {
  // Colonne + chiave di dedup, condivise fra query primaria e fallback.
  const DEDUP = `COALESCE(NULLIF(split_part(tp.match_id, ':', 3), ''), tp.match_id)`;
  const COLS = `tp.match_id, tp.tournament, tp.surface, tp.player1, tp.player2, tp.scheduled_at,
             tp.p1, tp.p2, tp.odds_p1, tp.odds_p2, tp.edge, tp.best_selection,
             tp.elo_p1, tp.elo_p2, tp.surface_matches_p1, tp.surface_matches_p2,
             tp.serve_form_p1, tp.serve_form_p2, tp.return_form_p1, tp.return_form_p2,
             tp.surface_reliability_p1, tp.surface_reliability_p2, tp.feature_quality,
             tp.p1_rest_days, tp.p2_rest_days, tp.p1_recent_matches_14d, tp.p2_recent_matches_14d,
             tp.h2h_p1_wins, tp.h2h_p2_wins,
             tp.model_version, tp.computed_at`;
  // Fail-closed (#020 audit): mai righe senza probabilità reali (niente 0.5
  // fabbricato); mai slot 'TBD' con tabellone non ancora fatto.
  const BASE_FILTERS = `AND tp.p1 IS NOT NULL
        AND tp.p2 IS NOT NULL
        AND upper(btrim(tp.player1)) NOT IN ('TBD', '')
        AND upper(btrim(tp.player2)) NOT IN ('TBD', '')`;

  // Primaria: live/upcoming, non ancora settlati. #LIVE-1: 5h coprono anche un
  // Bo5 lungo (il match resta visibile mentre si gioca; al settlement `winner`
  // si valorizza e la riga esce → finisce in history).
  let rows = await dbQuery<DbTennisPrediction>(`
    SELECT * FROM (
      SELECT DISTINCT ON (${DEDUP}) ${COLS}
      FROM tennis_predictions tp
      WHERE tp.scheduled_at > NOW() - INTERVAL '5 hours'
        AND tp.winner IS NULL
        ${BASE_FILTERS}
      ORDER BY ${DEDUP}, tp.computed_at DESC
    ) d
    ORDER BY d.scheduled_at ASC
    LIMIT 80
  `);
  let is_fallback = false;

  // #TENNIS-NEVER-EMPTY: se non c'è nulla di live/upcoming (buco notturno o fine
  // slate), invece di lasciare il board VUOTO mostriamo gli ultimi match recenti
  // (con predizione, anche già conclusi). Il frontend, via `is_placeholder`, li
  // rende bypassando la finestra di trading. È l'unico stato in cui compaiono
  // match finiti sul board — meglio di una pagina bianca.
  if (!rows.length) {
    rows = await dbQuery<DbTennisPrediction>(`
      SELECT * FROM (
        SELECT DISTINCT ON (${DEDUP}) ${COLS}
        FROM tennis_predictions tp
        WHERE tp.scheduled_at > NOW() - INTERVAL '24 hours'
          ${BASE_FILTERS}
        ORDER BY ${DEDUP}, tp.computed_at DESC
      ) d
      ORDER BY d.scheduled_at DESC
      LIMIT 12
    `);
    is_fallback = rows.length > 0;
  }

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
    is_fallback,
  };
}

// #TENNIS-TZ-FIX: `tennis_predictions.scheduled_at` è `timestamp without time
// zone` (UTC ma naïve), quindi arriva senza designatore di fuso. Il frontend fa
// `new Date("2026-08-05T19:35:00")`, che senza offset viene interpretato come ORA
// LOCALE del browser → l'orario mostrato è sfasato dell'offset locale. Il calcio è
// corretto perché serve `kickoff` con `+00:00`. Marchiamo la stringa come UTC: da
// lì la stessa `fmtKickoff`/`useTz` la riproietta nel fuso geolocato dell'utente,
// identica al calcio. Se una stringa ha già offset/Z (es. path Redis) resta com'è.
function ensureUtc(s: string): string {
  if (!s) return s;
  if (/[zZ]$|[+-]\d\d:?\d\d$/.test(s)) return s;
  return s + "Z";
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
    scheduled: ensureUtc(p.scheduled_at || p.scheduled || ""),
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
  const now = new Date().toISOString();

  const redisData = await getFromRedis();

  if (redisData && Array.isArray(redisData.predictions) && redisData.predictions.length > 0) {
    const matches: TennisPrediction[] = redisData.predictions
      .map(normalizePrediction)
      .filter((m): m is TennisPrediction => m !== null);
    const projected = projectTennisMatches(matches, state);
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
    const projected = projectTennisMatches(matches, state);
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
      // #TENNIS-NEVER-EMPTY: quando questi sono i match "ultimi recenti" di
      // riserva (nessun live/upcoming), il flag dice al frontend di mostrarli
      // bypassando la finestra di trading, così il board non resta mai vuoto.
      is_placeholder: dbData.is_fallback ?? false,
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

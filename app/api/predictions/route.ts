import { NextResponse } from "next/server";
import { resolveAccessState, type AccessState } from "@/lib/auth";
import { isUnlocked } from "@/lib/access-projection";
import { pickOfDayId } from "@/lib/pick-of-day";

export const dynamic = "force-dynamic";
import { buildModel, predict, computeExtraMarkets, MatchResult } from "@/lib/poisson-model";
import { fetchHistory, fetchFixtures } from "@/lib/football-data";
import { fetchOdds, normName, OddsResult } from "@/lib/odds-api";
import { computePiRatings, computeTeamForms } from "@/lib/pi-rating";
import { fetchLeagueXG, matchTeam } from "@/lib/understat";
import { fetchMatchWeather } from "@/lib/weather";
import {
  fetchApiFixtures,
  fetchPrediction,
  fetchInjuries,
  matchFixture,
} from "@/lib/api-football-enrichment";

export const maxDuration = 300;

import { dbQuery } from "@/lib/db";
import { syncMatchPredictionsToUnified } from "@/lib/unified-adapter";

const LEAGUES: Record<string, string> = {
  SA: "Serie A",
  PL: "Premier League",
  PD: "La Liga",
  BL1: "Bundesliga",
  FL1: "Ligue 1",
  CL: "Champions League",
  EL: "Europa League",
  WC: "World Cup",
};

type PredictionRow = {
  id: number;
  match_id: string;
  league: string;
  league_name: string;
  home_team: string;
  away_team: string;
  kickoff: string;
  p_home: number;
  p_draw: number;
  p_away: number;
  lambda_home: number | null;
  lambda_away: number | null;
  odds_home: number | null;
  odds_draw: number | null;
  odds_away: number | null;
  edge: number | null;
  best_selection: string | null;
  model_matches: number | null;
  computed_at: string;
  match_type?: string | null;
  is_estimate?: boolean;
  enrichment?: EnrichmentPayload | null;
};

// When real market odds are missing we must NOT fabricate odds or an edge:
// the customer could not tell a real value-bet from an invented one, which is a
// legal-claim risk ("value" over the market). Instead we expose the model's
// probabilities only, mark the row as an estimate (is_estimate=true) and leave
// edge/odds null so the frontend never flags it as a value-bet.
function markModelEstimate(row: PredictionRow): PredictionRow {
  const hasRealOdds =
    row.odds_home != null && row.odds_draw != null && row.odds_away != null;

  if (hasRealOdds) {
    return { ...row, is_estimate: false };
  }

  // No real market odds: model estimate only — no synthetic odds, no edge.
  return {
    ...row,
    odds_home: null,
    odds_draw: null,
    odds_away: null,
    edge: null,
    is_estimate: true,
  };
}

// ─── Per-tier read projection (P0: stop premium enrichment leaking to Base) ─────
//
// Anonymous / free (non-PotD): row is locked — pick, probabilities, edge and all
//   enrichment are stripped; only the matchup + kickoff stay visible (the card
//   blurs on `locked`). Mirrors the tennis board behaviour.
// base/premium/admin or the free Pick of the Day: unlocked.
// The public paid plan is `base`, so active paid users see the advanced enrichment.

// Advanced enrichment keys — stripped for anonymous/free/pending users.
const PREMIUM_ENRICHMENT_KEYS = [
  "pi_home", "pi_away",
  "xg_home", "xga_home", "xg_away", "xga_away", "npxg_home", "npxg_away",
  "ppda_home", "ppda_away",
  "injuries_home", "injuries_away",
  "weather",
  "api_pct_home", "api_pct_draw", "api_pct_away", "api_advice",
  "research",
] as const;

type ProjectedPredictionRow = Partial<PredictionRow> & {
  match_id: string;
  league: string;
  league_name: string;
  home_team: string;
  away_team: string;
  kickoff: string;
  locked: boolean;
  pick_of_day: boolean;
};

function projectPredictionRow(
  p: PredictionRow,
  state: AccessState,
  isPotD: boolean
): ProjectedPredictionRow {
  const base = {
    match_id: p.match_id,
    league: p.league,
    league_name: p.league_name,
    home_team: p.home_team,
    away_team: p.away_team,
    kickoff: p.kickoff,
    match_type: p.match_type ?? null,
    pick_of_day: isPotD,
  };

  if (!isUnlocked(state, isPotD)) {
    // Locked: keep the matchup visible, blank everything the card would reveal.
    return { ...base, locked: true };
  }

  const isPaid = state === "base" || state === "premium" || state === "admin_full";

  let enrichment: EnrichmentPayload | null = p.enrichment ?? null;
  if (enrichment && !isPaid) {
    const e: Record<string, unknown> = { ...(enrichment as Record<string, unknown>) };
    for (const k of PREMIUM_ENRICHMENT_KEYS) delete e[k];
    // extra_markets stay for the free Pick of the Day, but strip the per-market edge.
    const em = e.extra_markets as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(em)) {
      e.extra_markets = em.map((market) => {
        const rest = { ...market };
        delete rest.edge;
        return rest;
      });
    }
    enrichment = e as EnrichmentPayload;
  }

  return {
    ...base,
    locked: false,
    p_home: p.p_home,
    p_draw: p.p_draw,
    p_away: p.p_away,
    lambda_home: p.lambda_home,
    lambda_away: p.lambda_away,
    odds_home: p.odds_home,
    odds_draw: p.odds_draw,
    odds_away: p.odds_away,
    edge: p.edge,
    best_selection: p.best_selection,
    model_matches: p.model_matches,
    is_estimate: p.is_estimate,
    enrichment,
  };
}

// Leagues supported by Understat (no CL/EL)
const UNDERSTAT_LEAGUES = new Set(["SA", "PL", "PD", "BL1", "FL1"]);


function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Understat cache helpers ─────────────────────────────────────────────────

type XGMap = Record<string, { xg_home: number; xga_home: number; xg_away: number; xga_away: number; npxg_home: number; npxg_away: number; ppda: number; form: string; xpts: number; name: string }>;

async function getCachedXG(league: string): Promise<XGMap> {
  const rows = await dbQuery<{ data: XGMap; cached_at: string }>(
    `SELECT data, cached_at FROM understat_cache WHERE league = $1`,
    [league]
  );
  if (rows.length) {
    const age = (Date.now() - new Date(rows[0].cached_at).getTime()) / 3_600_000;
    if (age < 6) return rows[0].data; // fresh enough
  }
  return {};
}

async function refreshXGCache(league: string): Promise<XGMap> {
  const data = await fetchLeagueXG(league);
  if (Object.keys(data).length) {
    await dbQuery(
      `INSERT INTO understat_cache (league, data, cached_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (league) DO UPDATE SET data = EXCLUDED.data, cached_at = NOW()`,
      [league, JSON.stringify(data)]
    );
  }
  return data;
}

async function getXGForLeague(league: string): Promise<XGMap> {
  if (!UNDERSTAT_LEAGUES.has(league)) return {};
  const cached = await getCachedXG(league);
  if (Object.keys(cached).length) return cached;
  return await refreshXGCache(league);
}

// ─── Main computation ────────────────────────────────────────────────────────

interface EnrichmentPayload {
  pi_home?: number;
  pi_away?: number;
  xg_home?: number;
  xga_home?: number;
  xg_away?: number;
  xga_away?: number;
  npxg_home?: number;
  npxg_away?: number;
  ppda_home?: number;
  ppda_away?: number;
  form_home?: string;
  form_away?: string;
  injuries_home?: string[];
  injuries_away?: string[];
  weather?: { temp: number; wind: number; condition: string; rain: number; icon: string } | null;
  api_pct_home?: number;
  api_pct_draw?: number;
  api_pct_away?: number;
  api_advice?: string;
  research?: string;
  extra_market_odds?: Partial<Record<string, number>>;
  reliability?: string;
  team_matches?: number;
}

async function computeAndStore(): Promise<{ stored: number; leagues: string[] }> {
  const codes = Object.keys(LEAGUES);
  const stored: string[] = [];
  const season = new Date().getFullYear();

  // ── BATCH 1: historical results (7 calls to football-data.org) ──────────
  const t0 = Date.now();
  const histories = await Promise.all(
    codes.map(async (code) => ({ code, results: await fetchHistory(code) }))
  );

  // Rate limiter: football-data.org free tier = 10 req/min. Used 7 — wait for window reset.
  const elapsed = Date.now() - t0;
  await wait(Math.max(62_000 - elapsed, 1_000));

  // ── BATCH 2: fixtures + odds + Understat xG + API-Football fixture lists ─
  const [fixtureResults, oddsResults, xgResults, apifixResults] =
    await Promise.all([
      Promise.all(codes.map(async (code) => ({ code, fixtures: await fetchFixtures(code) }))),
      Promise.all(codes.map(async (code) => ({ code, odds: await fetchOdds(code) }))),
      Promise.all(codes.map(async (code) => ({ code, xg: await getXGForLeague(code) }))),
      Promise.all(
        codes.map(async (code) => ({ code, apifix: await fetchApiFixtures(code, season) }))
      ),
    ]);

  // Build lookup maps
  const oddsMap: Record<string, Record<string, OddsResult>> = {};
  for (const { code, odds } of oddsResults) {
    oddsMap[code] = {};
    for (const o of odds) oddsMap[code][`${o.homeNorm}|${o.awayNorm}`] = o;
  }

  const xgMap: Record<string, XGMap> = {};
  for (const { code, xg } of xgResults) xgMap[code] = xg;

  const apifixMap: Record<string, typeof apifixResults[0]["apifix"]> = {};
  for (const { code, apifix } of apifixResults) apifixMap[code] = apifix;

  // Load existing research summaries once
  const researchRows = await dbQuery<{ match_id: string; summary: string }>(
    `SELECT match_id, summary FROM match_research WHERE created_at > NOW() - INTERVAL '48 hours'`
  );
  const researchMap: Record<string, string> = {};
  for (const r of researchRows) researchMap[r.match_id] = r.summary;

  // ── Per-league computation ───────────────────────────────────────────────
  for (const { code, results } of histories) {
    const training: MatchResult[] = results.map((r) => ({
      homeTeam: r.homeTeam,
      awayTeam: r.awayTeam,
      homeGoals: r.homeGoals!,
      awayGoals: r.awayGoals!,
    }));

    const model = buildModel(training);
    if (!model) {
      console.log(`[${code}] insufficient data (${training.length} matches)`);
      continue;
    }

    // Compute Pi Ratings and form from the same training data (free)
    const piRatings = computePiRatings(training);
    const teamForms = computeTeamForms(training);
    const leagueXG = xgMap[code] ?? {};
    const apiFixtures = apifixMap[code] ?? [];

    const fixtures = fixtureResults.find((f) => f.code === code)?.fixtures ?? [];
    console.log(`[${code}] model on ${model.matchCount} matches → ${fixtures.length} fixtures`);

    for (const fix of fixtures) {
      const probs = predict(fix.homeTeam, fix.awayTeam, model);
      if (!probs) continue;

      const key = `${normName(fix.homeTeam)}|${normName(fix.awayTeam)}`;
      const odds = oddsMap[code]?.[key];

      // P0 #3: predictions built on too few matches per team (e.g. CL/EL early
      // rounds) are not reliable. Never compute an edge or a value-bet selection
      // for them — they are shown only as flagged model estimates.
      let edge: number | null = null;
      let bestSel: string | null = null;
      if (odds && probs.reliable) {
        const eH = probs.pHome - 1 / odds.oddsHome;
        const eD = probs.pDraw - 1 / odds.oddsDraw;
        const eA = probs.pAway - 1 / odds.oddsAway;
        edge = Math.max(eH, eD, eA);
        bestSel = edge === eH ? "HOME" : edge === eD ? "DRAW" : "AWAY";
        edge = Math.round(edge * 10_000) / 10_000;
      }

      // ── Build enrichment payload ─────────────────────────────────────────
      const enrichment: EnrichmentPayload = {};
      if (!probs.reliable) {
        enrichment.reliability = "insufficient_data";
        enrichment.team_matches = probs.teamMatches;
        console.log(
          `[${code}] insufficient_data: ${fix.homeTeam} vs ${fix.awayTeam} (min ${probs.teamMatches} matches/team)`
        );
      }

      // Pi Rating
      const piH = piRatings[fix.homeTeam];
      const piA = piRatings[fix.awayTeam];
      if (piH) enrichment.pi_home = Math.round(piH.home);
      if (piA) enrichment.pi_away = Math.round(piA.away);

      // xG from Understat
      const xgH = matchTeam(fix.homeTeam, leagueXG);
      const xgA = matchTeam(fix.awayTeam, leagueXG);
      if (xgH) {
        enrichment.xg_home = xgH.xg_home;
        enrichment.xga_home = xgH.xga_home;
        enrichment.npxg_home = xgH.npxg_home;
        enrichment.ppda_home = xgH.ppda;
      }
      if (xgA) {
        enrichment.xg_away = xgA.xg_away;
        enrichment.xga_away = xgA.xga_away;
        enrichment.npxg_away = xgA.npxg_away;
        enrichment.ppda_away = xgA.ppda;
      }

      // Form from history
      const formH = teamForms[fix.homeTeam];
      const formA = teamForms[fix.awayTeam];
      if (formH) enrichment.form_home = formH.homeForm;
      if (formA) enrichment.form_away = formA.awayForm;

      // Research from Ollama (Python agent)
      if (researchMap[fix.id]) enrichment.research = researchMap[fix.id];

      // Resolve api-football fixture early — used for time correction + enrichment
      const apifix = matchFixture(fix.homeTeam, fix.awayTeam, apiFixtures);

      // football-data.org free tier returns 00:00:00 UTC as placeholder when time unconfirmed.
      // Prefer api-football.com date when available and not also midnight.
      const fdMidnight = fix.utcDate.includes("T00:00:00");
      const apifixDate = apifix?.date ? new Date(apifix.date) : null;
      const apifixMidnight = apifixDate ? (apifixDate.getUTCHours() === 0 && apifixDate.getUTCMinutes() === 0) : true;
      const finalKickoff = fdMidnight && apifixDate && !apifixMidnight
        ? apifixDate.toISOString()
        : fix.utcDate;

      // Weather (async, only for matches within 48h)
      const kickoffDate = new Date(finalKickoff);
      const hoursUntil = (kickoffDate.getTime() - Date.now()) / 3_600_000;
      if (hoursUntil >= 0 && hoursUntil <= 48) {
        try {
          enrichment.weather = await fetchMatchWeather(fix.homeTeam, kickoffDate);
        } catch {
          // non-blocking
        }
      }

      // Extra market odds from The Odds API (stored for edge computation in GET)
      if (odds?.extra) {
        const mo: Partial<Record<string, number>> = {};
        for (const [k, v] of Object.entries(odds.extra)) {
          if (v != null) mo[k] = v;
        }
        if (Object.keys(mo).length) enrichment.extra_market_odds = mo;
      }

      // API-Football: injuries + prediction (only for value bets or matches within 72h)
      const isValueBet = edge != null && edge > 0.03;
      if (hoursUntil >= 0 && hoursUntil <= 72 && (isValueBet || hoursUntil <= 24)) {
        if (apifix) {
          try {
            const [pred, injuries] = await Promise.all([
              fetchPrediction(apifix.fixtureId),
              fetchInjuries(apifix.fixtureId),
            ]);
            if (pred) {
              enrichment.api_pct_home = pred.pct_home;
              enrichment.api_pct_draw = pred.pct_draw;
              enrichment.api_pct_away = pred.pct_away;
              enrichment.api_advice = pred.advice;
            }
            if (injuries.home.length) enrichment.injuries_home = injuries.home;
            if (injuries.away.length) enrichment.injuries_away = injuries.away;
          } catch {
            // non-blocking
          }
        }
      }

      await dbQuery(
        `INSERT INTO match_predictions (
           match_id, league, league_name, home_team, away_team, kickoff,
           p_home, p_draw, p_away, lambda_home, lambda_away,
           odds_home, odds_draw, odds_away, edge, best_selection, model_matches,
           enrichment, computed_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,NOW())
         ON CONFLICT (match_id) DO UPDATE SET
           p_home=EXCLUDED.p_home, p_draw=EXCLUDED.p_draw, p_away=EXCLUDED.p_away,
           lambda_home=EXCLUDED.lambda_home, lambda_away=EXCLUDED.lambda_away,
           odds_home=COALESCE(EXCLUDED.odds_home, match_predictions.odds_home),
           odds_draw=COALESCE(EXCLUDED.odds_draw, match_predictions.odds_draw),
           odds_away=COALESCE(EXCLUDED.odds_away, match_predictions.odds_away),
           edge=COALESCE(EXCLUDED.edge, match_predictions.edge),
           best_selection=COALESCE(EXCLUDED.best_selection, match_predictions.best_selection),
           model_matches=EXCLUDED.model_matches, enrichment=EXCLUDED.enrichment,
           computed_at=NOW()`,
        [
          fix.id, code, LEAGUES[code], fix.homeTeam, fix.awayTeam, finalKickoff,
          probs.pHome, probs.pDraw, probs.pAway, probs.lambdaHome, probs.lambdaAway,
          odds?.oddsHome ?? null, odds?.oddsDraw ?? null, odds?.oddsAway ?? null,
          edge, bestSel, model.matchCount,
          JSON.stringify(enrichment),
        ]
      );
      stored.push(code);
    }
  }

  await dbQuery(
    `DELETE FROM match_predictions WHERE kickoff < NOW() - INTERVAL '24 hours'`
  );

  return { stored: stored.length, leagues: [...new Set(stored)] };
}

export async function GET(req: Request) {
  // Read-side: never deny. The board returns per-card `locked` projections for
  // anonymous/free, and strips premium enrichment for base (P0 leak fix).
  const { state } = await resolveAccessState(req);
  const [predictions_raw, meta] = await Promise.all([
    dbQuery<PredictionRow>(
      `SELECT * FROM match_predictions
       WHERE kickoff > NOW()
       ORDER BY league = 'SA' DESC, kickoff ASC
       LIMIT 120`
    ),
    dbQuery<{ ts: string; cnt: string }>(
      `SELECT MAX(computed_at) as ts, COUNT(*) as cnt
       FROM match_predictions WHERE kickoff > NOW()`
    ),
  ]);
  const computedAt = meta[0]?.ts ?? null;
  const ageMinutes = computedAt
    ? (Date.now() - new Date(computedAt).getTime()) / 60_000
    : Infinity;
  const isOffSeason = predictions_raw.length === 0;
  const isStale = !isOffSeason && ageMinutes > 60;

  // Hydrate (estimate flag + extra markets) before projecting, then gate per tier.
  const hydratedRows = predictions_raw.map((p) => {
    const hydrated = markModelEstimate(p);
    const lH = hydrated.lambda_home;
    const lA = hydrated.lambda_away;
    if (lH != null && lA != null && lH > 0 && lA > 0) {
      const marketOdds = (hydrated.enrichment as EnrichmentPayload | null)?.extra_market_odds ?? {};
      const extra_markets = computeExtraMarkets(lH, lA, marketOdds);
      return { ...hydrated, enrichment: { ...(hydrated.enrichment ?? {}), extra_markets } };
    }
    return hydrated;
  });

  const potd = pickOfDayId(
    hydratedRows.map((p) => ({
      id: p.match_id,
      confidence_score: Math.round(Math.max(p.p_home, p.p_draw, p.p_away) * 100),
      starts_at: p.kickoff,
    }))
  );

  const predictions = hydratedRows.map((p) =>
    projectPredictionRow(p, state, p.match_id === potd)
  );

  return NextResponse.json(
    {
      predictions,
      computed_at: computedAt,
      count: predictions.length,
      is_stale: isStale,
      is_off_season: isOffSeason,
      source: "database",
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  // Default-deny: a missing CRON_SECRET must never leave the trigger open.
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await computeAndStore();
  const synced = await syncMatchPredictionsToUnified();
  return NextResponse.json({ ...result, synced_to_unified: synced, at: new Date().toISOString() });
}

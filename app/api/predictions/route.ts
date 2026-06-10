import { NextResponse } from "next/server";
import { resolveAccessState, type AccessState } from "@/lib/auth";
import { isUnlocked } from "@/lib/access-projection";
import { pickOfDayId } from "@/lib/pick-of-day";
import { verifyBearer } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
import {
  buildModel,
  predict,
  computeExtraMarkets,
  blendWithMarket,
  devig1x2,
  MARKET_BLEND_ALPHA,
  MatchResult,
} from "@/lib/poisson-model";
import { applyTemperature } from "@/lib/calibration";
import { logPredictionSnapshot } from "@/lib/prediction-log";
import { PREDICTION_WINDOW_DAYS } from "@/lib/prediction-window";
import { surfaceDecision, SURFACE_FLOOR_FOOTBALL } from "@/lib/surfacing-gate";
import { fetchHistory, fetchFixtures } from "@/lib/football-data";
import { fetchOdds, normName, OddsResult } from "@/lib/odds-api";
import { computePiRatings, computeTeamForms } from "@/lib/pi-rating";
import { fetchLeagueXG, matchTeam, leagueXGAverages } from "@/lib/understat";
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
  // World Cup enrichment (unified fallback rows): deep blocks are paid-tier,
  // mirroring the v2 projection where enrichment is premium-gated.
  "venue", "squad", "market", "lambdas",
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
  // True when the kickoff time comes from a real source (fd non-midnight, or
  // api-football provided a date). Lets the client distinguish a genuine
  // 00:00 UTC kickoff (NA evening slot at the 2026 World Cup) from the
  // football-data "time unconfirmed" midnight placeholder. Not premium:
  // survives the per-tier enrichment strip.
  time_confirmed?: boolean;
  // Confidence-surfacing gate flag (Wave 1). Same contract as the Python
  // national path's notes.surface. below_floor=true -> the frontend shows the
  // row without a pick direction/edge ("no clear favourite"). Probability-
  // neutral: p_home/p_draw/p_away and confidence_score are never altered.
  surface?: { below_floor: boolean; floor: number };
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
    // Football V4: xG enters the model, not just the enrichment display. Teams
    // or leagues without Understat coverage fall back to pure-goals ratings.
    const xgBaseline = leagueXGAverages(leagueXG);
    const apiFixtures = apifixMap[code] ?? [];

    const fixtures = fixtureResults.find((f) => f.code === code)?.fixtures ?? [];
    console.log(`[${code}] model on ${model.matchCount} matches → ${fixtures.length} fixtures${xgBaseline ? " (xG blend on)" : ""}`);

    for (const fix of fixtures) {
      const probs = predict(fix.homeTeam, fix.awayTeam, model, {
        home: matchTeam(fix.homeTeam, leagueXG),
        away: matchTeam(fix.awayTeam, leagueXG),
        league: xgBaseline,
      });
      if (!probs) continue;

      const key = `${normName(fix.homeTeam)}|${normName(fix.awayTeam)}`;
      const odds = oddsMap[code]?.[key];

      // ── Market blend (PROPOSAL B) ───────────────────────────────────────────
      // When real 1X2 odds exist, pull the served probabilities toward the
      // de-vigged closing line (p = α·model + (1−α)·market, α=MARKET_BLEND_ALPHA).
      // The blended triple is THE number served, stored and edged. No real odds →
      // market=null → blendWithMarket is the identity → today's behaviour exactly
      // (fail-safe, P0 #2 intact: no synthetic market is ever invented).
      // #CALIB-1: temperature scaling (tau=1.20) BEFORE the blend — fixes the
      // measured overconfidence of the model (draws under-predicted ~1.7pp).
      // Rows with odds blend the CALIBRATED model with the market; no-odds
      // estimate rows serve the calibrated model directly (where it matters
      // most). prediction_log's model_p_* records this calibrated triple — it
      // is what actually enters the blend.
      const modelProbs = applyTemperature({ pHome: probs.pHome, pDraw: probs.pDraw, pAway: probs.pAway });
      const marketDevig = odds
        ? devig1x2(odds.oddsHome, odds.oddsDraw, odds.oddsAway)
        : null;
      const served = blendWithMarket(modelProbs, marketDevig);
      const blendAlpha = marketDevig ? MARKET_BLEND_ALPHA : null;
      probs.pHome = served.pHome;
      probs.pDraw = served.pDraw;
      probs.pAway = served.pAway;

      // P0 #3: predictions built on too few matches per team (e.g. CL/EL early
      // rounds) are not reliable. Never compute an edge or a value-bet selection
      // for them — they are shown only as flagged model estimates.
      // NB: edge is computed on the POST-blend probability. Since the blend tilts
      // toward the line, the edge shrinks (correct: true edge over the close ≈ 0).
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

      // Confidence-surfacing gate (Wave 1). The floor is on the model's
      // FAVOURITE by probability (max-prob = the served confidence_score the
      // board renders), NOT on best_selection — which is the max-EDGE pick used
      // only when real odds exist. When the favourite's probability is below the
      // club floor there is "no clear favourite", so the frontend drops the pick
      // direction/edge regardless of any edge selection. Probability-neutral:
      // p_home/p_draw/p_away, edge and best_selection are all left untouched; we
      // only attach a flag (same contract as the Python notes.surface).
      const confidenceScore = Math.round(
        Math.max(probs.pHome, probs.pDraw, probs.pAway) * 100
      );
      const surface = surfaceDecision(confidenceScore);
      if (surface.belowFloor) {
        enrichment.surface = { below_floor: true, floor: SURFACE_FLOOR_FOOTBALL };
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
      // Confirmed unless ONLY the midnight placeholder exists: a second source
      // (api-football) agreeing on 00:00 corroborates a real midnight slot.
      enrichment.time_confirmed = !fdMidnight || apifixDate !== null;

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

      // PROPOSAL A: append an immutable snapshot of exactly what we served, with
      // both served (post-blend) and raw model probabilities + the de-vigged
      // market, so live calibration is measurable. Fail-soft: never breaks serve.
      await logPredictionSnapshot({
        matchId: fix.id,
        league: code,
        homeTeam: fix.homeTeam,
        awayTeam: fix.awayTeam,
        kickoff: finalKickoff,
        served,
        model: modelProbs,
        lambdaHome: probs.lambdaHome,
        lambdaAway: probs.lambdaAway,
        oddsHome: odds?.oddsHome ?? null,
        oddsDraw: odds?.oddsDraw ?? null,
        oddsAway: odds?.oddsAway ?? null,
        market: marketDevig,
        modelVersion: "football-v4-xg-model",
        blendAlpha,
      });
    }
  }

  await dbQuery(
    `DELETE FROM match_predictions WHERE kickoff < NOW() - INTERVAL '24 hours'`
  );

  return { stored: stored.length, leagues: [...new Set(stored)] };
}

// ─── Off-season fallback (PROPOSAL #016) ─────────────────────────────────────
//
// When match_predictions is empty (domestic leagues paused, no WC model in the
// TS Poisson path — it has no finished WC matches to train on), serve the
// Python national-model rows already published to unified_predictions (World
// Cup paper tier). Honesty rules preserved: odds/edge stay null, so
// markModelEstimate flags every fallback row as a model estimate and the
// frontend can never present it as a value bet. Rows without the full 1X2
// distribution in notes are skipped (fail-closed, no fabricated numbers).

type UnifiedFallbackRow = {
  external_event_id: string | null;
  source_id: string | null;
  league: string | null;
  competition: string;
  home_team: string | null;
  away_team: string | null;
  starts_at: string;
  pick: string | null;
  notes: string | null;
  signal_type: string | null;
  edge_percent: number | null;
  enrichment: Record<string, unknown> | null;
  updated_at: string;
};

const FALLBACK_SELECTIONS = new Set(["HOME", "DRAW", "AWAY"]);

function unifiedToPredictionRow(u: UnifiedFallbackRow): PredictionRow | null {
  if (!u.home_team || !u.away_team) return null;
  let notes: {
    p_home?: unknown; p_draw?: unknown; p_away?: unknown;
    odds_home?: unknown; odds_draw?: unknown; odds_away?: unknown;
  };
  try {
    notes = JSON.parse(u.notes ?? "");
  } catch {
    return null; // old rows without the distribution: skip, never invent
  }
  const pHome = Number(notes?.p_home);
  const pDraw = Number(notes?.p_draw);
  const pAway = Number(notes?.p_away);
  if (![pHome, pDraw, pAway].every((p) => Number.isFinite(p) && p >= 0 && p <= 1)) {
    return null;
  }
  const matchId = u.external_event_id ?? u.source_id;
  if (!matchId) return null;
  const pick = (u.pick ?? "").toUpperCase();

  // Real market odds are exposed ONLY on promoted signal rows (#018). Paper
  // rows may carry reference odds in notes, but the v1 board must never
  // compute a value-bet from a row the publication gate kept on paper.
  const isSignal = u.signal_type === "signal";
  const oddsHome = isSignal ? Number(notes?.odds_home) : NaN;
  const oddsDraw = isSignal ? Number(notes?.odds_draw) : NaN;
  const oddsAway = isSignal ? Number(notes?.odds_away) : NaN;
  const hasOdds = [oddsHome, oddsDraw, oddsAway].every(
    (o) => Number.isFinite(o) && o > 1
  );

  return {
    id: 0,
    match_id: matchId,
    league: u.league ?? "WC",
    league_name: u.competition,
    home_team: u.home_team,
    away_team: u.away_team,
    kickoff: u.starts_at,
    p_home: pHome,
    p_draw: pDraw,
    p_away: pAway,
    lambda_home: null,
    lambda_away: null,
    odds_home: hasOdds ? oddsHome : null,
    odds_draw: hasOdds ? oddsDraw : null,
    odds_away: hasOdds ? oddsAway : null,
    edge: hasOdds && u.edge_percent != null ? Number(u.edge_percent) / 100 : null,
    best_selection: FALLBACK_SELECTIONS.has(pick) ? pick : null,
    model_matches: null,
    computed_at: u.updated_at,
    match_type: null,
    // Real WC enrichment (form, venue, squad, lambdas, sample) written by the
    // Python model — flows to the board's Why/Deep Analysis. Premium keys are
    // stripped per tier by projectPredictionRow, like every football row.
    enrichment: (u.enrichment as EnrichmentPayload | null) ?? null,
  };
}

async function fetchUnifiedFallback(): Promise<PredictionRow[]> {
  const rows = await dbQuery<UnifiedFallbackRow>(
    `SELECT external_event_id, source_id, league, competition, home_team,
            away_team, starts_at, pick, notes, signal_type, edge_percent,
            enrichment, updated_at
     FROM unified_predictions
     WHERE sport = 'football'
       -- #LIVE-1 (APPROVE Andrea 2026-06-07): la card resta visibile durante
       -- la partita (150 min ≈ 90' + recuperi + margine) e sparisce quando il
       -- settlement la sposta in History — handoff Bets → History senza buchi.
       -- Trasparenza: il pick pre-match non si nasconde mai a match in corso.
       AND starts_at > NOW() - interval '150 minutes'
       AND starts_at < NOW() + ($1 || ' days')::interval
       AND expires_at > NOW() - interval '150 minutes'
       AND published_at IS NOT NULL
       AND is_historical = FALSE
       AND is_demo = FALSE
       -- Decisione Andrea 2026-06-07: il Mondiale vive SOLO nella scheda
       -- dedicata (/world-cup, che legge /api/v2/predictions?competition=
       -- World Cup). Il board principale serve il resto del football
       -- (amichevoli ora, club leagues alla ripresa).
       AND competition != 'World Cup'
     ORDER BY starts_at ASC
     LIMIT 120`,
    [PREDICTION_WINDOW_DAYS]
  );
  return rows
    .map(unifiedToPredictionRow)
    .filter((row): row is PredictionRow => row !== null);
}

export async function GET(req: Request) {
  // Read-side: never deny. The board returns per-card `locked` projections for
  // anonymous/free, and strips premium enrichment for base (P0 leak fix).
  const { state } = await resolveAccessState(req);
  const [primary_raw, meta] = await Promise.all([
    dbQuery<PredictionRow>(
      `SELECT * FROM match_predictions
       WHERE kickoff > NOW() - interval '150 minutes'
         AND kickoff < NOW() + ($1 || ' days')::interval
       ORDER BY league = 'SA' DESC, kickoff ASC
       LIMIT 120`,
      [PREDICTION_WINDOW_DAYS]
    ),
    dbQuery<{ ts: string; cnt: string }>(
      `SELECT MAX(computed_at) as ts, COUNT(*) as cnt
       FROM match_predictions
       WHERE kickoff > NOW() - interval '150 minutes'
         AND kickoff < NOW() + ($1 || ' days')::interval`,
      [PREDICTION_WINDOW_DAYS]
    ),
  ]);

  const fallback_raw = primary_raw.length === 0 ? await fetchUnifiedFallback() : [];
  const usingFallback = primary_raw.length === 0 && fallback_raw.length > 0;
  const predictions_raw = usingFallback ? fallback_raw : primary_raw;

  const computedAt = usingFallback
    ? fallback_raw.reduce<string | null>(
        (max, row) => (max === null || row.computed_at > max ? row.computed_at : max),
        null
      )
    : meta[0]?.ts ?? null;
  const ageMinutes = computedAt
    ? (Date.now() - new Date(computedAt).getTime()) / 60_000
    : Infinity;
  // Off-season banner only when there is truly nothing to show: the fallback
  // serves real upcoming fixtures (e.g. World Cup), so the banner would lie.
  const isOffSeason = predictions_raw.length === 0;
  const isStale = !isOffSeason && !usingFallback && ageMinutes > 60;

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
      source: usingFallback ? "unified_fallback" : "database",
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(req: Request) {
  // Default-deny + constant-time: a missing CRON_SECRET must never leave the
  // trigger open, and the compare must not leak timing.
  if (!verifyBearer(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await computeAndStore();
  const syncReport = await syncMatchPredictionsToUnified();
  return NextResponse.json({ ...result, synced_to_unified: syncReport, at: new Date().toISOString() });
}

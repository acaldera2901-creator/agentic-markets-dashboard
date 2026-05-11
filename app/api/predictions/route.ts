import { NextResponse } from "next/server";
import { buildModel, predict, MatchResult } from "@/lib/poisson-model";
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

const DB_URL = process.env.DATABASE_URL;

const LEAGUES: Record<string, string> = {
  SA: "Serie A",
  PL: "Premier League",
  PD: "La Liga",
  BL1: "Bundesliga",
  FL1: "Ligue 1",
  CL: "Champions League",
  EL: "Europa League",
};

// Leagues supported by Understat (no CL/EL)
const UNDERSTAT_LEAGUES = new Set(["SA", "PL", "PD", "BL1", "FL1"]);

async function dbQuery<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = []
): Promise<T[]> {
  if (!DB_URL) return [];
  try {
    const { neon } = await import("@neondatabase/serverless");
    const db = neon(DB_URL);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((await (db as any).query(query, params)) ?? []) as T[];
  } catch (e) {
    console.error("DB error:", String(e));
    return [];
  }
}

async function ensureTables() {
  // Main predictions table
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS match_predictions (
      id SERIAL PRIMARY KEY,
      match_id VARCHAR NOT NULL UNIQUE,
      league VARCHAR NOT NULL,
      league_name VARCHAR NOT NULL,
      home_team VARCHAR NOT NULL,
      away_team VARCHAR NOT NULL,
      kickoff TIMESTAMPTZ NOT NULL,
      p_home FLOAT NOT NULL,
      p_draw FLOAT NOT NULL,
      p_away FLOAT NOT NULL,
      lambda_home FLOAT,
      lambda_away FLOAT,
      odds_home FLOAT,
      odds_draw FLOAT,
      odds_away FLOAT,
      edge FLOAT,
      best_selection VARCHAR,
      model_matches INT,
      computed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Enrichment column (JSONB — added after initial creation)
  await dbQuery(
    `ALTER TABLE match_predictions ADD COLUMN IF NOT EXISTS enrichment JSONB`
  );
  // Understat per-league cache (refreshed every 6h)
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS understat_cache (
      league VARCHAR PRIMARY KEY,
      data JSONB NOT NULL,
      cached_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Research summaries from Python ResearchAgent (Ollama)
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS match_research (
      match_id VARCHAR PRIMARY KEY,
      summary TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

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

      let edge: number | null = null;
      let bestSel: string | null = null;
      if (odds) {
        const eH = probs.pHome - 1 / odds.oddsHome;
        const eD = probs.pDraw - 1 / odds.oddsDraw;
        const eA = probs.pAway - 1 / odds.oddsAway;
        edge = Math.max(eH, eD, eA);
        bestSel = edge === eH ? "HOME" : edge === eD ? "DRAW" : "AWAY";
        edge = Math.round(edge * 10_000) / 10_000;
      }

      // ── Build enrichment payload ─────────────────────────────────────────
      const enrichment: EnrichmentPayload = {};

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
      }
      if (xgA) {
        enrichment.xg_away = xgA.xg_away;
        enrichment.xga_away = xgA.xga_away;
        enrichment.npxg_away = xgA.npxg_away;
      }

      // Form from history
      const formH = teamForms[fix.homeTeam];
      const formA = teamForms[fix.awayTeam];
      if (formH) enrichment.form_home = formH.homeForm;
      if (formA) enrichment.form_away = formA.awayForm;

      // Research from Ollama (Python agent)
      if (researchMap[fix.id]) enrichment.research = researchMap[fix.id];

      // Weather (async, only for matches within 48h)
      const kickoffDate = new Date(fix.utcDate);
      const hoursUntil = (kickoffDate.getTime() - Date.now()) / 3_600_000;
      if (hoursUntil >= 0 && hoursUntil <= 48) {
        try {
          enrichment.weather = await fetchMatchWeather(fix.homeTeam, kickoffDate);
        } catch {
          // non-blocking
        }
      }

      // API-Football: injuries + prediction (only for value bets or matches within 72h)
      const isValueBet = edge != null && edge > 0.03;
      if (hoursUntil >= 0 && hoursUntil <= 72 && (isValueBet || hoursUntil <= 24)) {
        const apifix = matchFixture(fix.homeTeam, fix.awayTeam, apiFixtures);
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
          fix.id, code, LEAGUES[code], fix.homeTeam, fix.awayTeam, fix.utcDate,
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
    `DELETE FROM match_predictions WHERE kickoff < NOW() - INTERVAL '2 hours'`
  );

  return { stored: stored.length, leagues: [...new Set(stored)] };
}

export async function GET() {
  await ensureTables();

  const freshCheck = await dbQuery<{ cnt: string }>(
    `SELECT COUNT(*) as cnt FROM match_predictions
     WHERE kickoff > NOW() AND computed_at > NOW() - INTERVAL '1 hour'`
  );
  const freshCount = Number(freshCheck[0]?.cnt ?? 0);

  if (freshCount === 0) {
    await computeAndStore();
  }

  const predictions = await dbQuery(
    `SELECT * FROM match_predictions
     WHERE kickoff > NOW()
     ORDER BY league = 'SA' DESC, kickoff ASC
     LIMIT 120`
  );

  const meta = await dbQuery<{ ts: string; cnt: string }>(
    `SELECT MAX(computed_at) as ts, COUNT(*) as cnt
     FROM match_predictions WHERE kickoff > NOW()`
  );

  return NextResponse.json(
    {
      predictions,
      computed_at: meta[0]?.ts ?? null,
      count: Number(meta[0]?.cnt ?? 0),
    },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=60" } }
  );
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await ensureTables();
  const result = await computeAndStore();
  return NextResponse.json({ ...result, at: new Date().toISOString() });
}

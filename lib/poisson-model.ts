export interface MatchResult {
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
}

interface TeamStrength {
  attackHome: number;
  defenseHome: number;
  attackAway: number;
  defenseAway: number;
  /** Number of matches this team appears in (min of home+away samples used). */
  matches: number;
}

export interface PoissonModel {
  strengths: Record<string, TeamStrength>;
  avgHome: number;
  avgAway: number;
  matchCount: number;
}

// ─── Reliability guard (P0 #3) ─────────────────────────────────────────────────
// On small samples (typically CL/EL early rounds: 1–2 matches per team) raw
// goal-ratio strengths explode and produce indefensible probabilities (e.g. a
// home favourite shown at 11%). Two mitigations:
//   1. Shrinkage: pull each team's strength toward the league mean (1.0) with
//      weight 1/(matches + SHRINKAGE_PRIOR). Few matches → strength ≈ 1.0.
//   2. Min-match gate: predictions where either team has fewer than
//      MIN_MATCHES_PER_TEAM samples are flagged unreliable and must NOT be shown
//      as value-bets to the customer (see predict() -> reliable flag).
// Tune here (no TS config dir exists; the Python config/ is for the Python pipeline).
export const SHRINKAGE_PRIOR = 4; // pseudo-matches of league-average prior
export const MIN_MATCHES_PER_TEAM = 4; // below this a prediction is "insufficient_data"

// ─── xG blend (Football V4) ────────────────────────────────────────────────────
// Goals are a noisy sample of chance creation; xG is the better signal (backtest
// 2026-06: blending xG into the ratings closes ~60% of the Brier gap to market).
// Each attack/defense multiplier is blended with its xG-based counterpart:
//   rating = (1-w) * goalsRating + w * xgRating
// where xgRating = team xG (or xGA) per side / league-average xG for that side.
// Weight tuned via scripts/verify-xg-blend.ts walk-forward (2026-06-05:
// optimum w=0.5, Brier 0.6095→0.6014 on 6373 predictions, concave sweep);
// w=0 (xG missing for that figure) reproduces the pure-goals model exactly —
// safe fallback for CL/EL/WC where Understat has no coverage.
export const XG_BLEND_WEIGHT = 0.5;

// ─── Market blend (Reliability upgrade PROPOSAL B) ───────────────────────────
// The closing line is the single strongest 1X2 predictor: in the walk-forward
// backtest (docs/internal/reliability-upgrade-2026-06-06.md, FASE 4, 8.575
// predictions) the market reaches Brier 0.579 vs the served Poisson's 0.599,
// and the model loses exactly where it diverges most from the line (longshots
// 2.50+: 30.8% hit vs 43.4%). Blending the served probabilities toward the
// de-vigged market — p = α·p_model + (1−α)·p_market — recovers ~all of that gap.
//
// α is NOT an edge claim: the same backtest shows no ROI beats the closing line
// (everything loses ~7-9% to vig). The blend improves CALIBRATION, not edge; the
// product copy must never present it as "value vs market" (P0 #2 stays intact).
//
// α=0 is the statistical optimum every season out-of-sample, but it turns us into
// a pure mirror of the bookmaker. α=0.3 keeps almost the entire calibration gain
// while preserving the model's identity. Setting α=1 restores today's behaviour
// exactly (the rollback switch).
export const MARKET_BLEND_ALPHA = 0.3;

export interface TripleProb {
  pHome: number;
  pDraw: number;
  pAway: number;
}

export interface MarketProb {
  home: number;
  draw: number;
  away: number;
}

/**
 * De-vig 1X2 decimal odds into a normalized probability triple (basic overround
 * removal — TS port of core/football_data_uk.implied_probs). Returns null when
 * any leg is missing or non-positive, so callers never fabricate a market.
 */
export function devig1x2(
  oddsHome: number | null | undefined,
  oddsDraw: number | null | undefined,
  oddsAway: number | null | undefined
): MarketProb | null {
  if (!oddsHome || !oddsDraw || !oddsAway) return null;
  if (oddsHome <= 0 || oddsDraw <= 0 || oddsAway <= 0) return null;
  const invH = 1 / oddsHome;
  const invD = 1 / oddsDraw;
  const invA = 1 / oddsAway;
  const s = invH + invD + invA;
  if (s <= 0) return null;
  return { home: invH / s, draw: invD / s, away: invA / s };
}

/**
 * Blend model probabilities toward the de-vigged market:
 *   p = α·p_model + (1−α)·p_market.
 * α=1 (or market=null) → identity, the fail-safe that reproduces the current
 * served numbers when no real market exists. Output is a valid distribution
 * whenever both inputs are (no renormalization needed: a convex combination of
 * two simplex points stays on the simplex).
 */
export function blendWithMarket(
  model: TripleProb,
  market: MarketProb | null,
  alpha: number = MARKET_BLEND_ALPHA
): TripleProb {
  if (!market || alpha >= 1) {
    return { pHome: model.pHome, pDraw: model.pDraw, pAway: model.pAway };
  }
  const a = Math.max(0, Math.min(1, alpha));
  return {
    pHome: a * model.pHome + (1 - a) * market.home,
    pDraw: a * model.pDraw + (1 - a) * market.draw,
    pAway: a * model.pAway + (1 - a) * market.away,
  };
}

/** Per-side team xG figures, as served live by lib/understat.ts (last-10 averages). */
export interface TeamXGFigures {
  xg_home: number;
  xga_home: number;
  xg_away: number;
  xga_away: number;
}

/** League normalization baselines: average xG scored at home / away across teams. */
export interface LeagueXGBaseline {
  home: number;
  away: number;
}

export interface XGAdjust {
  home: TeamXGFigures | null;
  away: TeamXGFigures | null;
  league: LeagueXGBaseline | null;
  /** Blend weight override (default XG_BLEND_WEIGHT). Used by the backtest sweep. */
  weight?: number;
}

function mean(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 1;
}

export function poisson(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 2; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

export interface ExtraMarket {
  key: string;
  label: string;
  p: number;
  model_odds: number;
  market_odds: number | null;
  edge: number | null;
}

export function computeExtraMarkets(
  lambdaHome: number,
  lambdaAway: number,
  marketOdds: Partial<Record<string, number>> = {}
): ExtraMarket[] {
  const N = 9;
  let pBTTS = 0, pO15 = 0, pO25 = 0, pO35 = 0, p1X = 0, pX2 = 0, p12 = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const p = poisson(i, lambdaHome) * poisson(j, lambdaAway);
      if (i >= 1 && j >= 1) pBTTS += p;
      if (i + j >= 2) pO15 += p;
      if (i + j >= 3) pO25 += p;
      if (i + j >= 4) pO35 += p;
      if (i >= j) p1X += p;
      if (j >= i) pX2 += p;
      if (i !== j) p12 += p;
    }
  }

  const mOdds = (p: number) =>
    Math.round((1 / Math.max(0.03, Math.min(0.97, p))) * 100) / 100;
  const edge = (p: number, mkt: number | null) =>
    mkt != null ? Math.round((p * mkt - 1) * 10000) / 10000 : null;

  const raw: [string, string, number][] = [
    ["over_1_5", "O1.5", pO15],
    ["over_2_5", "O2.5", pO25],
    ["over_3_5", "O3.5", pO35],
    ["btts_yes",  "GG",   pBTTS],
    ["btts_no",   "NG",   1 - pBTTS],
    ["double_1x", "1X",  p1X],
    ["double_x2", "X2",  pX2],
    ["double_12", "12",  p12],
  ];

  return raw.map(([key, label, p]) => {
    const mo = marketOdds[key] ?? null;
    return { key, label, p: Math.round(p * 10000) / 10000, model_odds: mOdds(p), market_odds: mo, edge: edge(p, mo) };
  });
}

export function buildModel(results: MatchResult[]): PoissonModel | null {
  if (results.length < 8) return null;

  const homeGoals: Record<string, number[]> = {};
  const homeConceded: Record<string, number[]> = {};
  const awayGoals: Record<string, number[]> = {};
  const awayConceded: Record<string, number[]> = {};

  for (const r of results) {
    (homeGoals[r.homeTeam] ??= []).push(r.homeGoals);
    (homeConceded[r.homeTeam] ??= []).push(r.awayGoals);
    (awayGoals[r.awayTeam] ??= []).push(r.awayGoals);
    (awayConceded[r.awayTeam] ??= []).push(r.homeGoals);
  }

  const avgHome = mean(results.map((r) => r.homeGoals));
  const avgAway = mean(results.map((r) => r.awayGoals));

  const teams = new Set([
    ...results.map((r) => r.homeTeam),
    ...results.map((r) => r.awayTeam),
  ]);

  // Shrink a raw strength ratio toward the league mean (1.0). With n samples the
  // estimate gets weight n/(n+prior); the prior gets weight prior/(n+prior).
  // n=0 → 1.0, n→∞ → raw ratio. Caps the blow-ups on tiny CL/EL samples.
  const shrink = (raw: number, n: number) =>
    (raw * n + 1.0 * SHRINKAGE_PRIOR) / (n + SHRINKAGE_PRIOR);

  const strengths: Record<string, TeamStrength> = {};
  for (const team of teams) {
    const hg = homeGoals[team] ?? [];
    const hc = homeConceded[team] ?? [];
    const ag = awayGoals[team] ?? [];
    const ac = awayConceded[team] ?? [];
    strengths[team] = {
      attackHome: shrink(mean(hg.length ? hg : [avgHome]) / avgHome, hg.length),
      defenseHome: shrink(mean(hc.length ? hc : [avgAway]) / avgAway, hc.length),
      attackAway: shrink(mean(ag.length ? ag : [avgAway]) / avgAway, ag.length),
      defenseAway: shrink(mean(ac.length ? ac : [avgHome]) / avgHome, ac.length),
      matches: hg.length + ag.length, // total matches this team played
    };
  }

  return { strengths, avgHome, avgAway, matchCount: results.length };
}

export function predict(
  homeTeam: string,
  awayTeam: string,
  model: PoissonModel,
  xg?: XGAdjust
): { pHome: number; pDraw: number; pAway: number; lambdaHome: number; lambdaAway: number; teamMatches: number; reliable: boolean } | null {
  const h = model.strengths[homeTeam];
  const a = model.strengths[awayTeam];
  if (!h || !a) return null;

  // Reliability: the weaker-sampled of the two teams drives confidence.
  const teamMatches = Math.min(h.matches, a.matches);
  const reliable = teamMatches >= MIN_MATCHES_PER_TEAM;

  // Goals-based multipliers (the original model), optionally blended with xG.
  let attackHome = h.attackHome;
  let defenseHome = h.defenseHome;
  let attackAway = a.attackAway;
  let defenseAway = a.defenseAway;

  if (xg?.league && xg.league.home > 0 && xg.league.away > 0) {
    const w = xg.weight ?? XG_BLEND_WEIGHT;
    const blend = (goals: number, xgFigure: number | undefined, leagueAvg: number) =>
      xgFigure && xgFigure > 0 ? (1 - w) * goals + w * (xgFigure / leagueAvg) : goals;
    // Home attack creates xG at home (vs league home-xG average); home defense
    // concedes xGA at home, i.e. away-style chance creation (vs away average).
    attackHome  = blend(attackHome,  xg.home?.xg_home,  xg.league.home);
    defenseHome = blend(defenseHome, xg.home?.xga_home, xg.league.away);
    attackAway  = blend(attackAway,  xg.away?.xg_away,  xg.league.away);
    defenseAway = blend(defenseAway, xg.away?.xga_away, xg.league.home);
  }

  const lambdaHome = attackHome * defenseAway * model.avgHome;
  const lambdaAway = attackAway * defenseHome * model.avgAway;

  let pHome = 0, pDraw = 0, pAway = 0;
  for (let i = 0; i <= 10; i++) {
    for (let j = 0; j <= 10; j++) {
      const p = poisson(i, lambdaHome) * poisson(j, lambdaAway);
      if (i > j) pHome += p;
      else if (i === j) pDraw += p;
      else pAway += p;
    }
  }

  const total = pHome + pDraw + pAway;
  // Guard against numerical underflow (all Poisson terms → 0): dividing would
  // emit NaN probabilities into edges/confidence. Treat as an invalid prediction.
  if (!(total > 0)) return null;
  return {
    pHome: pHome / total,
    pDraw: pDraw / total,
    pAway: pAway / total,
    lambdaHome: Math.round(lambdaHome * 100) / 100,
    lambdaAway: Math.round(lambdaAway * 100) / 100,
    teamMatches,
    reliable,
  };
}

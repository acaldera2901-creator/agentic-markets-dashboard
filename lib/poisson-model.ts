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

// First-half share of a full-match goal expectation. Empirically first halves
// carry ~45% of match goals (fewer early goals, more late ones); this is a
// documented approximation, NOT a fitted 1st-half model — upgrade path is a
// dedicated 1st-half goals model if the FP 1st-half markets prove worth serving.
export const FIRST_HALF_GOAL_SHARE = 0.45;

/** Total-goals distribution (index = total goals) from two independent Poissons. */
function totalGoalsDist(lambdaHome: number, lambdaAway: number, N = 9): number[] {
  const pTotal = new Array(2 * N + 1).fill(0);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      pTotal[i + j] += poisson(i, lambdaHome) * poisson(j, lambdaAway);
    }
  }
  return pTotal;
}

/** P(team goals >= k) from the marginal Poisson(lambda). */
function poissonAtLeast(k: number, lambda: number): number {
  let below = 0;
  for (let i = 0; i < k; i++) below += poisson(i, lambda);
  return 1 - below;
}

/** 1X2 probabilities from a bivariate Poisson (pure, no Dixon-Coles tau — matches served model). */
function result1x2(lambdaHome: number, lambdaAway: number, N = 9): TripleProb {
  let h = 0, d = 0, a = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const p = poisson(i, lambdaHome) * poisson(j, lambdaAway);
      if (i > j) h += p; else if (i === j) d += p; else a += p;
    }
  }
  const t = h + d + a;
  return { pHome: h / t, pDraw: d / t, pAway: a / t };
}

/**
 * All goal-derived markets shown on the FortunePlay match card, each with a REAL
 * model probability (from the same validated bivariate-Poisson goal distribution),
 * fair odds, and edge vs the FP price. Every market here is honestly derivable from
 * (lambdaHome, lambdaAway) — no new data, no speculative model. Markets that need a
 * separate model (corners-by-team, red/yellow split) are owned by the soft-markets
 * track and intentionally NOT synthesized here.
 */
export function computeExtraMarkets(
  lambdaHome: number,
  lambdaAway: number,
  marketOdds: Partial<Record<string, number>> = {}
): ExtraMarket[] {
  const N = 9;
  let pBTTS = 0, p1X = 0, pX2 = 0, p12 = 0, pOdd = 0;
  let pHomeWin = 0, pDrawEq = 0, pAwayWin = 0;
  const csCells: [number, number, number][] = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const p = poisson(i, lambdaHome) * poisson(j, lambdaAway);
      if (i >= 1 && j >= 1) pBTTS += p;
      if (i >= j) p1X += p;
      if (j >= i) pX2 += p;
      if (i !== j) p12 += p;
      if ((i + j) % 2 === 1) pOdd += p;
      if (i > j) pHomeWin += p; else if (i === j) pDrawEq += p; else pAwayWin += p;
      csCells.push([i, j, p]);
    }
  }
  const rTot = pHomeWin + pDrawEq + pAwayWin;
  const dnbHome = pHomeWin / (pHomeWin + pAwayWin);
  const dnbAway = pAwayWin / (pHomeWin + pAwayWin);

  // Over/Under by line, from the total-goals distribution
  const tot = totalGoalsDist(lambdaHome, lambdaAway, N);
  const overAt = (line: number) => {
    let over = 0;
    for (let t = Math.ceil(line); t < tot.length; t++) over += tot[t];
    return over;
  };

  // Goals handicap keyed by EACH SIDE's own handicap value h (as FP labels it,
  // e.g. "Home (+1.5)", "Away (-1.5)"), from the goal-difference D = home - away:
  //   home covers with h_home:  home + h_home > away  ⇔  D > -h_home
  //   away covers with h_away:  away + h_away > home  ⇔  D <  h_away
  // Half-lines: no push. Whole lines: exact tie (D = ∓h) is a push (counted for neither).
  const homeCover = (h: number) => {
    let s = 0; for (const [i, j, p] of csCells) if (i - j > -h) s += p; return s;
  };
  const awayCover = (h: number) => {
    let s = 0; for (const [i, j, p] of csCells) if (i - j < h) s += p; return s;
  };

  const mOdds = (p: number) =>
    Math.round((1 / Math.max(0.03, Math.min(0.97, p))) * 100) / 100;
  const edge = (p: number, mkt: number | null) =>
    mkt != null ? Math.round((p * mkt - 1) * 10000) / 10000 : null;

  // First-half markets (approximate half-share lambdas)
  const fhH = lambdaHome * FIRST_HALF_GOAL_SHARE;
  const fhA = lambdaAway * FIRST_HALF_GOAL_SHARE;
  const fhRes = result1x2(fhH, fhA, N);
  const fhTot = totalGoalsDist(fhH, fhA, N);
  const fhOver = (line: number) => {
    let over = 0;
    for (let t = Math.ceil(line); t < fhTot.length; t++) over += fhTot[t];
    return over;
  };
  let fhBTTS = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (i >= 1 && j >= 1) fhBTTS += poisson(i, fhH) * poisson(j, fhA);

  const raw: [string, string, number][] = [
    // Over/Under goals (all lines the card shows)
    ["over_0_5", "O0.5", overAt(0.5)],
    ["over_1_5", "O1.5", overAt(1.5)],
    ["over_2_5", "O2.5", overAt(2.5)],
    ["over_3_5", "O3.5", overAt(3.5)],
    ["over_4_5", "O4.5", overAt(4.5)],
    ["under_0_5", "U0.5", 1 - overAt(0.5)],
    ["under_1_5", "U1.5", 1 - overAt(1.5)],
    ["under_2_5", "U2.5", 1 - overAt(2.5)],
    ["under_3_5", "U3.5", 1 - overAt(3.5)],
    ["under_4_5", "U4.5", 1 - overAt(4.5)],
    // Both teams to score
    ["btts_yes", "GG", pBTTS],
    ["btts_no",  "NG", 1 - pBTTS],
    // Double chance
    ["double_1x", "1X", p1X],
    ["double_x2", "X2", pX2],
    ["double_12", "12", p12],
    // Draw no bet
    ["dnb_home", "DNB 1", dnbHome],
    ["dnb_away", "DNB 2", dnbAway],
    // Goals odd/even
    ["goals_odd",  "Dispari", pOdd],
    ["goals_even", "Pari",    1 - pOdd],
    // Team totals (marginal Poisson per side)
    ["team1_over_0_5", "Casa O0.5", poissonAtLeast(1, lambdaHome)],
    ["team1_over_1_5", "Casa O1.5", poissonAtLeast(2, lambdaHome)],
    ["team1_over_2_5", "Casa O2.5", poissonAtLeast(3, lambdaHome)],
    ["team2_over_0_5", "Ospite O0.5", poissonAtLeast(1, lambdaAway)],
    ["team2_over_1_5", "Ospite O1.5", poissonAtLeast(2, lambdaAway)],
    ["team2_over_2_5", "Ospite O2.5", poissonAtLeast(3, lambdaAway)],
    // First half
    ["fh_home", "1T 1", fhRes.pHome],
    ["fh_draw", "1T X", fhRes.pDraw],
    ["fh_away", "1T 2", fhRes.pAway],
    ["fh_over_0_5", "1T O0.5", fhOver(0.5)],
    ["fh_over_1_5", "1T O1.5", fhOver(1.5)],
    ["fh_btts_yes", "1T GG", fhBTTS],
    ["fh_btts_no",  "1T NG", 1 - fhBTTS],
    // Goals handicap: keyed by each side's own handicap value h (matches FP labels).
    ...[-2.5, -2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2, 2.5].flatMap((h): [string, string, number][] => {
      const k = String(h).replace(".", "_");
      const sgn = h > 0 ? `+${h}` : `${h}`;
      return [
        [`ah_home_${k}`, `H ${sgn}`, homeCover(h)],
        [`ah_away_${k}`, `A ${sgn}`, awayCover(h)],
      ];
    }),
  ];

  const markets = raw.map(([key, label, p]) => {
    const mo = marketOdds[key] ?? null;
    return { key, label, p: Math.round(p * 10000) / 10000, model_odds: mOdds(p), market_odds: mo, edge: edge(p, mo) };
  });

  // Correct score: top-7 exact scores by model probability (normalized)
  csCells.sort((x, y) => y[2] - x[2]);
  for (const [i, j, p] of csCells.slice(0, 7)) {
    const key = `cs_${i}_${j}`;
    const prob = p / rTot;
    const mo = marketOdds[key] ?? null;
    markets.push({ key, label: `${i}-${j}`, p: Math.round(prob * 10000) / 10000, model_odds: mOdds(prob), market_odds: mo, edge: edge(prob, mo) });
  }

  return markets;
}

export interface GoalsSummary {
  expected_goals: number;
  band_low: number;
  band_high: number;
  band_p: number;
}

export function computeGoalsSummary(
  lambdaHome: number,
  lambdaAway: number
): GoalsSummary {
  const N = 9;
  const pTotal: number[] = new Array(2 * N + 1).fill(0);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      pTotal[i + j] += poisson(i, lambdaHome) * poisson(j, lambdaAway);
    }
  }
  const expected_goals = Math.round((lambdaHome + lambdaAway) * 10) / 10;
  const band_low = Math.floor(expected_goals);
  const band_high = Math.ceil(expected_goals);
  let band = 0;
  for (let t = band_low; t <= band_high; t++) band += pTotal[t] ?? 0;
  const band_p = Math.round(band * 10000) / 10000;
  return { expected_goals, band_low, band_high, band_p };
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

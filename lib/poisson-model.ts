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
}

export interface PoissonModel {
  strengths: Record<string, TeamStrength>;
  avgHome: number;
  avgAway: number;
  matchCount: number;
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

  const strengths: Record<string, TeamStrength> = {};
  for (const team of teams) {
    strengths[team] = {
      attackHome: mean(homeGoals[team] ?? [avgHome]) / avgHome,
      defenseHome: mean(homeConceded[team] ?? [avgAway]) / avgAway,
      attackAway: mean(awayGoals[team] ?? [avgAway]) / avgAway,
      defenseAway: mean(awayConceded[team] ?? [avgHome]) / avgHome,
    };
  }

  return { strengths, avgHome, avgAway, matchCount: results.length };
}

export function predict(
  homeTeam: string,
  awayTeam: string,
  model: PoissonModel
): { pHome: number; pDraw: number; pAway: number; lambdaHome: number; lambdaAway: number } | null {
  const h = model.strengths[homeTeam];
  const a = model.strengths[awayTeam];
  if (!h || !a) return null;

  const lambdaHome = h.attackHome * a.defenseAway * model.avgHome;
  const lambdaAway = a.attackAway * h.defenseHome * model.avgAway;

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
  };
}

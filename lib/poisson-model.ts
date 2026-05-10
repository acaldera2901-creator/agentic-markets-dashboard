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

function poisson(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 2; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
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

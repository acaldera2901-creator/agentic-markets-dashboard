import type { MatchResult } from "./poisson-model";

export interface PiRatings {
  [team: string]: { home: number; away: number };
}

export interface TeamForms {
  [team: string]: { homeForm: string; awayForm: string };
}

/**
 * Pi-inspired Elo rating with separate home/away ratings and margin-of-victory weighting.
 * All teams start at 0; higher = stronger.
 */
export function computePiRatings(results: MatchResult[]): PiRatings {
  const ratings: PiRatings = {};

  const get = (team: string) => {
    if (!ratings[team]) ratings[team] = { home: 0, away: 0 };
    return ratings[team];
  };

  for (const r of results) {
    const h = get(r.homeTeam);
    const a = get(r.awayTeam);

    // Expected outcome (Elo formula) using home vs away ratings
    const ratingDiff = h.home - a.away;
    const expectedProb = 1 / (1 + Math.pow(10, -ratingDiff / 400));
    const actual = r.homeGoals > r.awayGoals ? 1 : r.homeGoals === r.awayGoals ? 0.5 : 0;

    // K factor scaled by goal margin (bigger win = bigger update)
    const margin = Math.sqrt(Math.abs(r.homeGoals - r.awayGoals) + 1);
    const k = 20 * margin;

    const delta = k * (actual - expectedProb);
    h.home += delta;
    a.away -= delta;
  }

  return ratings;
}

/** Returns last-5 W/D/L strings for each team, split by home/away context. */
export function computeTeamForms(results: MatchResult[]): TeamForms {
  const homeLog: Record<string, string[]> = {};
  const awayLog: Record<string, string[]> = {};

  for (const r of results) {
    const homeResult = r.homeGoals > r.awayGoals ? "W" : r.homeGoals === r.awayGoals ? "D" : "L";
    const awayResult = r.awayGoals > r.homeGoals ? "W" : r.awayGoals === r.homeGoals ? "D" : "L";
    (homeLog[r.homeTeam] ??= []).push(homeResult);
    (awayLog[r.awayTeam] ??= []).push(awayResult);
  }

  const teams = new Set([...Object.keys(homeLog), ...Object.keys(awayLog)]);
  const forms: TeamForms = {};

  for (const team of teams) {
    forms[team] = {
      homeForm: (homeLog[team] ?? []).slice(-5).join(""),
      awayForm: (awayLog[team] ?? []).slice(-5).join(""),
    };
  }

  return forms;
}

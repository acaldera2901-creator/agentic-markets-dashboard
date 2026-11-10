import type { MatchResult } from "./poisson-model";

export interface PiRatings {
  [team: string]: { home: number; away: number };
}

export interface TeamForms {
  [team: string]: { form: string };
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

/**
 * Returns each team's last-5 W/D/L string over ALL its matches, home and away
 * together, oldest first. `results` must be in chronological order (as
 * fetchHistory returns them).
 *
 * #FORMA-RECENTE-1026 — this used to keep two logs, one per venue, and the
 * board showed the home team's last 5 HOME games and the away team's last 5
 * AWAY games under the label "Recent form": every badge row was wrong.
 */
export function computeTeamForms(results: MatchResult[]): TeamForms {
  const log: Record<string, string[]> = {};

  for (const r of results) {
    // Runtime source payloads can violate the static MatchResult contract.
    if (![r.homeGoals, r.awayGoals].every((g) => Number.isInteger(g) && g >= 0)) continue;
    const homeResult = r.homeGoals > r.awayGoals ? "W" : r.homeGoals === r.awayGoals ? "D" : "L";
    const awayResult = r.awayGoals > r.homeGoals ? "W" : r.awayGoals === r.homeGoals ? "D" : "L";
    (log[r.homeTeam] ??= []).push(homeResult);
    (log[r.awayTeam] ??= []).push(awayResult);
  }

  const forms: TeamForms = {};
  for (const [team, played] of Object.entries(log)) {
    forms[team] = { form: played.slice(-5).join("") };
  }

  return forms;
}

type DatedResult = MatchResult & { utcDate: string };

/**
 * Last-5 form over the supplied competitions, merged in kickoff order.
 * This does not imply coverage of cups or competitions missing from the input.
 * `before` is the exclusive observation cutoff, normally the refresh start time.
 * Inputs must be finished results; kickoff alone cannot prove a match is finished.
 *
 * #FORMA-TUTTE-1026 — computeTeamForms on one league's history only sees that
 * league: PSG read LWWWW in Ligue 1 while its real last 5 were WWWWW with the
 * Champions League wins over Man City (14/10) and Barcelona (20/10). Each
 * block is one competition's fetchHistory, chronological inside itself but not
 * across blocks, hence the sort. A match belongs to one competition, so no
 * dedupe is needed. Team names must be the same across blocks: true for
 * football-data.org, NOT for the summer snapshot (ESPN names) — do not mix them.
 */
export function computeCrossCompetitionForms(competitions: DatedResult[][], before = Date.now()): TeamForms {
  const all = competitions
    .flat()
    .map((r) => ({ r, t: Date.parse(r.utcDate) }))
    .filter(({ t }) => Number.isFinite(t) && t < before)
    .sort((a, b) => a.t - b.t)
    .map(({ r }) => r);
  return computeTeamForms(all);
}

/**
 * #HARNESS-1: canonical out-of-time benchmark of the SERVED football model.
 *
 * Replays the full served transformation — lib/poisson-model.ts predict at
 * production XG_BLEND_WEIGHT=0.5 + lib/calibration.ts applyTemperature — on
 * the understat walk-forward protocol (train on prior same-season matches,
 * live-shape last-10 xG figures, burn-in 30) and scores the HOLDOUT season
 * (2024, the most recent full season in data/understat/).
 *
 * Emits one JSON line on stdout (machine-readable for promotion_gate.py):
 *   {"sport":"football","holdout":"2024","n":...,"brier":...,"ece":...}
 *
 * Read-only. Run: npx tsx scripts/benchmark-served.ts
 */
import fs from "node:fs";
import path from "node:path";
import { buildModel, predict, MatchResult } from "../lib/poisson-model";
import { applyTemperature } from "../lib/calibration";

type Row = {
  date: string; home: string; away: string;
  homeXG: number; awayXG: number; homeGoals: number; awayGoals: number;
};

const DATA_DIR = path.join(__dirname, "..", "data", "understat");
const HOLDOUT_SEASON = "2024";
const W = 0.5;
const MIN_TRAIN = 30;

function loadCsv(file: string): Row[] {
  const lines = fs.readFileSync(file, "utf8").trim().split("\n").slice(1);
  return lines.map((l) => {
    const c = l.split(",");
    return {
      date: c[0], home: c[1], away: c[2],
      homeXG: Number(c[3]), awayXG: Number(c[4]),
      homeGoals: Number(c[5]), awayGoals: Number(c[6]),
    };
  });
}

function teamFigures(prior: Row[], team: string) {
  const home = prior.filter((r) => r.home === team).slice(-10);
  const away = prior.filter((r) => r.away === team).slice(-10);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  if (!home.length && !away.length) return null;
  return {
    xg_home: avg(home.map((r) => r.homeXG)),
    xga_home: avg(home.map((r) => r.awayXG)),
    xg_away: avg(away.map((r) => r.awayXG)),
    xga_away: avg(away.map((r) => r.homeXG)),
  };
}

function leagueBaseline(figures: Map<string, NonNullable<ReturnType<typeof teamFigures>>>) {
  const teams = [...figures.values()].filter((t) => t.xg_home > 0 || t.xg_away > 0);
  if (teams.length < 6) return null;
  const home = teams.reduce((s, t) => s + t.xg_home, 0) / teams.length;
  const away = teams.reduce((s, t) => s + t.xg_away, 0) / teams.length;
  return home > 0 && away > 0 ? { home, away } : null;
}

function main() {
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(`_${HOLDOUT_SEASON}.csv`))
    .sort();
  if (!files.length) {
    console.error(`no understat files for season ${HOLDOUT_SEASON}`);
    process.exit(2);
  }

  const probs3: [number, number, number][] = [];
  const outcomes: number[] = [];
  for (const file of files) {
    const rows = loadCsv(path.join(DATA_DIR, file)).sort((a, b) => a.date.localeCompare(b.date));
    for (let i = MIN_TRAIN; i < rows.length; i++) {
      const prior = rows.slice(0, i);
      const fix = rows[i];
      const training: MatchResult[] = prior.map((r) => ({
        homeTeam: r.home, awayTeam: r.away, homeGoals: r.homeGoals, awayGoals: r.awayGoals,
      }));
      const model = buildModel(training);
      if (!model) continue;
      const figures = new Map<string, NonNullable<ReturnType<typeof teamFigures>>>();
      for (const team of new Set(prior.flatMap((r) => [r.home, r.away]))) {
        const f = teamFigures(prior, team);
        if (f) figures.set(team, f);
      }
      const baseline = leagueBaseline(figures);
      const raw = predict(fix.home, fix.away, model, {
        home: figures.get(fix.home) ?? null,
        away: figures.get(fix.away) ?? null,
        league: baseline,
        weight: W,
      });
      if (!raw || !raw.reliable) continue;
      // The full served transform: temperature AFTER the model, same as route.ts.
      const cal = applyTemperature({ pHome: raw.pHome, pDraw: raw.pDraw, pAway: raw.pAway });
      probs3.push([cal.pHome, cal.pDraw, cal.pAway]);
      outcomes.push(fix.homeGoals > fix.awayGoals ? 0 : fix.homeGoals === fix.awayGoals ? 1 : 2);
    }
  }

  const n = probs3.length;
  let brier = 0;
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) brier += (probs3[i][k] - (outcomes[i] === k ? 1 : 0)) ** 2;
  }
  brier /= n;

  let ece = 0;
  for (let k = 0; k < 3; k++) {
    const bins = Array.from({ length: 10 }, () => ({ n: 0, pSum: 0, hits: 0 }));
    for (let i = 0; i < n; i++) {
      const b = Math.min(9, Math.floor(probs3[i][k] * 10));
      bins[b].n += 1; bins[b].pSum += probs3[i][k]; bins[b].hits += outcomes[i] === k ? 1 : 0;
    }
    for (const b of bins) {
      if (b.n) ece += (b.n / n) * Math.abs(b.pSum / b.n - b.hits / b.n);
    }
  }
  ece /= 3;

  console.log(JSON.stringify({
    sport: "football",
    holdout: HOLDOUT_SEASON,
    n,
    brier: Math.round(brier * 10000) / 10000,
    ece: Math.round(ece * 10000) / 10000,
  }));
}

main();

/**
 * CALIB-1 experiment (step 1/2): replay the SERVED football model
 * (lib/poisson-model.ts, XG_BLEND_WEIGHT=0.5 — production value) walk-forward
 * on understat 2021-2024 and export every prediction with its outcome to CSV.
 * The CSV feeds scripts/experiment_isotonic.py, which fits IsotonicCalibrator
 * on the 2021-2023 seasons and evaluates Brier/ECE on the held-out 2024 season.
 *
 * Read-only: writes only /tmp/served_predictions.csv. Same protocol as
 * scripts/verify-xg-blend.ts (train on prior same-season matches, live-shape
 * last-10 xG figures, burn-in 30).
 *
 * Run: npx tsx scripts/experiment-isotonic-export.ts
 */
import fs from "node:fs";
import path from "node:path";
import { buildModel, predict, MatchResult } from "../lib/poisson-model";

type Row = {
  date: string;
  home: string;
  away: string;
  homeXG: number;
  awayXG: number;
  homeGoals: number;
  awayGoals: number;
};

const DATA_DIR = path.join(__dirname, "..", "data", "understat");
const OUT = "/tmp/served_predictions.csv";
const W = 0.5; // production XG_BLEND_WEIGHT
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
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".csv")).sort();
  const out: string[] = ["league,season,date,home,away,pHome,pDraw,pAway,outcome"];
  for (const file of files) {
    const league = file.split("_")[0];
    const season = file.replace(".csv", "").split("_").pop()!;
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
      const probs = predict(fix.home, fix.away, model, {
        home: figures.get(fix.home) ?? null,
        away: figures.get(fix.away) ?? null,
        league: baseline,
        weight: W,
      });
      if (!probs || !probs.reliable) continue;
      const outcome = fix.homeGoals > fix.awayGoals ? 0 : fix.homeGoals === fix.awayGoals ? 1 : 2;
      out.push(`${league},${season},${fix.date},${fix.home},${fix.away},${probs.pHome},${probs.pDraw},${probs.pAway},${outcome}`);
    }
  }
  fs.writeFileSync(OUT, out.join("\n"));
  console.log(`wrote ${out.length - 1} predictions -> ${OUT}`);
}

main();

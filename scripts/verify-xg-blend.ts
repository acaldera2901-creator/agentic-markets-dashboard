/**
 * Walk-forward validation of the xG blend (Football V4) — measures the REAL
 * served code path: lib/poisson-model.ts buildModel/predict with the same
 * team-level last-10 home/away xG averages shape that lib/understat.ts serves
 * live (NOT the per-match xG features of the Python research model).
 *
 * Data: data/understat/<LEAGUE>_<name>_<season>.csv (per-match, 2021-2024).
 * Protocol per season (mirrors production):
 *   - train the goals model on all PRIOR same-season matches;
 *   - team xG figures = averages of last <=10 prior home (resp. away) matches;
 *   - league baseline = mean of team figures (lib/understat.leagueXGAverages shape);
 *   - predict 1X2, score multi-class Brier; sweep blend weight w.
 *
 * Run: npx tsx scripts/verify-xg-blend.ts
 * Reference numbers (Python research, per-match features): base ~0.589,
 * +xG ~0.582, market ~0.575 (docs/research/prediction-upgrade-2026-06.md).
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
const WEIGHTS = [0, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1.0];
const MIN_TRAIN = 30; // matches before we start scoring a season (burn-in)

function loadCsv(file: string): Row[] {
  const lines = fs.readFileSync(file, "utf8").trim().split("\n").slice(1);
  return lines.map((l) => {
    const c = l.split(",");
    return {
      date: c[0],
      home: c[1],
      away: c[2],
      homeXG: Number(c[3]),
      awayXG: Number(c[4]),
      homeGoals: Number(c[5]),
      awayGoals: Number(c[6]),
    };
  });
}

/** Last-10 per-side xG averages from prior matches — the live TeamXG shape. */
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

function brier(p: { pHome: number; pDraw: number; pAway: number }, r: Row): number {
  const y = r.homeGoals > r.awayGoals ? [1, 0, 0] : r.homeGoals === r.awayGoals ? [0, 1, 0] : [0, 0, 1];
  return (p.pHome - y[0]) ** 2 + (p.pDraw - y[1]) ** 2 + (p.pAway - y[2]) ** 2;
}

function main() {
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".csv")).sort();
  const totals = new Map<number, { sum: number; n: number; xgUsed: number }>();
  for (const w of WEIGHTS) totals.set(w, { sum: 0, n: 0, xgUsed: 0 });

  for (const file of files) {
    const rows = loadCsv(path.join(DATA_DIR, file)).sort((a, b) => a.date.localeCompare(b.date));
    for (let i = MIN_TRAIN; i < rows.length; i++) {
      const prior = rows.slice(0, i);
      const fix = rows[i];
      const training: MatchResult[] = prior.map((r) => ({
        homeTeam: r.home,
        awayTeam: r.away,
        homeGoals: r.homeGoals,
        awayGoals: r.awayGoals,
      }));
      const model = buildModel(training);
      if (!model) continue;

      // Live-shape xG features as of this date.
      const figures = new Map<string, NonNullable<ReturnType<typeof teamFigures>>>();
      for (const team of new Set(prior.flatMap((r) => [r.home, r.away]))) {
        const f = teamFigures(prior, team);
        if (f) figures.set(team, f);
      }
      const baseline = leagueBaseline(figures);
      const xgHome = figures.get(fix.home) ?? null;
      const xgAway = figures.get(fix.away) ?? null;

      for (const w of WEIGHTS) {
        const probs = predict(fix.home, fix.away, model,
          w === 0 ? undefined : { home: xgHome, away: xgAway, league: baseline, weight: w });
        if (!probs || !probs.reliable) continue;
        const t = totals.get(w)!;
        t.sum += brier(probs, fix);
        t.n += 1;
        if (w > 0 && baseline && (xgHome || xgAway)) t.xgUsed += 1;
      }
    }
  }

  console.log("\nxG blend walk-forward — multi-class Brier (lower is better)");
  console.log("market reference ~0.575 · Python research: base 0.589 → +xG 0.582\n");
  const base = totals.get(0)!;
  console.log(`w=0.0 (pure goals, current prod): Brier ${(base.sum / base.n).toFixed(4)}  n=${base.n}`);
  for (const w of WEIGHTS.slice(1)) {
    const t = totals.get(w)!;
    const b = t.sum / t.n;
    const delta = b - base.sum / base.n;
    console.log(
      `w=${w.toFixed(1)}: Brier ${b.toFixed(4)}  (Δ ${delta >= 0 ? "+" : ""}${delta.toFixed(4)})  n=${t.n}  xG-used=${t.xgUsed}`
    );
  }

  // Sanity: w=0 path must equal predict() without the xg argument at all.
  const sample = loadCsv(path.join(DATA_DIR, files[0])).sort((a, b) => a.date.localeCompare(b.date));
  const tr = sample.slice(0, 60).map((r) => ({ homeTeam: r.home, awayTeam: r.away, homeGoals: r.homeGoals, awayGoals: r.awayGoals }));
  const m = buildModel(tr)!;
  const fx = sample[60];
  const a = predict(fx.home, fx.away, m)!;
  const b = predict(fx.home, fx.away, m, { home: null, away: null, league: null })!;
  if (Math.abs(a.pHome - b.pHome) > 1e-12 || Math.abs(a.pDraw - b.pDraw) > 1e-12) {
    console.error("REGRESSION: no-xG path differs from baseline predict()");
    process.exit(1);
  }
  console.log("\n✓ no-xG fallback identical to baseline predict() (CL/EL/WC unaffected)");
}

main();

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnv(file: string) {
  const p = path.join(process.cwd(), file);
  if (!fs.existsSync(p)) return;

  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] ??= v;
  }
}

function wilsonInterval(successes: number, n: number, z = 1.96) {
  if (n === 0) return { low: null, high: null };
  const phat = successes / n;
  const denom = 1 + (z * z) / n;
  const center = (phat + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * n)) / n)) / denom;
  return {
    low: Math.max(0, center - margin),
    high: Math.min(1, center + margin),
  };
}

function pct(x: number | null) {
  return x == null ? null : Number((x * 100).toFixed(2));
}

async function main() {
  loadEnv(".env");
  loadEnv(".env.local");

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");

  const db = createClient(url, key, { auth: { persistSession: false } });
  async function sql<T>(query: string): Promise<T[]> {
    const { data, error } = await db.rpc("exec_sql", { query });
    if (error) throw new Error(error.message);
    return (data ?? []) as T[];
  }

  const football = (await sql<{
    settled: number;
    correct: number;
    avg_odds: number | null;
    avg_implied_probability: number | null;
  }>(`
    SELECT
      COUNT(*)::int AS settled,
      COUNT(*) FILTER (WHERE status = 'won')::int AS correct,
      ROUND(AVG(odds)::numeric, 4)::float AS avg_odds,
      ROUND(AVG(1 / NULLIF(odds, 0))::numeric, 4)::float AS avg_implied_probability
    FROM bets
    WHERE status IN ('won', 'lost')
  `))[0] ?? { settled: 0, correct: 0, avg_odds: null, avg_implied_probability: null };

  const footballBySelection = await sql<{
    selection: string;
    settled: number;
    correct: number;
    avg_odds: number | null;
    avg_implied_probability: number | null;
  }>(`
    SELECT
      selection,
      COUNT(*)::int AS settled,
      COUNT(*) FILTER (WHERE status = 'won')::int AS correct,
      ROUND(AVG(odds)::numeric, 4)::float AS avg_odds,
      ROUND(AVG(1 / NULLIF(odds, 0))::numeric, 4)::float AS avg_implied_probability
    FROM bets
    WHERE status IN ('won', 'lost')
    GROUP BY selection
    ORDER BY settled DESC
  `);

  const predictionSnapshotState = (await sql<{
    predictions: number;
    match_predictions: number;
    tennis_settled: number;
    tennis_measurable: number;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM predictions)::int AS predictions,
      (SELECT COUNT(*) FROM match_predictions)::int AS match_predictions,
      (SELECT COUNT(*) FROM tennis_predictions WHERE winner IS NOT NULL OR outcome IS NOT NULL)::int AS tennis_settled,
      (SELECT COUNT(*) FROM tennis_predictions WHERE best_selection IS NOT NULL AND (winner IS NOT NULL OR outcome IS NOT NULL))::int AS tennis_measurable
  `))[0];

  const tennisState = (await sql<{
    total: number;
    future: number;
    visible_window: number;
    value_rows: number;
    latest_compute: string | null;
  }>(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE scheduled_at > NOW())::int AS future,
      COUNT(*) FILTER (WHERE scheduled_at > NOW() - INTERVAL '2 hours' AND winner IS NULL)::int AS visible_window,
      COUNT(*) FILTER (WHERE best_selection IS NOT NULL AND edge >= 0.03)::int AS value_rows,
      MAX(computed_at)::text AS latest_compute
    FROM tennis_predictions
  `))[0];

  const interval = wilsonInterval(football.correct, football.settled);
  const hitRate = football.settled ? football.correct / football.settled : null;

  console.log(JSON.stringify({
    generated_at: new Date().toISOString(),
    football: {
      measurable_basis: "settled bets only; original probability snapshots are not currently retained",
      settled: football.settled,
      correct: football.correct,
      accuracy_pct: pct(hitRate),
      confidence_interval_95_pct: {
        low: pct(interval.low),
        high: pct(interval.high),
      },
      avg_odds: football.avg_odds,
      avg_implied_probability_pct: pct(football.avg_implied_probability),
      by_selection: footballBySelection.map((r) => {
        const ci = wilsonInterval(r.correct, r.settled);
        return {
          selection: r.selection,
          settled: r.settled,
          correct: r.correct,
          accuracy_pct: pct(r.settled ? r.correct / r.settled : null),
          confidence_interval_95_pct: { low: pct(ci.low), high: pct(ci.high) },
          avg_odds: r.avg_odds,
          avg_implied_probability_pct: pct(r.avg_implied_probability),
        };
      }),
    },
    tennis: {
      measurable_basis: "not measurable yet; tennis_predictions has no settled winner/outcome rows with best_selection",
      total_predictions: tennisState.total,
      future_predictions: tennisState.future,
      visible_window_predictions: tennisState.visible_window,
      active_value_rows: tennisState.value_rows,
      latest_compute: tennisState.latest_compute,
      settled_rows: predictionSnapshotState.tennis_settled,
      measurable_rows: predictionSnapshotState.tennis_measurable,
    },
    data_quality: {
      football_probability_snapshots: predictionSnapshotState.predictions,
      football_live_match_predictions: predictionSnapshotState.match_predictions,
      can_measure_probability_calibration: predictionSnapshotState.predictions > 0,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

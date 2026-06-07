import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { verifyBearer } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// #CALIB-1 (APPROVE Andrea 2026-06-07): live calibration monitor.
//
// Reads SETTLED prediction_log snapshots (results written by /api/cron/settle
// and /api/live) and reports the reliability profile of what we actually
// served: per-outcome predicted-vs-observed frequency in 10 bins, multi-class
// Brier and mean ECE, split by served vs model vs market columns. This is the
// evidence base for re-fitting CALIBRATION_TAU (lib/calibration.ts) — or for
// re-proposing isotonic — once enough LIVE settled data accumulates (the
// offline experiment rejected isotonic; see scripts/experiment_isotonic.py).
// Read-only, Bearer RESEARCH_SECRET, default-deny.

interface LogRow {
  p_home: number; p_draw: number; p_away: number;
  model_p_home: number | null; model_p_draw: number | null; model_p_away: number | null;
  market_p_home: number | null; market_p_draw: number | null; market_p_away: number | null;
  result: string;
}

type Triple = [number, number, number];
const OUTCOME_INDEX: Record<string, number> = { home: 0, draw: 1, away: 2 };

function metrics(probs: Triple[], outcomes: number[]) {
  const n = probs.length;
  if (n === 0) return null;
  let brier = 0;
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) {
      const y = outcomes[i] === k ? 1 : 0;
      brier += (probs[i][k] - y) ** 2;
    }
  }
  // per-outcome 10-bin reliability + ECE
  const reliability: Record<string, { bin: string; n: number; predicted: number; observed: number }[]> = {};
  let ece = 0;
  (["home", "draw", "away"] as const).forEach((name, k) => {
    const bins = Array.from({ length: 10 }, () => ({ n: 0, pSum: 0, hits: 0 }));
    for (let i = 0; i < n; i++) {
      const p = probs[i][k];
      const b = Math.min(9, Math.floor(p * 10));
      bins[b].n += 1;
      bins[b].pSum += p;
      bins[b].hits += outcomes[i] === k ? 1 : 0;
    }
    let e = 0;
    reliability[name] = bins
      .map((b, j) => {
        if (b.n === 0) return null;
        const predicted = b.pSum / b.n;
        const observed = b.hits / b.n;
        e += (b.n / n) * Math.abs(predicted - observed);
        return {
          bin: `${(j / 10).toFixed(1)}-${((j + 1) / 10).toFixed(1)}`,
          n: b.n,
          predicted: Math.round(predicted * 1000) / 1000,
          observed: Math.round(observed * 1000) / 1000,
        };
      })
      .filter((b): b is NonNullable<typeof b> => b !== null);
    ece += e;
  });
  return {
    n,
    brier: Math.round((brier / n) * 10000) / 10000,
    ece: Math.round((ece / 3) * 10000) / 10000,
    reliability,
  };
}

export async function GET(req: Request) {
  if (!verifyBearer(req, process.env.RESEARCH_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rows = await dbQuery<LogRow>(
    `SELECT p_home, p_draw, p_away,
            model_p_home, model_p_draw, model_p_away,
            market_p_home, market_p_draw, market_p_away,
            result
       FROM prediction_log
      WHERE result IN ('home','draw','away')
      ORDER BY settled_at DESC
      LIMIT 20000`
  );

  const outcomes = rows.map((r) => OUTCOME_INDEX[r.result]);
  const served = metrics(rows.map((r): Triple => [r.p_home, r.p_draw, r.p_away]), outcomes);

  const modelRows = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.model_p_home != null && r.model_p_draw != null && r.model_p_away != null);
  const model = metrics(
    modelRows.map(({ r }): Triple => [r.model_p_home!, r.model_p_draw!, r.model_p_away!]),
    modelRows.map(({ i }) => outcomes[i])
  );

  const marketRows = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.market_p_home != null && r.market_p_draw != null && r.market_p_away != null);
  const market = metrics(
    marketRows.map(({ r }): Triple => [r.market_p_home!, r.market_p_draw!, r.market_p_away!]),
    marketRows.map(({ i }) => outcomes[i])
  );

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    settled_snapshots: rows.length,
    served,   // what clients saw (post temperature + blend)
    model,    // calibrated model triple that entered the blend
    market,   // de-vigged market reference (when odds existed)
    note: "refit CALIBRATION_TAU from this once n is in the thousands; offline experiment: scripts/experiment_isotonic.py",
  });
}

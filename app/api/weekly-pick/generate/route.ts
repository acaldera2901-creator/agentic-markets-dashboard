// /api/weekly-pick/generate — #WEEKLY-PICK-1. Cron: genera/aggiorna la MULTIPLA
// DELLA CASA della settimana corrente dalle predizioni RAW (unified_predictions,
// NON proiettate → prob sbloccate, stessa fonte del board v2). Protetto da
// CRON_SECRET. Inerte se la feature è OFF. Nulla di prod finché WEEKLY_PICK_ENABLED
// non è "true" + migration applicata (gate).

import { NextResponse } from "next/server";
import { dbQuery, dbExecute } from "@/lib/db";
import { verifyBearer } from "@/lib/admin-auth";
import { PREDICTION_WINDOW_DAYS } from "@/lib/prediction-window";
import {
  buildHouseMultipla,
  currentWeekStart,
  weeklyPickEnabled,
  type WeeklyPickLeg,
} from "@/lib/weekly-pick";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = {
  id: string;
  sport: string | null;
  home_team: string | null;
  away_team: string | null;
  pick: string | null;
  p_home: number | null;
  p_draw: number | null;
  p_away: number | null;
  notes: string | null;
  starts_at: string;
};

export async function POST(req: Request) {
  if (!weeklyPickEnabled()) return NextResponse.json({ ok: false, reason: "disabled" });
  // Constant-time bearer check (#33): the prior `!== \`Bearer ${CRON_SECRET}\``
  // was a timing-variable string compare (length/prefix leak). Use the shared
  // fail-closed verifyBearer like every other cron/server-to-server endpoint.
  if (!verifyBearer(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rows = await dbQuery<Row>(
    `SELECT id, sport, home_team, away_team, pick, p_home, p_draw, p_away, notes, starts_at::text AS starts_at
       FROM unified_predictions
      WHERE starts_at > NOW()
        AND starts_at < NOW() + ($1 || ' days')::interval
        AND published_at IS NOT NULL
        AND is_historical = FALSE
        AND is_demo = FALSE
      ORDER BY starts_at ASC
      LIMIT 200`,
    [PREDICTION_WINDOW_DAYS]
  );

  const candidates: WeeklyPickLeg[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    // La distribuzione vive nelle COLONNE p_home/p_draw/p_away quando valorizzate
    // (es. tennis: p_home=p1, p_away=p2, p_draw null) e nel campo `notes` JSON per le
    // righe paper WC/friendly (colonne null). Coalesce colonna→notes IDENTICO a
    // /api/v2/predictions, così la multipla può MISCHIARE gli sport (calcio+tennis+WC)
    // scegliendo le pick a probabilità più alta a prescindere dallo sport. Righe senza
    // né colonne né notes 1X2 → skip (nessun numero inventato).
    let pH: number | null = typeof r.p_home === "number" ? r.p_home : null;
    let pD: number | null = typeof r.p_draw === "number" ? r.p_draw : null;
    let pA: number | null = typeof r.p_away === "number" ? r.p_away : null;
    if (pH == null && r.notes) {
      try {
        const n = JSON.parse(r.notes);
        if (typeof n?.p_home === "number") {
          pH = n.p_home;
          pD = typeof n?.p_draw === "number" ? n.p_draw : null;
          pA = typeof n?.p_away === "number" ? n.p_away : null;
        }
      } catch { /* notes malformati → salta */ }
    }
    if (!r.home_team || !r.away_team || !r.pick) continue;
    const prob = r.pick === "HOME" ? pH : r.pick === "AWAY" ? pA : r.pick === "DRAW" ? pD : null;
    if (prob == null || !Number.isFinite(prob) || prob <= 0 || prob > 1) continue;
    const market = r.pick === "HOME" ? r.home_team : r.pick === "AWAY" ? r.away_team : "Draw";
    const key = `${r.sport}|${r.home_team}|${r.away_team}|${r.starts_at.slice(0, 10)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({
      id: `wp_${r.id}`,
      label: `${r.home_team} vs ${r.away_team}`,
      market,
      sport: String(r.sport ?? "other"),
      prob,
    });
  }

  const week = currentWeekStart(new Date());
  const multipla = buildHouseMultipla(candidates);
  if (!multipla) {
    console.warn(`[weekly-pick/generate] week=${week}: candidate insufficienti (${candidates.length})`);
    return NextResponse.json({ ok: false, reason: "not enough candidates", week, candidates: candidates.length });
  }

  await dbExecute(
    `INSERT INTO weekly_pick (week_start, selections, combined_prob)
     VALUES ($1, $2, $3)
     ON CONFLICT (week_start)
     DO UPDATE SET selections = EXCLUDED.selections, combined_prob = EXCLUDED.combined_prob, created_at = NOW()`,
    [week, JSON.stringify(multipla.selections), multipla.combinedProb.toFixed(4)]
  );
  console.log(`[weekly-pick/generate] week=${week} legs=${multipla.selections.length} p=${multipla.combinedProb.toFixed(4)}`);
  return NextResponse.json({ ok: true, week, legs: multipla.selections.length, combined_prob: multipla.combinedProb });
}

// Vercel Cron (e il pulsante "Run" del dashboard) invocano in GET e includono
// automaticamente `Authorization: Bearer ${CRON_SECRET}`. Riuso la stessa logica
// e la stessa auth della POST — nessun percorso non autenticato aggiunto.
export async function GET(req: Request) {
  return POST(req);
}

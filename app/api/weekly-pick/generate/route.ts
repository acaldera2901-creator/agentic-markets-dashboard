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
  appendWeeklyLegs,
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
  // p_home/p_draw/p_away NON esistono come colonne in unified_predictions (le
  // prob vivono nel JSON `notes`): il coalesce sotto le legge da lì. Restano nel
  // tipo come opzionali per il ramo colonna, se un giorno verranno materializzate.
  p_home?: number | null;
  p_draw?: number | null;
  p_away?: number | null;
  confidence_score: number | null;
  notes: string | null;
  starts_at: string;
};

export async function POST(req: Request) {
  if (!weeklyPickEnabled()) return NextResponse.json({ ok: false, reason: "disabled" });
  // #PRELAUNCH-AUDIT: confronto timing-safe come gli altri cron (settle/subscriptions/
  // refresh) invece del !== raw, che era una regressione di hardening.
  if (!verifyBearer(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ⚠️ REGRESSIONE GIÀ ACCADUTA DUE VOLTE (05b08b4 fixò, 0b1f7c5 re-introdusse):
  // NON aggiungere p_home/p_draw/p_away a questa SELECT — le colonne NON esistono
  // in unified_predictions e con exec_sql l'intera query fallisce (42703) →
  // dbQuery ingoia → 0 candidati → "not enough candidates" SILENZIOSO a ogni run
  // (weekly pick mai generata). Le prob si leggono dal JSON `notes` (coalesce sotto,
  // identico a /api/v2/predictions che non erra solo perché non lista le colonne).
  const rows = await dbQuery<Row>(
    `SELECT id, sport, home_team, away_team, pick, confidence_score, notes, starts_at::text AS starts_at
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
    // La distribuzione vive nel JSON `notes` (schema reale: nessuna colonna
    // p_home/p_draw/p_away in unified_predictions — vedi warning sulla SELECT).
    // Il ramo "colonna" resta solo come future-proofing se verranno materializzate.
    // Coalesce identico a /api/v2/predictions, così la multipla può MISCHIARE gli
    // sport (calcio+tennis+WC) scegliendo le pick a probabilità più alta. Righe
    // senza notes 1X2 valide → skip (nessun numero inventato).
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
    let prob = r.pick === "HOME" ? pH : r.pick === "AWAY" ? pA : r.pick === "DRAW" ? pD : null;
    let market = r.pick === "HOME" ? r.home_team : r.pick === "AWAY" ? r.away_team : "Draw";
    // #WEEKLY-PICK-3 tennis: qui pick è il NOME del giocatore (non HOME/AWAY) e la
    // prob vive in confidence_score (0-100, = prob del pick: 86 ↔ fair_odds 1.17;
    // vedi lib/tennis-adapter.ts, confidence = round(prob*100)). Le pick sotto floor
    // hanno già pick=null a monte (surfacedPick) → restano naturalmente fuori.
    if (prob == null && r.sport === "tennis" && typeof r.confidence_score === "number"
        && (r.pick === r.home_team || r.pick === r.away_team)) {
      prob = r.confidence_score / 100;
      market = r.pick;
    }
    if (prob == null || !Number.isFinite(prob) || prob <= 0 || prob > 1) continue;
    const key = `${r.sport}|${r.home_team}|${r.away_team}|${r.starts_at.slice(0, 10)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({
      id: `wp_${r.id}`,
      label: `${r.home_team} vs ${r.away_team}`,
      market,
      sport: String(r.sport ?? "other"),
      prob,
      startsAt: r.starts_at,
    });
  }

  const week = currentWeekStart(new Date());
  // #WEEKLY-PICK-4: la schedina è DELLA settimana — solo match entro domenica.
  // (la finestra SQL è NOW()+10g e sconfinerebbe nel lunedì successivo.)
  const weekEnd = new Date(`${week}T00:00:00Z`);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  const weekCandidates = candidates.filter(
    (c) => c.startsAt && new Date(c.startsAt).getTime() < weekEnd.getTime()
  );
  const multipla = buildHouseMultipla(weekCandidates);
  if (!multipla) {
    console.warn(`[weekly-pick/generate] week=${week}: candidate insufficienti (${weekCandidates.length})`);
    return NextResponse.json({ ok: false, reason: "not enough candidates", week, candidates: weekCandidates.length });
  }

  // #WEEKLY-PICK-4 — FREEZE + CRESCITA PROGRESSIVA. Prima l'upsert DO UPDATE
  // ricostruiva la multipla a ogni giro di cron (le leg giocate sparivano dai
  // candidati e la schedina mutava sotto i piedi di chi l'aveva comprata).
  // Ora: le leg esistenti sono CONGELATE; a ogni giro si APPENDONO solo leg di
  // giorni nuovi (max 1/giorno, fino a WEEKLY_PICK_MAX_LEGS) man mano che la
  // pipeline (orizzonte ~2 giorni) produce predizioni per i giorni successivi →
  // la schedina vive e si allunga per tutta la settimana. Rebuild totale SOLO
  // esplicito con ?force=1 (stessa auth cron).
  const force = new URL(req.url).searchParams.get("force") === "1";
  const existingRows = await dbQuery<{ selections: string }>(
    `SELECT selections::text AS selections FROM weekly_pick WHERE week_start = $1 LIMIT 1`,
    [week]
  );
  const existingRaw = existingRows[0]?.selections ?? null;

  if (force || !existingRaw) {
    await dbExecute(
      force
        ? `INSERT INTO weekly_pick (week_start, selections, combined_prob)
           VALUES ($1, $2, $3)
           ON CONFLICT (week_start)
           DO UPDATE SET selections = EXCLUDED.selections, combined_prob = EXCLUDED.combined_prob, created_at = NOW()`
        : `INSERT INTO weekly_pick (week_start, selections, combined_prob)
           VALUES ($1, $2, $3)
           ON CONFLICT (week_start) DO NOTHING`,
      [week, JSON.stringify(multipla.selections), multipla.combinedProb.toFixed(4)]
    );
    console.log(`[weekly-pick/generate] week=${week} legs=${multipla.selections.length} p=${multipla.combinedProb.toFixed(4)} force=${force} mode=create`);
    return NextResponse.json({ ok: true, week, legs: multipla.selections.length, combined_prob: multipla.combinedProb, force, mode: "create" });
  }

  // Riga esistente: arricchisci le leg legacy senza startsAt (serve per il
  // dedup per-giorno) leggendo il kickoff dalla predizione, poi appendi.
  let existing: WeeklyPickLeg[] = [];
  try { existing = JSON.parse(existingRaw) as WeeklyPickLeg[]; } catch { existing = []; }
  const missingIds = existing.filter((l) => !l.startsAt).map((l) => (l.id.startsWith("wp_") ? l.id.slice(3) : l.id));
  if (missingIds.length > 0) {
    const kickRows = await dbQuery<{ id: string; starts_at: string }>(
      `SELECT id::text AS id, starts_at::text AS starts_at FROM unified_predictions WHERE id::text = ANY(string_to_array($1, ','))`,
      [missingIds.join(",")]
    );
    const byId = new Map(kickRows.map((r) => [r.id, r.starts_at]));
    for (const l of existing) {
      if (!l.startsAt) {
        const predId = l.id.startsWith("wp_") ? l.id.slice(3) : l.id;
        const k = byId.get(predId);
        if (k) l.startsAt = k;
      }
    }
  }

  const grown = appendWeeklyLegs(existing, weekCandidates);
  if (!grown) {
    console.log(`[weekly-pick/generate] week=${week} legs=${existing.length} mode=frozen (niente da aggiungere)`);
    return NextResponse.json({ ok: true, week, legs: existing.length, mode: "frozen" });
  }
  await dbExecute(
    `UPDATE weekly_pick SET selections = $2, combined_prob = $3 WHERE week_start = $1`,
    [week, JSON.stringify(grown.selections), grown.combinedProb.toFixed(4)]
  );
  console.log(`[weekly-pick/generate] week=${week} legs=${grown.selections.length} p=${grown.combinedProb.toFixed(4)} mode=append (+${grown.selections.length - existing.length})`);
  return NextResponse.json({ ok: true, week, legs: grown.selections.length, combined_prob: grown.combinedProb, mode: "append" });
}

// Vercel Cron (e il pulsante "Run" del dashboard) invocano in GET e includono
// automaticamente `Authorization: Bearer ${CRON_SECRET}`. Riuso la stessa logica
// e la stessa auth della POST — nessun percorso non autenticato aggiunto.
export async function GET(req: Request) {
  return POST(req);
}

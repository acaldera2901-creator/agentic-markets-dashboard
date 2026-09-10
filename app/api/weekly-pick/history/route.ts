// /api/weekly-pick/history — #WEEKLY-PICK-1. Storico read-only delle multiple delle
// settimane CHIUSE (week_start < settimana corrente). Risolve ogni leg contro il
// settlement (unified_predictions.result) senza scritture né nuove tabelle. La
// settimana è chiusa → nessun leak sul presente: legs/market/prob/status visibili.
// Inerte se la feature è OFF.

import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import {
  currentWeekStart,
  weeklyPickEnabled,
  resolveWeeklyPickOutcomes,
  WEEKLY_PICK_TRACK_RECORD_FROM,
  type PredOutcomeRow,
  type WeeklyPickLeg,
} from "@/lib/weekly-pick";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = { week_start: string; selections: unknown; combined_prob: string | number | null };

export async function GET() {
  if (!weeklyPickEnabled()) return NextResponse.json({ enabled: false });

  const week = currentWeekStart(new Date());
  // #WEEKLY-PICK-FOOTBALL-0910 — lo storico parte dal cambio di regola. Le
  // settimane prodotte dalla regola vecchia (5 gambe, calcio escluso per un
  // campo JSON vuoto) restano nel database ma non si pubblicano: appartengono a
  // un altro prodotto. Il taglio è per DATA, non per esito.
  const rows = await dbQuery<Row>(
    `SELECT week_start::text AS week_start, selections, combined_prob
       FROM weekly_pick
      WHERE week_start < $1
        AND week_start >= $2
      ORDER BY week_start DESC
      LIMIT 8`,
    [week, WEEKLY_PICK_TRACK_RECORD_FROM]
  );
  if (!rows.length) {
    // `since` dice alla UI da quando conta il track record, così la pagina può
    // spiegare l'assenza invece di sembrare rotta o vuota per caso.
    return NextResponse.json({
      enabled: true,
      weeks: [],
      since: WEEKLY_PICK_TRACK_RECORD_FROM,
    });
  }

  const parsed = rows.map((r) => ({
    week_start: r.week_start,
    combined_prob: r.combined_prob != null ? Number(r.combined_prob) : null,
    sels: (typeof r.selections === "string"
      ? JSON.parse(r.selections)
      : (r.selections ?? [])) as WeeklyPickLeg[],
  }));

  // Un'unica query per tutti i predId di tutte le settimane.
  const predIds = [
    ...new Set(
      parsed.flatMap((p) => p.sels.map((s) => (s.id.startsWith("wp_") ? s.id.slice(3) : s.id)))
    ),
  ];
  // #PRELAUNCH-AUDIT: `= ANY($array)` NON funziona con l'interpolate di lib/db (l'array
  // diventa una stringa comma-joined → 0 righe, errore ingoiato → ogni leg storica
  // restava irrisolta). IN con un placeholder per id, come già fatto in route.ts.
  const idPlaceholders = predIds.map((_, i) => `$${i + 1}`).join(", ");
  const predRows = predIds.length
    ? await dbQuery<PredOutcomeRow>(
        `SELECT id::text AS id, status, result, starts_at::text AS starts_at
           FROM unified_predictions WHERE id::text IN (${idPlaceholders})`,
        predIds
      )
    : [];

  const weeks = parsed.map((p) => {
    const { legs, outcome } = resolveWeeklyPickOutcomes(p.sels, predRows);
    return {
      week_start: p.week_start,
      combined_prob: p.combined_prob,
      outcome,
      legs: legs.map((l) => ({
        label: l.label,
        sport: l.sport,
        market: l.market,
        prob: l.prob,
        status: l.status,
      })),
    };
  });

  return NextResponse.json({ enabled: true, weeks, since: WEEKLY_PICK_TRACK_RECORD_FROM });
}

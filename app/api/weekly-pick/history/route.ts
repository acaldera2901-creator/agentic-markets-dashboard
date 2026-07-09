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
  type PredOutcomeRow,
  type WeeklyPickLeg,
} from "@/lib/weekly-pick";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = { week_start: string; selections: unknown; combined_prob: string | number | null };

export async function GET() {
  if (!weeklyPickEnabled()) return NextResponse.json({ enabled: false });

  const week = currentWeekStart(new Date());
  const rows = await dbQuery<Row>(
    `SELECT week_start::text AS week_start, selections, combined_prob
       FROM weekly_pick
      WHERE week_start < $1
      ORDER BY week_start DESC
      LIMIT 8`,
    [week]
  );
  if (!rows.length) return NextResponse.json({ enabled: true, weeks: [] });

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

  return NextResponse.json({ enabled: true, weeks });
}

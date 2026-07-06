// /api/weekly-pick — #WEEKLY-PICK-1. Serve la multipla della casa della settimana
// corrente, proiettata per sessione: Pro (inclusa) o acquirente one-off → sbloccata
// (market+prob); gli altri → teaser lockato (nomi match visibili, pick/prob nulli
// server-side, nessun leak) + prezzo. Inerte se la feature è OFF.

import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { resolveAccessState } from "@/lib/auth";
import {
  currentWeekStart,
  weeklyPickEnabled,
  weeklyPickIncludedInPlan,
  WEEKLY_PICK_PRICE_USD,
} from "@/lib/weekly-pick";
import { hasWeeklyPick } from "@/lib/weekly-pick-server";

export const dynamic = "force-dynamic";

type WpRow = { selections: unknown; combined_prob: string | number | null };
type Sel = { id: string; label: string; market: string; sport: string; prob: number };

export async function GET(req: Request) {
  if (!weeklyPickEnabled()) return NextResponse.json({ enabled: false });

  const { ctx, state } = await resolveAccessState(req);
  const week = currentWeekStart(new Date());

  const rows = await dbQuery<WpRow>(
    `SELECT selections, combined_prob FROM weekly_pick WHERE week_start = $1 LIMIT 1`,
    [week]
  );
  const row = rows[0];
  if (!row) return NextResponse.json({ enabled: true, week, available: false });

  const sels: Sel[] = typeof row.selections === "string" ? JSON.parse(row.selections) : ((row.selections as Sel[]) ?? []);
  const included = weeklyPickIncludedInPlan(state);
  const purchased = ctx ? await hasWeeklyPick(ctx.identifier, week) : false;
  const unlocked = included || purchased;

  return NextResponse.json({
    enabled: true,
    week,
    available: true,
    unlocked,
    included,
    price_usd: WEEKLY_PICK_PRICE_USD,
    combined_prob: unlocked && row.combined_prob != null ? Number(row.combined_prob) : null,
    legs: sels.length,
    // Locked projection: nomi match come teaser, pick/prob nascosti.
    selections: sels.map((s) => ({
      label: s.label,
      sport: s.sport,
      market: unlocked ? s.market : null,
      prob: unlocked ? s.prob : null,
    })),
  });
}

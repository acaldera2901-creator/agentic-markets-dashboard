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
  weeklyPickAmount,
  resolveWeeklyPickOutcomes,
  type PredOutcomeRow,
  type WeeklyPickLeg,
} from "@/lib/weekly-pick";
import { hasWeeklyPick } from "@/lib/weekly-pick-server";

export const dynamic = "force-dynamic";

type WpRow = { selections: unknown; combined_prob: string | number | null };

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

  const sels: WeeklyPickLeg[] = typeof row.selections === "string" ? JSON.parse(row.selections) : ((row.selections as WeeklyPickLeg[]) ?? []);
  const included = weeklyPickIncludedInPlan(state);
  const purchased = ctx ? await hasWeeklyPick(ctx.identifier, week) : false;
  const unlocked = included || purchased;

  // Stato live: risolve ogni leg contro il settlement della sua predizione, così
  // chi compra a metà settimana vede cosa ha già giocato e cosa manca.
  const predIds = sels.map((s) => (s.id.startsWith("wp_") ? s.id.slice(3) : s.id));
  const predRows = predIds.length
    ? await dbQuery<PredOutcomeRow>(
        `SELECT id::text AS id, status, result, starts_at::text AS starts_at
           FROM unified_predictions WHERE id::text = ANY($1)`,
        [predIds]
      )
    : [];
  const { legs: resolvedLegs, outcome, remaining } = resolveWeeklyPickOutcomes(sels, predRows);

  // Prezzo effettivo (sconto -50% se lancio attivo) deciso server-side; il full
  // serve alla UI per il barrato. price_usd = ciò che l'utente paga davvero.
  const { amount, fullAmount, discounted } = weeklyPickAmount();

  return NextResponse.json({
    enabled: true,
    week,
    available: true,
    unlocked,
    included,
    price_usd: amount,
    full_price_usd: fullAmount,
    discounted,
    combined_prob: unlocked && row.combined_prob != null ? Number(row.combined_prob) : null,
    outcome: unlocked ? outcome : null, // live/won/lost solo per chi ha sbloccato
    legs: sels.length,
    legs_remaining: remaining, // aggregato safe per il teaser ("N ancora da giocare")
    // Locked projection: nomi match come teaser; pick/prob/status/kickoff nascosti (no leak).
    selections: resolvedLegs.map((s) => ({
      label: s.label,
      sport: s.sport,
      market: unlocked ? s.market : null,
      prob: unlocked ? s.prob : null,
      status: unlocked ? s.status : null,
      kickoff: unlocked ? s.kickoff : null,
    })),
  });
}

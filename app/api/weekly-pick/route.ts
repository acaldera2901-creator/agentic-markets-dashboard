import { NextResponse } from 'next/server';
import { dbQueryStrict } from '@/lib/db';
import { resolveAccessState } from '@/lib/auth';
import { currentWeekStart, weeklyPickEnabled, weeklyPickIncludedInPlan, weeklyPickAmount,
  resolveWeeklyPickOutcomes, weeklyBrief, weeklyPickIntegrity, weeklyPickPurchasable,
  type PredOutcomeRow, type WeeklyPickLeg } from '@/lib/weekly-pick';
import { hasWeeklyPickStrict, resolveSealedWeeklyRows } from '@/lib/weekly-pick-server';

export const dynamic = 'force-dynamic';

type WpRow = { selections: unknown; combined_prob: string | number | null };

export async function GET(req: Request) {
  if (!weeklyPickEnabled()) return NextResponse.json({ enabled: false });
  try {
    const { ctx, state } = await resolveAccessState(req);
    const week = currentWeekStart(new Date());
    const rows = await dbQueryStrict<WpRow>('SELECT selections, combined_prob FROM weekly_pick WHERE week_start = $1 LIMIT 1', [week]);
    const row = rows[0];
    if (!row) return NextResponse.json({ enabled: true, week, available: false });
    const sels: WeeklyPickLeg[] = typeof row.selections === 'string' ? JSON.parse(row.selections) : (row.selections as WeeklyPickLeg[]) ?? [];
    const included = weeklyPickIncludedInPlan(state);
    const purchased = ctx ? await hasWeeklyPickStrict(ctx.identifier, week) : false;
    const unlocked = included || purchased;
    const predIds = sels.map(s => s.id.startsWith('wp_') ? s.id.slice(3) : s.id);
    const idPlaceholders = predIds.map((_,i) => `$${i+1}`).join(', ');
    const predRows = predIds.length ? await dbQueryStrict<PredOutcomeRow>(
      `SELECT id::text AS id, status, result, starts_at::text AS starts_at
         FROM unified_predictions WHERE id::text IN (${idPlaceholders})`, predIds) : [];
    const { legs, outcome, remaining } = resolveWeeklyPickOutcomes(sels, await resolveSealedWeeklyRows(sels, predRows));
    const { amount, fullAmount, discounted } = weeklyPickAmount();
    const selections = legs.map(s => ({ label: s.label, sport: s.sport,
      market: unlocked ? s.market : null, prob: unlocked ? s.prob : null,
      status: unlocked ? s.status : null, kickoff: unlocked ? s.kickoff : null,
      id: unlocked ? (s.id.startsWith('wp_') ? s.id.slice(3) : s.id) : null,
      // These cases have no frozen explanation/form/distribution payload. Reading
      // today's unified enrichment would misrepresent it as the recorded analysis.
      detail: null }));
    const sports: Record<string, number> = {};
    for (const s of sels) sports[s.sport ?? 'other'] = (sports[s.sport ?? 'other'] ?? 0) + 1;
    const combined = unlocked && row.combined_prob != null ? Number(row.combined_prob) : null;
    return NextResponse.json({ enabled: true, week, available: true,
      integrity: weeklyPickIntegrity(sels), purchasable: weeklyPickPurchasable(sels, predRows),
      unlocked, included, price_usd: amount, full_price_usd: fullAmount, discounted,
      combined_prob: combined, outcome: unlocked ? outcome : null,
      legs: sels.length, legs_remaining: remaining, closed: sels.length > 0 && remaining === 0,
      brief: weeklyBrief(selections, combined, []), sports, selections });
  } catch (error) {
    console.error('[weekly case unavailable]', String(error));
    return NextResponse.json({ error: 'weekly case unavailable' }, { status: 503 });
  }
}

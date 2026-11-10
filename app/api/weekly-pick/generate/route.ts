import { NextResponse } from 'next/server';
import { dbQueryStrict, dbExecute } from '@/lib/db';
import { verifyBearer } from '@/lib/admin-auth';
import { appendWeeklyLegs, buildHouseMultipla, currentWeekStart, weeklyPickEnabled, weeklyPickIntegrity, type WeeklyPickLeg } from '@/lib/weekly-pick';
import { weeklyCandidate, type WeeklyCandidateRow } from '@/lib/weekly-pick-candidate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!weeklyPickEnabled()) return NextResponse.json({ ok: false, reason: 'disabled' });
  if (!verifyBearer(req, process.env.CRON_SECRET)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  // Published cases are an audit record, including those with no purchases.
  if (new URL(req.url).searchParams.get('force') === '1') {
    return NextResponse.json({ error: 'published cases cannot be rebuilt' }, { status: 409 });
  }
  try {
    const now = new Date();
    const week = currentWeekStart(now);
    const end = new Date(`${week}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 7);
    const existingRows = await dbQueryStrict<{ selections: string }>(
      'SELECT selections::text AS selections FROM weekly_pick WHERE week_start = $1 LIMIT 1', [week]);
    const existingRaw = existingRows[0]?.selections ?? null;
    const existing: WeeklyPickLeg[] = existingRaw ? JSON.parse(existingRaw) : [];
    if (!Array.isArray(existing)) throw new Error('invalid saved case');
    // Unknown legacy kickoff is not permission to mutate a published case.
    if (existing.length && (weeklyPickIntegrity(existing) !== 'sealed_model' || existing.some(l => !l.startsAt || !Number.isFinite(Date.parse(l.startsAt)) || Date.parse(l.startsAt) <= now.getTime()))) {
      return NextResponse.json({ ok: true, week, legs: existing.length, mode: 'frozen' });
    }
    const rows = await dbQueryStrict<WeeklyCandidateRow>(
      `SELECT u.id::text AS id, u.sport, u.home_team, u.away_team, u.pick, u.notes,
              u.starts_at::text AS starts_at, u.model_version, u.source_table, u.source_id,
              l.pick AS sealed_pick, l.p_home AS sealed_p_home, l.p_draw AS sealed_p_draw,
              l.p_away AS sealed_p_away, l.captured_at::text AS sealed_at,
              l.commence_time::text AS sealed_starts_at, l.home_team AS sealed_home, l.away_team AS sealed_away
         FROM unified_predictions u JOIN pick_ledger l
           ON l.source_table = u.source_table AND l.source_id = u.source_id AND l.model_version = u.model_version
        WHERE u.starts_at > NOW() AND u.starts_at < $1::timestamptz
          AND u.published_at IS NOT NULL AND u.is_historical = FALSE AND u.is_demo = FALSE
          AND l.is_backfill = FALSE AND l.captured_at < l.commence_time
          AND (u.result IS NULL OR u.result = 'pending')
        ORDER BY u.starts_at ASC, u.id ASC`, [end.toISOString()]);
    const candidates = rows.map(r => weeklyCandidate(r, now)).filter((r): r is WeeklyPickLeg => r !== null);
    // Stable strongest candidate wins if duplicate provider rows describe a fixture.
    const seen = new Set<string>();
    const unique = candidates.sort((a,b) => b.prob - a.prob || a.id.localeCompare(b.id)).filter(c => {
      const key = `${c.sport}|${c.label}|${c.startsAt?.slice(0,10)}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
    const next = existingRaw ? appendWeeklyLegs(existing, unique) : buildHouseMultipla(unique);
    if (!next) return NextResponse.json(existingRaw
      ? { ok: true, week, legs: existing.length, mode: 'frozen' }
      : { ok: false, week, reason: 'not enough verified model candidates', candidates: unique.length });
    const firstKickoff = next.selections.reduce((min, l) => Math.min(min, Date.parse(l.startsAt!)), Infinity);
    // exec_sql deliberately returns [] for writes. Verify persisted content after
    // the atomic CAS instead of interpreting a missing RETURNING result as success.
    await dbExecute(existingRaw
      ? `UPDATE weekly_pick SET selections = $2::jsonb, combined_prob = $3
           WHERE week_start = $1 AND selections::jsonb = $4::jsonb
             AND NOW() < $5::timestamptz`
      : `INSERT INTO weekly_pick (week_start, selections, combined_prob)
           SELECT $1, $2::jsonb, $3 WHERE NOW() < $5::timestamptz
           ON CONFLICT (week_start) DO NOTHING`,
      [week, JSON.stringify(next.selections), next.combinedProb.toFixed(4), existingRaw, new Date(firstKickoff).toISOString()]);
    const persisted = await dbQueryStrict<{ matches: boolean }>(
      `SELECT (selections::jsonb = $2::jsonb AND combined_prob = $3::numeric) AS matches
         FROM weekly_pick WHERE week_start = $1`,
      [week, JSON.stringify(next.selections), next.combinedProb.toFixed(4)]);
    if (!persisted[0]?.matches) return NextResponse.json({ ok: false, week, reason: 'case changed or kickoff reached; retry' }, { status: 409 });
    return NextResponse.json({ ok: true, week, legs: next.selections.length, combined_prob: next.combinedProb, mode: existingRaw ? 'append' : 'create' });
  } catch (e) {
    console.error('[weekly-pick/generate]', String(e));
    return NextResponse.json({ ok: false, reason: 'generation unavailable' }, { status: 503 });
  }
}
export async function GET(req: Request) { return POST(req); }

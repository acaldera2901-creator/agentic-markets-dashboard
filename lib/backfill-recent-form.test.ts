// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { generateRecentFormBackfill, type BackfillInput } from '../scripts/backfill-recent-form';
const now = '2026-10-26T12:00:00Z';
function input(): BackfillInput {
  return { captured_at: now, histories: [
    { code: 'FL1', fetched_at: now, matches: [
      { utcDate: '2026-10-20', homeTeam: 'A', awayTeam: 'B', homeGoals: 0, awayGoals: 1 },
    ] },
    { code: 'CL', fetched_at: now, matches: [
      { utcDate: '2026-10-22', homeTeam: 'A', awayTeam: 'C', homeGoals: 2, awayGoals: 0 },
    ] },
    ...['PL','SA','PD','BL1'].map(code=>({code,fetched_at:now,matches:[]})),
  ], rows: [{ match_id: "fixture'1", league: 'FL1', home_team: 'A', away_team: 'B', kickoff: '2026-10-28T12:00:00Z', computed_at: now, enrichment: { form_home: 'LL', form_away: 'D', other: 42 } }] };
}
describe('offline recent-form backfill', () => {
  it('uses cross-competition chronology and states limited coverage', () => {
    const p = generateRecentFormBackfill(input(), now);
    expect(p.changes[0].after).toEqual({form_home: 'LW', form_away: 'W'});
    expect(p.report.coverage).toContain('not all competitions');
    expect(p.backup[0].enrichment.other).toBe(42);
  });
  it('rejects stale snapshots and duplicate identities; skips started fixtures', () => {
    const stale = input(); stale.histories[0].fetched_at = '2026-09-21';
    expect(() => generateRecentFormBackfill(stale, now)).toThrow(/fresh/i);
    const duplicate = input(); duplicate.rows.push(duplicate.rows[0]);
    expect(() => generateRecentFormBackfill(duplicate, now)).toThrow(/duplicate/i);
    const past = input(); past.rows[0].kickoff = '2026-10-25';
    expect(generateRecentFormBackfill(past, now).changes).toHaveLength(0);
  });
  it('rejects a missing league source rather than using CL-only fallback', () => {
    const x = input(); x.histories = x.histories.filter(h => h.code !== 'FL1');
    expect(() => generateRecentFormBackfill(x, now)).toThrow(/source/i);
  });
  it('executes atomic apply/rollback preserving other enrichment, and rejects a concurrent update', async () => {
    const db = new PGlite();
    // SQL uses transaction_timestamp(): align input with database time.
    const clock = (await db.query<{now:string}>('select now()::text as now')).rows[0].now;
    const x = input(); x.captured_at=clock; x.histories.forEach(h=>h.fetched_at=clock);
    x.rows[0].computed_at=clock; x.rows[0].kickoff=new Date(Date.parse(clock)+86400000).toISOString();
    x.rows[0].match_id = "fixture'\\$backfill$";
    const p=generateRecentFormBackfill(x,clock);
    await db.exec('create table match_predictions(match_id text primary key, kickoff timestamptz, computed_at timestamptz, enrichment jsonb)');
    await db.query('insert into match_predictions values($1,$2,$3,$4)',[x.rows[0].match_id,x.rows[0].kickoff,clock,JSON.stringify(x.rows[0].enrichment)]);
    await db.exec(p.applySql);
    expect((await db.query<{enrichment:object}>('select enrichment from match_predictions')).rows[0].enrichment).toEqual({...x.rows[0].enrichment,...p.changes[0].after});
    // A fixture starting after planning must abort the complete rollback.
    await db.exec("update match_predictions set kickoff=now()-interval '1 second'");
    await expect(db.exec(p.rollbackSql)).rejects.toThrow(/expected/i);
    await db.exec('rollback');
    await db.exec("update match_predictions set kickoff=now()+interval '1 day'");
    await db.exec(p.rollbackSql);
    expect((await db.query<{enrichment:object}>('select enrichment from match_predictions')).rows[0].enrichment).toEqual(x.rows[0].enrichment);
    await db.exec("update match_predictions set computed_at=computed_at+interval '1 second'");
    await expect(db.exec(p.applySql)).rejects.toThrow(/expected/i);
    await db.exec('rollback');
    await db.close();
  });
});

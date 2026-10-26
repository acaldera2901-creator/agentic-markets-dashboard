import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const { read, write } = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));
vi.mock('@/lib/db', () => ({ dbQuery: read, dbQueryStrict: read, dbExecute: write }));
vi.mock('@/lib/admin-auth', () => ({ verifyBearer: () => true }));
import { POST } from './route';
const leg = (id: string, day = 27) => ({ id: `wp_${id}`, label: 'A vs B', market: 'A', sport: 'football', prob: .8, startsAt: `2026-10-${day}T12:00:00Z` });
const sealedLeg = (id:string, day=27) => ({...leg(id,day),snapshot:{sourceTable:'match_predictions',sourceId:id,modelVersion:'football-v4-xg-model',pick:'HOME',capturedAt:'2026-10-24T08:00:00Z',probabilitySource:'model'}});
const row = (id: string, day = 29) => ({ id, sport: 'football', home_team: 'A', away_team: id, pick: 'HOME', confidence_score: 80, notes: null, starts_at: `2026-10-${day}T12:00:00Z`, model_version: 'football-v4-xg-model', source_table: 'match_predictions', source_id: id, sealed_pick: 'HOME', sealed_p_home: .8, sealed_p_draw: .1, sealed_p_away: .1, sealed_at: '2026-10-26T08:00:00Z', sealed_starts_at: `2026-10-${day}T12:00:00Z`, sealed_home: 'A', sealed_away: id });
const req = (query = '') => new Request(`https://x/api/weekly-pick/generate${query}`, { method: 'POST' });
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-26T10:00:00Z')); process.env.WEEKLY_PICK_ENABLED = 'true'; write.mockResolvedValue([{ changed: true }]); });
afterEach(() => vi.useRealTimers());
function fixture(candidates: unknown[], existing: unknown[] | null) {
 let stored = existing;
 read.mockImplementation(async (sql: string, params: unknown[]) => sql.includes('AS matches')
   ? [{matches: JSON.stringify(stored) === params[1]}]
   : sql.includes('FROM weekly_pick') ? stored ? [{selections: JSON.stringify(stored)}] : [] : candidates);
 write.mockImplementation(async (_sql: string, params: unknown[]) => { stored = JSON.parse(params[1] as string); return []; });
}
it('rejects force rebuild without touching existing cases', async () => { fixture([row('c'), row('d', 30)], [leg('a'), leg('b', 28)]); const r = await POST(req('?force=1')); expect(r.status).toBe(409); expect(write).not.toHaveBeenCalled(); });
it('can append a single final candidate before kickoff', async () => { fixture([row('c')], [sealedLeg('a'), sealedLeg('b', 28)]); const r = await POST(req()); expect(await r.json()).toMatchObject({ ok: true, mode: 'append', legs: 3 }); expect(write.mock.calls[0][0]).toContain('selections::jsonb = $4::jsonb'); });
it('does not append after the first kickoff', async () => { fixture([row('c'), row('d', 30)], [sealedLeg('a', 25), sealedLeg('b', 28)]); const r = await POST(req()); expect(await r.json()).toMatchObject({ mode: 'frozen' }); expect(write).not.toHaveBeenCalled(); });
it('does not manufacture a model case from unsealed confidence', async () => { fixture([ {...row('c'), sealed_pick: null}, {...row('d', 30), sealed_pick: null}], null); const r = await POST(req()); expect(await r.json()).toMatchObject({ ok: false }); expect(write).not.toHaveBeenCalled(); });
it('fails loudly on database failure', async () => { read.mockRejectedValue(new Error('offline')); expect((await POST(req())).status).toBe(503); expect(write).not.toHaveBeenCalled(); });
it('does not report success when a concurrent writer won the compare-and-swap', async () => { fixture([row('c')], [sealedLeg('a'), sealedLeg('b', 28)]); write.mockResolvedValue([{ changed: false }]); expect((await POST(req())).status).toBe(409); });

it('freezes even an incomplete future legacy case',async()=>{
 fixture([row('c')],[leg('a'),leg('b',28)]);
 const response=await POST(req());
 expect(await response.json()).toMatchObject({mode:'frozen',legs:2});
 expect(write).not.toHaveBeenCalled();
});

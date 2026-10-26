import { beforeEach, expect, it, vi } from 'vitest';
const h=vi.hoisted(()=>({read:vi.fn()}));
vi.mock('@/lib/db',()=>({dbQuery:h.read,dbQueryStrict:h.read}));
vi.mock('@/lib/weekly-pick-server',()=>({resolveSealedWeeklyRows:async(_legs:unknown,rows:unknown)=>rows}));
import { GET } from './route';
beforeEach(()=>{vi.resetAllMocks();process.env.WEEKLY_PICK_ENABLED='true';});
for(const failure of ['weeks','results']) it(`returns 503 on ${failure} failure rather than empty history or upcoming results`,async()=>{
 if(failure==='results') h.read.mockResolvedValueOnce([{week_start:'2026-10-19',selections:[{id:'wp_a',label:'A vs B',market:'A',sport:'tennis',prob:.8}],combined_prob:.8}]);
 h.read.mockRejectedValue(new Error('private database error'));
 const response=await GET();
 expect(response.status).toBe(503);
 expect(await response.json()).toEqual({error:'weekly history unavailable'});
});
it('retains a successful genuinely empty history',async()=>{
 h.read.mockResolvedValue([]);
 const response=await GET();
 expect(response.status).toBe(200);
 expect(await response.json()).toMatchObject({enabled:true,weeks:[]});
});

import { beforeEach, expect, it, vi } from 'vitest';
const h=vi.hoisted(()=>({read:vi.fn(),access:vi.fn(),purchase:vi.fn()}));
vi.mock('@/lib/db',()=>({dbQuery:h.read,dbQueryStrict:h.read}));
vi.mock('@/lib/auth',()=>({resolveAccessState:h.access}));
vi.mock('@/lib/weekly-pick-server',()=>({hasWeeklyPick:h.purchase,hasWeeklyPickStrict:h.purchase,resolveSealedWeeklyRows:async(_legs:unknown,rows:unknown)=>rows}));
import { GET } from './route';
beforeEach(()=>{vi.resetAllMocks();h.purchase.mockResolvedValue(false);process.env.WEEKLY_PICK_ENABLED='true';h.access.mockResolvedValue({ctx:null,state:'premium'});
 h.read.mockResolvedValueOnce([{selections:[{id:'wp_a',label:'A vs B',market:'A',sport:'tennis',prob:.8,startsAt:'2026-10-26T04:00:00Z'}],combined_prob:.8}]).mockResolvedValueOnce([{id:'a',status:'open',result:null,starts_at:'2026-10-27T04:00:00Z',explanation:'later explanation'}]);});
it('marks legacy unverified, unsaleable, preserves recorded kickoff, and never imports mutable details',async()=>{
 const payload=await(await GET(new Request('https://x/api/weekly-pick'))).json();
 expect(payload).toMatchObject({integrity:'legacy_unverified',purchasable:false,selections:[{prob:.8,kickoff:'2026-10-26T04:00:00Z',detail:null}]});
});
it('retains the locked server projection',async()=>{
 h.access.mockResolvedValue({ctx:null,state:'anonymous'});
 const payload=await(await GET(new Request('https://x/api/weekly-pick'))).json();
 expect(payload).toMatchObject({unlocked:false,combined_prob:null,selections:[{market:null,prob:null,status:null,kickoff:null,id:null,detail:null}]});
});

for (const failure of ['case', 'predictions', 'entitlement'] as const) {
 it(`returns 503 for ${failure} read failure, never a false empty/locked/upcoming state`,async()=>{
  if(failure === 'case') h.read.mockReset().mockRejectedValue(new Error('private database error'));
  if(failure === 'predictions') h.read.mockReset().mockResolvedValueOnce([{selections:[{id:'wp_a',label:'A vs B',market:'A',sport:'tennis',prob:.8}],combined_prob:.8}]).mockRejectedValueOnce(new Error('private database error'));
  if(failure === 'entitlement') {h.access.mockResolvedValue({ctx:{identifier:'x@example.com'},state:'free'});h.purchase.mockRejectedValue(new Error('private database error'));}
  const response=await GET(new Request('https://x/api/weekly-pick'));
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({error:'weekly case unavailable'});
 });
}

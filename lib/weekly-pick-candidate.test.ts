import { expect, it } from 'vitest';
import { weeklyCandidate, type WeeklyCandidateRow } from './weekly-pick-candidate';
const now = new Date('2026-10-26T10:00:00Z');
const base: WeeklyCandidateRow = {id:'p1',sport:'football',home_team:'A',away_team:'B',pick:'HOME',notes:null,starts_at:'2026-10-27T12:00:00Z',model_version:'football-v4-xg-model',source_table:'match_predictions',source_id:'match1',sealed_pick:'HOME',sealed_p_home:.7,sealed_p_draw:.2,sealed_p_away:.1,sealed_at:'2026-10-26T09:00:00Z',sealed_starts_at:'2026-10-27T12:00:00Z',sealed_home:'A',sealed_away:'B'};
it('uses the real sealed football distribution and records its exact source',()=>{
 expect(weeklyCandidate(base,now)).toMatchObject({prob:.7,market:'A',snapshot:{sourceTable:'match_predictions',sourceId:'match1',pick:'HOME',probabilitySource:'model'}});
});
it('does not infer probability from confidence or a missing seal',()=>expect(weeklyCandidate({...base,sealed_p_home:null},now)).toBeNull());
it('rejects unsupported model provenance',()=>expect(weeklyCandidate({...base,model_version:'unknown'},now)).toBeNull());
it('rejects changed picks and labels',()=>{
 expect(weeklyCandidate({...base,pick:'AWAY'},now)).toBeNull();
 expect(weeklyCandidate({...base,home_team:'Other'},now)).toBeNull();
});
it('rejects rescheduled and started matches',()=>{
 expect(weeklyCandidate({...base,starts_at:'2026-10-28T12:00:00Z'},now)).toBeNull();
 expect(weeklyCandidate(base,new Date('2026-10-28'))).toBeNull();
});
it('rejects invalid distributions and probabilities below the floor',()=>{
 expect(weeklyCandidate({...base,sealed_p_home:.9},now)).toBeNull();
 expect(weeklyCandidate({...base,sealed_p_home:.5,sealed_p_draw:.3,sealed_p_away:.2},now)).toBeNull();
});
it('accepts DRAW only from a complete valid sealed distribution',()=>expect(weeklyCandidate({...base,pick:'DRAW',sealed_pick:'DRAW',sealed_p_home:.2,sealed_p_draw:.6,sealed_p_away:.2},now)).toMatchObject({prob:.6,market:'Draw'}));
it('rejects invalid and future capture timestamps',()=>{
 expect(weeklyCandidate({...base,sealed_at:'not a date'},now)).toBeNull();
 expect(weeklyCandidate({...base,sealed_at:'2026-10-26T11:00:00Z'},now)).toBeNull();
});

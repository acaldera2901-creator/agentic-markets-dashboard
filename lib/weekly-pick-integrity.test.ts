import { expect, it } from 'vitest';
import { weeklyPickPurchasable, type WeeklyPickLeg } from './weekly-pick';
import { weeklyCandidate, type WeeklyCandidateRow } from './weekly-pick-candidate';
const now = new Date('2026-10-26T10:00:00Z');
const row: WeeklyCandidateRow = { id:'a', sport:'tennis', home_team:'A', away_team:'B',pick:'A', notes: JSON.stringify({probability:{version:'tennis-probability-v1',source:'model',raw_p1:.8396,raw_p2:.1604,published_p1:.8396,published_p2:.1604}}), starts_at:'2026-10-27T12:00:00Z',model_version:'elo_surface_v4_features_odds',source_table:'tennis_predictions',source_id:'a',sealed_pick:'A',sealed_p_home:.84,sealed_p_draw:null,sealed_p_away:.16,sealed_at:'2026-10-26T08:00:00Z',sealed_starts_at:'2026-10-27T12:00:00Z',sealed_home:'A',sealed_away:'B'};
it('accepts documented tennis confidence rounding but rejects drift and market metadata',()=>{
 expect(weeklyCandidate(row,now)?.prob).toBe(.84);
 expect(weeklyCandidate({...row,sealed_p_home:.79,sealed_p_away:.21},now)).toBeNull();
 expect(weeklyCandidate({...row,notes:row.notes!.replace('"model"','"market"')},now)).toBeNull();
 expect(weeklyCandidate({...row,notes:null},now)).toBeNull();
});
it('only sells a complete verified pre-match case with current fixture coverage',()=>{
 const l = {...weeklyCandidate(row,now), id:'wp_a'} as WeeklyPickLeg;
 const legs = ['a','b','c'].map(id=>({...l,id:`wp_${id}`}));
 const preds = ['a','b','c'].map(id=>({id,status:'open',result:null,starts_at:row.starts_at}));
 expect(weeklyPickPurchasable(legs,preds,now)).toBe(true);
 expect(weeklyPickPurchasable(legs.slice(0,2),preds,now)).toBe(false);
 expect(weeklyPickPurchasable(legs.map(l=>({...l,snapshot:undefined})),preds,now)).toBe(false);
 expect(weeklyPickPurchasable(legs,preds.slice(0,2),now)).toBe(false);
 expect(weeklyPickPurchasable(legs,preds.map(p=>({...p,status:'settled'})),now)).toBe(false);
 expect(weeklyPickPurchasable(legs,preds,new Date('2026-10-28'))).toBe(false);
 expect(weeklyPickPurchasable(legs,preds.map(p=>({...p,starts_at:'2026-10-28T12:00:00Z'})),now)).toBe(false);
});

import { resolveWeeklyPickOutcomes } from './weekly-pick';
it('distinguishes unresolved terminal results and all-void from played losses',()=>{
 const legs = [{id:'wp_a',label:'A vs B',market:'A',sport:'tennis',prob:.8}];
 expect(resolveWeeklyPickOutcomes(legs,[{id:'a',status:'settled',result:'unresolved',starts_at:null}])).toMatchObject({outcome:'unresolved',remaining:0,legs:[{status:'unresolved'}]});
 expect(resolveWeeklyPickOutcomes(legs,[{id:'a',status:'settled',result:'void',starts_at:null}]).outcome).toBe('void');
});

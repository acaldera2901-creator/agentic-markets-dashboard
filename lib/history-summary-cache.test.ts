import {describe,it,expect} from 'vitest';
import {readHistorySummary,writeHistorySummary} from './history-summary-cache';
const storage=()=>{const m=new Map<string,string>();return {getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>{m.set(k,v)}}};
describe('public history summary cache',()=>{
 it('retains public statistics between navigations but never a paid pick list',()=>{
  const s=storage();writeHistorySummary(s,{stats:{total:4,won:3},segments:[],history:[{pick:'private'}]} as never,100);
  expect(readHistorySummary(s,101)).toEqual({stats:{total:4,won:3},segments:[]});
  expect(s.getItem('betredge.history-summary.v1')).not.toContain('private');
 });
 it('expires, rejects malformed/future data and survives storage being disabled',()=>{
  const s=storage();writeHistorySummary(s,{stats:{total:4},segments:[]},100);
  expect(readHistorySummary(s,60101)).toBeNull();expect(readHistorySummary(s,99)).toBeNull();
  s.setItem('betredge.history-summary.v1','broken');expect(readHistorySummary(s,101)).toBeNull();
  const blocked={getItem:()=>{throw Error('blocked')},setItem:()=>{throw Error('blocked')}};
  expect(readHistorySummary(blocked)).toBeNull();expect(()=>writeHistorySummary(blocked,{stats:{},segments:[]})).not.toThrow();
 });
});

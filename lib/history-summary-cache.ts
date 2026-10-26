/** Public aggregates only. Never persist projected rows, picks or session data. */
import type { Segment } from './track-record-history';
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
type Summary = {stats: Record<string, unknown>; segments: Segment[]};
const KEY='betredge.history-summary.v1';
export function readHistorySummary(storage:StorageLike,now=Date.now()):Summary|null {
 try {
  const value=JSON.parse(storage.getItem(KEY)??'null');
  if(!value||!Number.isFinite(value.at)||now<value.at||now-value.at>60_000||!value.stats||typeof value.stats!=='object'||!Array.isArray(value.segments))return null;
  return {stats:value.stats,segments:value.segments};
 }catch{return null;}
}
export function writeHistorySummary(storage:StorageLike,value:Summary,now=Date.now()) {
 try {storage.setItem(KEY,JSON.stringify({at:now,stats:value.stats,segments:value.segments}));}catch{/* optional navigation optimization */}
}

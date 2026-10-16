/** Cache only raw history/ledger reads, never access-projected responses.
 * Short process-local TTL: no schema change, bounded memory, concurrent callers
 * share one read. Empty fallbacks and failures are deliberately not retained. */
export function createHistoryReadCache(now:()=>number=Date.now) {
 const entries=new Map<string,{expires:number;promise:Promise<unknown[]>}>();
 return function read<T>(key:string,load:()=>Promise<T[]>):Promise<T[]> {
  const existing=entries.get(key);
  if(existing && existing.expires>now())return existing.promise as Promise<T[]>;
  if(entries.size>=4)entries.delete(entries.keys().next().value!);
  const entry={expires:Infinity,promise:Promise.resolve().then(load) as Promise<unknown[]>};
  entries.set(key,entry);
  entry.promise=entry.promise.then(rows=>{
   if(rows.length)entry.expires=now()+30_000;
   else if(entries.get(key)===entry)entries.delete(key);
   return rows;
  },error=>{if(entries.get(key)===entry)entries.delete(key);throw error;});
  return entry.promise as Promise<T[]>;
 };
}
export const readHistoryCached=createHistoryReadCache();

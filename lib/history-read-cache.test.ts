import {describe,it,expect,vi} from 'vitest';
import {createHistoryReadCache} from './history-read-cache';
describe('history raw-read cache',()=>{
 it('coalesces simultaneous reads and expires after 30 seconds',async()=>{
  let now=0;const read=createHistoryReadCache(()=>now);const load=vi.fn(async()=>[{id:1}]);
  const [a,b]=await Promise.all([read('all',load),read('all',load)]);
  expect(a).toEqual(b);expect(load).toHaveBeenCalledTimes(1);
  now=29999;await read('all',load);expect(load).toHaveBeenCalledTimes(1);
  now=30001;await read('all',load);expect(load).toHaveBeenCalledTimes(2);
 });
 it('isolates filters, retries failures and does not retain empty/error fallbacks',async()=>{
  const read=createHistoryReadCache();const load=vi.fn().mockRejectedValueOnce(new Error('db')).mockResolvedValueOnce([]).mockResolvedValue([{id:1}]);
  await expect(read('football',load)).rejects.toThrow('db');await read('football',load);await read('football',load);await read('tennis',load);
  expect(load).toHaveBeenCalledTimes(4);
 });
});

describe('history snapshot coalescing',()=>{
 it('TTL zero coalesces concurrent work without extending the shared-cache lifetime',async()=>{
  const read=createHistoryReadCache(()=>1000,0);const load=vi.fn(async()=>[{id:1}]);
  await Promise.all([read('snapshot',load),read('snapshot',load)]);
  expect(load).toHaveBeenCalledTimes(1);
  await read('snapshot',load);expect(load).toHaveBeenCalledTimes(2);
 });
});

import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const {dbExecute}=vi.hoisted(()=>({dbExecute:vi.fn().mockResolvedValue([])}));vi.mock('@/lib/db',()=>({dbExecute}));
import {recordTrackingCounter} from './tracking-counters';
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('VERCEL_ENV','production');});afterEach(()=>vi.unstubAllEnvs());
it('does not touch DB when default off',async()=>{await recordTrackingCounter('bot');expect(dbExecute).not.toHaveBeenCalled();});
it('atomic counters carry only reason and count, with log evidence when DB itself fails',async()=>{vi.stubEnv('TRACKING_COUNTERS_ENABLED','1');dbExecute.mockRejectedValueOnce(new Error('DB down'));const warning=vi.spyOn(console,'warn').mockImplementation(()=>{});await expect(recordTrackingCounter('insert_failed')).resolves.toBeUndefined();expect(dbExecute).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT (day,reason)'),['insert_failed',1]);expect(warning).toHaveBeenCalledWith(expect.stringContaining('"counter_complete":false'));warning.mockRestore();});

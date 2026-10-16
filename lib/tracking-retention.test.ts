import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const {dbQueryStrict}=vi.hoisted(()=>({dbQueryStrict:vi.fn().mockResolvedValue([{summary:{dry_run:true}}])}));vi.mock('@/lib/db',()=>({dbQueryStrict}));
import {runTrackingRetention} from './tracking-retention';
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('VERCEL_ENV','production');});afterEach(()=>vi.unstubAllEnvs());
it('coordinated cleanup defaults off',async()=>{expect(await runTrackingRetention(false)).toBeNull();expect(dbQueryStrict).not.toHaveBeenCalled();});
it('approved periods are required before any deletion',async()=>{vi.stubEnv('TRACKING_RETENTION_ENABLED','1');vi.stubEnv('ANALYTICS_RETENTION_APPROVED','1');await expect(runTrackingRetention(false)).rejects.toThrow(/explicit configuration/);expect(dbQueryStrict).not.toHaveBeenCalled();});
it('dry and live runs use the identical transaction with explicit bounded periods',async()=>{vi.stubEnv('TRACKING_RETENTION_ENABLED','1');vi.stubEnv('ANALYTICS_RETENTION_APPROVED','1');vi.stubEnv('EMAIL_OUTCOMES_RETENTION_DAYS','90');vi.stubEnv('TRACKING_COUNTER_RETENTION_DAYS','90');await runTrackingRetention(true);const call=dbQueryStrict.mock.calls[0];expect(call[0]).toContain('br_run_tracking_retention');expect(call[1].slice(0,2)).toEqual([90,90]);expect(call[1][3]).toBe(true);});

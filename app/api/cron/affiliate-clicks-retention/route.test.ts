import {afterEach,describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import path from 'node:path';
const rpc=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/affiliate/rpc',()=>({affiliateRpc:rpc}));
import {GET} from './route';
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
const req=(token='secret')=>new Request('https://example.test/api/cron/affiliate-clicks-retention',{headers:{authorization:`Bearer ${token}`}});
describe('affiliate clicks retention cron',()=>{
 it('requires cron authentication',async()=>{vi.stubEnv('CRON_SECRET','secret');expect((await GET(req('wrong'))).status).toBe(401);expect(rpc).not.toHaveBeenCalled();});
 it('purges through the SQL function in every mode (retention does not depend on the program being live)',async()=>{vi.stubEnv('CRON_SECRET','secret');for(const mode of ['off','shadow','live']){vi.stubEnv('AFFILIATE_MODE',mode);rpc.mockResolvedValueOnce({ok:true,purged:3,retention_days:90});expect(await (await GET(req())).json()).toEqual({ok:true,purged:3,retention_days:90});}expect(rpc).toHaveBeenCalledWith('affiliate_purge_clicks',{});expect(rpc).toHaveBeenCalledTimes(3);});
 it('reports failure (503) instead of a fake successful purge',async()=>{vi.stubEnv('CRON_SECRET','secret');rpc.mockRejectedValue(new Error('db'));expect((await GET(req())).status).toBe(503);rpc.mockResolvedValue({ok:false});expect((await GET(req())).status).toBe(503);});
 it('is scheduled daily in vercel.json',()=>{const v=JSON.parse(readFileSync(path.resolve(__dirname,'../../../../vercel.json'),'utf8'));expect(v.crons).toContainEqual({path:'/api/cron/affiliate-clicks-retention',schedule:expect.stringMatching(/^\d+ \d+ \* \* \*$/)});});
});

import {afterEach,describe,it,expect,vi} from 'vitest';
const rpc=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/affiliate/rpc',()=>({affiliateRpc:rpc}));
import {GET} from './route';
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
const req=(token='secret')=>new Request('https://example.test/api/cron/affiliate-mature',{headers:{authorization:`Bearer ${token}`}});
describe('affiliate maturation cron',()=>{
 it('requires cron authentication',async()=>{vi.stubEnv('CRON_SECRET','secret');expect((await GET(req('wrong'))).status).toBe(401);expect(rpc).not.toHaveBeenCalled();});
 it('does not access the DB when off or shadow',async()=>{vi.stubEnv('CRON_SECRET','secret');for(const mode of ['off','shadow']){vi.stubEnv('AFFILIATE_MODE',mode);expect(await (await GET(req())).json()).toMatchObject({skipped:true});}expect(rpc).not.toHaveBeenCalled();});
 it('does not mature before accounting reconciliation is enabled',async()=>{vi.stubEnv('CRON_SECRET','secret');vi.stubEnv('AFFILIATE_MODE','live');expect(await (await GET(req())).json()).toMatchObject({skipped:true,reason:'accounting_not_ready'});expect(rpc).not.toHaveBeenCalled();});
 it('matures through a single atomic RPC in live mode',async()=>{vi.stubEnv('CRON_SECRET','secret');vi.stubEnv('AFFILIATE_MODE','live');vi.stubEnv('AFFILIATE_ACCOUNTING_READY','1');rpc.mockResolvedValue({ok:true,matured:2});expect(await (await GET(req())).json()).toEqual({ok:true,matured:2});expect(rpc).toHaveBeenCalledWith('affiliate_mature_commissions',{});});
 it('reports failure instead of a fake successful run',async()=>{vi.stubEnv('CRON_SECRET','secret');vi.stubEnv('AFFILIATE_MODE','live');vi.stubEnv('AFFILIATE_ACCOUNTING_READY','1');rpc.mockRejectedValue(new Error('db'));expect((await GET(req())).status).toBe(503);});
});

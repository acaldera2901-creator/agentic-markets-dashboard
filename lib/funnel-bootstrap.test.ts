import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {syncAnalyticsConsent,trackEvent} from './track-event';
beforeEach(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('gdpr_consent','accepted');vi.stubEnv('NEXT_PUBLIC_ANALYTICS_LINKING_ENABLED','1');});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('does not claim a disabled server established a session',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({ok:true,disabled:true})));
 expect(await syncAnalyticsConsent()).toBe('disabled');
});
it('waits for the signed cookie before sending simultaneous funnel events',async()=>{
 let resolve!:(r:Response)=>void;
 const fetcher=vi.fn((url:string)=>url==='/api/analytics/session'?new Promise<Response>(r=>{resolve=r;}):Promise.resolve(Response.json({ok:true})));
 vi.stubGlobal('fetch',fetcher);
 trackEvent('plan_view');trackEvent('checkout_opened');
 expect(fetcher.mock.calls.map(c=>c[0])).toEqual(['/api/analytics/session']);
 resolve(Response.json({ok:true}));
 await vi.waitFor(()=>expect(fetcher.mock.calls.filter(c=>c[0]==='/api/track')).toHaveLength(2));
 trackEvent('plan_cta_click');
 await vi.waitFor(()=>expect(fetcher.mock.calls.filter(c=>c[0]==='/api/track')).toHaveLength(3));
 expect(fetcher.mock.calls.filter(c=>c[0]==='/api/analytics/session')).toHaveLength(1);
});
it('keeps aggregate visibility when session bootstrap fails without inventing identity',async()=>{
 const fetcher=vi.fn((url:string)=>Promise.resolve(Response.json({}, {status:url==='/api/analytics/session'?503:200})));
 vi.stubGlobal('fetch',fetcher);trackEvent('plan_view');
 await vi.waitFor(()=>expect(fetcher.mock.calls).toHaveLength(2));
 const body=JSON.parse(String((fetcher.mock.calls[1] as unknown as [string,RequestInit])[1].body));
 expect(body.event_type).toBe('plan_view');expect(body.analytics_consent).toBe(false);expect(body.session_id).toBeUndefined();
});
it('drops queued events if consent is withdrawn during bootstrap',async()=>{
 let resolve!:(r:Response)=>void;
 const fetcher=vi.fn((url:string,init?:RequestInit)=>JSON.parse(String(init?.body)).consent==='accepted'?new Promise<Response>(r=>{resolve=r;}):Promise.resolve(Response.json({ok:true})));
 vi.stubGlobal('fetch',fetcher);trackEvent('checkout_opened');
 localStorage.setItem('gdpr_consent','declined');resolve(Response.json({ok:true}));
 await vi.waitFor(()=>expect(fetcher.mock.calls).toHaveLength(2));
 expect(fetcher.mock.calls.map(c=>c[0])).not.toContain('/api/track');
});

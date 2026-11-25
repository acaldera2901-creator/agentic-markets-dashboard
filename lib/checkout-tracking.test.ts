import {afterEach,expect,it,vi} from 'vitest';
import {checkoutRequest} from './checkout-tracking';
const track=vi.hoisted(()=>vi.fn());
vi.mock('./track-event',()=>({trackEvent:track,syncAnalyticsConsent:vi.fn().mockResolvedValue('ready')}));
afterEach(()=>{track.mockClear();vi.unstubAllGlobals();});
it('records an attempt and provider readiness, never a purchase or payment URL',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({url:'https://pay.example/private-order'})));
 const response=await checkoutRequest('/api/shopify/checkout',{method:'POST'}, {plan:'pro',period:'monthly',rail:'shopify'});
 expect(response.ok).toBe(true);
 expect(track.mock.calls.map(c=>c[0])).toEqual(['checkout_attempt','checkout_ready']);
 expect(JSON.stringify(track.mock.calls)).not.toContain('private-order');
});
it.each([401,409,500])('exposes bounded HTTP failure %s, without provider error text',async(status)=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({error:'buyer@example.test'},{status})));
 await checkoutRequest('/api/paygate/checkout',{method:'POST'}, {plan:'pro',period:'monthly',rail:'paygate'});
 expect(track.mock.calls[1]).toEqual(['checkout_failed',{plan:'pro',meta:{rail:'paygate',period:'monthly',status,reason:'http'}}]);
 expect(JSON.stringify(track.mock.calls)).not.toContain('buyer@');
});
it('reports malformed success and preserves the response for the UI',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({})));
 const response=await checkoutRequest('/api/paygate/checkout',{method:'POST'}, {plan:'pro',period:'monthly',rail:'paygate'});
 expect(await response.json()).toEqual({});expect(track.mock.calls[1][0]).toBe('checkout_failed');
});
it('reports network failure and propagates it to existing UI recovery',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('network')));
 await expect(checkoutRequest('/api/paygate/checkout',{method:'POST'}, {plan:'pro',period:'monthly',rail:'paygate'})).rejects.toThrow('network');
 expect(track.mock.calls[1][1].meta.reason).toBe('network');
});
it('recognizes a direct crypto order without emitting wallet or order identifiers',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({order:'secret-order',address:'secret-wallet'})));
 await checkoutRequest('/api/crypto/checkout',{method:'POST'}, {plan:'pro',period:'monthly',rail:'crypto_direct'});
 expect(track.mock.calls[1][0]).toBe('checkout_ready');expect(JSON.stringify(track.mock.calls)).not.toContain('secret');
});

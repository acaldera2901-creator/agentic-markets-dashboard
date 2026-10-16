import {describe,it,expect} from 'vitest';
import {analyticsMeta, shouldSkipAnalyticsPath} from './analytics-quality';
describe('backoffice event quality',()=>{
 it('recognizes admin paths without swallowing unrelated routes',()=>{expect(shouldSkipAnalyticsPath('/admin/banners-preview')).toBe(true);expect(shouldSkipAnalyticsPath('/administrator')).toBe(false);});
 it('overwrites fake ua and test status with coarse server classification',()=>{expect(analyticsMeta({ua:'fake',host:'foo.vercel.app',test:false},'Mozilla/5.0 Chrome/140.0')).toMatchObject({ua:'chrome',test:true});});
 it('keeps production widget hosts and never stores raw UA',()=>{const raw='Mozilla/5.0 Version/18.0 Safari/605.1.15';const m=analyticsMeta({host:'publisher.com'},raw);expect(m.ua).toBe('safari');expect(m.test).toBe(false);expect(JSON.stringify(m)).not.toContain(raw);});
 it('strips query strings from paths and rejects array metadata',()=>{expect(analyticsMeta({path:'/plans?email=test@example.com'},'Mozilla/5.0').path).toBe('/plans');expect(analyticsMeta([],'Mozilla/5.0').ua).toBe('other');});
});
it('allows only bounded analytics dimensions and removes identities even in encoded paths',()=>{const m=analyticsMeta({email:'private@example.test',profile_id:'11111111-2222-3333-4444-555555555555',user_agent:'raw',meta:{secret:'x'},path:'/users/private%40example.test?token=secret',viewability:'50pct-v1'},'Mozilla/5.0');expect(JSON.stringify(m)).not.toMatch(/private|profile_id|secret|user_agent/);expect(m.viewability).toBe('50pct-v1');expect(shouldSkipAnalyticsPath('/%61dmin/preview')).toBe(true);});
it('bounded decoding removes nested identity text from paths and every allowlisted text dimension',()=>{
 const input={path:'/tools/alice%2540private.example',surface:'alice%2540private.example',utm_source:'alice%252540private.example',utm_campaign:'invalid%xx',ref:'nested%252525252540private.example'};
 const result=analyticsMeta(input,'Mozilla/5.0');
 expect(result.path).toBe('/tools/[redacted]');expect(result.surface).toBe('[redacted]');expect(result.utm_source).toBe('[redacted]');expect(result.utm_campaign).toBe('[redacted]');expect(result.ref).toBe('[redacted]');
 expect(JSON.stringify(result)).not.toContain('private.example');
});

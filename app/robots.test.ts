import { describe, expect, it } from 'vitest';
import robots from './robots';

// Implements Google's longest matching path rule to test effective crawlability,
// including exact endpoints versus private subroutes, not array membership.
function allowed(path: string) {
  const rule = (robots().rules as Array<{allow: string | string[]; disallow: string | string[]}>)[0];
  const matches = (value: string | string[], allow: boolean) => [value].flat().filter(p => new RegExp('^' + p.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')).test(path)).map(p => ({length:p.replace(/[$*]/g,'').length, allow}));
  return [...matches(rule.allow,true),...matches(rule.disallow,false)].sort((a,b)=>b.length-a.length || Number(b.allow)-Number(a.allow))[0]?.allow ?? true;
}
describe('public board rendering is crawlable',()=>{
  it('allows public match requests including query strings',()=>{
    for(const url of ['/api/predictions','/api/predictions?lang=en','/api/tennis','/api/tennis-live','/api/news']) expect(allowed(url),url).toBe(true);
  });
  it('keeps auth, tracking, admin and endpoint subroutes excluded',()=>{
    for(const url of ['/api/auth','/api/track','/api/admin/users','/api/predictions/private','/api/tennis/admin','/admin','/reset-password','/go/example']) expect(allowed(url),url).toBe(false);
  });
});

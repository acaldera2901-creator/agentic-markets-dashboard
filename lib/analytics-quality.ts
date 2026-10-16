const META_KEYS=new Set(['path','src','utm_source','utm_medium','utm_campaign','utm_content','utm_term','ref_host','crm','host','ref','campaign_id','slot','surface','section','sport','tab','view','card','count','reason','cta','audience','internal','choice','digest','book','book_key','language','plan','partner','partner_id','viewability']);
export function shouldSkipAnalyticsPath(path:string):boolean {
 let decoded=path.split(/[?#]/)[0];
 try{for(let i=0;i<4&&decoded.includes('%');i++)decoded=decodeURIComponent(decoded);}catch{return true;}
 return /^\/admin(?:\/|$)/i.test(decoded);
}
/** Decode bounded input before scrubbing; unresolved or malformed escapes fail closed. */
function cleanDimension(value:string,path=false):string {
 let decoded=value.slice(0,path?2048:640);
 for(let depth=0;depth<5;depth++){
  if(path)decoded=decoded.split(/[?#]/)[0];
  if(!decoded.includes('%'))return decoded.replace(/[^\s/<>"@]+@[^\s/<>"@]+/g,'[redacted]').replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi,'[redacted]').slice(0,path?512:160);
  try{const next=decodeURIComponent(decoded);if(next===decoded)return '[redacted]';decoded=next;}catch{return '[redacted]';}
 }
 return '[redacted]';
}
export function analyticsMeta(input:unknown,userAgent:string|null):Record<string,unknown>{
 const source=input&&typeof input==='object'&&!Array.isArray(input)?input as Record<string,unknown>:{};
 const m:Record<string,unknown>={};
 for(const [key,value] of Object.entries(source)){
  if(!META_KEYS.has(key))continue;
  if(typeof value==='string')m[key]=cleanDimension(value,key==='path');
  else if(typeof value==='boolean'||(typeof value==='number'&&Number.isFinite(value)))m[key]=value;
 }
 const ua=userAgent||'';
 m.ua=/Edg\//.test(ua)?'edge':/Firefox\//.test(ua)?'firefox':/Chrome\//.test(ua)?'chrome':/Safari\//.test(ua)?'safari':'other';
 m.device=/iPad|Tablet/i.test(ua)?'tablet':/Mobile|Android|iPhone/i.test(ua)?'mobile':'desktop';
 let host=typeof m.host==='string'?m.host.toLowerCase():'';
 try{if(host)host=new URL('https://'+host).hostname;}catch{host='unknown';}
 if(m.host!==undefined)m.host=host;
 m.test=!!host&&(['example.com','localhost','127.0.0.1','partner-site.com'].includes(host)||host.endsWith('.vercel.app')||host.endsWith('.localhost')||host.endsWith('.test'));

 return m;
}

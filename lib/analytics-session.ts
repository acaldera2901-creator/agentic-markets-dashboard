import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { dbExecute, dbQueryStrict } from '@/lib/db';
import { analyticsWriteAllowed } from './events-write-gate';
export const ANALYTICS_COOKIE='br_analytics_session';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const TTL=86400;
export function analyticsLinkingEnabled():boolean {
 return analyticsWriteAllowed()&&process.env.ANALYTICS_LINKING_ENABLED==='1'&&process.env.ANALYTICS_RETENTION_APPROVED==='1'&&(process.env.ANALYTICS_SESSION_SECRET?.length??0)>=32;
}
export function signAnalyticsSession(sid:string,secret=process.env.ANALYTICS_SESSION_SECRET!,now=Math.floor(Date.now()/1000)):string {
 if(!UUID.test(sid)||!secret||secret.length<32)throw new Error('Analytics session configuration invalid');
 const body=Buffer.from(JSON.stringify({sid,iat:now,exp:now+TTL})).toString('base64url');
 return body+'.'+createHmac('sha256',secret).update(body).digest('base64url');
}
export function verifyAnalyticsSession(token:string|null|undefined,secret=process.env.ANALYTICS_SESSION_SECRET,now=Math.floor(Date.now()/1000)):string|null {
 if(!token||!secret||secret.length<32||token.length>512)return null;
 const [body,sig,extra]=token.split('.');if(!body||!sig||extra)return null;
 const expected=createHmac('sha256',secret).update(body).digest('base64url');
 if(sig.length!==expected.length||!timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null;
 try{const p=JSON.parse(Buffer.from(body,'base64url').toString());return UUID.test(p.sid)&&Number.isInteger(p.iat)&&p.iat<=now+60&&p.exp===p.iat+TTL&&p.exp>now?p.sid:null;}catch{return null;}
}
export function readAnalyticsSession(req:Request):string|null {
 try{const value=(req.headers.get('cookie')??'').split(/;\s*/).find(p=>p.startsWith(ANALYTICS_COOKIE+'='));return verifyAnalyticsSession(value?decodeURIComponent(value.slice(ANALYTICS_COOKIE.length+1)):null);}catch{return null;}
}
export function setAnalyticsCookie(res:NextResponse,token:string):void {
 // Session cookie, no cross-domain sharing and never readable by JS.
 res.cookies.set(ANALYTICS_COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',...(token?{}:{maxAge:0})});
}
export async function startAnalyticsSession(res:NextResponse):Promise<string> {
 const sid=randomUUID();await dbExecute('INSERT INTO br_analytics_sessions (session_id) VALUES ($1)',[sid]);
 setAnalyticsCookie(res,signAnalyticsSession(sid));return sid;
}
export async function linkAnalyticsIdentity(req:Request,identifier:string,via:'login'|'signup'):Promise<boolean> {
 if(!analyticsLinkingEnabled())return false;const sid=readAnalyticsSession(req);if(!sid)return false;
 try{const rows=await dbQueryStrict<{linked:boolean}>('SELECT public.br_link_analytics_session($1,$2,$3) AS linked',[sid,identifier,via]);return rows[0]?.linked===true;}catch{console.warn(JSON.stringify({kind:'analytics_link_failed',counter_complete:false}));return false;}
}
export async function revokeAnalyticsSession(sid:string):Promise<void> {
 await dbExecute('SELECT public.br_revoke_analytics_session($1)',[sid]);
}
/** Successful password/token auth alone may attach a profile. Existing bindings are never reassigned. */
export async function attachAnalyticsIdentity(req:Request,res:NextResponse,identifier:string,via:'login'|'signup'):Promise<void> {
 if(!analyticsLinkingEnabled()||!readAnalyticsSession(req))return;
 try{
  const result=await dbQueryStrict<{linked:boolean}>('SELECT public.br_link_analytics_session($1,$2,$3) AS linked',[readAnalyticsSession(req),identifier,via]);
  if(result[0]?.linked!==false)return;
  // Account switches get a new server-minted SID, preserving isolation between identities.
  await revokeAnalyticsSession(readAnalyticsSession(req)!);
  const sid=await startAnalyticsSession(res);
  await dbQueryStrict('SELECT public.br_link_analytics_session($1,$2,$3) AS linked',[sid,identifier,via]);
 }catch{console.warn(JSON.stringify({kind:'analytics_link_failed',counter_complete:false}));}
}

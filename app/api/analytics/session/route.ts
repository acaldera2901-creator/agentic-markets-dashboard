import { NextResponse } from 'next/server';
import { getSessionPlan } from '@/lib/auth';
import { dbQueryStrict } from '@/lib/db';
import { analyticsWriteAllowed } from '@/lib/events-write-gate';
import { analyticsLinkingEnabled, readAnalyticsSession, setAnalyticsCookie, startAnalyticsSession, revokeAnalyticsSession } from '@/lib/analytics-session';
import {isBotUserAgent} from '@/lib/bot-filter';
import {analyticsMeta,shouldSkipAnalyticsPath} from '@/lib/analytics-quality';
import {dbExecute} from '@/lib/db';
import { rateLimit,clientIp } from '@/lib/rate-limit';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 const origin=req.headers.get('origin');
 if(origin!==new URL(req.url).origin)return NextResponse.json({error:'forbidden'},{status:403});
 if(rateLimit(`analytics-session:${clientIp(req)}`,30,60000))return NextResponse.json({error:'rate_limited'},{status:429});
 let body;try{body=await req.json();}catch{return NextResponse.json({error:'invalid_request'},{status:400});}
 if(!body||!['accepted','revoked'].includes(body.consent))return NextResponse.json({error:'invalid_request'},{status:400});
 const res=NextResponse.json({ok:true},{headers:{'cache-control':'no-store'}});
 if(body.consent==='revoked'){
  const sid=readAnalyticsSession(req);setAnalyticsCookie(res,'');
  if(sid&&analyticsWriteAllowed())try{await revokeAnalyticsSession(sid);}catch{console.warn(JSON.stringify({kind:'analytics_revocation_failed',counter_complete:false}));return NextResponse.json({error:'cleanup_incomplete'},{status:503,headers:{'set-cookie':res.headers.get('set-cookie')!}});}
  return res;
 }
 if(!analyticsLinkingEnabled())return NextResponse.json({ok:true,disabled:true},{headers:{'cache-control':'no-store'}});
 if(isBotUserAgent(req.headers.get('user-agent'))||(typeof body.entry?.path==='string'&&shouldSkipAnalyticsPath(body.entry.path))||body.entry?.internal===true)return NextResponse.json({ok:true,ignored:true});
 try{
  const ctx=await getSessionPlan(req);
  if(ctx?.plan==='admin_full')return NextResponse.json({ok:true,ignored:true});
  let sid=readAnalyticsSession(req);
  // Reuse only a live server-issued record; a copied raw client SID is never considered.
  if(sid){const rows=await dbQueryStrict<{active:boolean}>('SELECT EXISTS(SELECT 1 FROM br_analytics_sessions WHERE session_id=$1 AND revoked_at IS NULL) AS active',[sid]);if(!rows[0]?.active)sid=null;}
  if(!sid)sid=await startAnalyticsSession(res);
  if(ctx){const linked=await dbQueryStrict<{linked:boolean}>('SELECT public.br_link_analytics_session($1,$2,$3) AS linked',[sid,ctx.identifier,'login']);if(!linked[0]?.linked){await revokeAnalyticsSession(sid);sid=await startAnalyticsSession(res);await dbQueryStrict('SELECT public.br_link_analytics_session($1,$2,$3) AS linked',[sid,ctx.identifier,'login']);}}
  const meta=analyticsMeta(body.entry,req.headers.get('user-agent'));
  const encoded=JSON.stringify(meta);const entry=encoded.length<=2048?encoded:JSON.stringify({ua:meta.ua,device:meta.device});
  await dbExecute('SELECT public.br_record_session_start($1,$2::jsonb,$3,$4)',[sid,entry,req.headers.get('x-vercel-ip-country'),null]);
  // The SID is intentionally not returned: clients cannot use it to claim somebody else's session.
  return res;
 }catch{console.warn(JSON.stringify({kind:'analytics_session_failed',counter_complete:false}));return NextResponse.json({error:'unavailable'},{status:503});}
}

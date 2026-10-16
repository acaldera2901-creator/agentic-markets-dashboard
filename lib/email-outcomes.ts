import {createHmac,timingSafeEqual} from 'node:crypto';
import {dbExecute} from '@/lib/db';
import {analyticsWriteAllowed} from './events-write-gate';
export function emailRetentionDays():number|null{const raw=process.env.EMAIL_OUTCOMES_RETENTION_DAYS??'';return /^\d+$/.test(raw)&&Number(raw)>=7&&Number(raw)<=730?Number(raw):null;}
export function emailOutcomesEnabled():boolean{return analyticsWriteAllowed()&&process.env.EMAIL_OUTCOMES_ENABLED==='1'&&emailRetentionDays()!==null;}
/** Resend/Svix signs id.timestamp.rawBody. Multiple v1 values support secret rotation. */
export function verifyResendWebhook(raw:string,headers:Headers,secret:string|undefined,now=Math.floor(Date.now()/1000)):boolean{
 const id=headers.get('svix-id'),ts=headers.get('svix-timestamp'),signatures=headers.get('svix-signature');
 if(!secret?.startsWith('whsec_')||!id||id.length>160||!/^\d+$/.test(ts??'')||!signatures||signatures.length>2048||Math.abs(now-Number(ts))>300)return false;
 const key=Buffer.from(secret.slice(6),'base64');if(key.length<16)return false;
 const expected=createHmac('sha256',key).update(`${id}.${ts}.${raw}`).digest('base64');
 return signatures.split(' ').some(part=>{const [v,sig,extra]=part.split(',');return v==='v1'&&!extra&&sig?.length===expected.length&&timingSafeEqual(Buffer.from(sig),Buffer.from(expected));});
}
export type EmailOutcome={eventId:string;messageId:string;eventType:string;occurredAt:string};
const EVENTS=new Set(['email.sent','email.delivered','email.delivery_delayed','email.bounced','email.complained','email.failed','email.suppressed','email.opened','email.clicked']);
export function projectEmailOutcome(input:unknown,eventId:string):EmailOutcome|null{
 if(!input||typeof input!=='object')return null;
 const p=input as {type?:unknown;created_at?:unknown;data?:{email_id?:unknown}};
 if(typeof p.type!=='string'||!EVENTS.has(p.type)||typeof p.created_at!=='string'||!Number.isFinite(Date.parse(p.created_at))||typeof p.data?.email_id!=='string'||!/^[a-zA-Z0-9_-]{1,160}$/.test(p.data.email_id)||!/^[a-zA-Z0-9_-]{1,160}$/.test(eventId))return null;
 return {eventId,messageId:p.data.email_id,eventType:p.type,occurredAt:new Date(p.created_at).toISOString()};
}
export async function recordEmailOutcome(outcome:EmailOutcome):Promise<void>{
 if(!emailOutcomesEnabled())return;
 const engagement=['email.opened','email.clicked'].includes(outcome.eventType);
 if(engagement){
  if(process.env.EMAIL_ENGAGEMENT_ENABLED!=='1')return;
  await dbExecute(`INSERT INTO email_events (event_id,message_id,event_type,occurred_at,profile_id)
   SELECT $1,$2,$3,$4::timestamptz,m.profile_id FROM br_email_messages m
   WHERE m.message_id=$2 AND m.engagement_allowed=true
   ON CONFLICT (event_id) DO NOTHING`,[outcome.eventId,outcome.messageId,outcome.eventType,outcome.occurredAt]);
 }else{
  await dbExecute(`INSERT INTO email_events (event_id,message_id,event_type,occurred_at,profile_id)
   VALUES ($1,$2,$3,$4::timestamptz,(SELECT profile_id FROM br_email_messages WHERE message_id=$2))
   ON CONFLICT (event_id) DO NOTHING`,[outcome.eventId,outcome.messageId,outcome.eventType,outcome.occurredAt]);
 }
}
/** Provider message IDs only; recipient email is resolved to UUID and never copied to new analytics tables. */
export async function recordEmailMessage(messageId:string,identifier:string,engagementAllowed=false):Promise<void>{
 if(!emailOutcomesEnabled()||!/^[a-zA-Z0-9_-]{1,160}$/.test(messageId))return;
 await dbExecute(`SELECT public.br_correlate_email_message($1,$2,$3)`,[messageId,identifier,engagementAllowed&&process.env.EMAIL_ENGAGEMENT_ENABLED==='1']);
}
/** Signed provider unsubscribe notifications resolve email transiently; analytics stores only contact/message references and UUIDs. */
export async function recordContactUnsubscribe(input:unknown,eventId:string):Promise<boolean>{
 if(!emailOutcomesEnabled()||!input||typeof input!=='object')return false;
 const p=input as {type?:unknown;created_at?:unknown;data?:{id?:unknown;email?:unknown;unsubscribed?:unknown}};
 if(p.type!=='contact.updated'||p.data?.unsubscribed!==true)return false;
 if(typeof p.data.id!=='string'||!/^[a-zA-Z0-9_-]{1,160}$/.test(p.data.id)||typeof p.data.email!=='string'||p.data.email.length>320||typeof p.created_at!=='string'||!Number.isFinite(Date.parse(p.created_at))||Date.parse(p.created_at)>Date.now()+86400000||!/^[a-zA-Z0-9_-]{1,160}$/.test(eventId))return false;
 await dbExecute('SELECT public.br_record_email_unsubscribe($1,$2,$3,$4::timestamptz)',[eventId,p.data.id,p.data.email.trim().toLowerCase(),new Date(p.created_at).toISOString()]);
 return true;
}

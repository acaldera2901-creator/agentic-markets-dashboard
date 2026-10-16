import { after } from 'next/server';
import { dbExecute } from '@/lib/db';
import { analyticsWriteAllowed } from './events-write-gate';
export type BusinessEvent={type:'signup_created'|'account_activated'|'purchase';identifier:string;source?:string;orderId?:string;plan?:string;amount?:number|null;currency?:string|null};
export function businessEventsEnabled():boolean{return analyticsWriteAllowed()&&process.env.BUSINESS_EVENTS_ENABLED==='1'&&process.env.ANALYTICS_RETENTION_APPROVED==='1';}
/** UUID resolution, dedup key claim and event insertion form one DB transaction. No client IDs/meta. */
export async function recordBusinessEvent(event:BusinessEvent):Promise<boolean> {
 if(!businessEventsEnabled())return false;
 if(!['signup_created','account_activated','purchase'].includes(event.type)||!event.identifier||event.identifier.length>320)return false;
 if(event.type==='purchase'&&(!event.orderId||event.orderId.length>160||!['paygate','paypal','crypto','stripe','shopify','weekly_pick','weekly_pick_crypto','weekly_pick_paygate'].includes(event.source??'')||(event.amount!=null&&(!Number.isFinite(event.amount)||event.amount<0))))return false;
 try{
  await dbExecute('SELECT public.br_emit_business_event($1,$2,$3,$4,$5,$6,$7)',[event.type,event.identifier,event.source??'auth',event.orderId??null,event.plan??null,event.amount??null,event.currency??null]);return true;
 }catch{console.warn(JSON.stringify({kind:'business_event_failed',event_type:event.type,counter_complete:false}));return false;}
}
export function scheduleBusinessEvent(event:BusinessEvent):void {
 if(!businessEventsEnabled())return;
 const run=()=>recordBusinessEvent(event);
 try{after(run);}catch{void run();}
}
export function schedulePurchaseEvent(input:{identifier:string;rail:string;paymentRef:string;grossUsd:number|null;plan?:string;paidAt?:Date;meta?:Record<string,unknown>}):void {
 scheduleBusinessEvent({type:'purchase',identifier:input.identifier,source:input.rail,orderId:input.paymentRef,plan:input.plan,amount:input.grossUsd,currency:input.grossUsd==null?null:'USD'});
}

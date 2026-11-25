import {syncAnalyticsConsent,trackEvent} from './track-event';

type Context={plan:string;period:string;rail:'shopify'|'paygate'|'crypto_direct'};
/** Provider readiness is NOT payment success. Never collect URLs, orders or error text. */
export async function checkoutRequest(url:string,init:RequestInit,context:Context):Promise<Response>{
 await syncAnalyticsConsent(undefined,false,true);
 const {plan,...meta}=context;
 trackEvent('checkout_attempt',{plan,meta});
 let response:Response;
 try{response=await fetch(url,init);}catch(error){
  trackEvent('checkout_failed',{plan,meta:{...meta,reason:'network'}});
  throw error;
 }
 if(!response.ok){
  trackEvent('checkout_failed',{plan,meta:{...meta,status:response.status,reason:'http'}});
 }else{
  const data=await response.clone().json().catch(()=>null);
  const ready=context.rail==='crypto_direct'
   ? typeof data?.order==='string' && typeof data?.address==='string'
   : typeof data?.url==='string' && /^https:\/\//.test(data.url);
  trackEvent(ready?'checkout_ready':'checkout_failed',{plan,meta:{...meta,...(!ready?{reason:'invalid_response'}:{})}});
 }
 return response;
}

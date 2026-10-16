import {NextResponse} from 'next/server';
import {recordContactUnsubscribe,emailOutcomesEnabled,projectEmailOutcome,recordEmailOutcome,verifyResendWebhook} from '@/lib/email-outcomes';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 if(!emailOutcomesEnabled())return NextResponse.json({ok:true,disabled:true});
 if(!process.env.RESEND_WEBHOOK_SECRET)return NextResponse.json({error:'not_configured'},{status:503});
 if(Number(req.headers.get('content-length')??0)>65536)return NextResponse.json({error:'payload_too_large'},{status:413});
 const raw=await req.text();if(Buffer.byteLength(raw)>65536)return NextResponse.json({error:'payload_too_large'},{status:413});
 if(!verifyResendWebhook(raw,req.headers,process.env.RESEND_WEBHOOK_SECRET))return NextResponse.json({error:'invalid_signature'},{status:400});
 let input;try{input=JSON.parse(raw);}catch{return NextResponse.json({error:'invalid_payload'},{status:400});}
 try{if(await recordContactUnsubscribe(input,req.headers.get('svix-id')!))return NextResponse.json({ok:true});}catch{console.warn(JSON.stringify({kind:'email_unsubscribe_failed',counter_complete:false}));return NextResponse.json({error:'persistence_failed'},{status:503});}
 const outcome=projectEmailOutcome(input,req.headers.get('svix-id')!);if(!outcome)return NextResponse.json({ok:true,ignored:true});
 if(Date.parse(outcome.occurredAt)>Date.now()+86400000)return NextResponse.json({error:'invalid_timestamp'},{status:400});
 try{await recordEmailOutcome(outcome);return NextResponse.json({ok:true});}catch{console.warn(JSON.stringify({kind:'email_outcome_failed',counter_complete:false}));return NextResponse.json({error:'persistence_failed'},{status:503});}
}

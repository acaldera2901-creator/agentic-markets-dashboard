import {NextResponse} from 'next/server';
import {verifyBearer} from '@/lib/admin-auth';
import {affiliateMode} from '@/lib/affiliate/config';
import {affiliateRpc} from '@/lib/affiliate/rpc';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 if(!verifyBearer(req,process.env.CRON_SECRET))return NextResponse.json({error:'unauthorized'},{status:401});
 if(affiliateMode()!=='live')return NextResponse.json({ok:true,skipped:true});
 if(process.env.AFFILIATE_ACCOUNTING_READY!=='1')return NextResponse.json({ok:true,skipped:true,reason:'accounting_not_ready'});
 try{
  const result=await affiliateRpc('affiliate_mature_commissions',{});
  if(!result.ok)throw new Error('maturity rejected');
  return NextResponse.json(result);
 }catch{
  console.error('[affiliate/mature] failed');
  return NextResponse.json({error:'maturity unavailable'},{status:503});
 }
}

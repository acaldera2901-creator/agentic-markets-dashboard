// #AFFILIATE-CLICKS-RETENTION-1022 — cancella i click /r/CODE oltre i 90 giorni
// (funzione affiliate_purge_clicks, migration 20261022140000). Gira in ogni
// AFFILIATE_MODE: la conservazione vale per le righe già scritte anche se il
// programma viene spento. Fail-loud: un errore è 503, mai un 200 «ripulito».
import {NextResponse} from 'next/server';
import {verifyBearer} from '@/lib/admin-auth';
import {affiliateRpc} from '@/lib/affiliate/rpc';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 if(!verifyBearer(req,process.env.CRON_SECRET))return NextResponse.json({error:'unauthorized'},{status:401});
 try{
  const result=await affiliateRpc('affiliate_purge_clicks',{});
  if(!result.ok)throw new Error('purge rejected');
  return NextResponse.json(result);
 }catch{
  console.error('[affiliate/clicks-retention] failed');
  return NextResponse.json({error:'retention unavailable'},{status:503});
 }
}

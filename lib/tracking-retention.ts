import {dbQueryStrict} from '@/lib/db';
import {analyticsWriteAllowed} from './events-write-gate';
import {PSEUDONYMOUS_EVENTS} from './analytics-events';
import {emailRetentionDays} from './email-outcomes';
export function trackingRetentionEnabled():boolean{return analyticsWriteAllowed()&&process.env.TRACKING_RETENTION_ENABLED==='1'&&process.env.ANALYTICS_RETENTION_APPROVED==='1';}
export async function runTrackingRetention(dryRun:boolean):Promise<Record<string,unknown>|null>{
 if(!trackingRetentionEnabled())return null;
 const emailDays=emailRetentionDays();const raw=process.env.TRACKING_COUNTER_RETENTION_DAYS??'';
 const counterDays=/^\d+$/.test(raw)?Number(raw):0;
 if(emailDays===null||counterDays<7||counterDays>730)throw new Error('Tracking retention periods require explicit configuration');
 const rows=await dbQueryStrict<{summary:Record<string,unknown>}>('SELECT public.br_run_tracking_retention($1,$2,$3::jsonb,$4) AS summary',[emailDays,counterDays,JSON.stringify(PSEUDONYMOUS_EVENTS),dryRun]);
 if(!rows[0]?.summary)throw new Error('Tracking retention returned no verification summary');
 return rows[0].summary;
}

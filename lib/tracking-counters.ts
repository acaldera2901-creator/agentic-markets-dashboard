import {dbExecute} from '@/lib/db';
import {analyticsWriteAllowed} from './events-write-gate';
export type TrackingReason='bot'|'internal'|'test'|'throttled'|'insert_failed';
export async function recordTrackingCounter(reason:TrackingReason,count=1):Promise<void>{
 if(!analyticsWriteAllowed()||process.env.TRACKING_COUNTERS_ENABLED!=='1'||!Number.isSafeInteger(count)||count<1)return;
 // Independent log evidence survives the same DB outage that prevented event persistence.
 console.info(JSON.stringify({kind:'tracking_counter',reason,count,persistence:'attempted'}));
 try{await dbExecute(`INSERT INTO bo_tracking_counters (day,reason,count)
 VALUES ((now() AT TIME ZONE 'Europe/Berlin')::date,$1,$2)
 ON CONFLICT (day,reason) DO UPDATE SET count=bo_tracking_counters.count+EXCLUDED.count`,[reason,count]);}
 catch{console.warn(JSON.stringify({kind:'tracking_counter',reason,count,counter_complete:false,persistence:'failed'}));}
}

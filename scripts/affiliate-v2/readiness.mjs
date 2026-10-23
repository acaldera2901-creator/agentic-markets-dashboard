// Read-only schema preflight. No application of migrations, no secret output.
// node scripts/affiliate-v2/readiness.mjs /absolute/path/to/private.env
import {readFileSync} from "node:fs";
import {parseEnv} from "node:util";
const env=process.argv[2]?parseEnv(readFileSync(process.argv[2],"utf8")):process.env;
const url=env.SUPABASE_URL||env.NEXT_PUBLIC_SUPABASE_URL;
const key=env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key){console.error("Database credentials unavailable in this environment file; no query executed.");process.exit(2);}
const tables=["affiliates","affiliate_referral_clicks","affiliate_attributions","affiliate_wallets","affiliate_commissions","affiliate_payouts","affiliate_payer_fingerprints","affiliate_refund_events","affiliate_admin_actions","affiliate_absences","affiliate_terms_acceptances","affiliate_reversal_inbox"];
const query="SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name LIKE 'affiliate%' ORDER BY table_name,ordinal_position";
const response=await fetch(`${url}/rest/v1/rpc/exec_sql`,{method:"POST",headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({query}),signal:AbortSignal.timeout(15000)});
if(!response.ok){console.error(`Read-only schema query failed: HTTP ${response.status}`);process.exit(2);}
const rows=await response.json();
if(!Array.isArray(rows)){console.error("Unexpected schema response");process.exit(2);}
const missing=tables.filter(t=>!rows.some(r=>r.table_name===t));
console.log(JSON.stringify({checkedAt:new Date().toISOString(),schemaOnly:true,missingTables:missing,legacyBoClicksPresent:rows.some(r=>r.table_name==="affiliate_clicks"&&r.column_name==="link_id"),note:"Schema presence alone does not confirm activation, commission accuracy or payout readiness."},null,2));
process.exitCode=missing.length?1:0;

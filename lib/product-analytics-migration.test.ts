// @vitest-environment node
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,it,expect} from 'vitest';
let db:PGlite;
const SID='11111111-2222-4333-8444-555555555555';const PROFILE='aaaaaaaa-2222-4333-8444-555555555555';
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE TABLE profiles(id uuid PRIMARY KEY,identifier text UNIQUE,plan text,created_at timestamptz default now(),activated_at timestamptz,marketing_opt_out boolean default false);
 CREATE TABLE events(id bigint generated always as identity,event_type text,session_id text,country text,language text,plan text,partner_id text,value numeric,meta jsonb default '{}',created_at timestamptz default now());
 INSERT INTO profiles VALUES('${PROFILE}','synthetic@example.test','free',now(),now(),false);`);
 const migration=readFileSync(new URL('../supabase/migrations/202610160002_product_analytics.sql',import.meta.url),'utf8');
 await db.exec(migration);await db.exec(migration);
},30000);
afterAll(async()=>{await db.close();});
it('replayed migration, business event and purchase source variants dedupe atomically without email in events',async()=>{
 await db.query('SELECT br_emit_business_event($1,$2,$3,$4,$5,$6,$7)',['signup_created','synthetic@example.test','auth',null,null,null,null]);
 await db.query('SELECT br_emit_business_event($1,$2,$3,$4,$5,$6,$7)',['signup_created','synthetic@example.test','auth',null,null,null,null]);
 for(const source of ['paygate','crypto'])await db.query('SELECT br_emit_business_event($1,$2,$3,$4,$5,$6,$7)',['purchase','synthetic@example.test',source,'order-1','base',12,'USD']);
 const rows=await db.query('SELECT * FROM events');expect(rows.rows).toHaveLength(2);expect(JSON.stringify(rows.rows)).not.toContain('synthetic@example.test');
});
it('session anchor is idempotent and cannot be bound to a second account',async()=>{
 await db.query('INSERT INTO br_analytics_sessions(session_id) VALUES ($1)',[SID]);
 await db.query('SELECT br_link_analytics_session($1,$2,$3)',[SID,'synthetic@example.test','login']);
 for(let i=0;i<2;i++)await db.query('SELECT br_record_session_start($1,$2,$3,$4)',[SID,JSON.stringify({path:'/plans'}),'IT','it']);
 expect((await db.query("SELECT * FROM events WHERE event_type='session_start'")).rows).toHaveLength(1);
 await db.exec("INSERT INTO profiles(id,identifier,plan) VALUES('bbbbbbbb-2222-4333-8444-555555555555','other@example.test','free')");
 const denied=await db.query<{linked:boolean}>('SELECT br_link_analytics_session($1,$2,$3) AS linked',[SID,'other@example.test','login']);expect(denied.rows[0].linked).toBe(false);
 await db.query('SELECT br_revoke_analytics_session($1)',[SID]);
 expect((await db.query('SELECT * FROM session_links')).rows).toHaveLength(0);
 expect((await db.query('SELECT * FROM events WHERE session_id=$1',[SID])).rows).toHaveLength(0);
 const again=await db.query<{linked:boolean}>('SELECT br_link_analytics_session($1,$2,$3) AS linked',[SID,'synthetic@example.test','login']);expect(again.rows[0].linked).toBe(false);
});
it('email outcomes arriving before message mapping correlate using UUID only',async()=>{
 await db.exec("INSERT INTO email_events(event_id,message_id,event_type,occurred_at) VALUES('e1','m1','email.delivered',now())");
 await db.query('SELECT br_correlate_email_message($1,$2,$3)',['m1','synthetic@example.test',false]);
 expect((await db.query<{profile_id:string}>('SELECT profile_id FROM email_events')).rows[0].profile_id).toBe(PROFILE);
});
it('coordinated retention dry-run preserves data and live run strips old linkage and business identifiers together',async()=>{
 await db.exec("UPDATE events SET created_at=now()-interval '15 months'; UPDATE session_links SET linked_at=now()-interval '15 months'; UPDATE br_analytics_sessions SET created_at=now()-interval '15 months'; UPDATE email_events SET occurred_at=now()-interval '91 days'; UPDATE br_email_messages SET sent_at=now()-interval '91 days'");
 const args=[90,90,JSON.stringify(['session_start','page_view']),true];await db.query('SELECT br_run_tracking_retention($1,$2,$3,$4)',args);
 expect((await db.query('SELECT * FROM email_events')).rows).toHaveLength(1);
 args[3]=false;await db.query('SELECT br_run_tracking_retention($1,$2,$3,$4)',args);
 expect((await db.query('SELECT * FROM email_events')).rows).toHaveLength(0);expect((await db.query('SELECT * FROM br_email_messages')).rows).toHaveLength(0);
 expect(JSON.stringify((await db.query('SELECT meta FROM events')).rows)).not.toContain(PROFILE);
});
it('anonymous and authenticated database roles cannot read operational personal data or call writer RPCs',async()=>{
 await db.exec('SET ROLE anon');
 try{await expect(db.query('SELECT * FROM session_links')).rejects.toThrow(/permission denied/);await expect(db.query("SELECT br_revoke_analytics_session('x')")).rejects.toThrow(/permission denied/);}finally{await db.exec('RESET ROLE');}
});
it('provider unsubscribe is idempotent, disables engagement and stores no raw email',async()=>{await db.query('SELECT br_record_email_unsubscribe($1,$2,$3,$4)',['unsubscribe-1','contact-id','synthetic@example.test',new Date().toISOString()]);await db.query('SELECT br_record_email_unsubscribe($1,$2,$3,$4)',['unsubscribe-1','contact-id','synthetic@example.test',new Date().toISOString()]);const events=await db.query("SELECT * FROM email_events WHERE event_id='unsubscribe-1'");expect(events.rows).toHaveLength(1);expect(JSON.stringify(events.rows)).not.toContain('synthetic@example.test');expect((await db.query<{marketing_opt_out:boolean}>('SELECT marketing_opt_out FROM profiles WHERE id=$1',[PROFILE])).rows[0].marketing_opt_out).toBe(true);});
it('event insertion failure rolls back the dedup claim, permitting a later analytics retry',async()=>{
 await db.exec("ALTER TABLE events ADD CONSTRAINT synthetic_telemetry_failure CHECK(event_type<>'purchase') NOT VALID");
 try{await expect(db.query('SELECT br_emit_business_event($1,$2,$3,$4,$5,$6,$7)',['purchase','synthetic@example.test','paypal','retry-order','base',12,'USD'])).rejects.toThrow();expect((await db.query("SELECT * FROM br_business_event_keys WHERE event_key='purchase:paypal:retry-order'")).rows).toHaveLength(0);}finally{await db.exec('ALTER TABLE events DROP CONSTRAINT synthetic_telemetry_failure');}
 await db.query('SELECT br_emit_business_event($1,$2,$3,$4,$5,$6,$7)',['purchase','synthetic@example.test','paypal','retry-order','base',12,'USD']);expect((await db.query("SELECT * FROM br_business_event_keys WHERE event_key='purchase:paypal:retry-order'")).rows).toHaveLength(1);
});
it('both insert/revoke interleavings leave no linked SID and reject an insert after withdrawal',async()=>{
 const first='22222222-2222-4333-8444-555555555555',second='33333333-2222-4333-8444-555555555555';
 for(const sid of [first,second])await db.query('INSERT INTO br_analytics_sessions(session_id) VALUES($1)',[sid]);
 const insert=(sid:string)=>db.query<{inserted:boolean}>('SELECT br_insert_browser_event($1,$2,$3,$4,$5,$6,$7) AS inserted',['page_view',sid,'IT','en','free',null,JSON.stringify({path:'/plans'})]);
 expect((await insert(first)).rows[0].inserted).toBe(true);
 await db.query('SELECT br_revoke_analytics_session($1)',[first]);
 await db.query('SELECT br_revoke_analytics_session($1)',[second]);
 expect((await insert(second)).rows[0].inserted).toBe(false);
 expect((await db.query('SELECT * FROM events WHERE session_id IN ($1,$2)',[first,second])).rows).toHaveLength(0);
});

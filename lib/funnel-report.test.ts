// @vitest-environment node
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
it('connects tagged signup, activation, product, checkout and server purchase without counting internal users or retry duplicates',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
 CREATE TABLE profiles(id uuid PRIMARY KEY,identifier text UNIQUE,plan text,created_at timestamptz default now(),activated_at timestamptz,marketing_opt_out boolean default false,acquisition jsonb,signup_session_id text);
 CREATE TABLE events(id bigint generated always as identity,event_type text,session_id text,country text,language text,plan text,partner_id text,value numeric,meta jsonb default '{}',created_at timestamptz default now());`);
 await db.exec(readFileSync(new URL('../supabase/migrations/202610160002_product_analytics.sql',import.meta.url),'utf8'));
 const id='aaaaaaaa-2222-4333-8444-555555555555',sid='11111111-2222-4333-8444-555555555555';
 await db.query("INSERT INTO profiles(id,identifier,plan,acquisition,signup_session_id) VALUES($1,'synthetic@example.test','free',$2,$3)",[id,JSON.stringify({agent:'betredge_social',utm_source:'instagram'}),sid]);
 await db.query('INSERT INTO br_analytics_sessions(session_id) VALUES($1)',[sid]);
 await db.query("SELECT br_emit_business_event('signup_created','synthetic@example.test','auth',null,null,null,null)");
 await db.exec("UPDATE profiles SET activated_at=now()");
 await db.query("SELECT br_link_analytics_session($1,'synthetic@example.test','signup')",[sid]);
 for(const event of ['card_open','plan_view','checkout_opened','checkout_attempt','checkout_failed','checkout_attempt','checkout_ready'])
 await db.query('SELECT br_insert_browser_event($1,$2,null,null,null,null,$3)',[event,sid,JSON.stringify({internal:false,test:false})]);
 for(let i=0;i<2;i++)await db.query("SELECT br_emit_business_event('purchase','synthetic@example.test','shopify','fixture-order','pro',29.99,'USD')");
 await db.exec(`INSERT INTO profiles(id,identifier,plan,acquisition) VALUES('bbbbbbbb-2222-4333-8444-555555555555','internal@example.test','free','{"agent":"betredge_social","utm_source":"instagram","traffic_type":"internal"}');`);
 const report=readFileSync(new URL('../docs/analytics/funnel-by-agent.sql',import.meta.url),'utf8');
 const result=await db.query(report,['2020-01-01','2099-01-01']);
 expect(result.rows).toEqual([{agent:'betredge_social',source:'instagram',registered_accounts:1,activated_accounts:1,linked_accounts:1,used_product:1,viewed_plans:1,opened_checkout:1,attempted_checkout:1,provider_ready:1,encountered_failure:1,paying_accounts:1}]);
 await db.query('SELECT br_revoke_analytics_session($1)',[sid]);
 const revoked=await db.query<Record<string,unknown>>(report,['2020-01-01','2099-01-01']);
 expect(revoked.rows[0]).toMatchObject({linked_accounts:0,attempted_checkout:0,paying_accounts:1});
 }finally{await db.close();}
},30000);

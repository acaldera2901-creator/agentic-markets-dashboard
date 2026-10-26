// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@/lib/db', async importOriginal => {
 const original = await importOriginal<typeof import('@/lib/db')>();
 return {...original,dbQueryStrict:h.query,dbExecute:h.query};
});
vi.mock('@/lib/admin-auth',()=>({verifyBearer:()=>true}));
import { interpolate } from '@/lib/db';
import { POST } from './route';
const pg = new PGlite();
beforeAll(async()=>{
 const migration = readFileSync('supabase/migrations/20260524000000_initial_schema.sql','utf8');
 const fn = migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.exec_sql'),migration.indexOf('GRANT EXECUTE ON FUNCTION public.exec_sql'));
 await pg.exec(fn);
 await pg.exec(`CREATE TABLE weekly_pick (week_start date PRIMARY KEY,selections jsonb,combined_prob numeric);
 CREATE TABLE unified_predictions(id text,sport text,home_team text,away_team text,pick text,notes text,starts_at timestamptz,model_version text,source_table text,source_id text,published_at timestamptz,is_historical boolean,is_demo boolean,result text);
 CREATE TABLE pick_ledger(source_table text,source_id text,model_version text,pick text,p_home float,p_draw float,p_away float,captured_at timestamptz,commence_time timestamptz,home_team text,away_team text,is_backfill boolean);
 INSERT INTO unified_predictions SELECT id::text,'football','A',id::text,'HOME',null,'2100-01-05'::timestamptz + id * interval '1 day','football-v4-xg-model','match_predictions',id::text,'2100-01-04',false,false,null FROM generate_series(1,3) id;
 INSERT INTO pick_ledger SELECT source_table,source_id,model_version,pick,.8,.1,.1,'2100-01-04',starts_at,home_team,away_team,false FROM unified_predictions;`);
 h.query.mockImplementation(async(sql:string,params:unknown[]=[])=>{
  const result = await pg.query<{data:unknown}>('SELECT exec_sql($1) AS data',[interpolate(sql,params)]);
  return result.rows[0].data;
 });
 process.env.WEEKLY_PICK_ENABLED='true';
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2100-01-04T10:00:00Z'));
});
afterAll(async()=>{vi.useRealTimers();await pg.close();});
it('persists a sealed case through the real exec_sql wrapper and remains idempotent',async()=>{
 const request=()=>new Request('https://x/api/weekly-pick/generate',{method:'POST'});
 const created=await POST(request());
 expect(created.status).toBe(200);
 expect(await created.json()).toMatchObject({ok:true,mode:'create',legs:3});
 const before=await pg.query('SELECT * FROM weekly_pick');
 expect((await (await POST(request())).json())).toMatchObject({ok:true,mode:'frozen'});
 expect((await pg.query('SELECT * FROM weekly_pick')).rows).toEqual(before.rows);
},15000);
it('appends through the real RPC and a stale CAS cannot overwrite a concurrent case',async()=>{
 const stored = (await pg.query<{selections:unknown[]}>('SELECT selections FROM weekly_pick')).rows[0].selections;
 await pg.query('UPDATE weekly_pick SET selections=$1::jsonb',[JSON.stringify(stored.slice(0,2))]);
 expect(await (await POST(new Request('https://x/api/weekly-pick/generate',{method:'POST'}))).json()).toMatchObject({ok:true,mode:'append',legs:3});
 const update = h.query.mock.calls.find(([sql])=>String(sql).startsWith('UPDATE weekly_pick'))!;
 const committed = (await pg.query('SELECT selections FROM weekly_pick')).rows;
 // Same stale two-leg read, different proposed replacement: CAS must not match.
 const staleParams = [...update[1]]; staleParams[1] = JSON.stringify(stored.slice(0,1));
 await h.query(update[0],staleParams);
 expect((await pg.query('SELECT selections FROM weekly_pick')).rows).toEqual(committed);
});

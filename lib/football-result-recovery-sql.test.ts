// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { it, expect } from 'vitest';
it('corrects obsolete void atomically, grades the sealed pick independently, and guards retries',async()=>{
 const db=new PGlite();
 const queries=[...readFileSync('core/football_result_recovery.py','utf8').matchAll(/text\("""([\s\S]*?)"""\)/g)].map(m=>m[1]);
 const id='00000000-0000-0000-0000-000000000001';
 const params:Record<string,unknown>={id,expected_pick:'home',expected_result:'void',expected_verification:'unverified',result:'won',outcome:'home',final_score:'2-1',reason:'STATUS_FULL_TIME',notes:'{"final_score":"2-1"}'};
 async function run(q:string){const values:unknown[]=[];return db.query(q.replace(/(?<!:):([a-z_]+)/g,(_,k)=>{values.push(params[k]);return `$${values.length}`;}),values);}
 try {
 await db.exec(`CREATE TABLE unified_predictions(id uuid,pick text,sport text,source_table text,source_id text,notes text,result text,status text,is_historical boolean,settled_at timestamptz,updated_at timestamptz,verification_state text,verification_source text,verification_at timestamptz,verification_note text);
 CREATE TABLE pick_ledger(source_table text,source_id text,model_version text,pick text);
 CREATE TABLE pick_settlement(id serial,source_table text,source_id text,model_version text,result text,outcome text,final_score text,is_backfill boolean,settlement_revision int,correction_reason text,UNIQUE(source_table,source_id,model_version,settlement_revision));
 CREATE VIEW pick_settlement_current AS SELECT DISTINCT ON(source_table,source_id,model_version) * FROM pick_settlement ORDER BY source_table,source_id,model_version,settlement_revision DESC;
 INSERT INTO unified_predictions(id,pick,sport,source_table,source_id,notes,result,verification_state) VALUES('${id}','home','football','football_predictions','event','{}','void','unverified');
 INSERT INTO pick_ledger VALUES('football_predictions','event','v1','AWAY');
 INSERT INTO pick_settlement(source_table,source_id,model_version,result,settlement_revision) VALUES('football_predictions','event','v1','void',1);`);
 expect((await run(queries[0])).rows).toHaveLength(1);
 await run(queries[1]);await run(queries[2]);
 expect((await db.query('SELECT result,settlement_revision FROM pick_settlement_current')).rows).toEqual([{result:'lost',settlement_revision:2}]);
 expect((await db.query('SELECT result,verification_state FROM unified_predictions')).rows).toEqual([{result:'won',verification_state:'verified'}]);
 expect((await run(queries[0])).rows).toHaveLength(0);
 await run(queries[1]);expect((await db.query('SELECT * FROM pick_settlement')).rows).toHaveLength(2);
 } finally {await db.close();}
},20000);

// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { it, expect } from 'vitest';

it('recovers unresolved rows and appends the sealed grade without rewriting a confirmed result', async () => {
 const db = new PGlite();
 const source = readFileSync('core/published_result_recovery.py','utf8');
 const queries = [...source.matchAll(/text\("""([\s\S]*?)"""\)/g)].map(m=>m[1]);
 const id='00000000-0000-0000-0000-000000000001';
 const params: Record<string,unknown>={id,expected_pick:'A',source_id:'match',winner:'B',result:'lost',final_score:'6-4 6-3',notes:'{"final_score":"6-4 6-3"}',verification_source:'betconstruct'};
 async function run(q:string) {
   const values: unknown[]=[];
   return db.query(q.replace(/(?<!:):([a-z_]+)/g,(_,key)=>{values.push(params[key]);return `$${values.length}`;}),values);
 }
 try {
 await db.exec(`CREATE TABLE unified_predictions(id uuid PRIMARY KEY,pick text,home_team text,away_team text,notes text,result text,status text,is_historical boolean,settled_at timestamptz,updated_at timestamptz,verification_state text,verification_source text,verification_at timestamptz,verification_note text);
 CREATE TABLE pick_ledger(source_table text,source_id text,model_version text,pick text);
 CREATE TABLE pick_settlement(id serial,source_table text,source_id text,model_version text,result text,outcome text,final_score text,is_backfill boolean,settlement_revision integer,correction_reason text,UNIQUE(source_table,source_id,model_version,settlement_revision));
 CREATE VIEW pick_settlement_current AS SELECT DISTINCT ON (source_table,source_id,model_version) * FROM pick_settlement ORDER BY source_table,source_id,model_version,settlement_revision DESC;
 INSERT INTO unified_predictions(id,pick,home_team,away_team,notes,result) VALUES('${id}','A','A','B','{}','unresolved');
 INSERT INTO pick_ledger VALUES('tennis_predictions','match','v1','B');
 INSERT INTO pick_settlement(source_table,source_id,model_version,result,settlement_revision) VALUES('tennis_predictions','match','v1','unresolved',1);`);
 expect(queries).toHaveLength(3);
 expect((await run(queries[0])).rows).toHaveLength(1);
 await run(queries[1]); await run(queries[2]);
 expect((await db.query('SELECT result,settlement_revision FROM pick_settlement_current')).rows).toEqual([{result:'won',settlement_revision:2}]);
 expect((await db.query('SELECT result,verification_source FROM unified_predictions')).rows).toEqual([{result:'lost',verification_source:'betconstruct'}]);
 expect((await run(queries[0])).rows).toHaveLength(0);
 await run(queries[1]);
 expect((await db.query('SELECT * FROM pick_settlement')).rows).toHaveLength(2);
 } finally {await db.close();}
},20000);

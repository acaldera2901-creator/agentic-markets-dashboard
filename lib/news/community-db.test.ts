// @vitest-environment node
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
it('enforces one like, one comment/minute, and deletes engagement with its news',async()=>{
 const db=new PGlite();try{
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE TABLE news_items(guid_hash text PRIMARY KEY);');
 await db.exec(readFileSync('supabase/migrations/20261105220000_news_community.sql','utf8'));
 await db.query('INSERT INTO news_items VALUES ($1)',['a']);
 await db.query("INSERT INTO news_likes(news_guid,user_id) VALUES ('a','u') ON CONFLICT DO NOTHING");await db.query("INSERT INTO news_likes(news_guid,user_id) VALUES ('a','u') ON CONFLICT DO NOTHING");
 expect((await db.query<{n:number}>('SELECT count(*)::int n FROM news_likes')).rows[0].n).toBe(1);
 await db.query("INSERT INTO news_comments VALUES ('00000000-0000-0000-0000-000000000001','a','u','A','Hello',now(),1)");
 await expect(db.query("INSERT INTO news_comments VALUES ('00000000-0000-0000-0000-000000000002','a','u','A','Spam',now(),1)")).rejects.toThrow();
 await db.query("DELETE FROM news_items WHERE guid_hash='a'");expect((await db.query<{n:number}>('SELECT count(*)::int n FROM news_comments')).rows[0].n).toBe(0);
 }finally{await db.close()}
},20000);

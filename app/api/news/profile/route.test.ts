// @vitest-environment node
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,expect,it,vi} from 'vitest';
import sharp from 'sharp';
const context=vi.hoisted(()=>({db:null as unknown as PGlite,user:{identifier:'ada@example.com',name:'Ada',plan:'premium',plan_expires_at:'2027-01-01T00:00:00Z'} as Record<string,unknown>|null}));
vi.mock('@/lib/auth',()=>({getSessionPlan:async()=>context.user}));
vi.mock('@/lib/db',()=>({dbQueryStrict:async(sql:string,params:unknown[]=[]) =>(await context.db.query(sql,params)).rows,dbExecute:async(sql:string,params:unknown[]=[]) =>(await context.db.query(sql,params)).rows}));
import {GET,PUT} from './route';
import {POST,DELETE} from './avatar/route';
import {GET as community} from '../community/route';
const url='https://example.com/api/news/profile';
const put=(data:unknown,origin='https://example.com')=>PUT(new Request(url,{method:'PUT',headers:{origin,'content-type':'application/json'},body:JSON.stringify(data)}));
beforeAll(async()=>{
 context.db=new PGlite();await context.db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE TABLE profiles(identifier text PRIMARY KEY,created_at timestamptz DEFAULT '2020-01-01');INSERT INTO profiles(identifier) VALUES ('ada@example.com'),('other@example.com');`);
 await context.db.exec(readFileSync('supabase/migrations/20261007123611_newswatch_tables.sql','utf8'));
 await context.db.exec(readFileSync('supabase/migrations/20261105220000_news_community.sql','utf8'));
 await context.db.exec(readFileSync('supabase/migrations/20261105230000_community_profiles.sql','utf8'));
 await context.db.query(`INSERT INTO news_items(guid_hash,source,source_url,published_at,rewritten_en,rewritten_it,rewrite_model) VALUES ($1,'Source','https://example.com',now(),$2,$2,'test')`,['a'.repeat(64),JSON.stringify({title:'Actual news',body:'Actual body'})]);
},20000);
afterAll(async()=>context.db?.close());
it('rejects unsigned and cross-origin mutations',async()=>{
 expect((await put({},'https://evil.test')).status).toBe(403);
 const user=context.user;context.user=null;expect((await GET(new Request(url))).status).toBe(401);expect((await put({})).status).toBe(401);context.user=user;
});
it('persists editable fields, enforces unique handles and keeps auth data private',async()=>{
 expect((await put({displayName:'Ada Public',username:'ADA_1',bio:'Hello',plan:'admin_full'})).status).toBe(200);
 let result=await (await GET(new Request(url))).json();expect(result.profile).toEqual({displayName:'Ada Public',username:'ada_1',bio:'Hello',avatarUrl:null});expect(result.account).toMatchObject({identifier:'ada@example.com',plan:'premium',createdAt:'2020-01-01T00:00:00.000Z'});
 const user=context.user;context.user={...user,identifier:'other@example.com'};expect((await put({displayName:'Other',username:'ADA_1',bio:''})).status).toBe(409);context.user=user;
 expect((await put({displayName:'Ada',username:'support',bio:''})).status).toBe(400);
 await context.db.query(`INSERT INTO news_likes(news_guid,user_id) VALUES ($1,'ada@example.com')`,['a'.repeat(64)]);
 await context.db.query(`INSERT INTO news_comments(id,news_guid,user_id,display_name,body,minute_bucket) SELECT md5(i::text)::uuid,$1,'ada@example.com','Old name','Comment '||i,i FROM generate_series(1,101) i`,['a'.repeat(64)]);
 result=await (await GET(new Request(url))).json();expect(result.activity.comments).toHaveLength(100);expect(result.activity.commentCount).toBe(101);expect(result.activity.likes[0]).toMatchObject({newsGuid:'a'.repeat(64),title:'Actual news'});
 const publicData=await (await community(new Request(`https://example.com/api/news/community?guid=${'a'.repeat(64)}`))).json();expect(publicData.comments[0]).toMatchObject({name:'Ada Public',username:'ada_1',avatarUrl:null});expect(JSON.stringify(publicData)).not.toContain('ada@example.com');
});
it('persists and removes sanitized avatar and rejects cross-origin/delete and spoofed files',async()=>{
 const png=await sharp({create:{width:8,height:8,channels:3,background:'red'}}).png().toBuffer();
 async function upload(bytes:Buffer,type:string){const form=new FormData();form.set('avatar',new Blob([new Uint8Array(bytes)],{type}),'avatar.png');return POST(new Request(`${url}/avatar`,{method:'POST',headers:{origin:'https://example.com'},body:form}))}
 expect((await upload(png,'image/jpeg')).status).toBe(400);
 const response=await upload(png,'image/png');expect(response.status).toBe(200);const {avatarUrl}=await response.json();expect((await (await GET(new Request(url))).json()).profile.avatarUrl).toBe(avatarUrl);
 expect((await DELETE(new Request(`${url}/avatar`,{method:'DELETE',headers:{origin:'https://evil.test'}}))).status).toBe(403);
 expect((await DELETE(new Request(`${url}/avatar`,{method:'DELETE',headers:{origin:'https://example.com'}}))).status).toBe(200);expect((await (await GET(new Request(url))).json()).profile.avatarUrl).toBeNull();
});
it('prevents direct client reads and cascades profile deletion',async()=>{
 await context.db.exec('SET ROLE anon');await expect(context.db.query('SELECT * FROM community_profiles')).rejects.toThrow();await context.db.exec('RESET ROLE');
 await context.db.query(`DELETE FROM profiles WHERE identifier='ada@example.com'`);expect((await context.db.query('SELECT * FROM community_profiles')).rows).toHaveLength(0);
});

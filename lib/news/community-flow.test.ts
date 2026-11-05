// @vitest-environment node
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
const {run,session}=vi.hoisted(()=>({run:vi.fn(),session:vi.fn()}));
vi.mock('@/lib/db',()=>({dbQueryStrict:run,dbExecute:run}));
vi.mock('@/lib/auth',()=>({getSessionPlan:session}));
import {GET,POST} from '@/app/api/news/community/route';
it('persists comments, denies other-account deletion, rate limits and permits owner deletion',async()=>{
 const db=new PGlite();const guid='a'.repeat(64),id='00000000-0000-0000-0000-000000000001';
 const req=(input:unknown)=>new Request('https://www.betredge.com/api/news/community',{method:'POST',headers:{origin:'https://www.betredge.com','content-type':'application/json'},body:JSON.stringify({guid,...input as object})});
 try{
 await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE TABLE news_items(guid_hash text PRIMARY KEY);');await db.exec(readFileSync('supabase/migrations/20261105220000_news_community.sql','utf8'));await db.query('INSERT INTO news_items VALUES ($1)',[guid]);
 run.mockImplementation(async(sql,params)=>(await db.query(sql,params)).rows);session.mockResolvedValue({identifier:'private@example.com',name:null,plan:'free'});
 expect((await POST(req({action:'comment',body:'A thoughtful comment',id}))).status).toBe(200);
 expect((await POST(req({action:'comment',body:'A thoughtful comment',id}))).status).toBe(200);
 expect((await POST(req({action:'comment',body:'Too soon',id:'00000000-0000-0000-0000-000000000002'}))).status).toBe(429);
 const r=await GET(new Request('https://www.betredge.com/api/news/community?guid='+guid));const data=await r.json();expect(data.commentCount).toBe(1);expect(data.comments[0]).toMatchObject({body:'A thoughtful comment',name:'BetRedge member',mine:true});expect(JSON.stringify(data)).not.toContain('private@example.com');
 session.mockResolvedValue({identifier:'other@example.com',name:'Other',plan:'free'});expect((await POST(req({action:'delete',id}))).status).toBe(404);
 session.mockResolvedValue({identifier:'private@example.com',name:null,plan:'free'});expect((await POST(req({action:'delete',id}))).status).toBe(200);expect((await(await GET(new Request('https://www.betredge.com/api/news/community?guid='+guid))).json()).commentCount).toBe(0);
 }finally{await db.close()}
},20000);

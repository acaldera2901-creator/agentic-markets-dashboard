import {NextResponse} from 'next/server';
import {getSessionPlan} from '@/lib/auth';
import {dbExecute,dbQueryStrict} from '@/lib/db';
export const dynamic='force-dynamic';
const validGuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:Request){
 const guid=new URL(req.url).searchParams.get('guid');if(!validGuid(guid))return json({error:'invalid_news'},400);
 try{
  const user=await getSessionPlan(req);
  const [stats]=await dbQueryStrict(`SELECT (SELECT count(*)::int FROM news_likes WHERE news_guid=$1) AS likes, (SELECT count(*)::int FROM news_comments WHERE news_guid=$1) AS comments, EXISTS(SELECT 1 FROM news_likes WHERE news_guid=$1 AND user_id=$2) AS liked`,[guid,user?.identifier??null]);
  const comments=await dbQueryStrict(`SELECT id,body,display_name AS name,created_at, (user_id=$2 OR $3) AS mine FROM news_comments WHERE news_guid=$1 ORDER BY created_at DESC,id DESC LIMIT 50`,[guid,user?.identifier??null,user?.plan==='admin_full']);
  return json({likes:Number(stats?.likes??0),commentCount:Number(stats?.comments??0),liked:!!stats?.liked,authenticated:!!user,comments});
 }catch{return json({error:'unavailable'},503)}
}
export async function POST(req:Request){
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'origin'},403);
 if(!req.headers.get('content-type')?.includes('application/json'))return json({error:'content_type'},415);
 try{
  const user=await getSessionPlan(req);if(!user)return json({error:'login_required'},401);
  const raw=await req.text();if(raw.length>4096)return json({error:'too_large'},413);
  let input;try{input=JSON.parse(raw)}catch{return json({error:'invalid_json'},400)}
  if(!input||!validGuid(input.guid))return json({error:'invalid_news'},400);
  const {guid,action}=input;
  if(!['like','comment','delete'].includes(action))return json({error:'invalid_action'},400);
  if(action==='like'&&typeof input.liked!=='boolean')return json({error:'invalid_like'},400);
  if(action==='comment'&&(typeof input.body!=='string'||!input.body.trim()||input.body.trim().length>1000||!/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(input.id??'')))return json({error:'invalid_comment'},400);
  if(action==='delete'&&!/^[0-9a-f-]{36}$/i.test(input.id??''))return json({error:'invalid_comment'},400);
  if(!(await dbQueryStrict('SELECT guid_hash FROM news_items WHERE guid_hash=$1',[guid])).length)return json({error:'news_not_found'},404);
  if(action==='like'){
   if(input.liked)await dbExecute('INSERT INTO news_likes(news_guid,user_id) VALUES ($1,$2) ON CONFLICT (news_guid,user_id) DO NOTHING',[guid,user.identifier]);
   else await dbExecute('DELETE FROM news_likes WHERE news_guid=$1 AND user_id=$2',[guid,user.identifier]);
  }else if(action==='comment'){
   // At most one comment per account per minute, atomically enforced by the DB.
   // Public names never default to email / private account identifier.
   const name=user.name?.trim();const display=name&&!name.includes('@')?name.slice(0,60):'BetRedge member';
   const rows=await dbExecute(`INSERT INTO news_comments(id,news_guid,user_id,display_name,body,minute_bucket) VALUES ($1::uuid,$2,$3,$4,$5,floor(extract(epoch FROM now())/60)::bigint) ON CONFLICT DO NOTHING RETURNING id`,[input.id,guid,user.identifier,display,input.body.trim()]);
   if(!rows.length){const previous=await dbQueryStrict('SELECT id FROM news_comments WHERE id=$1::uuid AND user_id=$2 AND news_guid=$3',[input.id,user.identifier,guid]);if(!previous.length)return json({error:'slow_down'},429)}
  }else{
   const rows=await dbExecute('DELETE FROM news_comments WHERE id=$1::uuid AND news_guid=$2 AND (user_id=$3 OR $4) RETURNING id',[input.id,guid,user.identifier,user.plan==='admin_full']);
   if(!rows.length)return json({error:'not_found'},404);
  }
  return json({ok:true});
 }catch{return json({error:'unavailable'},503)}
}

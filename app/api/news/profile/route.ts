import {NextResponse} from 'next/server';
import {getSessionPlan} from '@/lib/auth';
import {dbExecute,dbQueryStrict} from '@/lib/db';
import {fallbackDisplayName,ProfileError,readLimitedBody,validateProfile} from '@/lib/news/profile';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:Request){
 try{
  const user=await getSessionPlan(req);if(!user)return json({error:'login_required'},401);
  const [rows,comments,likes,counts]=await Promise.all([
   dbQueryStrict(`SELECT p.created_at,c.display_name,c.username,c.bio,c.avatar_url FROM profiles p LEFT JOIN community_profiles c ON c.user_id=p.identifier WHERE p.identifier=$1`,[user.identifier]),
   dbQueryStrict(`SELECT c.id,c.body,c.news_guid AS "newsGuid",n.rewritten_en->>'title' AS title,c.created_at AS "createdAt" FROM news_comments c JOIN news_items n ON n.guid_hash=c.news_guid WHERE c.user_id=$1 ORDER BY c.created_at DESC,c.id DESC LIMIT 100`,[user.identifier]),
   dbQueryStrict(`SELECT l.news_guid AS "newsGuid",n.rewritten_en->>'title' AS title,l.created_at AS "createdAt" FROM news_likes l JOIN news_items n ON n.guid_hash=l.news_guid WHERE l.user_id=$1 ORDER BY l.created_at DESC,l.news_guid LIMIT 100`,[user.identifier]),
   dbQueryStrict(`SELECT (SELECT count(*)::int FROM news_comments WHERE user_id=$1) AS comments,(SELECT count(*)::int FROM news_likes WHERE user_id=$1) AS likes`,[user.identifier]),
  ]);
  if(!rows.length)return json({error:'login_required'},401);
  const row=rows[0];
  return json({profile:{displayName:row.display_name??fallbackDisplayName(user.name),username:row.username??'',bio:row.bio??'',avatarUrl:row.avatar_url??null},account:{identifier:user.identifier,plan:user.plan,createdAt:row.created_at,planExpiresAt:user.plan_expires_at},activity:{comments,likes,commentCount:Number(counts[0]?.comments??0),likeCount:Number(counts[0]?.likes??0)}});
 }catch{return json({error:'unavailable'},503)}
}
export async function PUT(req:Request){
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'origin'},403);
 if(req.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return json({error:'content_type'},415);
 try{
  const user=await getSessionPlan(req);if(!user)return json({error:'login_required'},401);
  const raw=await readLimitedBody(req,4096);let input;try{input=JSON.parse(raw.toString('utf8'))}catch{throw new ProfileError('invalid_json')}
  const {displayName,username,bio}=validateProfile(input);
  await dbExecute(`INSERT INTO community_profiles(user_id,display_name,username,bio) VALUES ($1,$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET display_name=EXCLUDED.display_name,username=EXCLUDED.username,bio=EXCLUDED.bio,updated_at=now()`,[user.identifier,displayName,username,bio]);
  return json({ok:true});
 }catch(error){
  if(error instanceof ProfileError)return json({error:error.message},error.status);
  // dbExecute wraps the database message; the named unique index survives RPC wrapping.
  if(String(error).includes('community_profiles_username_unique'))return json({error:'username_taken'},409);
  return json({error:'unavailable'},503);
 }
}

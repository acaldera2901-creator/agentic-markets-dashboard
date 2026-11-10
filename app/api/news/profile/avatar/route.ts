import {NextResponse} from 'next/server';
import {getSessionPlan} from '@/lib/auth';
import {dbExecute} from '@/lib/db';
import {encodeAvatar,fallbackDisplayName,MAX_AVATAR_BYTES,ProfileError,readLimitedBody} from '@/lib/news/profile';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(req:Request){
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'origin'},403);
 try{
  const user=await getSessionPlan(req);if(!user)return json({error:'login_required'},401);
  if(!req.headers.get('content-type')?.startsWith('multipart/form-data;'))return json({error:'content_type'},415);
  const body=await readLimitedBody(req,MAX_AVATAR_BYTES+16384);
  let form:FormData;try{form=await new Response(new Uint8Array(body),{headers:{'content-type':req.headers.get('content-type')!}}).formData()}catch{throw new ProfileError('invalid_avatar')}
  const file=form.get('avatar');
  if(!file||typeof file==='string'||form.getAll('avatar').length!==1)throw new ProfileError('invalid_avatar');
  const avatarUrl=await encodeAvatar(Buffer.from(await file.arrayBuffer()),file.type);
  await dbExecute(`INSERT INTO community_profiles(user_id,display_name,avatar_url) VALUES ($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET avatar_url=EXCLUDED.avatar_url,updated_at=now()`,[user.identifier,fallbackDisplayName(user.name),avatarUrl]);
  return json({avatarUrl});
 }catch(error){return error instanceof ProfileError?json({error:error.message},error.status):json({error:'unavailable'},503)}
}
export async function DELETE(req:Request){
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'origin'},403);
 try{
  const user=await getSessionPlan(req);if(!user)return json({error:'login_required'},401);
  await dbExecute('UPDATE community_profiles SET avatar_url=NULL,updated_at=now() WHERE user_id=$1',[user.identifier]);
  return json({avatarUrl:null});
 }catch{return json({error:'unavailable'},503)}
}

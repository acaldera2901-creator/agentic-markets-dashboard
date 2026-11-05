import sharp from 'sharp';

export class ProfileError extends Error {
 constructor(message:string,public status=400){super(message)}
}
const reserved=new Set(['admin','administrator','support','betredge','moderator','official','staff','system','root','help','api','news']);
export function validateProfile(input:unknown){
 if(!input||typeof input!=='object')throw new ProfileError('invalid_profile');
 const data=input as Record<string,unknown>;
 if(typeof data.displayName!=='string'||typeof data.username!=='string'||typeof data.bio!=='string')throw new ProfileError('invalid_profile');
 const displayName=data.displayName.trim(),username=data.username.trim().toLowerCase(),bio=data.bio.trim();
 if(!displayName||displayName.length>40||/[\u0000-\u001f\u007f]/.test(displayName))throw new ProfileError('invalid_display_name');
 if(username&&(!/^[a-z0-9_]{3,20}$/.test(username)||reserved.has(username)))throw new ProfileError('invalid_username');
 if(bio.length>160||bio.includes('\u0000'))throw new ProfileError('invalid_bio');
 return {displayName,username:username||null,bio};
}
export function fallbackDisplayName(name:string|null|undefined){
 const clean=name?.trim();return clean&&!clean.includes('@')?clean.slice(0,40):'BetRedge member';
}
export const MAX_AVATAR_BYTES=2*1024*1024;
export async function encodeAvatar(bytes:Buffer,mime:string):Promise<string>{
 if(!bytes.length||bytes.length>MAX_AVATAR_BYTES)throw new ProfileError('avatar_too_large',413);
 const formats:Record<string,string>={'image/png':'png','image/jpeg':'jpeg','image/webp':'webp'};
 if(!formats[mime])throw new ProfileError('invalid_avatar');
 try{
  if(formats[mime]==='png'){
   for(let offset=8;offset+12<=bytes.length;){
    const length=bytes.readUInt32BE(offset);
    if(bytes.toString('ascii',offset+4,offset+8)==='acTL')throw new Error('animated PNG');
    offset+=12+length;
   }
  }
  const image=sharp(bytes,{limitInputPixels:16_777_216,failOn:'warning'});
  const meta=await image.metadata();
  if(meta.format!==formats[mime]||!meta.width||!meta.height||meta.width>4096||meta.height>4096||(meta.pages??1)>1)throw new Error('invalid raster');
  const output=await image.rotate().resize(256,256,{fit:'cover'}).webp({quality:80}).toBuffer();
  const dataUrl=`data:image/webp;base64,${output.toString('base64')}`;
  if(dataUrl.length>64000)throw new Error('encoded avatar too large');
  return dataUrl;
 }catch{throw new ProfileError('invalid_avatar')}
}
// Bound the stream, not just Content-Length (which can be absent or false).
export async function readLimitedBody(req:Request,limit:number):Promise<Buffer>{
 const reader=req.body?.getReader();if(!reader)return Buffer.alloc(0);
 const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new ProfileError('too_large',413)}chunks.push(value)}}finally{reader.releaseLock()}
 return Buffer.concat(chunks);
}

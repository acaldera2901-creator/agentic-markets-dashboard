// @vitest-environment node
import {expect,it} from 'vitest';
import sharp from 'sharp';
import {validateProfile,encodeAvatar,readLimitedBody} from './profile';
it('normalizes handles and forbids reserved, malformed and overlong profile fields',()=>{
 expect(validateProfile({displayName:' Ada ',username:' ADA_1 ',bio:' Hello '})).toEqual({displayName:'Ada',username:'ada_1',bio:'Hello'});
 expect(validateProfile({displayName:'Ada',username:'',bio:''}).username).toBeNull();
 for(const patch of [{username:'Admin'},{username:'ab'},{username:'a-b'},{displayName:''},{displayName:'a'.repeat(41)},{bio:'a'.repeat(161)}]) expect(()=>validateProfile({displayName:'Ada',username:'ada',bio:'',...patch})).toThrow();
});
it('reencodes actual raster bytes to a metadata-free 256px WebP',async()=>{
 const input=await sharp({create:{width:300,height:400,channels:3,background:'red'}}).jpeg().withMetadata().toBuffer();
 const result=await encodeAvatar(input,'image/jpeg');
 expect(result.startsWith('data:image/webp;base64,')).toBe(true);
 const metadata=await sharp(Buffer.from(result.split(',')[1],'base64')).metadata();
 expect([metadata.width,metadata.height,metadata.format]).toEqual([256,256,'webp']);expect(metadata.exif).toBeUndefined();
});
it('rejects spoofed MIME, SVG, broken, oversized and huge images',async()=>{
 const png=await sharp({create:{width:4,height:4,channels:3,background:'red'}}).png().toBuffer();
 for(const [data,mime] of [[png,'image/svg+xml'],[png,'image/jpeg'],[Buffer.from('<svg/>'),'image/png'],[Buffer.from('broken'),'image/webp'],[Buffer.alloc(2097153),'image/png'],[await sharp({create:{width:5000,height:1,channels:3,background:'red'}}).png().toBuffer(),'image/png']] as const) await expect(encodeAvatar(data,mime)).rejects.toThrow();
});
it('rejects APNG animation rather than silently accepting its first frame',async()=>{
 const png=await sharp({create:{width:4,height:4,channels:3,background:'red'}}).png().toBuffer();
 // acTL is APNG's animation-control chunk; libvips can otherwise read only the first frame.
 const chunk=Buffer.alloc(20);chunk.writeUInt32BE(8);chunk.write('acTL',4);chunk.writeUInt32BE(2,8);
 await expect(encodeAvatar(Buffer.concat([png.subarray(0,33),chunk,png.subarray(33)]),'image/png')).rejects.toThrow();
});
it('rejects animated WebP',async()=>{
 const webp=await sharp(Buffer.concat([Buffer.alloc(4*4*3,0),Buffer.alloc(4*4*3,255)]),{raw:{width:4,height:8,channels:3,pageHeight:4}}).webp().toBuffer();
 expect((await sharp(webp).metadata()).pages).toBe(2);
 await expect(encodeAvatar(webp,'image/webp')).rejects.toThrow();
});

it('bounds streamed request bytes even without Content-Length',async()=>{
 const request=new Request('https://example.com',{method:'PUT',body:'a'.repeat(4097)});
 await expect(readLimitedBody(request,4096)).rejects.toMatchObject({status:413});
 expect((await readLimitedBody(new Request('https://example.com',{method:'PUT',body:'ok'}),4096)).toString()).toBe('ok');
});

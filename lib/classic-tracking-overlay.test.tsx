import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import {render,screen,fireEvent,act} from '@testing-library/react';
import {it,expect,vi} from 'vitest';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import ts from 'typescript';
const sha='3930728ba47ac8dba56eaebe20c72fd5ea7db56e';
let available=true;try{execFileSync('git',['cat-file','-e',sha],{stdio:'pipe'});}catch{available=false;}
it.skipIf(!available)('SHA-bound Classic overlay applies cleanly; banner impressions are 50%-qualified, once per mount, with preview disabled',()=>{
 const dir=mkdtempSync(join(tmpdir(),'br-classic-overlay-'));
 try{
  execFileSync('git',['init','-q'],{cwd:dir});mkdirSync(join(dir,'components/classic'),{recursive:true});
  for(const file of ['ClassicBanners.tsx','ClassicLobby.tsx'])writeFileSync(join(dir,'components/classic',file),execFileSync('git',['show',`${sha}:components/classic/${file}`]));
  const patch=readFileSync(join(process.cwd(),'docs/backoffice/classic-3930728-tracking.patch'),'utf8');
  execFileSync('git',['apply','--check','-'],{cwd:dir,input:patch});execFileSync('git',['apply','-'],{cwd:dir,input:patch});
  const source=readFileSync(join(dir,'components/classic/ClassicBanners.tsx'),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
  expect(compiled.diagnostics).toEqual([]);
  const trackEvent=vi.fn();const overlayModule={exports:{} as {ClassicBanners:React.ComponentType<Record<string,unknown>>}};
  const load=(id:string)=>id==='react'?React:id==='react/jsx-runtime'?jsxRuntime:id==='next/link'?{default:(p:React.AnchorHTMLAttributes<HTMLAnchorElement>)=><a {...p}/>}:{trackEvent};
  new Function('require','module','exports',compiled.outputText)(load,overlayModule,overlayModule.exports);
  let callback:IntersectionObserverCallback=()=>{};
  vi.stubGlobal('IntersectionObserver',class{constructor(fn:IntersectionObserverCallback){callback=fn;}observe(){}unobserve(){}disconnect(){}});
  const Component=overlayModule.exports.ClassicBanners;const custom=vi.fn((event:React.MouseEvent)=>event.preventDefault());
  const banners=[{id:'board',title:'Board',sub:'Today',cta:'Open board',href:'/app',onClick:custom}];
  const {container,unmount}=render(<Component banners={banners} label="Featured"/>);
  expect(trackEvent).not.toHaveBeenCalled();const target=container.querySelector('li')!;
  const entry=(ratio:number):IntersectionObserverEntry=>({target,isIntersecting:true,intersectionRatio:ratio,time:0,boundingClientRect:target.getBoundingClientRect(),intersectionRect:target.getBoundingClientRect(),rootBounds:null});
  act(()=>callback([entry(0.49)],{} as IntersectionObserver));expect(trackEvent).not.toHaveBeenCalled();
  act(()=>callback([entry(0.5)],{} as IntersectionObserver));
  act(()=>callback([entry(0.9)],{} as IntersectionObserver));
  expect(trackEvent).toHaveBeenCalledTimes(1);expect(trackEvent).toHaveBeenCalledWith('house_banner_view',{meta:{campaign_id:'classic:board',slot:'classic-lobby',viewability:'50pct-v1'}});
  fireEvent.click(screen.getByRole('link',{name:/Open board/}));expect(custom).toHaveBeenCalledOnce();expect(trackEvent).toHaveBeenCalledTimes(2);
  unmount();trackEvent.mockClear();render(<Component banners={banners} label="Featured" preview/>);fireEvent.click(screen.getByRole('link',{name:/Open board/}));expect(trackEvent).not.toHaveBeenCalled();
 }finally{vi.unstubAllGlobals();rmSync(dir,{recursive:true,force:true});}
});

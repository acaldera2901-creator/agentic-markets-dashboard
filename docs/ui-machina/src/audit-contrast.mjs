/* Contrasto misurato A FINESTRE: con strati position:fixed (la scena e la
   velatura) una schermata fullPage non li dipinge dove stanno davvero, e la
   misura mente. Qui si scorre di una viewport alla volta e si misura solo
   ciò che è realmente in vista, sul pixel come lo vede l'utente. */
import { chromium } from "/Users/calde/.npm/_npx/6f4879659183bc49/node_modules/playwright/index.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
const SP="/private/tmp/claude-501/-Users-calde/e4f6345d-f210-4918-970a-846aabd17410/scratchpad";
const file=process.argv[2], pages=process.argv.slice(3);
mkdirSync(`${SP}/shots`,{recursive:true});
const KILL="*{-webkit-text-fill-color:transparent!important;text-shadow:none!important;box-shadow:none!important;border-color:transparent!important}*::before,*::after{background:transparent!important;border-color:transparent!important}";
const b=await chromium.launch();
const VP={width:1440,height:900};
const p=await b.newPage({viewport:VP,deviceScaleFactor:1});
const all=[];
for(const pg of pages){
  const url = file.startsWith("static") ? `file://${SP}/${file}#p-${pg}` : `file://${SP}/${file}`;
  await p.goto(url,{waitUntil:"load"});
  if(!file.startsWith("static")) await p.evaluate(k=>document.querySelector(`[data-go="${k}"]`).click(),pg);
  await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(500);
  const H=await p.evaluate(()=>document.documentElement.scrollHeight);
  for(let top=0, w=0; top<H; top+=VP.height, w++){
    await p.evaluate(y=>window.scrollTo(0,y),top); await p.waitForTimeout(120);
    const leaves=await p.evaluate(()=>{
      const out=[];
      for(const n of document.querySelectorAll("body *")){
        if(n.children.length)continue;
        const t=(n.textContent||"").trim(); if(!t)continue;
        const r=n.getBoundingClientRect();
        if(r.width<3||r.height<3) continue;
        if(r.top<0||r.bottom>innerHeight||r.left<0||r.right>innerWidth) continue;  // solo ciò che è tutto in vista
        const c=getComputedStyle(n);
        if(c.visibility==="hidden"||c.display==="none"||c.opacity==="0")continue;
        out.push({cls:(n.className||"").toString().split(" ")[0]||n.tagName.toLowerCase(),
          box:{x:r.x,y:r.y,width:r.width,height:r.height},
          color:c.color,bg:c.backgroundColor,fs:parseFloat(c.fontSize),fw:c.fontWeight});
      }
      return out;
    });
    if(!leaves.length) continue;
    const shot=`shots/${pg}-${w}.png`;
    await p.addStyleTag({content:KILL});
    await p.screenshot({path:`${SP}/${shot}`});          // viewport, non fullPage
    await p.evaluate(()=>{const s=[...document.querySelectorAll("style")].pop(); s.remove();});
    for(const l of leaves) all.push({shot,...l});
  }
}
writeFileSync(`${SP}/leaf2.json`,JSON.stringify(all));
console.log("nodi misurati in vista:",all.length);
await b.close();

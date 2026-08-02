import { chromium } from "/Users/calde/.npm/_npx/6f4879659183bc49/node_modules/playwright/index.mjs";
import { writeFileSync } from "node:fs";
const SP="/private/tmp/claude-501/-Users-calde/e4f6345d-f210-4918-970a-846aabd17410/scratchpad";
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
await p.goto("file://"+SP+"/local-en.html",{waitUntil:"load"});
await p.evaluate(()=>document.fonts.ready);
const all=[];
for(const pg of ["home","previsioni","storico","piani","builder","classifica","invita","weekly","community","worldcup","partner"]){
  await p.evaluate(k=>document.querySelector(`[data-go="${k}"]`).click(),pg);
  await p.waitForTimeout(650);
  // SOLO nodi foglia con testo: niente contenitori, niente bordi o badge nel box
  const leaves = await p.evaluate(()=>{
    const out=[];
    for(const n of document.querySelectorAll("body *")){
      if(n.closest(".nope"))continue;
      if(n.children.length)continue;
      const t=(n.textContent||"").trim(); if(!t)continue;
      const r=n.getBoundingClientRect(); if(r.width<3||r.height<3)continue;
      const c=getComputedStyle(n);
      if(c.visibility==="hidden"||c.display==="none")continue;
      out.push({tag:n.tagName,cls:(n.className||"").toString().split(" ")[0]||n.tagName.toLowerCase(),
        box:{x:r.x+window.scrollX,y:r.y+window.scrollY,width:r.width,height:r.height},
        color:c.color,bg:c.backgroundColor,fs:parseFloat(c.fontSize),fw:c.fontWeight});
    }
    return out;
  });
  for(const l of leaves) all.push({pg,...l});
  // tutti i glifi trasparenti: il layout resta, il testo sparisce del tutto.
  // Nascondere solo le foglie lasciava visibile il testo dei paragrafi attorno
  // e si finiva a misurare testo-su-testo.
  await p.evaluate(()=>{const st=document.createElement("style");st.id="kill";
    st.textContent="*{-webkit-text-fill-color:transparent!important;text-shadow:none!important;"+
      "box-shadow:none!important;border-color:transparent!important}"+
      "*::before,*::after{background:transparent!important;border-color:transparent!important}";
    document.head.appendChild(st);});
  await p.screenshot({path:`${SP}/le-${pg}.png`,fullPage:true});
  await p.evaluate(()=>document.getElementById("kill")?.remove());
}
writeFileSync(`${SP}/leaf.json`,JSON.stringify(all));
console.log("nodi foglia di testo misurati:",all.length);
await b.close();

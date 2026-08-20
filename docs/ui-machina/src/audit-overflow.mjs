import { chromium } from "/Users/calde/.npm/_npx/6f4879659183bc49/node_modules/playwright/index.mjs";
const SP="/private/tmp/claude-501/-Users-calde/e4f6345d-f210-4918-970a-846aabd17410/scratchpad";
const b=await chromium.launch();
for(const vp of [{width:390,height:844},{width:360,height:800},{width:768,height:1024},{width:1440,height:900}]){
  const p=await b.newPage({viewport:vp});
  await p.goto("file://"+SP+"/local-en.html",{waitUntil:"load"});
  await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(500);
  let worst=0, where="";
  for(const n of ["home","previsioni","storico","builder","classifica","invita","piani","weekly","community","worldcup","partner"]){
    if(n!=="home"){ await p.evaluate(k=>document.querySelector(`[data-go="${k}"]`).click(),n); await p.waitForTimeout(450); }
    const o=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    if(o>worst){worst=o;where=n;}
  }
  console.log(`${vp.width}px → overflow massimo ${worst}px ${worst?"("+where+")":""}`);
  await p.close();
}
await b.close();

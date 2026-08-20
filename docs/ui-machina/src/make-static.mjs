/* Genera la versione CONDIVISIBILE: tutte le pagine già rese nel documento,
   navigazione con :target (nessun JavaScript necessario per vedere i contenuti).
   Il JS resta solo per il carosello, ed è un miglioramento, non un requisito. */
import { chromium } from "/Users/calde/.npm/_npx/6f4879659183bc49/node_modules/playwright/index.mjs";
import { readFileSync, writeFileSync } from "node:fs";

const SP = "/private/tmp/claude-501/-Users-calde/e4f6345d-f210-4918-970a-846aabd17410/scratchpad";
const [, , lang] = process.argv;
const SRC = lang === "en" ? "local-en.html" : "local3.html";
const OUT = lang === "en" ? "static-en.html" : "static-it.html";
const TITLE = lang === "en"
  ? "BetRedge — Predictive Sports Intelligence"
  : "BetRedge — frontend nuovo, pagina per pagina";
const PAGES = ["home","previsioni","storico","builder","classifica","invita","piani","weekly","community","worldcup"]
  .concat(lang === "en" ? ["partner"] : []);
const SCENE = { previsioni:"im-stadium", weekly:"im-court", worldcup:"im-crowd",
                builder:"im-clay", storico:"im-stadium", partner:"im-crowd" };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto("file://" + SP + "/" + SRC, { waitUntil: "load" });
await p.evaluate(() => document.fonts.ready);

const parts = {};
for (const name of PAGES) {
  await p.evaluate((k) => document.querySelector(`[data-go="${k}"]`).click(), name);
  await p.waitForTimeout(320);
  parts[name] = await p.evaluate(() => document.getElementById("app").innerHTML);
}
const chrome = await p.evaluate(() => ({
  head: document.querySelector("header.top-bar").outerHTML,
  foot: document.querySelector("footer.site-foot")?.outerHTML
     || document.querySelector("footer.legal").outerHTML,
  bot: document.getElementById("botnav").outerHTML,
  css: document.querySelector("style").textContent,
}));
await b.close();

// I controlli che navigano diventano ancore vere: funzionano senza JS,
// si aprono in una scheda nuova, si copiano come link.
// Converte in ancora SOLO i controlli che navigano. Il primo tentativo
// sostituiva ogni </button>, compresi quelli dei bottoni senza data-go
// (la "+" del Builder, la "×", i "Visit"): tag non chiusi e layout distrutto.
const toAnchor = (html) => html
  .replace(/<button([^>]*)>([\s\S]*?)<\/button>/g, (m, attrs, inner) => {
    const g = attrs.match(/\sdata-go="(\w+)"/);
    if (!g) return m;                                   // non naviga: resta bottone
    return `<a${attrs.replace(/\sdata-go="\w+"/, "")} href="#p-${g[1]}">${inner}</a>`;
  })
  .replace(/<a([^>]*?)\sdata-go="(\w+)"([^>]*?)\shref="#"/g, '<a$1 href="#p-$2"$3')
  .replace(/<a([^>]*?)\shref="#"([^>]*?)\sdata-go="(\w+)"/g, '<a$1 href="#p-$3"$2')
  .replace(/\sdata-go="\w+"/g, "");

const nav = PAGES.map((n) => `#p-${n}`);
// Solo i MENU: senza il prefisso, la regola colpiva ogni link con quell'href
// — compreso il bottone verde del banner, che diventava bianco su verde.
const NAVS = [".tnav", ".botnav", ".rail", ".foot-col"];
const activeRules = PAGES.map((n) =>
  NAVS.map((c) => `body:has(#p-${n}:target) ${c} [href="#p-${n}"]`).join(",")
  + `{color:#fff;border-bottom-color:var(--verde-b)}`).join("\n");

const css = chrome.css + `
/* ── navigazione senza JavaScript: :target ── */
.page{display:none}
.page:target{display:block}
body:not(:has(.page:target)) #p-home{display:block}
${activeRules}
.page>.bgfix{position:fixed}
@media print{.page{display:block!important}}
`;

const body = [
  toAnchor(chrome.head),
  ...PAGES.map((n) => `<section class="page" id="p-${n}">
  <div class="bgfix ${SCENE[n] || "im-stadium"}" aria-hidden="true"></div>
  <main>${toAnchor(parts[n])}</main>
</section>`),
  toAnchor(chrome.bot),
  toAnchor(chrome.foot),
].join("\n");

// unico script rimasto: il carosello. Se non gira, si vede la prima slide.
const js = `
(function(){
  var caro=document.getElementById("caro"); if(!caro) return;
  var run=document.getElementById("caro-run"), dots=document.getElementById("caro-d");
  var n=3, i=0, timer=null;
  var per=function(){ return window.innerWidth<=860?1:2; };
  dots.innerHTML='<button aria-label="Slide 1"></button><button aria-label="Slide 2"></button><button aria-label="Slide 3"></button>';
  function draw(){ run.style.transform="translateX(-"+(i*100/per())+"%)";
    for(var k=0;k<dots.children.length;k++) dots.children[k].className=(k===((i%n)+n)%n)?"on":""; }
  function step(d){ i=(i+d+n)%n; draw(); }
  document.getElementById("caro-p").onclick=function(){step(-1)};
  document.getElementById("caro-n").onclick=function(){step(1)};
  for(var k=0;k<dots.children.length;k++)(function(x){dots.children[x].onclick=function(){i=x;draw()}})(k);
  var slow=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function start(){ if(!slow&&!timer) timer=setInterval(function(){step(1)},4200); }
  function stop(){ clearInterval(timer); timer=null; }
  caro.addEventListener("mouseenter",stop); caro.addEventListener("mouseleave",start);
  caro.addEventListener("focusin",stop);
  window.addEventListener("resize",draw);
  draw(); start();
})();`;

writeFileSync(`${SP}/${OUT}`,
`<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${TITLE}</title>
<style>${css}</style>
</head>
<body>
${body}
<script>${js}</script>
</body>
</html>
`);
console.log(OUT, Math.round(readFileSync(`${SP}/${OUT}`).length / 1024), "KB ·", PAGES.length, "pagine ·", nav.join(" "));

// audit-wcag.mjs — contrasto come lo definisce WCAG, non come lo vedono i pixel.
//
// PERCHÉ ESISTE, accanto ad audit-live.mjs. Quello campiona i pixel dello
// screenshot: per un testo da 10px la maggior parte dei pixel del glifo è
// antialiasata, cioè copertura PARZIALE, quindi il rapporto misurato scende
// sotto quello reale. Misurato il 22/08 su .wp-slip-badge.live: i pixel dicevano
// 4.08:1, i colori dichiarati 4.89:1, e lo screenshot mostrava un badge
// perfettamente leggibile. Stessa storia su tre superfici diverse (schede del
// blog e gambe del weekly-pick su bianco): l'armatura a pixel sovra-riporta sui
// testi piccoli e sulle schede con l'angolo smussato.
//
// WCAG 1.4.3 definisce il rapporto fra il COLORE DEL TESTO e il COLORE DI SFONDO,
// non fra i pixel renderizzati. Questo script fa quello: compone i livelli di
// fondo semitrasparenti fino al primo opaco e confronta.
//
// COSA NON PUÒ FARE: se dietro il testo c'è una FOTO non esiste un "colore di
// sfondo" — quel caso resta di competenza di audit-live.mjs, che i pixel li vede.
// Le due armature sono complementari: questa è la conformità, quella è l'indizio.
//
// I colori li parsa il BROWSER, via canvas 1×1: color(srgb 0.95 …) ha componenti
// 0–1, oklch e lab altre unità ancora. Un parser scritto a mano le sbaglia — il
// mio le leggeva come 0–255 e inventava quattro difetti inesistenti.
//
// Esclusioni, tutte per conformità e non per indulgenza:
//   · controlli disabled → WCAG 1.4.3 li esenta («inactive user interface component»)
//   · colore trasparente → non descrive alcun pixel (di solito background-clip:text)
//   · aria-hidden → non è contenuto
//
// Uso: node audit-wcag.mjs --theme=dark|light <url> [url…]
//      esce 1 se trova almeno un nodo sotto soglia.

// Stesso percorso assoluto usato da tutti gli altri script di questa cartella:
// playwright non è una dipendenza del repo, vive nella cache di npx.
import { chromium } from "/Users/calde/.npm/_npx/6f4879659183bc49/node_modules/playwright/index.mjs";

const args = process.argv.slice(2);
const TEMA = (args.find((a) => a.startsWith("--theme=")) || "--theme=dark").split("=")[1];
const URLS = args.filter((a) => !a.startsWith("--"));
if (!URLS.length) {
  console.error("uso: node audit-wcag.mjs --theme=dark|light <url> [url…]");
  process.exit(2);
}
if (TEMA !== "dark" && TEMA !== "light") {
  console.error(`tema non valido: "${TEMA}" — dark o light`);
  process.exit(2);
}

const MISURA = () => {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  const memo = new Map();
  const parse = (s) => {
    if (!s) return null;
    if (memo.has(s)) return memo.get(s);
    cx.fillStyle = "#000";
    cx.fillStyle = s; // se s è invalido, fillStyle resta #000
    cx.clearRect(0, 0, 1, 1);
    cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    const v = [d[0], d[1], d[2], d[3] / 255];
    memo.set(s, v);
    return v;
  };
  const lin = (c) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const L = (a) => 0.2126 * lin(a[0]) + 0.7152 * lin(a[1]) + 0.0722 * lin(a[2]);
  const rapporto = (a, b) => {
    const p = [L(a), L(b)].sort((x, y) => y - x);
    return (p[0] + 0.05) / (p[1] + 0.05);
  };
  const sopra = (f, b) => (f[3] >= 1 ? f.slice(0, 3) : [0, 1, 2].map((i) => f[i] * f[3] + b[i] * (1 - f[3])));

  // Compone i fondi dal primo opaco verso l'alto: uno scrim rgba(...,.72)
  // ignorato porta a misurare il testo contro il fondo sbagliato.
  const fondo = (e) => {
    const livelli = [];
    let foto = false;
    let n = e;
    while (n && n !== document.documentElement) {
      const s = getComputedStyle(n);
      if (/url\(|gradient/.test(s.backgroundImage)) foto = true;
      const c = parse(s.backgroundColor);
      if (c && c[3] > 0) {
        livelli.push(c);
        if (c[3] >= 1) break;
      }
      n = n.parentElement;
    }
    let base = parse(getComputedStyle(document.documentElement).backgroundColor);
    if (!base || base[3] < 1) base = parse(getComputedStyle(document.body).backgroundColor) || [255, 255, 255, 1];
    let acc = base.slice(0, 3);
    for (let i = livelli.length - 1; i >= 0; i--) acc = sopra(livelli[i], acc);
    return { bg: acc, foto };
  };

  const sel = (e) =>
    e.tagName.toLowerCase() +
    (typeof e.className === "string" && e.className.trim()
      ? "." + e.className.trim().split(/\s+/).slice(0, 3).join(".")
      : "");

  const falliti = [];
  let misurati = 0;
  let esentati = 0;
  let sopraFoto = 0;
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const txt = (n.textContent || "").trim();
    if (!txt) continue;
    const e = n.parentElement;
    if (!e) continue;
    if (e.closest("[aria-hidden='true']")) continue;
    const cs = getComputedStyle(e);
    if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
    if (e.closest("[disabled], [aria-disabled='true']")) {
      esentati++;
      continue;
    }
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const fg = parse(cs.color);
    if (!fg) continue;
    if (fg[3] === 0) {
      esentati++;
      continue;
    }
    const { bg, foto } = fondo(e);
    if (foto) sopraFoto++;
    misurati++;
    const px = parseFloat(cs.fontSize);
    const peso = +cs.fontWeight || 400;
    const soglia = px >= 24 || (px >= 18.66 && peso >= 700) ? 3 : 4.5;
    const rr = rapporto(sopra(fg, bg), bg);
    if (rr < soglia) {
      falliti.push({
        sel: sel(e),
        txt: txt.slice(0, 30),
        r: +rr.toFixed(2),
        soglia,
        px: +px.toFixed(1),
        foto,
        colore: cs.color,
        fondo: `rgb(${bg.map(Math.round).join(",")})`,
      });
    }
  }
  return { misurati, esentati, sopraFoto, falliti };
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addInitScript(
  (t) => {
    try {
      localStorage.setItem("agentic-theme", t);
      localStorage.setItem("br_cookie_consent", "accepted");
    } catch {}
  },
  TEMA,
);

let totMisurati = 0;
let totFalliti = 0;
let totEsentati = 0;
let totFoto = 0;

for (const url of URLS) {
  const page = await ctx.newPage();
  let esito;
  try {
    await page.goto(url, { waitUntil: "load", timeout: 45000 });
    await page.waitForTimeout(3000);
    const temaVisto = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    if (temaVisto !== TEMA) {
      // Un tema che non è quello richiesto rende la misura priva di senso:
      // meglio dirlo che pubblicare un numero su uno stato ibrido.
      console.log(`⚠ ${url}: tema servito «${temaVisto}» invece di «${TEMA}» — misura saltata`);
      await page.close();
      continue;
    }
    esito = await page.evaluate(MISURA);
  } catch (err) {
    console.log(`✗ ${url}: ${err.message.split("\n")[0]}`);
    await page.close();
    continue;
  }
  totMisurati += esito.misurati;
  totFalliti += esito.falliti.length;
  totEsentati += esito.esentati;
  totFoto += esito.sopraFoto;

  const rotta = new URL(url).pathname || "/";
  console.log(`— ${rotta}: ${esito.falliti.length}/${esito.misurati} sotto soglia · ${esito.esentati} esentati · ${esito.sopraFoto} sopra un'immagine`);
  const gruppi = new Map();
  for (const f of esito.falliti) {
    const k = `${f.sel}|${f.r}`;
    if (!gruppi.has(k)) gruppi.set(k, { ...f, n: 0 });
    gruppi.get(k).n++;
  }
  for (const g of [...gruppi.values()].sort((a, b) => a.r - b.r)) {
    console.log(
      `    ${g.n}× ${g.r}:1 (soglia ${g.soglia}) «${g.txt}» ${g.sel} ${g.px}px${g.foto ? " [sopra immagine: verifica con audit-live]" : ""} · ${g.colore} su ${g.fondo}`,
    );
  }
  await page.close();
}

console.log(
  `\nESITO WCAG (${TEMA}) · nodi misurati ${totMisurati} · sotto soglia ${totFalliti} · esentati ${totEsentati} (disabled o colore trasparente) · ${totFoto} sopra un'immagine`,
);
await browser.close();
process.exit(totFalliti ? 1 : 0);

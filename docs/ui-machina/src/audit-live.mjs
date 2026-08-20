/* Armatura per il PRODOTTO, non per la preview. #UI-MACHINA-0802
 *
 * Le due armature originali (audit-contrast.mjs, audit-overflow.mjs) misurano i
 * file della preview via file:// e navigano cliccando [data-go]. Il prodotto è
 * un'app su http://, con rotte vere: serviva la stessa misura su un URL.
 *
 * Misura due cose, entrambe sul pixel come lo vede l'utente:
 *
 *  CONTRASTO — a finestre. Con strati position:fixed (la scena e la velatura)
 *  una schermata fullPage non li dipinge dove stanno davvero e la misura mente:
 *  si scorre di una viewport alla volta e si misura solo ciò che è in vista.
 *  Per ogni nodo di testo si cerca il pixel PEGGIORE del fondo reale sotto di
 *  esso, con tutti i glifi resi trasparenti e le auto-decorazioni neutralizzate
 *  (un elemento misurava il proprio filetto: 193 falsi allarmi la prima volta).
 *
 *  OVERFLOW — nessuna pagina deve scorrere in orizzontale a 360/390/768/1440.
 *
 * LIMITE NOTO, da non confondere con un difetto del prodotto: se dentro il
 * rettangolo del testo passa un filetto disegnato con `background` su un
 * elemento (non su un pseudo), lo spegnitore non lo tocca e il "pixel peggiore"
 * finisce su quello. Il tell è che schiarendo il testo il rapporto PEGGIORA
 * invece di migliorare: quando succede, il nodo è un falso allarme e il colore
 * del prodotto non si tocca. Misurato su .v-scan-row .md e .go della landing.
 *
 * Uso:  node docs/ui-machina/src/audit-live.mjs http://localhost:3000/app [altri URL…]
 */
import { chromium } from "/Users/calde/.npm/_npx/6f4879659183bc49/node_modules/playwright/index.mjs";

// --theme=dark|light forza il tema PRIMA del caricamento, così un confronto
// prima/dopo non finisce per misurare due temi diversi (errore già fatto: la
// base risultava in chiaro e il "dopo" in scuro, e i difetti del tema scuro
// sembravano colpa del restyling).
const THEME = (process.argv.find(a => a.startsWith("--theme=")) || "").split("=")[1] || "";
const URLS = process.argv.slice(2).filter(a => !a.startsWith("--"));
if (!URLS.length) { console.error("uso: node audit-live.mjs <url> [url…]"); process.exit(2); }

// rende trasparenti TUTTI i glifi (non solo le foglie: nascondere solo quelle
// lascia visibile il testo dei paragrafi attorno e si misura testo su testo) e
// spegne le decorazioni che un elemento fa a sé stesso.
const KILL = `*{-webkit-text-fill-color:transparent!important;text-shadow:none!important;
box-shadow:none!important;border-color:transparent!important}
*::before,*::after{background:transparent!important;border-color:transparent!important}`;

const WIDTHS = [360, 390, 768, 1440];
const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
if (THEME) await context.addInitScript(t => { try { localStorage.setItem("agentic-theme", t); } catch {} }, THEME);
let failContrast = 0, failOverflow = 0, measured = 0;

for (const url of URLS) {
  // ── overflow: quattro larghezze ──
  for (const width of WIDTHS) {
    const page = await context.newPage(); await page.setViewportSize({ width, height: 900 });
    await page.goto(url, { waitUntil: "networkidle" }).catch(() => page.goto(url, { waitUntil: "load" }));
    await page.waitForTimeout(600);
    const over = await page.evaluate(() => {
      const d = document.documentElement;
      const slack = d.scrollWidth - d.clientWidth;
      if (slack <= 1) return { slack: 0, culprits: [] };
      const culprits = [];
      for (const el of document.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (r.right > d.clientWidth + 1 && r.width > 0) {
          culprits.push(`${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]} → ${Math.round(r.right)}px`);
        }
        if (culprits.length > 6) break;
      }
      return { slack, culprits };
    });
    if (over.slack > 1) {
      failOverflow++;
      console.log(`✗ OVERFLOW  ${url} @${width}px — sfora di ${over.slack}px`);
      over.culprits.forEach(c => console.log(`             ${c}`));
    } else {
      console.log(`✓ overflow  ${url} @${width}px — 0`);
    }
    await page.close();
  }

  // ── contrasto: a finestre, sul rendering vero ──
  const page = await context.newPage(); await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url, { waitUntil: "networkidle" }).catch(() => page.goto(url, { waitUntil: "load" }));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);

  // I rettangoli si prendono dal RANGE del nodo di testo, non dal riquadro
  // dell'elemento: il riquadro include padding, bordi e le decorazioni che
  // l'elemento fa a sé stesso, e il "pixel peggiore" finiva su un pixel dove
  // nessun glifo sta davvero. Validato: con i riquadri degli elementi
  // l'armatura dava 5 falsi allarmi sulla preview APPROVATA; coi rettangoli
  // del testo ne dà 0.
  const nodes = await page.evaluate(() => {
    const out = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walk.nextNode())) {
      const txt = n.nodeValue.trim();
      if (!txt) continue;
      const el = n.parentElement;
      if (!el || el.closest("[aria-hidden='true']")) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        if (r.width < 2 || r.height < 4) continue;
        out.push({
          txt: txt.slice(0, 40),
          sel: el.tagName.toLowerCase() + (el.className ? "." + el.className.toString().trim().split(/\s+/).join(".") : ""),
          color: cs.color, size: parseFloat(cs.fontSize), weight: cs.fontWeight,
          x: r.x + window.scrollX, y: r.y + window.scrollY, w: r.width, h: r.height,
        });
      }
    }
    return out;
  });

  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.addStyleTag({ content: KILL });
  await page.waitForTimeout(200);

  const worst = [];
  for (let want = 0; want < H; want += 860) {
    // l'offset si RILEGGE dal browser: scrollTo puo' non atterrare dove chiedi
    // (clamp a fondo pagina, contenitori con scroll proprio, scroll-behavior).
    // Fidandosi del valore chiesto, i nodi in fondo si misurano sui pixel
    // sbagliati e l'esito e' 1.00:1 su testo che in realta' e' leggibile.
    const top = await page.evaluate(y => { window.scrollTo(0, y); return Math.round(window.scrollY); }, want);
    await page.waitForTimeout(180);
    const shot = await page.screenshot({ type: "png" });
    const { createCanvas, loadImage } = await import("node:module").then(() => ({ createCanvas: null, loadImage: null })).catch(() => ({}));
    // niente canvas nativo: si misura via la pagina stessa, che sa leggere i pixel
    const png = shot.toString("base64");
    // solo cio che e' INTERAMENTE in vista: un rettangolo tagliato dal bordo
    // della finestra fa campionare pixel che non stanno sotto nessun glifo.
    const inWindow = nodes.filter(n => n.y >= top && n.y + n.h <= top + 900 && n.x >= 0 && n.x + n.w <= 1440)
                          .filter(n => !n.done);
    inWindow.forEach(n => { n.done = true; });
    if (!inWindow.length) continue;
    measured += inWindow.length;
    const res = await page.evaluate(async ({ png, list, top }) => {
      const img = new Image();
      await new Promise(r => { img.onload = r; img.src = "data:image/png;base64," + png; });
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const out = [];
      for (const n of list) {
        // rientro di 1px: il bordo del rettangolo del testo tocca ancora i
        // pixel del contorno, che non sono fondo
        const x0 = Math.max(0, Math.round(n.x) + 1), y0 = Math.max(0, Math.round(n.y - top) + 1);
        const w = Math.min(Math.round(n.w) - 2, c.width - x0), h = Math.min(Math.round(n.h) - 2, c.height - y0);
        if (w <= 0 || h <= 0) continue;
        const d = ctx.getImageData(x0, y0, w, h).data;
        // il pixel PEGGIORE: quello piu vicino in luminanza al colore del testo
        let worstPx = null, worstDelta = Infinity;
        const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        const L = p => 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2]);
        const m = n.color.match(/\d+/g).map(Number);
        const Lt = L(m);
        for (let i = 0; i < d.length; i += 4 * 3) {   // 1 pixel su 3: basta e costa un terzo
          const px = [d[i], d[i + 1], d[i + 2]];
          const delta = Math.abs(L(px) - Lt);
          if (delta < worstDelta) { worstDelta = delta; worstPx = px; }
        }
        out.push({ ...n, bg: worstPx });
      }
      return out;
    }, { png, list: inWindow, top });
    worst.push(...res);
  }

  for (const n of worst) {
    const fg = n.color.match(/\d+/g).map(Number).slice(0, 3);
    const r = ratio(fg, n.bg);
    const big = n.size >= 24 || (n.size >= 18.66 && +n.weight >= 700);
    const floor = big ? 3 : 4.5;
    if (r < floor) {
      failContrast++;
      console.log(`✗ CONTRASTO ${r.toFixed(2)}:1 (soglia ${floor}) — "${n.txt}" · ${n.sel} · ${n.size}px`);
    }
  }
  console.log(`— ${url}: ${worst.length} nodi di testo misurati`);
  await page.close();
}

await browser.close();
console.log(`\nESITO · nodi misurati ${measured} · contrasto sotto soglia ${failContrast} · overflow ${failOverflow}`);
process.exit(failContrast || failOverflow ? 1 : 0);

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
 * TRAPPOLA CHIUSA (2026-08-20): una regione richiesta FUORI dall'immagine
 * catturata torna nera (getImageData riempie di zeri). In tema SCURO l'errore
 * era invisibile, perche' il nero coincideva col fondo vero; in tema CHIARO
 * faceva fallire 1322 nodi su 1613. Ora ogni nodo fuori dai limiti viene
 * SALTATO e contato: la copertura si dichiara, non si finge.
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
let failContrast = 0, failOverflow = 0, measured = 0, notMeasured = 0;

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

  // ── CONTRASTO, una finestra alla volta ─────────────────────────────────────
  // La raccolta avviene DENTRO il ciclo, non una volta sola all'inizio: un nodo
  // si giudica solo dove e' davvero visibile. Tre filtri, ognuno con un motivo
  // pagato:
  //  · rettangoli del RANGE del testo, non il riquadro dell'elemento (che
  //    include padding, bordi e le decorazioni che l'elemento fa a se stesso);
  //  · interamente dentro la viewport (fuori, getImageData restituisce NERO e in
  //    tema scuro l'errore si nasconde perche' coincide col fondo);
  //  · non COPERTO da uno strato fisso (banner cookie, dock, widget chat): il
  //    testo sotto un overlay non ha quell'overlay come fondo, e' nascosto.
  await page.addStyleTag({ content: KILL });
  await page.waitForTimeout(200);
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  const worst = [];
  const seen = new Set();

  for (let want = 0; want < H; want += 860) {
    const top = await page.evaluate(y => { window.scrollTo(0, y); return Math.round(window.scrollY); }, want);
    await page.waitForTimeout(180);

    const inWindow = await page.evaluate(() => {
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
        // #PRO-AA-0822 — tre esclusioni, tutte per correttezza, non per indulgenza:
        // 1) i controlli DISABILITATI sono esplicitamente esentati dal minimo di
        //    contrasto (WCAG 1.4.3 «Incidental: inactive user interface component»).
        //    Il submit della modale di login su /plans è disabled a opacity .4 e
        //    veniva contato come falla a 1.71:1.
        // 2) testo con colore TRASPARENTE: il colore calcolato non descrive nessun
        //    pixel (di solito è background-clip:text con un gradiente). Misurarlo
        //    dà 1.02:1 su un titolo che si legge benissimo.
        // 3) discendenti di un elemento disabilitato (il testo sta in uno span).
        if (el.closest("[disabled], [aria-disabled='true']")) continue;
        if (/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)|^transparent$/.test(cs.color)) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const r of range.getClientRects()) {
          if (r.width < 2 || r.height < 4) continue;
          if (r.top < 1 || r.left < 1 || r.bottom > innerHeight - 1 || r.right > innerWidth - 1) continue;
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          if (!hit || !(hit === el || el.contains(hit) || hit.contains(el))) continue;
          out.push({
            key: `${txt.slice(0, 24)}@${Math.round(r.x)},${Math.round(r.y + window.scrollY)}`,
            txt: txt.slice(0, 40),
            sel: el.tagName.toLowerCase() + (el.className ? "." + el.className.toString().trim().split(/\s+/).join(".") : ""),
            color: cs.color, size: parseFloat(cs.fontSize), weight: cs.fontWeight,
            x: r.x, y: r.y, w: r.width, h: r.height,
          });
        }
      }
      return out;
    });

    const fresh = inWindow.filter(n => !seen.has(n.key));
    fresh.forEach(n => seen.add(n.key));
    if (!fresh.length) continue;
    measured += fresh.length;

    const png = (await page.screenshot({ type: "png" })).toString("base64");
    const res = await page.evaluate(async ({ png, list }) => {
      const img = new Image();
      await new Promise(r => { img.onload = r; img.src = "data:image/png;base64," + png; });
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const out = [], skipped = [];
      const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      const L = p => 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2]);
      for (const n of list) {
        const x0 = Math.round(n.x) + 1, y0 = Math.round(n.y) + 1;
        const w = Math.round(n.w) - 2, h = Math.round(n.h) - 2;
        if (w <= 0 || h <= 0 || x0 < 0 || y0 < 0 || x0 + w > c.width || y0 + h > c.height) { skipped.push(n.txt); continue; }
        const d = ctx.getImageData(x0, y0, w, h).data;
        const Lt = L(n.color.match(/\d+/g).map(Number));
        // il pixel PEGGIORE: quello piu' vicino in luminanza al colore del testo
        // Oltre al pixel peggiore si conta QUANTI pixel stanno entro il 20% di
        // quella distanza. Serve a distinguere un fondo davvero critico da una
        // scheggia: sotto un nome di squadra 29 pixel chiari su 2.491 erano
        // un'annotazione della demo, non la foto — e il "pixel peggiore" da solo
        // fa sembrare illeggibile un testo che si legge benissimo.
        let worstPx = null, worstDelta = Infinity, tot = 0;
        for (let i = 0; i < d.length; i += 4 * 3) {
          const px = [d[i], d[i + 1], d[i + 2]];
          const delta = Math.abs(L(px) - Lt);
          if (delta < worstDelta) { worstDelta = delta; worstPx = px; }
          tot++;
        }
        let vicini = 0;
        for (let i = 0; i < d.length; i += 4 * 3) {
          const px = [d[i], d[i + 1], d[i + 2]];
          if (Math.abs(L(px) - Lt) <= worstDelta * 1.2) vicini++;
        }
        out.push({ ...n, bg: worstPx, quota: tot ? vicini / tot : 0 });
      }
      return { out, skipped };
    }, { png, list: fresh });
    worst.push(...res.out);
    notMeasured += res.skipped.length;
  }

  for (const n of worst) {
    const fg = n.color.match(/\d+/g).map(Number).slice(0, 3);
    const r = ratio(fg, n.bg);
    const big = n.size >= 24 || (n.size >= 18.66 && +n.weight >= 700);
    const floor = big ? 3 : 4.5;
    if (r < floor) {
      failContrast++;
      const q = n.quota != null ? ` · ${(n.quota * 100).toFixed(1)}% dei pixel` : "";
      console.log(`✗ CONTRASTO ${r.toFixed(2)}:1 (soglia ${floor}) — "${n.txt}" · ${n.sel} · ${n.size}px${q}`);
    }
  }
  console.log(`— ${url}: ${worst.length} nodi di testo misurati`);
  await page.close();
}

await browser.close();
console.log(`\nESITO · nodi misurati ${measured - notMeasured} · non misurabili (fuori vista) ${notMeasured} · contrasto sotto soglia ${failContrast} · overflow ${failOverflow}`);
process.exit(failContrast || failOverflow ? 1 : 0);

// e2e/v3c-banner-crop.spec.ts (#REDESIGN-V3C banners-fix) — nessun soggetto umano tagliato.
// Per ogni banner fotografico della fascia (home, /predictions, /pricing, /partners), a 6 larghezze
// fra 360 e 1920, chiaro e scuro: ricostruisce la geometria di `object-fit`/`object-position`
// dell'<img>, proietta i riquadri del soggetto (testa, palla, racchetta, mani, tifosi in primo piano,
// misurati a mano sulle sorgenti) e verifica che stiano dentro la parte visibile della fascia — il
// riquadro, il contenitore e il taglio diagonale a destra (34 px desktop / 22 px mobile, v3c.css) —
// con 2 px di tolleranza. Da 600 px in su, dove il banner sta a destra del testo, testa e palla non
// devono nemmeno passare sotto il testo della fascia (tab, titolo, riga meta) — in inglese e nelle due
// lingue coi titoli più lunghi (pt, fr: misurato sulle 6 lingue principali). Sotto i 600 px (final4)
// la foto non c'è: il test verifica che sia nascosta e non scaricata.
// Flag ON contro il mock locale (come gli altri e2e v3c):
//   MOCK_DB_PORT=<p> npx tsx scripts/v3c/mock-db.ts
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:<p> SUPABASE_SERVICE_ROLE_KEY=mock NEXT_PUBLIC_REDESIGN=1 \
//   NODE_OPTIONS="--require ./scripts/v3c/no-network.cjs" npx next dev -p <port>
//   PW_BANNERS=1 PW_PORT=<port> npx playwright test e2e/v3c-banner-crop.spec.ts --project=desktop-1440
import { expect, test } from "@playwright/test";

test.skip(process.env.PW_BANNERS !== "1", "needs the flag-ON dev server on the local mock");

/** Riquadri chiave nelle coordinate della sorgente, larga `ref` px (il rapporto viene dall'immagine). */
const SUBJECTS: Record<string, { ref: number; boxes: Record<string, [number, number, number, number]>; keys: string[] }> = {
  // ritaglio di social-football-1080x1350 (scripts/v3c/banner-fit-crops.mjs: 40,290 1040×700)
  "hero-football-fit": { ref: 1040, boxes: { head: [360, 32, 480, 150], ball: [795, 335, 940, 470], hand: [100, 175, 150, 215], boots: [340, 410, 660, 635] }, keys: ["head", "ball"] },
  // ritaglio di social-tennis-1080x1350 (0,45 1080×655)
  "hero-tennis-fit": { ref: 1080, boxes: { ball: [915, 25, 980, 83], racket: [245, 170, 432, 365], head: [380, 365, 555, 555], hands: [120, 187, 1035, 490] }, keys: ["head", "ball"] },
  // partner-crowd-1200x628: i tifosi in primo piano con la sciarpa e la fila di teste davanti
  "partner-crowd": { ref: 1200, boxes: { fansL: [175, 180, 375, 345], fansR: [820, 190, 1080, 350], heads: [100, 240, 1100, 350] }, keys: [] },
};
const ROUTES = ["/", "/predictions", "/pricing", "/partners"];
const WIDTHS = [1920, 1440, 1024, 768, 640, 390, 360];
const LANGS = ["en", "pt", "fr"];
const TOL = 2;

test.describe("banner della fascia: nessun soggetto tagliato", () => {
  test.skip(({ isMobile }) => isMobile, "le larghezze le imposta il test: basta il progetto desktop");
  for (const lang of LANGS)
  for (const mode of ["light", "dark"] as const)
    for (const width of WIDTHS)
      test(`${lang} ${mode} ${width}`, async ({ browser }) => {
        const ctx = await browser.newContext({ viewport: { width, height: 900 } });
        await ctx.addInitScript((l) => localStorage.setItem("agentic-lang", l), lang);
        const page = await ctx.newPage();
        await page.route("**/api/track**", (r) => r.abort());
        await page.route("**/api/partner-click**", (r) => r.abort());
        const problems: string[] = [];
        for (const path of ROUTES) {
          await page.goto(`${path}?mode=${mode}`, { waitUntil: "load" });
          const pic = page.locator(".v3c-fascia .v3c-banner").first();
          await expect(pic, `${path}: banner`).toHaveCount(1);
          // final4: sotto i 600 px la fascia è pulita (colore + motivo), la foto non si mostra né si scarica
          if (width < 600) {
            await expect(pic, `${path}: niente foto sotto i 600 px`).toBeHidden();
            const src = await pic.locator("img").evaluate((i: HTMLImageElement) => i.currentSrc);
            if (!src.startsWith("data:")) problems.push(`${path}: foto scaricata sotto i 600 px (${src})`);
            continue;
          }
          await pic.locator("img").evaluate((i: HTMLImageElement) => i.decode().catch(() => undefined));
          const g = await pic.evaluate((p) => {
            const img = p.querySelector("img")!;
            const f = p.closest(".v3c-fascia")!;
            const rect = (e: Element) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; };
            const cs = getComputedStyle(img);
            const text = Array.from(f.querySelectorAll(".v3c-fascia-tab, .v3c-t-page, .v3c-t-match, .v3c-fascia-meta > *")).flatMap((e) => {
              // le righe di testo vere (un titolo su due righe ha due rettangoli)
              const range = document.createRange(); range.selectNodeContents(e);
              return Array.from(range.getClientRects()).map((r) => [r.left, r.top, r.right, r.bottom]);
            });
            return { img: rect(img), fascia: rect(f), nw: img.naturalWidth, nh: img.naturalHeight, fit: cs.objectFit, pos: cs.objectPosition, src: img.currentSrc, text };
          });
          const file = g.src.split("/").pop()!;
          const key = Object.keys(SUBJECTS).find((k) => file.startsWith(k));
          if (!key) { problems.push(`${path}: banner ${file} senza soggetti dichiarati`); continue; }
          const { ref, boxes, keys } = SUBJECTS[key];
          const [ix, iy, ix2, iy2] = g.img; const iw = ix2 - ix, ih = iy2 - iy;
          const NW = ref, NH = (g.nh * ref) / g.nw;
          const s = g.fit === "contain" ? Math.min(iw / NW, ih / NH) : Math.max(iw / NW, ih / NH);
          const [px, py] = g.pos.split(" ").map((v) => parseFloat(v) / 100);
          const ox = ix + (iw - NW * s) * px, oy = iy + (ih - NH * s) * py;
          const [fx, fy, fx2, fy2] = g.fascia;
          const cut = width <= 820 ? 22 : 34;
          const vis = [Math.max(ix, fx), Math.max(iy, fy), Math.min(ix2, fx2), Math.min(iy2, fy2)];
          for (const [name, [x0, y0, x1, y1]] of Object.entries(boxes)) {
            const b = [ox + x0 * s, oy + y0 * s, ox + x1 * s, oy + y1 * s];
            const right = Math.min(vis[2], fx2 - cut * ((Math.min(b[3], vis[3]) - fy) / (fy2 - fy)));
            const lost = [b[0] < vis[0] - TOL && "left", b[1] < vis[1] - TOL && "top", b[2] > right + TOL && "right", b[3] > vis[3] + TOL && "bottom"].filter(Boolean);
            if (lost.length) problems.push(`${path} ${file}: ${name} tagliato (${lost.join(",")})`);
            if (width >= 600 && keys.includes(name))
              for (const t of g.text)
                if (t[0] < b[2] && t[2] > b[0] && t[1] < b[3] && t[3] > b[1]) { problems.push(`${path} ${file}: ${name} sotto il testo della fascia`); break; }
          }
        }
        await ctx.close();
        expect(problems).toEqual([]);
      });
});

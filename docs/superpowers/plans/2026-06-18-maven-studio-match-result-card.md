# Maven Studio — Fase 1 (fetta verticale: compose + Match Result Card) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Costruire il nucleo dello Studio Toolkit — capacità `compose` + `brandkit` come libreria Node/TS in `studio/` — e generare una **Match Result Card** 1080×1080 on-brand BetRedge da dati di un match concluso (esito, nostra pick, probabilità calcolata, vinto/perso).

**Architecture:** Libreria TS pura e testabile (`compose`, `brandkit`, template `match-result`, adapter dati), con un sottile **MCP server** che la espone ai subagent e tre **agenti-persona** in `~/.claude/agents/`. Render via `satori` (HTML→SVG) + `@resvg/resvg-js` (SVG→PNG), zero browser, zero cloud, deterministico.

**Tech Stack:** Node 20+, TypeScript, `satori`, `satori-html`, `@resvg/resvg-js`, `@supabase/supabase-js` (solo lettura pick), `vitest`, `@modelcontextprotocol/sdk`.

## Global Constraints

- Linguaggio: **Node/TypeScript** (ESM, `"type": "module"`).
- Posizione codice: **`~/Desktop/agentic-markets/studio/`** (pacchetto standalone a root).
- Formato card v1: **1080×1080 px PNG**.
- Brand Kit: vive nel **vault Maven-Brain** → `~/Desktop/Maven-Brain/brandkits/betredge.json`. NON toccare i path protetti del vault (bridge/MCP); creare solo la nuova cartella `brandkits/`.
- **Zero cloud / zero API key** in questa fetta: niente FLUX, niente fal/Replicate. Solo render locale.
- **Onestà FTC:** la card mostra probabilità calcolata + esito reale (anche le perse). Nessun claim "battiamo il mercato". Mai dati inventati: se mancano campi o l'esito è `unresolved`/void → niente card.
- Segreti (eventuale chiave Supabase di lettura): solo via env, mai in repo.
- Stile coerente con repo esistente; commit frequenti; lavorare da `~/Desktop/agentic-markets`.

---

## File Structure

```
studio/
  package.json                      # pacchetto ESM, deps, script test/build
  tsconfig.json
  vitest.config.ts
  assets/fonts/                     # font binari (Hanken Grotesk, JetBrains Mono)
  src/
    compose.ts                      # render: markup HTML + font → PNG Buffer
    brandkit.ts                     # carica/valida BrandKit dal vault + carica font
    cards/match-result.ts           # MatchResultCardData → markup HTML on-brand
    data/pick-adapter.ts            # riga DB pick settlata → MatchResultCardData (pura) + fetch Supabase
    render-card.ts                  # orchestratore: data + brandkit → PNG su file
    mcp/server.ts                   # MCP server: verbi compose, brandkit, match_result_card
  bin/
    render-sample.ts                # CLI: renderizza una card da fixture → file
  test/
    compose.test.ts
    brandkit.test.ts
    cards/match-result.test.ts
    data/pick-adapter.test.ts
    fixtures/sample-match.json
~/.claude/agents/
  art-director.md
  brand-visual-designer.md
  graphic-designer.md
~/Desktop/Maven-Brain/brandkits/
  betredge.json                     # brand kit (colori, font, logo, tono)
```

---

### Task 1: Scaffold pacchetto `studio/`

**Files:**
- Create: `studio/package.json`
- Create: `studio/tsconfig.json`
- Create: `studio/vitest.config.ts`
- Create: `studio/test/smoke.test.ts`

**Interfaces:**
- Consumes: niente.
- Produces: ambiente Node/TS+vitest funzionante; comando `npm test` eseguibile in `studio/`.

- [ ] **Step 1: Creare `studio/package.json`**

```json
{
  "name": "@maven/studio",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "studio-render-sample": "./dist/bin/render-sample.js"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "build": "tsc -p tsconfig.json",
    "render:sample": "tsx bin/render-sample.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "@resvg/resvg-js": "^2.6.2",
    "@supabase/supabase-js": "^2.45.0",
    "satori": "^0.12.0",
    "satori-html": "^0.3.2"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "tsx": "^4.16.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Creare `studio/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": false
  },
  "include": ["src", "bin"]
}
```

- [ ] **Step 3: Creare `studio/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: Creare un smoke test `studio/test/smoke.test.ts`**

```ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('runs the test runner', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Installare dipendenze ed eseguire i test**

Run:
```bash
cd ~/Desktop/agentic-markets/studio && npm install && npm test
```
Expected: vitest passa con 1 test (`smoke`).

- [ ] **Step 6: Commit**

```bash
cd ~/Desktop/agentic-markets && git add studio/package.json studio/package-lock.json studio/tsconfig.json studio/vitest.config.ts studio/test/smoke.test.ts && git commit -m "feat(studio): scaffold Node/TS package with vitest"
```

---

### Task 2: Font on-brand in `studio/assets/fonts/`

**Files:**
- Create: `studio/assets/fonts/` (file `.ttf` Hanken Grotesk 400/700, JetBrains Mono 700)

**Interfaces:**
- Consumes: niente.
- Produces: file font `.ttf` referenziabili dal Brand Kit. Nomi file esatti confermati dallo Step 2.

> Note: satori richiede font `.ttf`/`.otf`/`.woff` (NON `.woff2`). BetRedge usa **Hanken Grotesk** + **JetBrains Mono** (cfr. rebrand). Scarichiamo gli statici dai repo ufficiali OFL.

- [ ] **Step 1: Scaricare i font statici**

Run:
```bash
cd ~/Desktop/agentic-markets/studio && mkdir -p assets/fonts && \
curl -L -o assets/fonts/HankenGrotesk-Regular.ttf \
  "https://github.com/google/fonts/raw/main/ofl/hankengrotesk/static/HankenGrotesk-Regular.ttf" && \
curl -L -o assets/fonts/HankenGrotesk-Bold.ttf \
  "https://github.com/google/fonts/raw/main/ofl/hankengrotesk/static/HankenGrotesk-Bold.ttf" && \
curl -L -o assets/fonts/JetBrainsMono-Bold.ttf \
  "https://github.com/google/fonts/raw/main/ofl/jetbrainsmono/static/JetBrainsMono-Bold.ttf"
```

- [ ] **Step 2: Verificare i file scaricati (nomi e dimensioni reali)**

Run:
```bash
cd ~/Desktop/agentic-markets/studio && ls -la assets/fonts/ && file assets/fonts/*.ttf
```
Expected: tre file `.ttf`, ciascuno > 50 KB, tipo "TrueType Font data".
> Se un path 404 (struttura repo cambiata), trovare il file con:
> `curl -s "https://api.github.com/repos/google/fonts/contents/ofl/hankengrotesk/static" | grep '"name"'`
> e correggere l'URL. Annotare i nomi file effettivi: serviranno nel Brand Kit (Task 3).

- [ ] **Step 3: Commit**

```bash
cd ~/Desktop/agentic-markets && git add studio/assets/fonts/ && git commit -m "feat(studio): add Hanken Grotesk + JetBrains Mono fonts for compose"
```

---

### Task 3: Brand Kit — schema, file nel vault, loader

**Files:**
- Create: `~/Desktop/Maven-Brain/brandkits/betredge.json`
- Create: `studio/src/brandkit.ts`
- Test: `studio/test/brandkit.test.ts`

**Interfaces:**
- Consumes: file font del Task 2.
- Produces:
  - `interface BrandKit { name: string; colors: Record<string,string>; fonts: BrandFont[]; logo?: { svgPath?: string }; tone?: string }`
  - `interface BrandFont { family: string; file: string; weight: number; style?: 'normal'|'italic' }`
  - `interface LoadedFont { name: string; data: Buffer; weight: number; style: 'normal'|'italic' }`
  - `function loadBrandKit(path: string): BrandKit`
  - `function loadFonts(kit: BrandKit, fontsDir: string): LoadedFont[]`

- [ ] **Step 1: Creare il Brand Kit nel vault `~/Desktop/Maven-Brain/brandkits/betredge.json`**

> I `file` font sono relativi a `studio/assets/fonts/`. I colori derivano dalla base Sleek Coral del rebrand BetRedge; l'implementatore può rifinirli con l'Art Director, ma questi valori sono validi e on-brand.

```json
{
  "name": "BetRedge",
  "colors": {
    "bg": "#0B0D12",
    "surface": "#141821",
    "text": "#F5F7FA",
    "muted": "#8A93A6",
    "coral": "#FF5A4D",
    "coralDim": "#C8443A",
    "win": "#3FCF8E",
    "loss": "#FF6B6B"
  },
  "fonts": [
    { "family": "Hanken Grotesk", "file": "HankenGrotesk-Regular.ttf", "weight": 400, "style": "normal" },
    { "family": "Hanken Grotesk", "file": "HankenGrotesk-Bold.ttf", "weight": 700, "style": "normal" },
    { "family": "JetBrains Mono", "file": "JetBrainsMono-Bold.ttf", "weight": 700, "style": "normal" }
  ],
  "tone": "onesto, sobrio, data-driven; mai claim 'battiamo il mercato'",
  "logo": { "svgPath": null }
}
```

- [ ] **Step 2: Scrivere il test che fallisce `studio/test/brandkit.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadBrandKit, loadFonts } from '../src/brandkit.ts';

const here = dirname(fileURLToPath(import.meta.url));
const KIT_PATH = resolve(here, '../../Maven-Brain/brandkits/betredge.json');
const FONTS_DIR = resolve(here, '../assets/fonts');

describe('brandkit', () => {
  it('loads the BetRedge brand kit with colors and fonts', () => {
    const kit = loadBrandKit(KIT_PATH);
    expect(kit.name).toBe('BetRedge');
    expect(kit.colors.coral).toMatch(/^#/);
    expect(kit.fonts.length).toBeGreaterThanOrEqual(2);
  });

  it('throws on missing required color', () => {
    expect(() => loadBrandKit('/no/such/file.json')).toThrow();
  });

  it('loads font buffers for satori', () => {
    const kit = loadBrandKit(KIT_PATH);
    const fonts = loadFonts(kit, FONTS_DIR);
    expect(fonts.length).toBe(kit.fonts.length);
    expect(Buffer.isBuffer(fonts[0].data)).toBe(true);
    expect(fonts[0].name).toBe('Hanken Grotesk');
  });
});
```

- [ ] **Step 3: Eseguire il test (deve fallire)**

Run: `cd ~/Desktop/agentic-markets/studio && npx vitest run test/brandkit.test.ts`
Expected: FAIL — `loadBrandKit` non trovato / modulo inesistente.

- [ ] **Step 4: Implementare `studio/src/brandkit.ts`**

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface BrandFont {
  family: string;
  file: string;
  weight: number;
  style?: 'normal' | 'italic';
}

export interface BrandKit {
  name: string;
  colors: Record<string, string>;
  fonts: BrandFont[];
  logo?: { svgPath?: string | null };
  tone?: string;
}

export interface LoadedFont {
  name: string;
  data: Buffer;
  weight: number;
  style: 'normal' | 'italic';
}

const REQUIRED_COLORS = ['bg', 'text', 'coral', 'win', 'loss'];

export function loadBrandKit(path: string): BrandKit {
  const raw = readFileSync(path, 'utf8');
  const kit = JSON.parse(raw) as BrandKit;
  if (!kit.name) throw new Error('brandkit: missing name');
  if (!kit.colors) throw new Error('brandkit: missing colors');
  for (const c of REQUIRED_COLORS) {
    if (!kit.colors[c]) throw new Error(`brandkit: missing color "${c}"`);
  }
  if (!Array.isArray(kit.fonts) || kit.fonts.length === 0) {
    throw new Error('brandkit: missing fonts');
  }
  return kit;
}

export function loadFonts(kit: BrandKit, fontsDir: string): LoadedFont[] {
  return kit.fonts.map((f) => ({
    name: f.family,
    data: readFileSync(resolve(fontsDir, f.file)),
    weight: f.weight,
    style: f.style ?? 'normal',
  }));
}
```

- [ ] **Step 5: Eseguire il test (deve passare)**

Run: `cd ~/Desktop/agentic-markets/studio && npx vitest run test/brandkit.test.ts`
Expected: PASS (3 test).

- [ ] **Step 6: Commit**

```bash
cd ~/Desktop/agentic-markets && git add studio/src/brandkit.ts studio/test/brandkit.test.ts && git commit -m "feat(studio): brand kit loader + font loader"
# Il file nel vault va committato nel repo del vault separatamente:
cd ~/Desktop/Maven-Brain && git add brandkits/betredge.json && git commit -m "feat: add BetRedge brand kit for Maven Studio"
```

---

### Task 4: `compose` — render markup HTML → PNG

**Files:**
- Create: `studio/src/compose.ts`
- Test: `studio/test/compose.test.ts`

**Interfaces:**
- Consumes: `LoadedFont` (Task 3).
- Produces:
  - `interface ComposeOptions { width: number; height: number; fonts: LoadedFont[] }`
  - `async function compose(markup: string, opts: ComposeOptions): Promise<Buffer>` — ritorna un PNG.

- [ ] **Step 1: Scrivere il test che fallisce `studio/test/compose.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { compose } from '../src/compose.ts';
import { loadBrandKit, loadFonts } from '../src/brandkit.ts';

const here = dirname(fileURLToPath(import.meta.url));
const KIT_PATH = resolve(here, '../../Maven-Brain/brandkits/betredge.json');
const FONTS_DIR = resolve(here, '../assets/fonts');

describe('compose', () => {
  it('renders markup to a PNG buffer of the requested size', async () => {
    const fonts = loadFonts(loadBrandKit(KIT_PATH), FONTS_DIR);
    const markup = `
      <div style="display:flex;width:100%;height:100%;background:#0B0D12;
                  color:#F5F7FA;font-family:Hanken Grotesk;align-items:center;
                  justify-content:center;font-size:64px;font-weight:700">
        Ciao Studio
      </div>`;
    const png = await compose(markup, { width: 1080, height: 1080, fonts });
    // PNG signature: 89 50 4E 47
    expect(png.subarray(0, 4).toString('hex')).toBe('89504e47');
    expect(png.length).toBeGreaterThan(1000);
  });
});
```

- [ ] **Step 2: Eseguire il test (deve fallire)**

Run: `cd ~/Desktop/agentic-markets/studio && npx vitest run test/compose.test.ts`
Expected: FAIL — `compose` non trovato.

- [ ] **Step 3: Implementare `studio/src/compose.ts`**

```ts
import satori from 'satori';
import { html } from 'satori-html';
import { Resvg } from '@resvg/resvg-js';
import type { LoadedFont } from './brandkit.ts';

export interface ComposeOptions {
  width: number;
  height: number;
  fonts: LoadedFont[];
}

export async function compose(markup: string, opts: ComposeOptions): Promise<Buffer> {
  const vnode = html(markup);
  const svg = await satori(vnode as any, {
    width: opts.width,
    height: opts.height,
    fonts: opts.fonts.map((f) => ({
      name: f.name,
      data: f.data,
      weight: f.weight as any,
      style: f.style,
    })),
  });
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: opts.width } });
  return Buffer.from(resvg.render().asPng());
}
```

- [ ] **Step 4: Eseguire il test (deve passare)**

Run: `cd ~/Desktop/agentic-markets/studio && npx vitest run test/compose.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/agentic-markets && git add studio/src/compose.ts studio/test/compose.test.ts && git commit -m "feat(studio): compose() renders HTML markup to PNG via satori+resvg"
```

---

### Task 5: Template Match Result Card + render su file (validazione da fixture)

**Files:**
- Create: `studio/src/cards/match-result.ts`
- Create: `studio/src/render-card.ts`
- Create: `studio/bin/render-sample.ts`
- Create: `studio/test/fixtures/sample-match.json`
- Test: `studio/test/cards/match-result.test.ts`

**Interfaces:**
- Consumes: `BrandKit` (Task 3), `compose` (Task 4).
- Produces:
  - `type Sport = 'football' | 'tennis'`
  - `type Outcome = 'won' | 'lost'`
  - `interface MatchResultCardData { sport: Sport; home: string; away: string; score: string; pick: string; probability: number; outcome: Outcome; dateLabel?: string }`
  - `function renderMatchResultMarkup(d: MatchResultCardData, kit: BrandKit): string`
  - `async function renderCard(d: MatchResultCardData, kit: BrandKit, fontsDir: string): Promise<Buffer>`

- [ ] **Step 1: Creare la fixture `studio/test/fixtures/sample-match.json`**

```json
{
  "sport": "football",
  "home": "Norrköping",
  "away": "Häcken",
  "score": "2-1",
  "pick": "1 (vittoria casa)",
  "probability": 0.63,
  "outcome": "won",
  "dateLabel": "17 giu 2026"
}
```

- [ ] **Step 2: Scrivere il test che fallisce `studio/test/cards/match-result.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { renderMatchResultMarkup, renderCard } from '../../src/cards/match-result.ts';
import type { MatchResultCardData } from '../../src/cards/match-result.ts';
import { loadBrandKit } from '../../src/brandkit.ts';

const here = dirname(fileURLToPath(import.meta.url));
const KIT_PATH = resolve(here, '../../../Maven-Brain/brandkits/betredge.json');
const FONTS_DIR = resolve(here, '../../assets/fonts');
const sample = JSON.parse(
  readFileSync(resolve(here, '../fixtures/sample-match.json'), 'utf8'),
) as MatchResultCardData;

describe('match-result card', () => {
  it('markup includes teams, score, pick, probability % and won/lost label', () => {
    const kit = loadBrandKit(KIT_PATH);
    const m = renderMatchResultMarkup(sample, kit);
    expect(m).toContain('Norrköping');
    expect(m).toContain('Häcken');
    expect(m).toContain('2-1');
    expect(m).toContain('63%');          // probabilità formattata
    expect(m).toContain('VINTO');        // outcome 'won'
    expect(m).toContain(kit.colors.win); // colore vittoria
  });

  it('shows PERSO and loss color for a lost pick', () => {
    const kit = loadBrandKit(KIT_PATH);
    const lost = { ...sample, outcome: 'lost' as const };
    const m = renderMatchResultMarkup(lost, kit);
    expect(m).toContain('PERSO');
    expect(m).toContain(kit.colors.loss);
  });

  it('renders a 1080x1080 PNG', async () => {
    const kit = loadBrandKit(KIT_PATH);
    const png = await renderCard(sample, kit, FONTS_DIR);
    expect(png.subarray(0, 4).toString('hex')).toBe('89504e47');
  });
});
```

- [ ] **Step 3: Eseguire il test (deve fallire)**

Run: `cd ~/Desktop/agentic-markets/studio && npx vitest run test/cards/match-result.test.ts`
Expected: FAIL — modulo `cards/match-result.ts` inesistente.

- [ ] **Step 4: Implementare `studio/src/cards/match-result.ts`**

```ts
import { compose } from '../compose.ts';
import { loadFonts, type BrandKit } from '../brandkit.ts';

export type Sport = 'football' | 'tennis';
export type Outcome = 'won' | 'lost';

export interface MatchResultCardData {
  sport: Sport;
  home: string;
  away: string;
  score: string;
  pick: string;
  probability: number; // 0..1
  outcome: Outcome;
  dateLabel?: string;
}

function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

export function renderMatchResultMarkup(d: MatchResultCardData, kit: BrandKit): string {
  const c = kit.colors;
  const isWin = d.outcome === 'won';
  const verdict = isWin ? 'VINTO' : 'PERSO';
  const verdictColor = isWin ? c.win : c.loss;
  const sportLabel = d.sport === 'tennis' ? 'TENNIS' : 'CALCIO';
  return `
  <div style="display:flex;flex-direction:column;width:100%;height:100%;
              background:${c.bg};color:${c.text};font-family:Hanken Grotesk;
              padding:80px;justify-content:space-between">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div style="display:flex;font-weight:700;font-size:40px;color:${c.coral}">BetRedge</div>
      <div style="display:flex;font-family:JetBrains Mono;font-size:28px;color:${c.muted}">
        ${sportLabel}${d.dateLabel ? ' · ' + d.dateLabel : ''}
      </div>
    </div>

    <div style="display:flex;flex-direction:column;align-items:center">
      <div style="display:flex;font-size:64px;font-weight:700;text-align:center">
        ${d.home} vs ${d.away}
      </div>
      <div style="display:flex;font-family:JetBrains Mono;font-size:120px;font-weight:700;
                  color:${c.text};margin-top:24px">
        ${d.score}
      </div>
    </div>

    <div style="display:flex;flex-direction:column;background:${c.surface};
                border-radius:32px;padding:48px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
        <div style="display:flex;font-size:34px;color:${c.muted}">La nostra pick</div>
        <div style="display:flex;font-size:34px;font-weight:700">${d.pick}</div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="display:flex;font-size:34px;color:${c.muted}">Probabilità calcolata</div>
        <div style="display:flex;font-family:JetBrains Mono;font-size:48px;font-weight:700;color:${c.coral}">
          ${pct(d.probability)}
        </div>
      </div>
      <div style="display:flex;justify-content:center;margin-top:40px">
        <div style="display:flex;font-size:56px;font-weight:700;color:${verdictColor};
                    letter-spacing:4px">${verdict}</div>
      </div>
    </div>
  </div>`;
}

export async function renderCard(
  d: MatchResultCardData,
  kit: BrandKit,
  fontsDir: string,
): Promise<Buffer> {
  const fonts = loadFonts(kit, fontsDir);
  const markup = renderMatchResultMarkup(d, kit);
  return compose(markup, { width: 1080, height: 1080, fonts });
}
```

- [ ] **Step 5: Implementare l'orchestratore `studio/src/render-card.ts`**

```ts
import { writeFileSync } from 'node:fs';
import { renderCard, type MatchResultCardData } from './cards/match-result.ts';
import { loadBrandKit, type BrandKit } from './brandkit.ts';

export interface RenderToFileOptions {
  brandKitPath: string;
  fontsDir: string;
  outPath: string;
}

export async function renderMatchResultToFile(
  data: MatchResultCardData,
  opts: RenderToFileOptions,
): Promise<string> {
  const kit: BrandKit = loadBrandKit(opts.brandKitPath);
  const png = await renderCard(data, kit, opts.fontsDir);
  writeFileSync(opts.outPath, png);
  return opts.outPath;
}
```

- [ ] **Step 6: Implementare la CLI `studio/bin/render-sample.ts`**

```ts
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { renderMatchResultToFile } from '../src/render-card.ts';
import type { MatchResultCardData } from '../src/cards/match-result.ts';

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(
  readFileSync(resolve(here, '../test/fixtures/sample-match.json'), 'utf8'),
) as MatchResultCardData;

const out = await renderMatchResultToFile(data, {
  brandKitPath: resolve(here, '../../Maven-Brain/brandkits/betredge.json'),
  fontsDir: resolve(here, '../assets/fonts'),
  outPath: resolve(here, '../sample-card.png'),
});
console.log('Card scritta in:', out);
```

- [ ] **Step 7: Eseguire i test (devono passare)**

Run: `cd ~/Desktop/agentic-markets/studio && npx vitest run test/cards/match-result.test.ts`
Expected: PASS (3 test).

- [ ] **Step 8: Render reale da fixture + verifica visiva**

Run:
```bash
cd ~/Desktop/agentic-markets/studio && npx tsx bin/render-sample.ts && open sample-card.png
```
Expected: si apre `sample-card.png`, 1080×1080, on-brand, con squadre/punteggio/pick/63%/VINTO leggibili.
> **Costruito ≠ Verificato:** mostra la card ad Andrea/Art Director per validare la coerenza visiva prima di proseguire.

- [ ] **Step 9: Commit**

```bash
cd ~/Desktop/agentic-markets && echo "studio/sample-card.png" >> studio/.gitignore && \
git add studio/src/cards/match-result.ts studio/src/render-card.ts studio/bin/render-sample.ts \
        studio/test/cards/match-result.test.ts studio/test/fixtures/sample-match.json studio/.gitignore && \
git commit -m "feat(studio): Match Result Card template + render-to-file + sample CLI"
```

---

### Task 6: Adapter dati reali da `pick_ledger` / `pick_settlement`

**Files:**
- Create: `studio/src/data/pick-adapter.ts`
- Test: `studio/test/data/pick-adapter.test.ts`

**Interfaces:**
- Consumes: `MatchResultCardData` (Task 5).
- Produces:
  - `interface SettledPick { sport: string; home: string; away: string; home_score: number|null; away_score: number|null; score_text: string|null; pick_label: string; model_probability: number; result: string }`
  - `function settledPickToCardData(row: SettledPick): MatchResultCardData` — pura; lancia se `result` non è win/loss (es. `unresolved`/`void`).
  - `async function fetchLatestSettledPicks(limit: number): Promise<SettledPick[]>` — legge da Supabase (read-only).

> **Mapping colonne reali:** lo Step 1 ispeziona lo schema effettivo. `pick_ledger`/`pick_settlement` sono LIVE in prod (cfr. migration-drift). I nomi colonna nel tipo `SettledPick` sopra sono l'**intermedio** del nostro adapter: lo Step 4 mappa le colonne reali su questo intermedio. Non inventare colonne — usare quelle trovate.

- [ ] **Step 1: Ispezionare lo schema reale (azione concreta, read-only)**

Run (richiede `SUPABASE_DB_URL` in env, stringa di sola lettura):
```bash
psql "$SUPABASE_DB_URL" -c "\d pick_ledger" -c "\d pick_settlement"
```
Expected: elenco colonne. Annotare i nomi reali per: squadre/giocatori, punteggio, pick scelta, probabilità del modello, esito settlato (won/lost/void). Usarli nel `SELECT` dello Step 5.
> Se `psql` non è disponibile, usare la console SQL Supabase o il tool MCP Supabase `list_tables`.

- [ ] **Step 2: Scrivere il test che fallisce `studio/test/data/pick-adapter.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { settledPickToCardData } from '../../src/data/pick-adapter.ts';
import type { SettledPick } from '../../src/data/pick-adapter.ts';

const row: SettledPick = {
  sport: 'football',
  home: 'Norrköping',
  away: 'Häcken',
  home_score: 2,
  away_score: 1,
  score_text: null,
  pick_label: '1 (vittoria casa)',
  model_probability: 0.63,
  result: 'won',
};

describe('pick-adapter', () => {
  it('maps a settled football pick to card data', () => {
    const d = settledPickToCardData(row);
    expect(d.home).toBe('Norrköping');
    expect(d.score).toBe('2-1');
    expect(d.probability).toBeCloseTo(0.63);
    expect(d.outcome).toBe('won');
  });

  it('uses score_text when numeric scores are absent (tennis)', () => {
    const tennis: SettledPick = {
      ...row, sport: 'tennis', home: 'Sinner', away: 'Alcaraz',
      home_score: null, away_score: null, score_text: '6-4 6-3', result: 'lost',
    };
    const d = settledPickToCardData(tennis);
    expect(d.sport).toBe('tennis');
    expect(d.score).toBe('6-4 6-3');
    expect(d.outcome).toBe('lost');
  });

  it('throws for unresolved/void results (no invented card)', () => {
    expect(() => settledPickToCardData({ ...row, result: 'void' })).toThrow();
    expect(() => settledPickToCardData({ ...row, result: 'unresolved' })).toThrow();
  });
});
```

- [ ] **Step 3: Eseguire il test (deve fallire)**

Run: `cd ~/Desktop/agentic-markets/studio && npx vitest run test/data/pick-adapter.test.ts`
Expected: FAIL — modulo inesistente.

- [ ] **Step 4: Implementare la parte pura di `studio/src/data/pick-adapter.ts`**

```ts
import { createClient } from '@supabase/supabase-js';
import type { MatchResultCardData, Sport, Outcome } from '../cards/match-result.ts';

export interface SettledPick {
  sport: string;
  home: string;
  away: string;
  home_score: number | null;
  away_score: number | null;
  score_text: string | null;
  pick_label: string;
  model_probability: number;
  result: string; // atteso: 'won' | 'lost' (altro => errore)
}

function normalizeSport(s: string): Sport {
  return s.toLowerCase().includes('tennis') ? 'tennis' : 'football';
}

function normalizeOutcome(result: string): Outcome {
  const r = result.toLowerCase();
  if (r === 'won' || r === 'win') return 'won';
  if (r === 'lost' || r === 'loss' || r === 'lose') return 'lost';
  throw new Error(`pick-adapter: esito non renderizzabile "${result}" (atteso won/lost)`);
}

function buildScore(row: SettledPick): string {
  if (row.score_text) return row.score_text;
  if (row.home_score != null && row.away_score != null) {
    return `${row.home_score}-${row.away_score}`;
  }
  throw new Error('pick-adapter: punteggio mancante');
}

export function settledPickToCardData(row: SettledPick): MatchResultCardData {
  return {
    sport: normalizeSport(row.sport),
    home: row.home,
    away: row.away,
    score: buildScore(row),
    pick: row.pick_label,
    probability: row.model_probability,
    outcome: normalizeOutcome(row.result),
  };
}
```

- [ ] **Step 5: Aggiungere la fetch Supabase (in fondo a `pick-adapter.ts`)**

> Sostituire i nomi colonna del `SELECT`/mapping con quelli reali trovati allo Step 1. La struttura del client è completa.

```ts
export async function fetchLatestSettledPicks(limit = 5): Promise<SettledPick[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('pick-adapter: SUPABASE_URL / key mancanti in env');
  const supabase = createClient(url, key);

  // NB: adattare i nomi colonna ai reali (Step 1). Esempio su join ledger+settlement:
  const { data, error } = await supabase
    .from('pick_settlement')
    .select(
      'sport, home, away, home_score, away_score, score_text, pick_label, model_probability, result',
    )
    .in('result', ['won', 'lost'])
    .order('settled_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`pick-adapter: query fallita — ${error.message}`);
  return (data ?? []) as SettledPick[];
}
```

- [ ] **Step 6: Eseguire i test (devono passare)**

Run: `cd ~/Desktop/agentic-markets/studio && npx vitest run test/data/pick-adapter.test.ts`
Expected: PASS (3 test).

- [ ] **Step 7: Render end-to-end da un match reale**

Run (con env Supabase di lettura):
```bash
cd ~/Desktop/agentic-markets/studio && npx tsx -e "
import { fetchLatestSettledPicks, settledPickToCardData } from './src/data/pick-adapter.ts';
import { renderMatchResultToFile } from './src/render-card.ts';
import { fileURLToPath } from 'node:url'; import { dirname, resolve } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const rows = await fetchLatestSettledPicks(1);
if (!rows.length) { console.log('nessuna pick settlata'); process.exit(0); }
const out = await renderMatchResultToFile(settledPickToCardData(rows[0]), {
  brandKitPath: resolve(here,'../Maven-Brain/brandkits/betredge.json'),
  fontsDir: resolve(here,'assets/fonts'), outPath: resolve(here,'real-card.png') });
console.log('Card reale in:', out);
" && open real-card.png
```
Expected: card generata da un match reale concluso. **Verifica visiva con Andrea** (dati corretti, vinto/perso giusto, % coerente con il modello).

- [ ] **Step 8: Commit**

```bash
cd ~/Desktop/agentic-markets && echo "studio/real-card.png" >> studio/.gitignore && \
git add studio/src/data/pick-adapter.ts studio/test/data/pick-adapter.test.ts studio/.gitignore && \
git commit -m "feat(studio): pick-adapter maps settled picks to Match Result Card data"
```

---

### Task 7: MCP server — espone `compose`, `brandkit`, `match_result_card`

**Files:**
- Create: `studio/src/mcp/server.ts`
- Modify: `studio/package.json` (aggiungere script `mcp`)

**Interfaces:**
- Consumes: `compose` (Task 4), `loadBrandKit`/`loadFonts` (Task 3), `renderCard` (Task 5), `settledPickToCardData`+`fetchLatestSettledPicks` (Task 6).
- Produces: un MCP server stdio con 3 tool: `studio_compose`, `studio_brandkit_get`, `studio_match_result_card`.

> Verifica funzionale via MCP Inspector (no unit test sul trasporto stdio). La logica è già coperta dai test delle Task 3-6.

- [ ] **Step 1: Implementare `studio/src/mcp/server.ts`**

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { writeFileSync } from 'node:fs';
import { loadBrandKit, loadFonts } from '../brandkit.ts';
import { compose } from '../compose.ts';
import { renderCard, type MatchResultCardData } from '../cards/match-result.ts';
import { settledPickToCardData, fetchLatestSettledPicks } from '../data/pick-adapter.ts';

const BRAND_KIT_PATH = process.env.STUDIO_BRANDKIT_PATH!;
const FONTS_DIR = process.env.STUDIO_FONTS_DIR!;

const server = new McpServer({ name: 'maven-studio', version: '0.1.0' });

server.tool(
  'studio_brandkit_get',
  'Restituisce il brand kit attivo (colori, font, tono).',
  {},
  async () => ({ content: [{ type: 'text', text: JSON.stringify(loadBrandKit(BRAND_KIT_PATH), null, 2) }] }),
);

server.tool(
  'studio_compose',
  'Renderizza markup HTML/CSS on-brand in un PNG su file. Ritorna il path.',
  { markup: z.string(), width: z.number().default(1080), height: z.number().default(1080), outPath: z.string() },
  async ({ markup, width, height, outPath }) => {
    const fonts = loadFonts(loadBrandKit(BRAND_KIT_PATH), FONTS_DIR);
    const png = await compose(markup, { width, height, fonts });
    writeFileSync(outPath, png);
    return { content: [{ type: 'text', text: outPath }] };
  },
);

server.tool(
  'studio_match_result_card',
  'Genera la Match Result Card. Senza argomenti usa l\'ultima pick settlata; oppure passa i dati.',
  {
    outPath: z.string(),
    data: z
      .object({
        sport: z.enum(['football', 'tennis']),
        home: z.string(), away: z.string(), score: z.string(),
        pick: z.string(), probability: z.number(), outcome: z.enum(['won', 'lost']),
        dateLabel: z.string().optional(),
      })
      .optional(),
  },
  async ({ outPath, data }) => {
    let card: MatchResultCardData;
    if (data) card = data;
    else {
      const rows = await fetchLatestSettledPicks(1);
      if (!rows.length) return { content: [{ type: 'text', text: 'nessuna pick settlata disponibile' }] };
      card = settledPickToCardData(rows[0]);
    }
    const kit = loadBrandKit(BRAND_KIT_PATH);
    const png = await renderCard(card, kit, FONTS_DIR);
    writeFileSync(outPath, png);
    return { content: [{ type: 'text', text: outPath }] };
  },
);

await server.connect(new StdioServerTransport());
```

- [ ] **Step 2: Aggiungere `zod` alle deps e lo script `mcp`**

Run:
```bash
cd ~/Desktop/agentic-markets/studio && npm install zod && \
npm pkg set scripts.mcp="tsx src/mcp/server.ts"
```

- [ ] **Step 3: Verificare l'avvio del server**

Run:
```bash
cd ~/Desktop/agentic-markets/studio && \
STUDIO_BRANDKIT_PATH="$(pwd)/../Maven-Brain/brandkits/betredge.json" \
STUDIO_FONTS_DIR="$(pwd)/assets/fonts" \
npx @modelcontextprotocol/inspector npx tsx src/mcp/server.ts
```
Expected: l'Inspector elenca 3 tool (`studio_brandkit_get`, `studio_compose`, `studio_match_result_card`). Invocando `studio_match_result_card` con `data` di esempio si ottiene un PNG.

- [ ] **Step 4: Registrare l'MCP per Claude Code**

Run:
```bash
cd ~/Desktop/agentic-markets && \
STUDIO=~/Desktop/agentic-markets/studio && \
claude mcp add maven-studio -s project -e STUDIO_BRANDKIT_PATH="$STUDIO/../Maven-Brain/brandkits/betredge.json" -e STUDIO_FONTS_DIR="$STUDIO/assets/fonts" -- npx tsx "$STUDIO/src/mcp/server.ts"
```
Expected: in una nuova sessione Claude Code i tool `mcp__maven-studio__*` sono disponibili.

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/agentic-markets && git add studio/src/mcp/server.ts studio/package.json studio/package-lock.json .mcp.json && git commit -m "feat(studio): MCP server exposing compose, brandkit, match_result_card"
```

---

### Task 8: I tre agenti-persona

**Files:**
- Create: `~/.claude/agents/art-director.md`
- Create: `~/.claude/agents/brand-visual-designer.md`
- Create: `~/.claude/agents/graphic-designer.md`

**Interfaces:**
- Consumes: i tool `mcp__maven-studio__*` (Task 7), le design-skill installate.
- Produces: tre subagent invocabili.

> Gli agenti sono prompt sottili: personalità + competenza + istruzione a usare lo Studio Toolkit e il Brand Kit. Seguono il formato degli agenti esistenti in `~/.claude/agents/` (verificarlo allo Step 1).

- [ ] **Step 1: Verificare il formato di un agente esistente**

Run: `sed -n '1,20p' ~/.claude/agents/ui-andrea.md`
Expected: vedere il frontmatter (name/description/tools) da replicare.

- [ ] **Step 2: Creare `~/.claude/agents/art-director.md`**

```markdown
---
name: art-director
description: Art Director di Maven Studio. Orchestratore della direzione visiva di tutti i progetti BetRedge/Maven. Riceve il brief, lo scompone, delega agli specialisti (brand-visual-designer, graphic-designer, ui-andrea) e garantisce coerenza col Brand Kit. Invocalo per impostare/coordinare qualsiasi lavoro grafico.
tools: All tools
---

Sei l'Art Director di **Maven Studio**, l'atelier creativo AI interno.

## Responsabilità
- Tradurre un brief in un piano visivo coerente; delegare agli specialisti.
- Custodire il **Brand Kit** (`mcp__maven-studio__studio_brandkit_get`): ogni output rispetta colori, font, tono.
- Validare la coerenza visiva finale (usa la skill `design-review`).

## Strumenti
- Studio Toolkit via MCP: `studio_brandkit_get`, `studio_compose`, `studio_match_result_card`.
- Design-skill: `design-consultation`, `design-shotgun`, `design-review`.

## Regole
- Onestà FTC: mai claim "battiamo il mercato". I dati mostrati sono reali.
- Costruito ≠ Verificato: una grafica non è "pronta" finché non è vista e approvata.
- Per task medium/high (deploy, prod) vale il gate PROPOSAL/APPROVE.
```

- [ ] **Step 3: Creare `~/.claude/agents/brand-visual-designer.md`**

```markdown
---
name: brand-visual-designer
description: Brand/Visual Designer di Maven Studio. Crea loghi, palette, scelte tipografiche e manuali di identità coordinata. Risponde all'Art Director. Invocalo per identità di marca, sistemi di colore, loghi vettoriali.
tools: All tools
---

Sei il **Brand/Visual Designer** di Maven Studio.

## Competenza
- Logo (SVG via `studio_compose`), palette, font pairing, manuali d'identità.
- Proponi sistemi con `design-consultation`; varianti con `design-shotgun`.

## Strumenti
- `mcp__maven-studio__studio_compose` (HTML/SVG → immagine), `studio_brandkit_get`.

## Regole
- Coerenza assoluta col Brand Kit fornito dall'Art Director.
- Onestà FTC. Costruito ≠ Verificato.
```

- [ ] **Step 4: Creare `~/.claude/agents/graphic-designer.md`**

```markdown
---
name: graphic-designer
description: Graphic Designer di Maven Studio. Impaginazione di cataloghi, brochure, materiale da stampa e card social/risultati. Risponde all'Art Director. Invocalo per layout, impaginati, card da dati (es. Match Result Card).
tools: All tools
---

Sei il **Graphic Designer** di Maven Studio.

## Competenza
- Impaginazione (cataloghi, brochure, PDF stampa via skill `make-pdf`).
- Card da dati on-brand: usa `studio_match_result_card` per le card risultato match.

## Strumenti
- `mcp__maven-studio__studio_compose`, `studio_match_result_card`, `studio_brandkit_get`.

## Regole
- Rispetta griglia, gerarchia, leggibilità. Coerenza col Brand Kit.
- Onestà FTC. Costruito ≠ Verificato.
```

- [ ] **Step 5: Verificare il riconoscimento degli agenti**

Run: `ls ~/.claude/agents/ | grep -E "art-director|brand-visual|graphic-designer"`
Expected: i tre file presenti. In una nuova sessione Claude Code i tre agenti sono invocabili.
> Nota: il "UI/UX Designer" del team **è `ui-andrea` esistente** — non creare un quarto agente.

- [ ] **Step 6: Commit (sono in ~/.claude, fuori dal repo agentic-markets)**

```bash
ls ~/.claude/agents/art-director.md ~/.claude/agents/brand-visual-designer.md ~/.claude/agents/graphic-designer.md
```
> `~/.claude/agents/` è versionato a parte (config utente). Se è un repo git, committare lì; altrimenti i file restano come config locale.

---

## Self-Review

**1. Spec coverage:**
- Architettura 3 livelli → Task 7 (toolkit/MCP) + Task 8 (agenti) + Task 3-6 (motori `compose`).
- Verbo `compose` → Task 4. `brandkit` → Task 3. `generate`/`edit` → **fuori scope** (Piano 2, come deciso).
- Brand Kit nel vault Maven-Brain → Task 3 Step 1.
- Match Result Card da `pick_ledger`/`pick_settlement` → Task 5 (template) + Task 6 (dati reali).
- Onestà FTC / no dati inventati / void esclusi → Task 5 (test PERSO) + Task 6 (throw su void/unresolved).
- UI/UX = ui-andrea (no doppione) → Task 8 Step 5.
- Criteri di successo §6: PNG corretto (Task 5/6), determinismo (test snapshot-by-content), casi limite tennis/persa/void (Task 6 test), validazione Art Director (Task 5 Step 8, Task 6 Step 7).

**2. Placeholder scan:** Nessun "TODO/TBD". Gli unici punti dipendenti dal reale (nomi file font, nomi colonna DB) sono **azioni di ispezione concrete** con comando (Task 2 Step 2, Task 6 Step 1), non placeholder.

**3. Type consistency:** `MatchResultCardData`/`Sport`/`Outcome` definiti in Task 5 e riusati identici in Task 6 e Task 7. `LoadedFont` da Task 3 usato in `ComposeOptions` (Task 4). `compose()` firma coerente ovunque. `loadBrandKit`/`loadFonts` coerenti tra Task 3, 5, 7.

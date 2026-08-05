# Free Betting Tools — Implementation Plan (#TOOLS-HUB-0805)

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:executing-plans` (inline) to work this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** cinque calcolatori di betting gratuiti su `/tools`, indicizzabili in 11 lingue, che prendono il posto di `/world-cup` nelle vie d'ingresso del sito.

**Architecture:** un modulo di matematica pura testato (`lib/betting-math.ts`), un dizionario di copy per lingua (`lib/tools/copy/*.ts`), cinque client component isolati che consumano solo il modulo, e quattro `page.tsx` server-side che generano staticamente 55 pagine (5 tool × 11 lingue) da quella stessa implementazione.

**Tech Stack:** Next 16.2.7 App Router (server component + `force-static`), React 19, TypeScript, vitest, CSS in `app/globals.css`.

**Spec:** `docs/superpowers/specs/2026-08-05-free-betting-tools-design.md`

## Global Constraints

- Branch `betredge/tools-hub`. Nessun push su `main`. Deploy prod solo con APPROVE.
- Rotte tool: nessun accesso a DB/API. `export const dynamic = "force-static"`.
- `dynamicParams = false` su `[lang]` e `[tool]`: qualunque segmento fuori lista → 404.
- Slug invarianti in tutte le lingue: `odds-converter`, `ev-calculator`, `kelly-criterion`, `margin-calculator`, `probability-calculator`.
- Lingue: `en` (nessun prefisso, canonical) + `it es fr de pt nl pl tr sv ru`.
- Nessun arrotondamento intermedio nella matematica: si arrotonda solo in formattazione.
- Input invalido → `null`. Mai `NaN` verso la UI, mai eccezioni.
- Copy FTC-safe: nessun profitto promesso, nessun "battiamo il mercato". La pagina Kelly porta l'avvertimento su varianza e rischio di rovina.
- Niente emoji. Icone: SVG inline nel contenuto; per il rail/nav icona raster 3D (standing rule: mai line-art).
- Nuove classi CSS prefissate `.tl-` (evita collisioni con `lp-`, `wc-`, `wp-`, `v-`, `am-`).
- `npm test` e `npm run build` verdi alla fine di ogni task che tocca codice.

---

### Task 1: modulo di matematica (TDD, nessuna UI)

**Files:**
- Create: `lib/betting-math.ts`
- Test: `lib/betting-math.test.ts`

**Interfaces — Produces:**
```ts
export type OddsFormat = "decimal" | "american" | "fractional" | "hongkong" | "malay" | "indonesian";
export function parseOdds(input: string, format: OddsFormat): number | null;      // → decimale
export function formatOdds(decimal: number, format: OddsFormat): string;
export function impliedProbability(decimal: number): number;                       // 0..1
export function probabilityToDecimal(p: number): number;
export function bookmakerMargin(decimals: number[]): number | null;
export function payoutPercent(decimals: number[]): number | null;
export function noVigProbabilities(decimals: number[]): number[] | null;
export function noVigOdds(decimals: number[]): number[] | null;
export function expectedValue(a: { probability: number; decimal: number; stake: number }):
  { ev: number; evPercent: number; fairDecimal: number; edge: number } | null;
export function kelly(a: { probability: number; decimal: number; bankroll: number; fraction: number }):
  { edge: number; fullKelly: number; stakeFraction: number; stake: number; growthRate: number } | null;
export function breakEvenProbability(decimal: number): number | null;
export function parlayProbability(probabilities: number[]): number | null;
export function parlayOdds(decimals: number[]): number | null;
```

- [ ] **Step 1: scrivi il test file completo** con i casi della tabella dello spec (conversioni, margine, no-vig, EV, Kelly, break-even, multipla) più i bordi: stringa vuota, spazi, testo, `0`, negativi, `1.00`, `p=0`, `p=1`, virgola europea `2,50`, array vuoto, array di un elemento, americana `+50` (invalida), frazionaria `11/4`.
- [ ] **Step 2: `npx vitest run lib/betting-math.test.ts`** → FAIL (modulo inesistente).
- [ ] **Step 3: implementa `lib/betting-math.ts`** — funzioni pure, nessun import.
  Formule: `american>0 → 1+a/100`, `american<0 → 1+100/|a|`; `fractional n/d → 1+n/d`;
  `hongkong → 1+hk`; `indonesian>0 → 1+i`, `indonesian<0 → 1+1/|i|`;
  `malay>0 → 1+m`, `malay<0 → 1+1/|m|`; `margine = Σ(1/oᵢ) − 1`;
  `noVig pᵢ = (1/oᵢ)/Σ(1/oⱼ)`; `EV = p·(o−1)·stake − (1−p)·stake`;
  `kelly f* = (p·(o−1) − (1−p))/(o−1)`, `f* ≤ 0 → stake 0`;
  `growth = p·ln(1+f·(o−1)) + (1−p)·ln(1−f)`.
- [ ] **Step 4: `npx vitest run lib/betting-math.test.ts`** → PASS su tutti i casi.
- [ ] **Step 5: commit** `test+feat(tools): matematica delle quote pura e testata (#TOOLS-HUB-0805)`

---

### Task 2: registry dei tool + impianto copy con test di completezza

**Files:**
- Create: `lib/tools/registry.ts`, `lib/tools/copy/types.ts`, `lib/tools/copy/en.ts`, `lib/tools/copy/index.ts`
- Test: `lib/tools/copy.test.ts`

**Interfaces — Consumes:** niente. **Produces:**
```ts
// registry.ts
export const TOOL_SLUGS = ["odds-converter","margin-calculator","ev-calculator","kelly-criterion","probability-calculator"] as const;
export type ToolSlug = (typeof TOOL_SLUGS)[number];
export const TOOL_LOCALES = ["en","it","es","fr","de","pt","nl","pl","tr","sv","ru"] as const;
export type ToolLocale = (typeof TOOL_LOCALES)[number];
export function isToolSlug(v: string): v is ToolSlug;
export function isToolLocale(v: string): v is ToolLocale;
export function toolPath(slug: ToolSlug, locale: ToolLocale): string;   // en → /tools/x, it → /it/tools/x
export function hubPath(locale: ToolLocale): string;

// copy/types.ts
export type ToolCopy = {
  metaTitle: string; metaDescription: string; h1: string; lede: string;
  labels: Record<string, string>;          // etichette input/output del calcolatore
  formulaTitle: string; formula: string[]; // righe di spiegazione della formula
  explainerTitle: string; explainer: string[];   // paragrafi, 250–350 parole totali
  faq: { q: string; a: string }[];         // 3–4
  caveat?: string;                         // Kelly: varianza / rischio di rovina
};
export type ToolsCopy = {
  hub: { metaTitle: string; metaDescription: string; h1: string; lede: string; cardCta: string; intro: string[] };
  common: { backLabel: string; ctaTitle: string; ctaBody: string; ctaButton: string; otherTools: string; langLabel: string; free: string };
  tools: Record<ToolSlug, ToolCopy>;
};
```

- [ ] **Step 1: scrivi `lib/tools/copy.test.ts`** — per ogni locale in `TOOL_LOCALES`: esiste il dizionario; ha tutte e 5 le chiavi di `tools`; ogni `ToolCopy` ha `metaTitle`, `h1`, `lede`, ≥2 paragrafi in `explainer`, ≥3 FAQ; le chiavi di `labels` di ogni tool sono identiche a quelle di `en` (nessuna etichetta mancante o inventata); `kelly-criterion` ha `caveat` non vuoto.
- [ ] **Step 2: `npx vitest run lib/tools/copy.test.ts`** → FAIL.
- [ ] **Step 3: implementa** `registry.ts`, `copy/types.ts`, `copy/en.ts` (copy inglese completo dei 5 tool + hub) e `copy/index.ts` che espone `getToolsCopy(locale): ToolsCopy` con fallback a `en` per locale ignoto.
- [ ] **Step 4: rendi verde il test per `en`**; gli altri 10 locali arrivano al Task 5 → il test resta rosso su quelli: temporaneamente `TOOL_LOCALES` contiene solo `en` in `copy/index.ts`? **No.** Il test itera su `Object.keys(DICTS)`, e `getToolsCopy` fa fallback: al Task 5 si aggiungono i locali a `DICTS` e il test li copre automaticamente.
- [ ] **Step 5: `npx vitest run`** → tutto verde. **Commit** `feat(tools): registry, tipi e copy EN con test di completezza (#TOOLS-HUB-0805)`

---

### Task 3: i cinque calcolatori (client component) + CSS

**Files:**
- Create: `components/tools/OddsConverter.tsx`, `MarginCalculator.tsx`, `EvCalculator.tsx`, `KellyCalculator.tsx`, `ProbabilityCalculator.tsx`, `components/tools/ToolCalculator.tsx` (dispatcher slug → componente), `components/tools/NumberField.tsx` (input controllato riusato)
- Modify: `app/globals.css` (blocco `.tl-*` in fondo)
- Test: `components/tools/calculators.test.tsx`

**Interfaces — Consumes:** tutto da `lib/betting-math.ts` (Task 1) e `ToolCopy["labels"]` (Task 2).
**Produces:** `<ToolCalculator slug={ToolSlug} copy={ToolCopy} />` — unico punto d'ingresso usato dalle pagine.

- [ ] **Step 1: test di rendering** (vitest + @testing-library se già in repo, altrimenti test di puro calcolo sui componenti esclusi e coperti dal Task 1): monta `ToolCalculator` per ogni slug, verifica che compaia il readout iniziale e che non lanci con input vuoto.
- [ ] **Step 2: esegui** → FAIL.
- [ ] **Step 3: implementa i componenti.** Regole comuni: `"use client"`, stato locale con stringhe (non numeri) per non combattere l'input, calcolo live in `useMemo`, readout che mostra `—` quando l'input non è valido (mai `NaN`), `inputMode="decimal"`, `aria-label` da `copy.labels`, nessun bottone "calcola". Ogni file ≤ 200 righe.
- [ ] **Step 4: esegui** → PASS. `npx tsc --noEmit` pulito.
- [ ] **Step 5: aggiungi il CSS `.tl-*`** in `app/globals.css`: griglia due colonne desktop (input | readout) che collassa a una colonna sotto 760px, superfici sui token `--am-*`, tema chiaro/scuro via `data-theme` come il resto del sito.
- [ ] **Step 6: commit** `feat(tools): i cinque calcolatori client + superfici .tl-* (#TOOLS-HUB-0805)`

---

### Task 4: rotte, metadata, hreflang, JSON-LD

**Files:**
- Create: `lib/tools/seo.ts`, `components/tools/ToolShell.tsx`, `components/tools/ToolsHub.tsx`, `components/tools/LangPicker.tsx`, `app/tools/page.tsx`, `app/tools/[tool]/page.tsx`, `app/[lang]/tools/page.tsx`, `app/[lang]/tools/[tool]/page.tsx`
- Test: `lib/tools/seo.test.ts`

**Interfaces — Consumes:** `registry.ts`, `getToolsCopy`, `<ToolCalculator>`.
**Produces:**
```ts
// lib/tools/seo.ts
export function toolMetadata(slug: ToolSlug, locale: ToolLocale): Metadata;   // title/description/canonical/alternates
export function hubMetadata(locale: ToolLocale): Metadata;
export function toolJsonLd(slug: ToolSlug, locale: ToolLocale): object[];      // WebApplication + FAQPage
```

- [ ] **Step 1: `lib/tools/seo.test.ts`** — `toolMetadata` produce: canonical assoluto corretto per locale (`https://www.betredge.com/it/tools/kelly-criterion`), `alternates.languages` con tutte e 11 le lingue **più** `x-default` → EN, title/description dal dizionario del locale; `toolJsonLd` produce due oggetti con `@type` `WebApplication` e `FAQPage` e tante `mainEntity` quante le FAQ.
- [ ] **Step 2: esegui** → FAIL.
- [ ] **Step 3: implementa `seo.ts`**, poi `ToolShell` (H1, lede, calcolatore, formula, explainer, FAQ, link agli altri tool, CTA, `LangPicker`, `SiteTopbar backHref="/" `, `SiteFooter lang`), `ToolsHub` (griglia 5 card + intro + CTA), e le quattro `page.tsx`.
  Ogni page: `export const dynamic = "force-static"`, `export const dynamicParams = false`, `generateStaticParams`, `generateMetadata`, JSON-LD via `<script type="application/ld+json">`.
  `app/[lang]/...`: `generateStaticParams` restituisce i 10 locali **non-en** (l'inglese vive su `/tools`, altrimenti due URL per lo stesso contenuto).
- [ ] **Step 4: esegui i test** → PASS. **`npm run build`** → verifica nell'output che siano generate `/tools`, 5 `/tools/*`, 10 `/[lang]/tools` e 50 `/[lang]/tools/*`.
- [ ] **Step 5: commit** `feat(tools): rotte statiche 5×11 con canonical, hreflang e JSON-LD (#TOOLS-HUB-0805)`

---

### Task 5: le dieci traduzioni

**Files:**
- Create: `lib/tools/copy/it.ts`, `es.ts`, `fr.ts`, `de.ts`, `pt.ts`, `nl.ts`, `pl.ts`, `tr.ts`, `sv.ts`, `ru.ts`
- Modify: `lib/tools/copy/index.ts` (registra i 10 dizionari)

- [ ] **Step 1: scrivi i 10 dizionari.** Traduzione reale, non stringhe inglesi copiate: title/description pensati sulla keyword locale (es. IT "convertitore quote", ES "calculadora de valor esperado"), explainer 250–350 parole, 3–4 FAQ. Termini di prodotto invariati (BetRedge, +EV, Kelly, no-vig).
- [ ] **Step 2: `npx vitest run lib/tools/copy.test.ts`** → PASS su tutti e 11 i locali (il test del Task 2 li copre da solo).
- [ ] **Step 3: `npm run build`** → 55 pagine generate.
- [ ] **Step 4: commit** `feat(tools): copy dei tool nelle 10 lingue non-inglesi (#TOOLS-HUB-0805)`

---

### Task 6: nav, icona, sitemap, banner WC

**Files:**
- Create: `public/icons/menu-tools.png` (320px), `public/icons/menu-tools-sm.png` (64px)
- Modify: `app/components/menu-icon.tsx` (nome `"tools"`), `app/page.tsx:737` (bottone sport WC → Tools), `app/app/page.tsx:9020` (rail) e `:9054` (tile mobile), `components/SiteFooter.tsx` (link `/tools` + stringa in 5 lingue), `app/sitemap.ts`, `lib/house-banners.ts` (4 banner WC fuori rotazione)
- Test: `app/sitemap.test.ts`

- [ ] **Step 1: genera l'icona** con gptimg seguendo il protocollo noto (`pkill -f "codex exec"` prima della chiamata, prompt corto, una immagine alla volta): oggetto 3D su trasparente, stile identico alle altre `menu-*.png`, scia coral. Ridimensiona a 320 e 64px.
- [ ] **Step 2: `app/sitemap.test.ts`** — la sitemap contiene le 55 URL dei tool, `/world-cup` è presente con `changeFrequency: "monthly"`, nessuna URL duplicata.
- [ ] **Step 3: esegui** → FAIL.
- [ ] **Step 4: applica le modifiche di nav + sitemap + banner.** `/world-cup` **non** si cancella e **non** si redirige: resta 200. Il `wc-back-link` dentro la dashboard resta.
- [ ] **Step 5: `npx vitest run`** → PASS. `npm run build` verde.
- [ ] **Step 6: commit** `feat(tools): Tools prende il posto della World Cup nelle vie d'ingresso (#TOOLS-HUB-0805)`

---

### Task 7: verifica reale e PR

- [ ] **Step 1:** `npm test` e `npm run build` — output incollato nel report, non riassunto.
- [ ] **Step 2:** `npm run dev` e visual check con Playwright a **390px** e **1440px** su `/tools`, `/tools/kelly-criterion`, `/it/tools/ev-calculator` (mobile: l'estensione Chrome non cambia il viewport).
- [ ] **Step 3:** verifica a mano nel browser i valori della tabella dei casi di test su tutti e 5 i calcolatori, più input di bordo (vuoto, `0`, negativo, testo).
- [ ] **Step 4:** `curl -s localhost:3000/it/tools/kelly-criterion | grep -E 'canonical|hreflang|application/ld\+json'` — canonical, 11 hreflang + x-default, due blocchi JSON-LD.
- [ ] **Step 5:** `curl -s -o /dev/null -w "%{http_code}" localhost:3000/world-cup` → `200`; `/tools/non-esiste` e `/xx/tools` → `404`.
- [ ] **Step 6:** push del branch, PR con la lista di cosa è cambiato davvero vs proposto. **Nessun deploy prod senza APPROVE.**

---

## Self-review

- **Copertura spec:** rotte §1→T4 · matematica §2→T1 · i 5 tool §3→T1+T3 · pagina/SEO §4→T2+T3+T4 · WC archiviata §5→T6 · criteri di successo §6→T7 · fuori perimetro §7 non implementato per scelta · nota legale §8 riportata nel report finale · gate §9→T7 step 6.
- **Placeholder:** nessuno; ogni step ha comando o contenuto reale.
- **Coerenza tipi:** `ToolSlug`/`ToolLocale` definiti in T2 e usati con lo stesso nome in T3/T4/T6; `getToolsCopy` unico accesso al copy; `ToolCalculator` unico punto d'ingresso dei calcolatori.

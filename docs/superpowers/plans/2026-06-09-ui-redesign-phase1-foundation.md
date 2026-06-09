# UI Redesign "Sleek Coral" — Fase 1: Fondamenta (token + font + glifi)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ri-skinnare l'intero sito sulla palette/voce "Sleek Coral" (coral unico raffinato + Hanken Grotesk + JetBrains Mono) e introdurre lo sprite dei glifi sport, **senza toccare markup di layout né logica** — uno stato deployabile e reversibile che mette al sicuro il sistema di token prima della chirurgia di layout (Fasi 2–6).

**Architecture:** Re-skin via variabili. I font passano attraverso le stesse CSS var (`--font-display`, `--font-mono`) già usate da `globals.css`, quindi cambiando solo `layout.tsx` si ripropaga ovunque. I colori cambiano riscrivendo i valori `--am-*` nei due blocchi `:root` (dark) e `:root[data-theme="light"]`; gli alias legacy fanno ripropagare su tutte le classi bespoke. Lo sprite glifi è un nuovo componente additivo, non ancora referenziato (lo useranno le fasi successive).

**Tech Stack:** Next.js (App Router, versione con breaking changes — vedi `AGENTS.md`), `next/font/google`, CSS custom properties.

**Vincolo assoluto:** nessuna modifica alla logica (data fetching, settlement, gating, calcoli). Solo presentazione. Ogni riga cambiata risale alla richiesta UI (Surgical Changes).

**Spec di riferimento:** `docs/superpowers/specs/2026-06-09-ui-redesign-sleek-coral-design.md`
**Fonte visiva di verità (valori esatti):** `docs/design-craft/mockups/redesign-direction-v2.html`

---

## Verifica (questo progetto non ha unit test UI — "test" = build + visivo + no-regressione)

Definizioni usate negli step:
- **BUILD OK** = `npm run build` termina senza errori TypeScript/ESLint.
- **VISUAL OK** = avviato `npm run dev`, controllo **da loggato** (cookie Chrome, regola `visual_check_loggato`) la home in **dark E light**: i colori/font sono cambiati come atteso, nessun elemento illeggibile, contrasto AA.
- **NO-REG** = i flussi chiave non cambiano comportamento: toggle tema, login, tab Account/Storico/Classifica si aprono, le card si espandono. Smoke manuale.
- **Backup** prima di editare `globals.css`/`layout.tsx`: `cp app/globals.css app/globals.css.bak-p1 && cp app/layout.tsx app/layout.tsx.bak-p1` (rimuovere i `.bak-p1` a fine fase).

---

## File coinvolti

- Modify: `app/layout.tsx` (righe 2, 5-15, 29) — swap font.
- Modify: `app/globals.css` (`:root` 8-91 dark, `:root[data-theme="light"]` 97-134) — valori token; nuovo token `--am-hi`.
- Create: `app/components/sport-glyphs.tsx` — sprite SVG dei 12 glifi (additivo).

---

### Task 1: Swap font — Hanken Grotesk (voce) + JetBrains Mono (cifre)

**Files:**
- Modify: `app/layout.tsx:2`, `app/layout.tsx:5-15`, `app/layout.tsx:29`

Razionale: Space Grotesk è la "convergence trap" bandita dal design bible §4; Space Mono va sostituito con JetBrains Mono (slashed-zero, tabular). Le variabili restano `--font-display` / `--font-mono`, così `globals.css` non si tocca.

- [ ] **Step 1: Backup**

```bash
cp app/layout.tsx app/layout.tsx.bak-p1
```

- [ ] **Step 2: Sostituisci l'import dei font**

In `app/layout.tsx` riga 2, da:
```ts
import { Space_Grotesk, Space_Mono } from "next/font/google";
```
a:
```ts
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
```

- [ ] **Step 3: Sostituisci la configurazione dei font (righe 5-15)**

Da:
```ts
const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const spaceMono = Space_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});
```
a:
```ts
const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});
```

- [ ] **Step 4: Aggiorna il className su `<html>` (riga 29)**

Da `className={`${spaceGrotesk.variable} ${spaceMono.variable}`}`
a `className={`${hankenGrotesk.variable} ${jetbrainsMono.variable}`}`

- [ ] **Step 5: BUILD OK**

Run: `npm run build`
Expected: build verde, nessun errore (i nomi `Hanken_Grotesk`/`JetBrains_Mono` esistono in `next/font/google`).

- [ ] **Step 6: VISUAL OK**

`npm run dev` → home in dark e light: i titoli/testi ora sono Hanken Grotesk (grottesco con carattere, non più Space Grotesk), le cifre JetBrains Mono. Nessun layout rotto.

- [ ] **Step 7: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(ui): swap brand voice to Hanken Grotesk + JetBrains Mono (sleek-coral P1)"
```

---

### Task 2: Ricalibra l'accento CORAL (un solo accento, raffinato, per tema)

**Files:**
- Modify: `app/globals.css` — `:root` (dark, ~8-91) e `:root[data-theme="light"]` (~97-134)

Razionale: spec §4.1. Coral più materico su near-black (dark) e abbastanza scuro da reggere AA come testo (light). Valori target dal mockup `:root`.

- [ ] **Step 1: Backup**

```bash
cp app/globals.css app/globals.css.bak-p1
```

- [ ] **Step 2: Aggiorna i valori coral nel blocco `:root` (DARK)**

Trova le righe che definiscono `--am-coral`, `--am-coral-2`, `--am-coral-dim`, `--am-coral-b` e portale a (valori spec):
```css
  --am-coral:      #FF6A5E;   /* primary unico: pick del modello / numero-chiave / stato attivo */
  --am-coral-2:    #C7463E;   /* fill barra del pick (coral-deep, più materico) */
  --am-coral-dim:  rgba(255,106,94,0.13);
  --am-coral-b:    rgba(255,106,94,0.34);
```

- [ ] **Step 3: Aggiorna i valori coral nel blocco `:root[data-theme="light"]`**

```css
  --am-coral:      #D8392F;   /* AA come testo su bianco */
  --am-coral-2:    #E5483D;   /* fill barra su track chiaro */
  --am-coral-dim:  rgba(216,57,47,0.08);
  --am-coral-b:    rgba(216,57,47,0.30);
```

- [ ] **Step 4: BUILD OK** — `npm run build` verde (solo valori CSS, nessun cambio strutturale).

- [ ] **Step 5: VISUAL OK** — dark e light: l'accento è il nuovo coral ovunque compaia (CTA, stato attivo, top-pick). Contrasto AA verificato (testo coral su panel chiaro leggibile).

- [ ] **Step 6: Commit**

```bash
git add app/globals.css
git commit -m "feat(ui): refine coral accent per-theme (sleek-coral P1)"
```

---

### Task 3: Ricalibra neutri/superfici + aggiungi inner-highlight

**Files:**
- Modify: `app/globals.css` — blocchi `:root` e `:root[data-theme="light"]`

Razionale: spec §4.1/§4.4. Near-black a tint freddo bassissima croma + ramp superfici + token `--am-hi` (inner-highlight 1px, elevazione reale stile Linear). Valori dal mockup.

- [ ] **Step 1: Nel blocco `:root` (DARK), porta i neutri/superfici a:**

```css
  --am-bg:         #0B0C0E;
  --am-bg-2:       #0E1013;
  --am-panel:      #131519;
  --am-panel-2:    #181B20;
  --am-panel-3:    #1E2229;   /* mantieni il gradino successivo coerente */
  --am-inset:      #0C0D10;
  --am-line:       #21252C;
  --am-line-2:     #2C313A;
  --am-text:       #EDEFF2;
  --am-muted:      #AEB4BE;
  --am-muted-2:    #6E7682;
```

- [ ] **Step 2: Aggiungi il token inner-highlight nel blocco `:root` (DARK)**

Subito dopo `--am-line-2`, aggiungi:
```css
  --am-hi:         rgba(255,255,255,0.05);  /* bordo superiore 1px, elevazione */
```

- [ ] **Step 3: Nel blocco `:root[data-theme="light"]`, porta i neutri/superfici a:**

```css
  --am-bg:         #F4F5F7;
  --am-bg-2:       #EEF0F3;
  --am-panel:      #FFFFFF;
  --am-panel-2:    #FBFCFD;
  --am-panel-3:    #EEF0F3;
  --am-inset:      #EEF0F3;
  --am-line:       #E3E6EB;
  --am-line-2:     #D2D7DE;
  --am-text:       #14171C;
  --am-muted:      #4A515B;
  --am-muted-2:    #79818D;
  --am-hi:         rgba(255,255,255,0.9);
```

- [ ] **Step 4: BUILD OK** — `npm run build` verde.

- [ ] **Step 5: VISUAL OK** — dark: superfici near-black più fredde e a gradini; light: bianco caldo neutro. Gerarchia regge in scala di grigi; testo AA in entrambi. Nessuna superficie "sparita" (es. card invisibili su bg).

- [ ] **Step 6: Commit**

```bash
git add app/globals.css
git commit -m "feat(ui): recalibrate neutral/surface ramp + inner-highlight token (sleek-coral P1)"
```

---

### Task 4: Sprite glifi sport custom (componente additivo)

**Files:**
- Create: `app/components/sport-glyphs.tsx`

Razionale: spec §4.5. 12 `<symbol>` SVG line-art, una forma coral per glifo. Additivo: monta lo sprite una volta, i glifi si usano via `<svg><use href="#g-..."/></svg>`. Non referenziato finché le fasi 2-6 non lo usano → zero rischio. **Codice completo = i `<symbol>` del mockup `redesign-direction-v2.html` (righe ~415-489), invariati**; qui sotto la versione React completa.

- [ ] **Step 1: Crea il componente con lo sprite completo**

```tsx
// app/components/sport-glyphs.tsx
// Sprite SVG dei glifi sport custom (sleek-coral). Stile: line-art geometrica,
// stroke 1.5, round join, UNA forma in coral per glifo. Montare una volta in cima
// al layout; usare via <svg className="..."><use href="#g-ball"/></svg>.
// Fonte di verità: docs/design-craft/mockups/redesign-direction-v2.html
export function SportGlyphSprite() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <symbol id="g-ball" viewBox="0 0 24 24">
          <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.4 15.4 9.9 14.1 13.9 9.9 13.9 8.6 9.9Z" fill="var(--am-coral)" stroke="var(--am-coral)" />
            <path d="M12 3v4.4M15.4 9.9l3.7-1.4M14.1 13.9l2.4 3.4M9.9 13.9l-2.4 3.4M8.6 9.9 4.9 8.5" />
          </g>
        </symbol>
        <symbol id="g-pitch" viewBox="0 0 24 24">
          <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
            <rect x="3" y="5" width="18" height="14" rx="1.5" />
            <path d="M12 5v14" /><circle cx="12" cy="12" r="2.6" />
            <path d="M3 8.6h2.8v6.8H3M21 8.6h-2.8v6.8H21" />
            <circle cx="12" cy="12" r="0.7" fill="var(--am-coral)" stroke="var(--am-coral)" />
          </g>
        </symbol>
        <symbol id="g-racket" viewBox="0 0 24 24">
          <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
            <ellipse cx="9.5" cy="8.2" rx="5.5" ry="6.2" />
            <path d="M12.7 12.9 21 21.2" /><path d="M11 14l-1.2 1.2" />
            <g stroke="var(--am-coral)" strokeWidth="1"><path d="M6.4 5.2v6.4M9.5 4.1v8.5M12.6 5.6v5.6M5.1 8.2h8.8M5 10.6h9" /></g>
          </g>
        </symbol>
        <symbol id="g-tball" viewBox="0 0 24 24">
          <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M5 6.5c3.4 2 3.4 9 0 11M19 6.5c-3.4 2-3.4 9 0 11" stroke="var(--am-coral)" />
          </g>
        </symbol>
        <symbol id="g-grass" viewBox="0 0 24 24">
          <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
            <path d="M4 20v-8M4 12c0-2.4 1.6-4 3.4-4M12 20V8" />
            <path d="M12 8c0-2.6 1.8-4.4 3.8-4.4" stroke="var(--am-coral)" /><path d="M12 20V8" stroke="var(--am-coral)" />
            <path d="M20 20v-7M20 13c0-2.2-1.4-3.6-3-3.6" />
            <path d="M3 20h18" strokeWidth="1.5" />
          </g>
        </symbol>
        <symbol id="g-court" viewBox="0 0 24 24">
          <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
            <path d="M3 20 7 5h10l4 15Z" /><path d="M5.3 12.5h13.4" /><path d="M6.6 8h10.8" />
            <path d="M12 8v9" /><path d="M5.3 20h13.4" stroke="var(--am-coral)" strokeDasharray="1.4 1.4" />
          </g>
        </symbol>
        <symbol id="g-trophy" viewBox="0 0 24 24">
          <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
            <path d="M7 4h10v4a5 5 0 0 1-10 0Z" />
            <path d="M7 5.5H4.2V7A2.8 2.8 0 0 0 7 9.8M17 5.5h2.8V7A2.8 2.8 0 0 1 17 9.8" />
            <path d="M12 13v3.2M9 20h6M9.6 20l.5-3.8h3.8l.5 3.8" />
            <circle cx="12" cy="6.4" r="1.7" fill="var(--am-coral)" stroke="var(--am-coral)" />
          </g>
        </symbol>
        <symbol id="g-desk" viewBox="0 0 24 24">
          <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
            <path d="M4 20V10M9.3 20V5M14.6 20v-7" />
            <path d="M20 20V8" stroke="var(--am-coral)" />
          </g>
        </symbol>
        <symbol id="g-history" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6.5A8 8 0 1 1 4 13" /><path d="M4 4v3.5h3.5" /><path d="M12 8v4.4l3 1.8" stroke="var(--am-coral)" /></g></symbol>
        <symbol id="g-rank" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 20v-6M12 20V8M19 20v-9" stroke="var(--am-coral)" /><path d="M3 20h18" /></g></symbol>
        <symbol id="g-builder" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="7" height="7" rx="1.4" /><rect x="13" y="13" width="7" height="7" rx="1.4" stroke="var(--am-coral)" /><path d="M11 7.5h4.5a2 2 0 0 1 2 2V13" /></g></symbol>
        <symbol id="g-pick" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.5 14.3 9l5.7.3-4.4 3.8 1.5 5.6L12 15.8 6.9 18.7l1.5-5.6L4 9.3 9.7 9Z" stroke="var(--am-coral)" /></g></symbol>
        <symbol id="g-bolt" viewBox="0 0 24 24"><path d="M13 2 4 14h6l-1 8 9-12h-6Z" fill="currentColor" /></symbol>
      </defs>
    </svg>
  );
}
```

- [ ] **Step 2: BUILD OK**

Run: `npm run build`
Expected: verde. Il componente compila (attributi SVG in camelCase per React: `strokeWidth`, `strokeLinejoin`, `strokeDasharray`).

- [ ] **Step 3: Commit**

```bash
git add app/components/sport-glyphs.tsx
git commit -m "feat(ui): add custom sport glyph SVG sprite (sleek-coral P1)"
```

---

### Task 5: Verifica di fase + cleanup backup

- [ ] **Step 1: NO-REG** — smoke manuale da loggato: toggle tema dark↔light, apertura tab (Account/Storico/Classifica), espansione "Perché" di una card, login modal. Tutto funziona come prima (solo aspetto cambiato).

- [ ] **Step 2: VISUAL OK finale** — dark e light: il sito è coeso sul nuovo coral + Hanken + superfici sleek. Screenshot di confronto prima/dopo per Andrea.

- [ ] **Step 3: Rimuovi i backup**

```bash
rm -f app/globals.css.bak-p1 app/layout.tsx.bak-p1
git add -A && git commit -m "chore(ui): drop phase-1 backups"
```

---

## Self-review (coverage vs spec §4.1, §4.2, §4.5)

- §4.2 tipografia (Hanken + JetBrains Mono) → Task 1. ✓
- §4.1 coral unico per tema → Task 2. ✓ (la *riduzione d'uso* di --am-cobalt come accento e il razionamento a 3 ruoli avvengono nel restyle componenti, Fase 2+ — qui si fissa il valore.)
- §4.1/§4.4 neutri/superfici + inner-highlight → Task 3. ✓
- §4.5 sistema glifi → Task 4. ✓ (uso nei componenti = Fasi 2+.)
- §4.3 griglia 12-col, §5 componenti, §6 responsive, §8 estrazione componenti → **fuori fase**, coperti dai piani successivi.
- Nessun placeholder; valori e codice espliciti; verifica = build + visivo + no-reg (il progetto non ha unit test UI).

## Roadmap fasi successive (piani separati, scritti dopo che la Fase 1 atterra)

- **Fase 2 — `PredictionCard` (atomo):** restyle di `ProbBar`@1083, `FormRow`/`FormBadge`, e il blocco card; barre monocromatiche con coral solo sul pick; "Perché", footer azione sobria. Userà i glifi.
- **Fase 3 — Featured / "Edge del giorno":** nuovo focal point span-12 (oggi non esiste come tale).
- **Fase 4 — Topbar + Rail + doppia-nav + Ticker + Filtri:** chrome di navigazione e griglia 12-col.
- **Fase 5 — Storico / Classifica / Promo demote / Footer compliance.**
- **Fase 6 — Responsive (breakpoint 1200/1080, regola `minmax(0,1fr)`, ticker scroll-x) + pulizia orfani.**

Ogni fase: PROPOSAL con change-spec + `APPROVE` prima di toccare il codice; verifica visiva loggata dark+light + check JS overflow; nessuna regressione logica.

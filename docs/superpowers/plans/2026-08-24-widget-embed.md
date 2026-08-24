# Widget embed predizioni — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (esecuzione inline, nessun subagente — vincolo di sessione).

**Goal:** un `<script>` incollabile su siti terzi che mostra predizioni BetRedge e porta traffico attribuito.

**Architecture:** `public/widget.js` (tag del partner) → `<iframe>` su `/embed` (route handler che ritorna HTML puro) → `lib/embed-feed.ts` (query dedicata che riusa le decisioni di `lib/access-projection`).

**Tech Stack:** Next 16 route handler, vitest+jsdom, nessuna dipendenza nuova.

**Spec:** `docs/superpowers/specs/2026-08-24-widget-embed-predizioni-design.md`

## Global Constraints

- Ref valido = `/^[A-Z0-9_-]{2,20}$/` (stessa regex di `app/r/[code]/route.ts` e del register). Non valido → nessun ref, mai troncato.
- La versione (`teaser`/`open`) la decide il **server** da `EMBED_FULL_REFS`. Nessun `data-mode`.
- Zero claim di performance nell'HTML del widget; 18+ e disclaimer sempre visibili.
- Nessun cookie/localStorage/fingerprint sul sito ospite.
- Colori dai token del sito: bg `#0B0C0E`, panel `#131519`, line `#21252C`, text `#EDEFF2`, muted `#AEB4BE`, brand `#23A559`, cobalt `#3B82F6`; light: text `#14171C`, muted `#4A515B`.
- Lingue: le 5 della chrome (`it/en/es/fr/ru`) via `chromeLang()` di `lib/tools/registry`, fallback `en`.
- `limit` clampato 1..6.

---

### Task 1: `lib/embed-feed.ts` — ref, versione, proiezione

**Files:** Create `lib/embed-feed.ts`, `lib/embed-feed.test.ts`

**Interfaces produced:**
- `type EmbedMode = "teaser" | "open"`
- `normalizeEmbedRef(raw: string | null): string | null`
- `resolveEmbedMode(ref: string | null, allowlist: string | undefined): EmbedMode`
- `type EmbedRow = { id, sport, competition, homeTeam, awayTeam, startsAt, pick, confidence: number|null, locked: boolean, topPick: boolean }`
- `toEmbedRows(rows: Record<string, unknown>[], mode: EmbedMode, limit: number): EmbedRow[]` (puro)
- `fetchEmbedRows(opts: { sport?: string|null; limit: number; mode: EmbedMode }): Promise<EmbedRow[]>`

- [ ] **Step 1: test rossi** — `lib/embed-feed.test.ts`: ref valido/invalido/lowercase; ref fuori allowlist con `EMBED_FULL_REFS` popolata → `teaser`; ref dentro → `open`; `toEmbedRows` teaser sblocca 1 riga per sport e ne blocca le altre; open le sblocca tutte; limit clampato; riga senza pick sotto floor resta servita ma senza decisione.
- [ ] **Step 2: `npx vitest run lib/embed-feed.test.ts`** → FAIL (modulo assente)
- [ ] **Step 3: implementa** — `toEmbedRows` usa `showcaseRanking` + `projectPrediction(row, mode === "open" ? "premium" : "free", rank)` e `humanizePick` per la decisione; `fetchEmbedRows` esegue la SELECT dei soli campi necessari con gli stessi filtri del board (`is_demo=FALSE`, `is_historical=FALSE`, `published_at IS NOT NULL`, finestra `PREDICTION_WINDOW_DAYS`, coda 150 minuti).
- [ ] **Step 4: verde**
- [ ] **Step 5: commit** `feat(widget): feed dedicato per l'embed (#WIDGET-EMBED-0824)`

---

### Task 2: `app/embed/route.ts` — HTML del widget + header di embeddabilità

**Files:** Create `app/embed/route.ts`, `app/embed/embed-html.ts`, `app/embed/embed-html.test.ts`; Modify `next.config.ts`

**Interfaces produced:** `renderEmbedHtml(opts: { rows: EmbedRow[]; ref: string|null; lang: Lang; theme: "light"|"dark"|"auto"; host: string|null; mode: EmbedMode }): string`

- [ ] **Step 1: test rossi** — l'HTML contiene le squadre; una riga locked non contiene la sua decisione; la CTA contiene `ref` e gli `utm_*`; con ref invalido la CTA non contiene `ref=`; l'HTML non contiene stringhe di claim vietate (`/\d+%\s*(win|vincite|accuracy)/i`, "beat the market"); contiene 18+; escaping: un nome squadra con `<script>` esce escapato.
- [ ] **Step 2: FAIL**
- [ ] **Step 3: implementa** `embed-html.ts` (funzione pura, HTML+CSS inline) e `route.ts` (parsing query → `fetchEmbedRows` → `new NextResponse(html, { headers })` con `Content-Type: text/html`, `Cache-Control: public, s-maxage=120, stale-while-revalidate=60`, `Content-Security-Policy: ... frame-ancestors *` e **nessun** `X-Frame-Options`).
- [ ] **Step 4:** `next.config.ts`: la regola globale passa da `/:path*` a `/((?!embed$|widget.js$).*)`; aggiungi la regola dedicata per `/embed`. Test in `app/embed/headers.test.ts` che importa `nextConfig.headers()` e asserisce: `/embed` senza `X-Frame-Options`, sorgente globale che non matcha `embed`.
- [ ] **Step 5: verde + commit** `feat(widget): pagina /embed e deroga frame-ancestors sul solo path`

---

### Task 3: `public/widget.js` — il tag del partner

**Files:** Create `public/widget.js`, `lib/widget-script.test.ts`

- [ ] **Step 1: test rossi** — il test legge il file con `readFileSync`, lo esegue in jsdom con uno `<script data-*>` corrente, e verifica: iframe inserito dopo il tag; `src` contiene sport/limit/lang/theme/ref/host; `postMessage` da un `source` estraneo **non** cambia l'altezza; messaggio legittimo la applica clampata; due tag nella stessa pagina → due iframe indipendenti.
- [ ] **Step 2: FAIL**
- [ ] **Step 3: implementa** widget.js (IIFE, no global, `document.currentScript` catturato subito).
- [ ] **Step 4: verde + commit** `feat(widget): script di embed per i siti partner`

---

### Task 4: eventi di misura + pagina di prova + verifica cross-origin

**Files:** Modify `app/api/track/route.ts`; Create `scripts/widget-demo.html`

- [ ] **Step 1:** aggiungi `widget_view`, `widget_click` a `ALLOWED_EVENTS` + test che li accetta.
- [ ] **Step 2:** l'HTML dell'embed emette `widget_view` al load e `widget_click` sul click (fetch keepalive verso `/api/track`, nessun cookie).
- [ ] **Step 3:** `scripts/widget-demo.html` = finta pagina partner con lo snippet.
- [ ] **Step 4: verifica reale** — `npm run dev` su :3000 + `python3 -m http.server 8001` sulla cartella scripts; screenshot desktop e 390px; click che porta il ref giusto. Senza questi screenshot il lavoro non è "fatto".
- [ ] **Step 5: commit** `feat(widget): eventi di misura + pagina di prova`

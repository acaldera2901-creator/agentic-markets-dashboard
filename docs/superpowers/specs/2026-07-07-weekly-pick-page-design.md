# Design — Pagina Weekly Pick strutturata + entry point (#WEEKLY-PICK-1 · UI)

Data: 2026-07-07 · Autore: Andrea via Claude Code · Approccio: **A** (arricchire la
route standalone `/weekly-pick` esistente).

## Contesto (stato attuale, verificato)

La Weekly Pick ("multipla della casa") è **code-complete ma dormiente**:
- Pagina standalone `app/weekly-pick/page.tsx` (single-card, 5 lingue), API
  `app/api/weekly-pick/{route,generate,checkout,callback}.ts`, `lib/weekly-pick*.ts`,
  migration `db/migrations/014_weekly_pick.sql`, test.
- **Orfana**: `/weekly-pick` non è linkata da nessuna nav/board/feature.
- **Vuota**: nessun cron chiama `/api/weekly-pick/generate` → tabella `weekly_pick`
  mai popolata → l'API risponde `available:false`.
- Flag `WEEKLY_PICK_ENABLED` OFF di default (`lib/weekly-pick.ts:37`); migration 014
  NON applicata in prod; nessun cron in `vercel.json`.
- Esiste `ops/PROPOSAL-WEEKLY-PICK-1.md` (change-spec go-live, prezzo €12.99).
- ⚠️ Da non confondere con il badge legacy `pick_of_day` in
  `lib/access-projection.ts:59-60` (top-1 per sport sul board) — feature diversa.

## Obiettivo

Ridisegnare `/weekly-pick` come **pagina strutturata** e renderla **visibile subito**
nel sito, agganciata nella "parte feature". Il go-live (accensione reale) resta un
passo separato dietro gate.

## Decisioni prese (Andrea)

- Approccio **A** (route standalone arricchita).
- Sezioni: **hero+spiegazione**, **card multipla**, **come funziona**, **storico**.
- Entry point: **rail sinistro gruppo "Featured"** + **benefit nella card Pro** dei Piani.
- Icona: **glyph SVG inline** (no asset PNG raster).
- Link **visibile subito** (opzione i): pre-go-live la card mostra "in arrivo".
- **Stato live delle legs** (requisito chiave): le pick escono lunedì; chi compra a
  metà settimana deve vedere le legs **già giocate** (esito) e quelle **ancora da
  giocare**, oltre allo storico delle settimane precedenti.

## Architettura

Tutto **frontend + read-only**, nessuna scrittura DB, nessuna nuova tabella. La
feature resta gated dal flag esistente: con `WEEKLY_PICK_ENABLED` OFF gli endpoint
restano inerti (come oggi).

### Unità (confini chiari)

1. **`lib/weekly-pick.ts` — funzione pura di risoluzione esiti (NUOVA)**
   `resolveLegOutcomes(legs, predRows)` → per ogni leg mappa `wp_<predId>` allo stato
   della predizione: `upcoming` | `won` | `lost` | `void`, + kickoff. Deriva l'esito
   aggregato della multipla: `lost` se ≥1 leg persa; altrimenti `live` se ≥1 leg
   `upcoming`; altrimenti `won` (tutte le non-void risolte a won). Regola esplicita:
   una leg il cui `predId` non trova riga in `unified_predictions` è trattata come
   `upcoming` (mai `lost`), così un dato mancante non fa risultare falsamente persa la
   multipla. Pura, testabile, zero I/O.
   - Cosa fa: trasforma legs+risultati in stato per-leg e aggregato.
   - Come si usa: chiamata da `/api/weekly-pick` (settimana corrente) e
     `/api/weekly-pick/history` (settimane passate).
   - Dipende da: solo i tipi delle righe predizione. Nessuna dipendenza runtime.

2. **`app/api/weekly-pick/route.ts` — GET settimana corrente (MODIFICA)**
   Oltre a quanto già fa, per le legs della settimana corrente fa un solo
   `SELECT id, status, result, starts_at FROM unified_predictions WHERE id = ANY($1)`
   (id estratti da `wp_<predId>`), poi `resolveLegOutcomes`. Ritorna per ogni leg uno
   `status` (upcoming/won/lost/void) + `kickoff`. **Proiezione per sessione invariata**:
   - Sbloccato (Pro/acquirente): `market`, `prob`, `status` per-leg, `kickoff`, esito
     aggregato, `combined_prob`, `legs_remaining`.
   - Lockato (teaser): `label` + solo `played`/`upcoming` **aggregato** (es. "2 di 5
     ancora da giocare"). **Mai** l'esito per-leg né la pick (rivelerebbe la selezione).

3. **`app/api/weekly-pick/history/route.ts` — GET storico (NUOVO)**
   `force-dynamic`. Se flag OFF → `{ enabled:false }`. Legge le `weekly_pick` con
   `week_start < currentWeekStart()` (ultime ~8), risolve ogni riga con
   `resolveLegOutcomes` (join batch su `unified_predictions`). Ritorna per settimana:
   `week_start`, `legs` (label/market/prob/status — sempre visibili nello storico: la
   settimana è chiusa, nessun leak sul presente), esito aggregato, `combined_prob`.
   Nessun paywall sullo storico (record fattuale, no upsell).

4. **`app/weekly-pick/page.tsx` — pagina (RISCRITTA)**
   Quattro sezioni sotto l'header esistente:
   - **Hero + spiegazione**: titolo, cos'è la multipla della casa. Copy FTC-safe:
     nessuna quota, nessun edge/vincita promessa (riusa tono esistente).
   - **La multipla (card)**: legs con stato live (✓ won / ✗ lost / ⏱ upcoming+kickoff),
     "N legs ancora live", prob combinata; teaser lockato + blocco prezzo/CTA per
     non-Pro; invariata la logica sblocco/upsell.
   - **Come funziona**: 3-4 step (selezione top-prob deterministica dal modello;
     cadenza settimanale, nuova ogni lunedì, scade a fine settimana; inclusa nel Pro /
     one-off €12.99 per gli altri).
   - **Storico**: ultime settimane con esito finale; empty-state al lancio.
   - Copy nelle 5 lingue esistenti (it/en/es/fr/ru), stesso pattern `COPY`.

5. **Entry point (MODIFICA `app/app/page.tsx`)**
   - Rail gruppo **Featured** (`rail-lab is-second`, dove stanno World Cup/Creator
     Picks): nuovo `<Link href="/weekly-pick">` + glyph SVG inline (nuovo simbolo in
     `<defs>`, es. `#g-weekly`). Desktop-only, coerente con gli altri featured.
   - **Piani, card Pro** (`PlansTab`, lista `plan-feature-list`): nuovo
     `<PlanFeature>` "Weekly Pick inclusa" con `<Link href="/weekly-pick">`.

## Flusso dati

Lunedì (post-go-live) il cron `generate` costruisce la multipla da
`unified_predictions` futuri e la persiste in `weekly_pick` (id leg = `wp_<predId>`).
Durante la settimana le predizioni vengono settlate dal ciclo esistente
(`/api/cron/settle` → `unified_predictions.result`). La pagina, ad ogni load, risolve
lo stato delle legs read-time: nessuna scrittura, sempre coerente col board.

## Error / empty handling

Riuso loading/error/"in arrivo" + retry già presenti. Nuovi empty-state: storico
vuoto ("primo pick in arrivo"); settimana corrente non ancora generata → "in arrivo".
Con flag OFF entrambi gli endpoint tornano `{enabled:false}` → la pagina mostra la
struttura (hero/come funziona) + stati "in arrivo"/storico vuoto.

## Testing

- Unit test su `resolveLegOutcomes` (pura): tutte won → `won`; ≥1 lost → `lost`; mix
  upcoming+won → `live`; void escluse dal calcolo; leg senza predizione corrispondente
  → trattata come `upcoming`/ignorata (definire esplicito). Pattern `lib/weekly-pick.test.ts`.
- Verifica UI reale da loggato **solo su prod dopo go-live** (preview non fa login —
  nota nota in memoria). Pre-go-live: visual check locale con dati mock.

## Confine del gate

- **Questo spec (UI + endpoint storico + risoluzione read-time + entry point) =
  frontend shippabile, NO gate.** Nessuna migration/flag/pagamento/scrittura DB. Con
  feature OFF la pagina è visibile ma la card mostra "in arrivo".
- **Go-live = PROPOSAL separata + APPROVE umano** (aggiornare
  `ops/PROPOSAL-WEEKLY-PICK-1.md`): apply migration 014 in prod, `WEEKLY_PICK_ENABLED=true`
  su Vercel, cron `weekly-pick/generate` in `vercel.json`, verifica rail PayGate, +
  OK Michele sul prezzo. Non si esegue nulla prima dell'APPROVE.

## Fuori scope (YAGNI)

- Nessuna nuova tabella per lo storico (join read-time sufficiente).
- Nessun ingresso in bottom-nav mobile (i featured esistenti sono desktop-only; se
  serve mobile è un follow-up separato).
- Nessun teaser nella landing anonima (non richiesto).
- Nessun refactor del monolite `app/page.tsx` oltre le due aggiunte puntuali.

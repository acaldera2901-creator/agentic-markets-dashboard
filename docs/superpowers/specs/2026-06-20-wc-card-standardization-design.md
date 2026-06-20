# Standardizzazione card World Cup (pagina /world-cup) — Design

**Data:** 2026-06-20
**Owner:** Andrea
**Stato:** design approvato in brainstorming (approccio B + blocco Gol), in attesa review spec

## Contesto e motivazione

Le card prediction sono di due "generazioni":
- **Calcio (`PredictionCard`) e tennis (`TennisMatchCard`)** nel feed principale `/app` →
  design **nuovo**: readout **Mercato/Modello/Edge** (`.mvm`), pallini **Confidenza**,
  e (calcio) **blocco Gol** (Over/Under + gol attesi/fascia). Vanno bene così.
- **World Cup** nella pagina dedicata **`/world-cup`** (componente
  `components/world-cup/WcBoard.tsx`, funzione `WcCard`) → design **vecchio**: barre
  HOME/DRAW/AWAY (`.rows`) + chip edge, **senza** `.mvm`, **senza** Confidenza,
  **senza** blocco Gol. Stonano rispetto a calcio/tennis.

Obiettivo: rendere le card WC della pagina `/world-cup` **visivamente e
strutturalmente identiche** alle card calcio/tennis, **incluso il blocco Gol**
(la WC ha già i λ in `enrichment.lambdas`, scritti dal Poisson nazionale).

## Approccio

**B — Allineare il markup di `WcCard` al design standard.** Si riscrive la sola
sezione "readout" di `WcCard` per emettere lo stesso `.mvm` + Confidenza + blocco
Gol del calcio, riusando le **classi CSS globali già esistenti** (`.mvm`, `.conf`,
`.goals-block`…, definite in `app/globals.css`, caricato anche su `/world-cup` dal
root `app/layout.tsx`) e le funzioni `computeGoalsSummary`/`computeExtraMarkets` di
`lib/poisson-model`.

Scartati: **A** (riusare `PredictionCard`) — vive nel monolite `app/app/page.tsx`,
non esportato, con molti hook di contesto non disponibili su `/world-cup`: estrazione
rischiosa. **C** (estrarre un componente condiviso) — refactor ampio, non richiesto ora.

## Scope

**Un solo file:** `components/world-cup/WcBoard.tsx`, funzione `WcCard`.
**Nessun CSS nuovo** (classi globali già esistenti). Nessuna modifica a dati/pipeline.

## Design

Nella `WcCard`, la sezione condizionale "outcome rows / gate overlay" diventa, a
specchio del calcio (`PredictionCard`):

1. **`p.locked`** → `lock-overlay` (invariato).
2. **`belowFloor`** (nessun favorito) → si **mantengono le barre oneste** (`.rows`
   HOME/DRAW/AWAY) + label flat "nessun favorito · match aperto" — come fa il calcio
   nel ramo belowFloor.
3. **pick chiaro** → **readout `.mvm`** identico al calcio:
   - **col Mercato:** `e.market` (prob. di mercato già de-viggata) per l'esito del pick;
     se assente `–`.
   - **col model (Modello):** prob. modello del pick (`probs[pick]`), label
     `Modello · {nome pick}` (HOME→squadra casa, AWAY→squadra trasferta, DRAW→"Pareggio").
   - **col edge (Edge):** edge di valore quando esiste quota reale
     (`p.signal_type==="signal" && p.edge_percent>0` → `+{edge_percent}%`), altrimenti `–`.
   - **Confidenza** (`.conf` con 4 `.dot` + `.conf-txt`): mostrata **solo quando
     edge di valore presente** (stessa condizione del calcio); valore confidenza
     derivato come nel calcio (`confidence_score` se presente, altrimenti da edge+prob).
   - quando **non** c'è edge di valore → label flat "nessuna quota · lettura del
     modello" (come il calcio senza quota). Coerente FTC (nessun claim).
   - La `.mvm` su `/world-cup` è **display-only** (niente betslip): nessun `onClick`,
     niente classe `sel`.
4. **Blocco Gol** (dopo il readout, quando `e.lambdas` presente):
   `{e.lambdas && <blocco gol>}` con gli stessi contenuti del calcio —
   `Gol attesi` + `Fascia più probabile` (da `computeGoalsSummary(λh, λa)`) e
   `Over 1.5/2.5/3.5` (da `computeExtraMarkets(λh, λa)`), stesse classi `.goals-block`.
5. **Resta invariato:** top (glifo WC), fixture + scorebar (live/programmato),
   sezione **Perché** + footer (`.why`/`.act`).

### Helper / dipendenze

- `pct` e `modelEdge`: già presenti/importati in `WcBoard.tsx`.
- `computeGoalsSummary`, `computeExtraMarkets`: **importare** da `@/lib/poisson-model`.
- Confidenza: `WcBoard` non ha `confidenceFromEdge` (vive in `page.tsx`, non esportato)
  → **replicare un piccolo helper locale** identico a quello del calcio
  (input: edge frazionario + probabilità → 0..100), così i pallini coincidono.
- i18n: seguire la convenzione già in uso in `WcBoard` (`useWcLang` + label inline/maps),
  **non** introdurre `pick5` (che è del monolite). Le etichette nuove (Mercato, Modello,
  Edge, Confidenza, label flat, Gol attesi, Fascia più probabile, gol) seguono lo stesso
  stile bilingue/multilingue già presente nel file.

## Dati disponibili (verificati in `WcCard`)

`probs` (p_home/draw/away da `notes`) · `pick` (HOME/DRAW/AWAY, null se belowFloor) ·
`belowFloor` · `e = p.enrichment` con `e.market` (p_home/draw/away), `e.lambdas`
(home/away), `e.form_*`, `e.matches` · `p.signal_type`, `p.edge_percent`.

## Cosa NON si tocca

Pipeline/dati WC · gating accesso · card calcio/tennis (già ok) · CSS globale ·
resto di `/world-cup` (gruppi, calendario, winner odds) · `PredictionCard`/`page.tsx`.

## Error handling / edge cases

- `e.market` assente → col Mercato `–` (no crash).
- `e.lambdas` assente o λ ≤ 0 → blocco Gol non renderizzato.
- `belowFloor` → barre, niente mvm/confidenza/edge.
- `p.locked` → solo overlay.
- Over sempre monotòni decrescenti (proprietà della distribuzione, come nel calcio).

## Piano di verifica

1. **Visual check su `/world-cup` da loggato Base+** (i pick sbloccati): una card WC
   mostra il readout Mercato/Modello/Edge + (se value) Confidenza + **blocco Gol**
   (Over 1.5 ≥ 2.5 ≥ 3.5, gol attesi + fascia), identica per impaginazione a una card
   calcio/tennis del feed `/app`. Confronto a fianco.
2. Card **belowFloor** → mostra le barre + "nessun favorito"; card **locked** →
   overlay invariato; card **senza quota** → label "nessuna quota · lettura del modello".
3. **Regressione:** resto di `/world-cup` (gruppi, calendario, winner odds) invariato;
   build verde; `tsc` senza nuovi errori.

## Note implementative

- Branch nuovo da `main`: `feat/wc-card-standardization` (worktree
  `~/Desktop/agentic-markets-wccard`).
- Rischio basso: un solo componente, additivo/sostitutivo nella sola sezione readout,
  CSS già esistente. Merge/deploy prod resta dietro **gate APPROVE**.

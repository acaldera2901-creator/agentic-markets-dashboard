# Spec — Ridisegno "Why" + "Deep Analysis" (calcio / tennis / World Cup)

**Data:** 2026-06-22 · **Owner:** Andrea via Claude Code · **Stato:** approvato (design), pre-plan

## Context

Le card prediction di BetRedge mostrano un testo **"Why"** (perché il modello fa quella
chiamata) e, per i premium, un pannello **"Deep Analysis"**. Entrambi sono stati scritti
quando avevamo meno dati. Oggi l'insieme è molto più ricco — gol attesi + fascia risultato +
Over/Under, **marcatori (player props)**, profili giocatore, copertura quote/Market-Edge, forma,
contesto (riposo/viaggio/casa), per tennis rating superficie/overall + H2H + match-su-superficie.

Obiettivo: **Why più sensato e capibile da tutti** (linguaggio semplice, intreccia i dati nuovi)
e **Deep Analysis completamente rivista** (lista compatta ripulita, jargon tradotto, dati nuovi),
sia lato calcio/WC sia tennis.

**Decisione chiave (Andrea):** testi **deterministici a template** (no LLM) — gratis, istantanei,
5 lingue controllate, FTC-safe (zero allucinazioni). Niente modifiche al modello/logica di
predizione: **solo presentazione** (testo + righe del pannello). Gating invariato.

## Goals

- Riscrivere i 3 generatori di Why (`buildFootballWhy`, `buildTennisWhy`, `buildWcWhy`) in
  linguaggio semplice, intrecciando i dati nuovi, con **tetto ~4 frasi brevi**.
- Rifare le 3 Deep Analysis (calcio inline, tennis inline, `DeepAnalysis` WC) come **lista
  compatta ripulita**: etichette in parole semplici, jargon tradotto, righe nuove, ordine intuitivo.
- Mantenere copertura **5 lingue** (it/en/es/fr/ru), onestà FTC, gating premium della Deep Analysis.

## Non-goals

- Nessun LLM. Nessuna modifica a modello/probabilità/edge. Nessun cambio di gating o di struttura
  card (readout Mercato/Modello/Edge + blocco Gol restano com'è). Nessun nuovo dato calcolato che
  non sia già disponibile sulla riga/enrichment.

## Dati disponibili (fonti già presenti)

- **Gol** (calcio/WC): da `lambda_home/away` (enrichment.lambdas su WC) via
  `lib/poisson-model.ts` → `computeGoalsSummary` (gol attesi totali, fascia più probabile + p) e
  `computeExtraMarkets` (Over 1.5/2.5/3.5). Già usati nel blocco Gol delle card.
- **Marcatori**: `enrichment.goalscorer_markets` (array; ogni item `name`, `side`, `pScores`,
  `marketImplied`, `edge`). Top scorer = max `pScores`.
- **Forma**: `enrichment.form_home/away` (string "WWDLL" o WcFormCounts {w,d,l}).
- **Modello vs Mercato / value**: `p_home/draw/away` (modello) vs `1/odds_*` (mercato implicito);
  `edge` (calcio frazionale) / `edge_percent` (WC %); `signal_type==="signal"` = value bet.
- **Tennis** (`TennisMatch`): `surface`, `p1/p2`, `elo_p1/p2` (rating superficie), `elo_p1/p2_overall`,
  `surface_matches_p1/p2`, `elo_raw_p1/p2` (prob modello), `h2h_p1_wins/p2_wins`.
- **Contesto WC**: `venue.travel_km_*`, `venue.rest_days_*`, `venue.host_advantage`,
  `squad.injuries_*`, `matches.home/away` (campione internazionali).
- **Calcio club**: `xg_*`, `npxg_*`, `ppda_*`, `pi_*` (rating), `injuries_*`, `weather`,
  `api_pct_*`, `extra_markets[]`, `research` (testo AI).

## Design — Nuovo "Why" (deterministico, ~4 frasi, lingua semplice)

Regola trasversale: **prioritizzazione** (non tutte le frasi sempre); niente sigle tecniche nel
Why (le sigle vivono nella Deep Analysis); tono "racconto", non elenco; onestà FTC sempre.

### Calcio / World Cup (`buildFootballWhy`, `buildWcWhy`)

Frasi, in quest'ordine di priorità (assembla fino a ~4):

1. **La chiamata, semplice** — favorito + intensità in parole comuni:
   - `tp >= 65` → "X parte favorito netto." · draw-top → "Il modello vede l'equilibrio reggere."
   - `45 ≤ tp < 65` → "Partita aperta, X leggermente avanti." · below-floor/`tp < 45` →
     "Equilibrio: nessun favorito netto."
2. **Forma a parole** — da form counts, NO sigle:
   - ≥3 vinte su ultime 5 → "X arriva da {n} vittorie nelle ultime 5." · buon momento / fatica /
     altalena (riusa la logica `formMoodWord`, ma resa come frase). Se entrambe note, confronto
     ("…, mentre Y fatica").
3. **Storia gol** — da `computeGoalsSummary` + `computeExtraMarkets`:
   - "Partita da ~{eg.toFixed(0)} gol (fascia {band}), Over 2.5 al {overPct}%."
   - Mostrata solo se λ disponibili (calcio club ha λ? se assente, salta).
4. **Marcatore chiave** — da `goalscorer_markets` (top per pScores), solo se ≥ soglia leggibile:
   - "Occhio a {name}: primo candidato al gol ({pct}%)."
5. **Confidenza + onestà FTC** — confidenza in parole ("lettura solida"/"più incertezza") legata
   al motivo (campione piccolo `matches < 10`, o equilibrio) + riga value:
   - value bet → "Il modello la dà più probabile della quota: da qui il valore{su esito}."
   - no value → "Il mercato è già in linea: nessun margine di valore."
   - no quota → "Non c'è una quota di mercato: è la lettura del modello, non una value bet."

Cap: scegliere al massimo 4 tra (1 sempre) + (2,3,4 se dati presenti) + (5 sempre, accorpa value+
confidenza in una frase). World Cup aggiunge, se presente, mezza frase host ("X gioca in casa").

### Tennis (`buildTennisWhy`)

1. **Chiamata + superficie** — "Sull'erba il modello vede {fav} {favorito netto/di misura}."
   · equilibrio (`gap ≤ 0.06`) → "Match equilibrato sull'erba: nessun favorito reale." · TBD →
   lettura provvisoria.
2. **Perché su questa superficie** — da rating superficie + match giocati, in parole:
   - △rating ≥60 → "dove ha un netto vantaggio su questa superficie" · ≥15 → "dove parte un po'
     più in alto" · + match-su-superficie se notevole ("con {n} match giocati qui").
3. **Testa a testa** — se `h2h` rilevante: "e conduce gli scontri diretti {a}-{b}."
4. **Confidenza + onestà FTC** — come calcio (value / in-linea / no-quota), confidenza a parole.

Cap ~4 frasi. Tennis non ha gol/marcatori.

## Design — Nuova "Deep Analysis" (lista compatta ripulita, premium-only)

Resta la struttura `.deep-analysis-panel` → righe `.da-row` (label → value). Cambia: **etichette
in parole semplici**, **jargon tradotto**, **righe nuove**, **ordine intuitivo**. Le righe si
renderizzano solo se il dato è presente (fail-soft, invariato).

### Calcio / World Cup (ordine)

| Riga (label nuova)   | Fonte                         | Note |
|----------------------|-------------------------------|------|
| Gol attesi           | `computeGoalsSummary` (λ) o `xg_*` | "2.3 vs 1.6" |
| Risultato probabile  | `computeGoalsSummary.band`    | "2-3 gol (47%)" — NUOVA |
| Over 2.5             | `computeExtraMarkets`         | "58%" — NUOVA |
| Forma                | `form_*`                      | "4V/5 vs altalena" (parole) |
| Marcatore top        | `goalscorer_markets`          | "Mbappé 51%" — NUOVA |
| Pressing             | `ppda_*`                      | (era PPDA) — opzionale, solo se presente |
| Infortuni            | `injuries_*` / `squad.injuries_*` | "H:1 · A:2" |
| Riposo / Viaggio / In casa | `venue.*` (WC)          | "3g vs 2g" / "in casa: Spagna" |
| Meteo                | `weather`                     | invariato |
| Modello vs Mercato   | `p_*` vs `1/odds_*` (+`edge`) | "64% vs 58% (+6.0%)" — NUOVA/riformulata |

Rimuovere dalle righe il jargon non spiegabile a tutti (npxG, API-FB, Rating Pi grezzo): npxG e
api_pct si **omettono** dalla lista (restano nei dati, non mostrati); "Rating" → "Forza" se mantenuto.

### Tennis (ordine)

| Riga (label nuova)        | Fonte                | Note |
|---------------------------|----------------------|------|
| Forza sulla superficie    | `elo_p1/p2`          | (era "Rating CLAY") |
| Forza generale            | `elo_*_overall`      | (era "Overall rating") |
| Match su questa superficie| `surface_matches_*`  | |
| Probabilità modello       | `elo_raw_*`          | "58% vs 42%" |
| Testa a testa             | `h2h_*`              | "5-3" |

## File toccati

- `app/app/page.tsx`:
  - `buildFootballWhy` (~4156), `buildTennisWhy` (~4233) → riscrittura testo.
  - helper forma in parole (`formMoodWord`/`teamFormCounts` ~4142) → estendere a frase "n vinte su 5".
  - Deep Analysis calcio JSX (~4682) e tennis JSX (~5073) → nuove righe/label/ordine.
  - Riuso `computeGoalsSummary`/`computeExtraMarkets` da `lib/poisson-model.ts` (già importati per il blocco Gol).
- `components/world-cup/WcBoard.tsx`:
  - `buildWcWhy` (~273) → riscrittura.
  - `DeepAnalysis` (~160) → nuove righe/label/ordine.
- Stringhe i18n nelle 5 lingue: inline negli stessi file (pattern esistente `pick5`/ternari WcLang).

Nessun cambio a gating, projection, schema, modello.

## Verifica

- **Test**: i 3 generatori Why sono funzioni pure → aggiungere/aggiornare test (vitest se esiste
  infra per il file; altrimenti smoke manuale) per i casi: favorito netto / equilibrio / below-floor /
  no-quota / value / campione piccolo / con-marcatore / senza-marcatore / TBD (tennis).
- **tsc --noEmit** pulito sui file toccati.
- **Visual check da loggato Pro** su prod (post-deploy, come da regola): Why leggibile su una card
  calcio, una tennis, una WC; Deep Analysis nuova su ognuna (premium). Verificare fail-soft quando
  un dato manca (riga assente, nessun crash).
- **5 lingue**: spot-check almeno IT + EN.

## Rischi / note

- Lunghezza Why: rispettare il cap ~4 frasi (prioritizzazione) per non gonfiare la card.
- FTC: mai dichiarare value senza quota reale; confidenza descrittiva, non promesse.
- Dati mancanti: ogni frase/riga è condizionale → fail-soft (già il pattern attuale).

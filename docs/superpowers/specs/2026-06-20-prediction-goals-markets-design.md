# Mercati gol nelle schede prediction calcio — Design

**Data:** 2026-06-20
**Owner:** Andrea
**Stato:** spec approvata in brainstorming, in attesa di review prima del piano

## Contesto e motivazione

Sbostats (competitor IT) sulle sue card mostra, oltre all'1X2, dati sui gol:
over/under, "media gol", risultati più frequenti — ma calcolati come **frequenze
storiche** incasellate per quota di apertura (descrittivo, retrospettivo, generico).

BetRedge serve oggi **solo l'1X2** nelle schede prediction calcio. Vogliamo dare
all'utente **più opzioni sui gol** per la singola partita, sfruttando il fatto che
il nostro motore è **generativo**: il modello Poisson/Dixon-Coles
(`lib/poisson-model.ts`) produce la **distribuzione congiunta sui risultati esatti**
(gol casa × gol trasferta), da cui ogni mercato derivato è una somma di celle. Quindi
diamo **probabilità calibrate per quella specifica partita**, non frequenze storiche.

**Scoperta chiave (verificata nel codice):** Over/Under 1.5/2.5/3.5 (e BTTS, doppia
chance) sono **già calcolati** da `computeExtraMarkets()` (`lib/poisson-model.ts:165-205`)
e finiscono in `enrichment.extra_markets`, ma **nessun componente UI li renderizza**.
Il lavoro è quindi quasi solo di **display**, non di modellazione.

## Scope

Aggiungere alle schede prediction **calcio** del sito un blocco "Gol" che mostra:

```
Gol attesi: 2.6   ·   Fascia più probabile: 2–3 gol (44%)
Over 1.5: 78%   Over 2.5: 54%   Over 3.5: 31%
```

- **Gol attesi** = λ_casa + λ_trasferta (già nel modello).
- **Fascia più probabile** = intervallo `[floor(gol_attesi), ceil(gol_attesi)]` con la
  sua probabilità, ricavata dalla distribuzione totale-gol. Es. gol attesi 2.6 → fascia
  `2–3 gol`, P(totale ∈ {2,3}). Definizione **deterministica** (bracket attorno ai gol
  attesi), non una ricerca della finestra a massima probabilità: scelta apposta per
  semplicità e per coerenza con il valore "gol attesi" mostrato accanto. La label UI
  resta "fascia più probabile" perché per gol attesi non interi questo bracket è di
  fatto la coppia di totali contigui più probabile.
- **Over 1.5 / 2.5 / 3.5** = già in `extra_markets`.

**Gating:** visibile **da Base in su**, come l'1X2. Anonimo/free lo vedono lockato
(stesso comportamento del pick 1X2 esistente — riusa il `LockedGate` già in uso).

**Framing copy (FTC-onesto):** sono **probabilità calibrate del modello** per quella
partita. **Mai** un claim di tipo "X% vincenti" / win-rate. Coerente con la regola
"dimostra l'edge senza overclaim" (`feedback_perche_dimostra_edge`).

## Fuori scope (esplicito)

- **Card social / Telegram** (stile SBOTIPS): NON in questo lavoro. Eventuale fase
  successiva via Maven Studio (`~/Desktop/accelerator/studio/`), stessa source of truth.
- **Risultati esatti più probabili** e **BTTS / doppia chance**: calcolati ma non
  mostrati ora (Andrea ha scelto solo Over/Under + gol attesi).
- **Settlement e track record** dei mercati gol: nessun claim di accuratezza ⇒ nessun
  settlement nuovo, nessuna riga `pick_ledger`/`pick_settlement`, nessuna modifica schema.
- **Modello statistico**: invariato. Nessuna ricalibrazione.
- **Tennis / altri sport**: solo calcio.
- **Gol 1°/2° tempo**: non calcolabile (richiede dato time-split che non ingeriamo).

## Design

### Unità 1 — `computeGoalsSummary()` in `lib/poisson-model.ts`

Nuova funzione esportata, **affiancata** a `computeExtraMarkets()` (non ne cambia la
firma né i chiamanti esistenti):

```ts
export interface GoalsSummary {
  expected_goals: number;        // λ_casa + λ_trasferta, arrotondato a 1 decimale
  band_low: number;              // floor(expected_goals)
  band_high: number;             // ceil(expected_goals)  (= band_low se intero)
  band_p: number;                // P(totale gol ∈ [band_low, band_high]), 0..1
}

export function computeGoalsSummary(
  lambdaHome: number,
  lambdaAway: number
): GoalsSummary
```

Implementazione: stesso doppio loop `i,j` su `poisson(i, λH) * poisson(j, λA)` già usato
in `computeExtraMarkets` (N=9). Accumula `pTotal[i+j] += p`. Poi:
- `expected_goals = round1(λH + λA)`
- `band_low = floor(expected_goals)`, `band_high = ceil(expected_goals)`
- `band_p = somma di pTotal[t] per t in [band_low, band_high]`, arrotondato a 4 decimali.

Caso limite: gol attesi interi (es. 2.0) ⇒ band_low = band_high = 2, band_p = P(totale = 2).

### Unità 2 — persistenza in `enrichment`

Nel punto in cui oggi viene calcolato `extra_markets`
(`app/api/predictions/route.ts`, ~riga 835), aggiungere:

```ts
const goals_summary = computeGoalsSummary(lH, lA);
// enrichment: { ...extra_markets, goals_summary }
```

`goals_summary` vive accanto a `extra_markets` dentro `enrichment` (campo JSONB già
esistente in `unified_predictions`). **Nessuna modifica allo schema DB.**

### Unità 3 — sub-componente UI "Gol" nella card prediction

Nuovo componente (es. `GoalsBlock`) che:
- legge `enrichment.extra_markets` (filtra `over_1_5`, `over_2_5`, `over_3_5`) e
  `enrichment.goals_summary` dalla prediction già servita;
- renderizza il blocco sotto l'1X2 con il layout mostrato sopra;
- mostra le probabilità in **percentuale** (es. `Over 2.5: 54%`), arrotondate all'intero;
- è soggetto allo **stesso gating per tier** del pick 1X2: per anonimo/free appare
  lockato (riusa `LockedGate`); per Base+ è visibile.
- appare **solo per il calcio** (gli altri sport non hanno `goals_summary`).

Segue lo stile visivo delle card esistenti (no shadcn drop-in: il monolite CSS-context,
vedi `project_dashboard_web_architecture`).

### Cosa NON viene toccato

Modello statistico · 1X2 · `computeExtraMarkets()` (firma e callers) · schema DB ·
`pick_ledger` / `pick_settlement` · settlement · Maven Studio · tennis/WC.

## Flusso dati

```
Poisson model (λH, λA)
   ├─ computeExtraMarkets()  → extra_markets[] (over_1_5/2_5/3_5 già presenti)
   └─ computeGoalsSummary()  → goals_summary {expected_goals, band, band_p}   [NUOVO]
        ↓ (entrambi in enrichment JSONB di unified_predictions)
   API /api/predictions  → prediction servita (gating per tier già applicato)
        ↓
   GoalsBlock (UI)  → render "Gol" sotto l'1X2, Base+ visibile / free lockato
```

## Error handling / edge cases

- `goals_summary` assente (sport ≠ calcio, o prediction vecchia pre-feature): il
  `GoalsBlock` non si renderizza (return null). Nessun crash, nessun placeholder vuoto.
- λ mancanti/NaN: `computeGoalsSummary` non viene chiamata se il modello non ha prodotto
  λ; in difetto restituisce comunque un oggetto coerente solo con λ validi (>0).
- Probabilità sempre clampate/normalizzate dalla distribuzione (somma celle ≤ 1; il
  troncamento a N=9 è già la convenzione di `computeExtraMarkets`, manteniamo identica).

## Piano di verifica

1. **Test unitario** su `computeGoalsSummary`: dati λ noti (es. λH=1.5, λA=1.1 ⇒ gol
   attesi 2.6, fascia [2,3]) verifica `expected_goals`, `band_low/high` e che `band_p`
   coincida con la somma diretta di `pTotal[2]+pTotal[3]`. Verifica anche il caso λ interi.
   Sanity: gli Over devono essere monotòni decrescenti (O1.5 ≥ O2.5 ≥ O3.5).
2. **Visual check sul sito da loggato Base** (`feedback_visual_check_loggato`): il blocco
   Gol appare sotto l'1X2 su una partita di calcio reale, numeri coerenti; da
   anonimo/free appare lockato.
3. **Regressione**: le card non-calcio e l'1X2 esistente invariati.

## Note implementative

- **Branch:** partire da `main` con un branch nuovo (es. `feat/prediction-goals-markets`).
  Il branch corrente `feat/maven-studio` è OBSOLETO (Studio spostato in `accelerator/`),
  **non** continuare lì.
- Rischio basso (display-only, additivo, nessun DB/settlement). Il gate di approvazione
  resta per il merge/deploy in prod, ma non ci sono operazioni irreversibili nello sviluppo.

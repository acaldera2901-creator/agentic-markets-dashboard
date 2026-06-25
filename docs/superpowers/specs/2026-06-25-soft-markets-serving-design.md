# Mercati soft (corner / cartellini / falli) sulle card — design

**Data:** 2026-06-25 · **Stato:** design approvato in brainstorming, da rivedere prima del piano
**Owner:** Andrea (decisioni) · esecuzione Claude · **gate:** SP2 tocca prod → PROPOSAL + APPROVE

## Contesto e validazione (fatto)

Lo stack BetRedge è gol-only (Dixon-Coles + TS Poisson). I mercati soft erano fuori
scope. Backtest **walk-forward** (zero leakage) su **5.346 match reali** (top-5 EU +
5 estive, stagioni 2023+2024, esiti via api-football Ultra `/fixtures/statistics`):

| Mercato | Modello vs baseline media-lega | ECE | Verdetto |
|---|---|---|---|
| Falli | **+10.1%** Brier | 0.043 | forte, aggiunge informazione |
| Cartellini | **+1.8%** Brier | 0.047 | lieve ma positivo |
| Corner | −1% (baseline meglio) | 0.053 | nessuna skill, ma calibrato/unbiased (λ 9.87 vs 9.89) |

**Quote storiche soft NON esistono** (api-football forward-only, The Odds API non copre
il calcio soft) → "battiamo il book" **non dimostrabile** ora. Quindi si serve come
**STIMA DEL MODELLO CALIBRATA**, non come edge-vs-book. L'edge-claim arriverà dalla
raccolta forward (spike `io.maven.softmarkets.collect`) quando avrà abbastanza coppie.

## Decisioni (Andrea, 2026-06-25)

1. **Tutti e 3** sulle card. Corner inclusi come **stima generica calibrata** (λ tassi
   calibrati, nessun claim di skill/edge). Falli/cartellini col modello team-aware.
2. **Accesso: solo Pro** (lockato/blurrato per Free/Base, coerente col gating esistente).
3. **Framing onesto**: "attesi ~X · P(over linea) Y%", etichetta = stima del modello.
   Mai "edge sul bookmaker". Niente numero di edge sui soft.

## Architettura

Riusa il modello league-agnostic dello spike (Python). Tre unità isolate:

### 1. Predictor job (Python, nuovo — estende lo spike)
- **Cosa fa:** per i fixture imminenti (finestra serving) delle leghe servite, calcola
  per ogni mercato λ totale → P(over) sulle linee standard + valore atteso + confidenza.
  Falli/cartellini: tassi team-aware (forma recente, shrinkage). Corner: tasso calibrato
  (skill neutra). Stessa matematica di `analyze_backtest.py`, già validata.
- **Input:** tassi-squadra da api-football Ultra (recent `/fixtures/statistics`), già
  raccolti da `collect.py` (`team_match_stats`). Riusa la chiave `API_FOOTBALL_DIRECT_KEY`.
- **Output:** scrive in `soft_predictions` (Supabase prod). Idempotente (upsert per match).
- **Schedule:** **nuovo launchd dedicato** (isolato, come `io.maven.softmarkets.collect`),
  NON dentro il daemon `agents` (evita di accoppiarlo alla pipeline gol). Cadenza ≤2h,
  allineata al refresh board.
- **Leghe servite:** le **10 leghe club** (top-5 EU quando in stagione + 5 estive). **WC
  esclusa** dai soft (nazionali = dati troppo rumorosi, varianza alta; ha già il suo path).
- **Dipende da:** Ultra key, Supabase service role, modello (shared con backtest).

### 2. Tabella `soft_predictions` (Supabase)
Chiave per-match + per-mercato. Campi minimi:
`match_key` (team-norm + data), `league`, `home`, `away`, `kickoff`,
`market` (corners|cards|fouls), `expected` (λ), `main_line`, `p_over`, `confidence`,
`model_version`, `is_generic` (true per corner), `computed_at`.
Settlement (forward, per track record): `actual`, `settled_at`.

### 3. Blocco card (TS, frontend)
- Nuovo blocco "Corner / Cartellini / Falli attesi" sotto il blocco Gol, **stesso stile**
  (readout, niente barre — coerente con lo standard struttura card).
- Legge `soft_predictions` matchando il fixture (team-norm + data, riusa la logica di
  name-matching già esistente per le odds).
- **Pro-only**: stesso `LockedGate` degli altri blocchi premium. Free/Base → blurrato.
- Corner etichettato come stima generica (micro-nota), falli/cartellini come stima modello.

## Data flow

```
api-football Ultra (stats squadra)  ──►  Predictor job (Python)
                                              │  λ, P(over), confidenza
                                              ▼
                                   soft_predictions (Supabase)
                                              │
                                              ▼  match per team-norm+data
                            Card TS (blocco soft, Pro-only)  ──►  utente Pro
                                              ▲
            api-football stats (esiti reali) ─┘  settlement forward (track record)
```

## Error handling
- Predictor fail-soft per match: se mancano tassi-squadra (warmup < soglia) → salta quel
  match/mercato (non scrive riga incompleta), non blocca gli altri.
- Card fail-soft: nessuna `soft_predictions` per il fixture → blocco non renderizzato
  (mai placeholder/valori finti).
- Matching fallito (nomi) → blocco assente per quel match (fail-closed, come le odds).

## Testing / verifica
- Unit: matematica λ/P(over) (già coperta dal backtest), parsing stats, name-matching.
- Integrazione: predictor scrive righe sane per un set di fixture noti; card le legge e
  rende il blocco; gate Pro verificato loggato (Free/Base blurrato).
- Verifica reale (Costruito≠Verificato): predizioni soft visibili su una card prod Pro,
  e settlement che popola `actual` dopo le partite.

## Fuori scope (esplicito)
- Claim di edge-vs-book sui soft (serve la raccolta forward → fase futura).
- Mercati soft oltre i 3 (1H, handicap, team-totals): no.
- Refactor della pipeline gol/board: no (isolato).

## Rischi
- **Name-matching** Python-predictor ↔ board TS: stesso rischio delle odds. Mitigazione:
  riusare la normalizzazione esistente; fail-closed.
- **Copertura tassi-squadra** per leghe minori/estive a inizio stagione (warmup): alcuni
  match senza blocco finché non c'è storia sufficiente. Accettabile.
- **Corner generico** percepito come "debole": mitigato dall'etichetta onesta.

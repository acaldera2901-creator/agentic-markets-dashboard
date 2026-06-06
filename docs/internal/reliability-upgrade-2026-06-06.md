# Reliability Upgrade — Reverse Engineering & Migliorie Misurate

**Data:** 2026-06-06
**Autore:** ML Engineer (su richiesta di Andrea)
**Scope:** read-only sul DB Supabase aziendale + dataset locali. Zero scritture, zero commit/deploy.
**Base di partenza:** `docs/internal/calibration-backtest-2026-06-06.md` (report di stanotte).
**Verdetto in una riga:** la singola leva che alza davvero l'affidabilità è **blendare verso il mercato** (Brier 0.599→0.58, accuracy +3pt, sistema il segmento underdog dove perdiamo). Ma **non esiste edge dimostrabile** oltre la closing line: blendare migliora la calibrazione, non crea valore. Le due cose vanno separate nel prodotto.

---

## FASE 1 — Reverse engineering: cosa entra DAVVERO nelle probabilità servite

### Pipeline football servita al cliente (end-to-end)
1. `app/api/predictions/route.ts` → `computeAndStore()` (cron POST, ogni run):
   - Carica storico via `lib/football-data.ts` (`fetchHistory`, football-data.org).
   - `buildModel()` + `predict()` in `lib/poisson-model.ts` — **Poisson bivariato indipendente** con:
     - shrinkage bayesiano verso media-lega (`SHRINKAGE_PRIOR=4`),
     - gate min-match (`MIN_MATCHES_PER_TEAM=4` → flag `insufficient_data`),
     - **blend xG** (`XG_BLEND_WEIGHT=0.5`): le multipliche attacco/difesa sono mediate con `xg/xga` da Understat (`lib/understat.ts`, cache tabella `understat_cache`).
   - Scrive in `match_predictions` (DB) → `unified_predictions` via `lib/unified-adapter.ts`.
2. `GET /api/predictions` legge `match_predictions`, calcola `edge = p_modello − 1/odds` solo se ci sono odds reali e `reliable=true`, proietta per tier.

### Features che ENTRANO nel numero servito (il λ Poisson)
| Feature | Entra nei λ? | Fonte |
|---|---|---|
| Goal segnati/subiti casa/trasferta (ratio shrinkato) | **Sì — è il cuore** | storico football-data.org |
| xG/xGA last-10 (blend w=0.5) | **Sì** (V4, merge 99d7bbf) | Understat |
| Media gol lega (avgHome/avgAway) | Sì | storico |
| Vantaggio campo | Sì (implicito in avgHome>avgAway + split casa/trasf.) | storico |

### Features CALCOLATE ma che NON entrano nel numero (solo display/enrichment)
| Feature | Stato | Dove finisce |
|---|---|---|
| Pi-rating | calcolato, **solo enrichment** | `enrichment.pi_home/away` |
| Form (ultime N) | calcolato, **solo enrichment** | `enrichment.form_*` |
| Meteo | fetch <48h, **solo enrichment** | `enrichment.weather` |
| Infortuni (API-Football) | fetch, **solo enrichment** | `enrichment.injuries_*` |
| Predizione API-Football | fetch, **solo enrichment** | `enrichment.api_pct_*` |
| Quote di mercato | usate **solo per edge a posteriori**, NON entrano nelle probabilità | The Odds API |
| Movimento quote (open→close) | **non raccolto nel serve** | — |

**Diagramma sintetico:**
```
storico gol ──┐
xG Understat ─┼─► ratings shrinkati ─► λ_home, λ_away ─► griglia Poisson 0..10 ─► p(H/D/A) ─► SERVITO
              │
form/pi/meteo/infortuni/quote ─► (solo enrichment, NON tocca p) ─► display
```
**Punto chiave:** il mercato (la fonte predittiva più forte in assoluto, vedi Fase 4) **non entra nelle probabilità servite.** È usato solo per calcolare l'edge a posteriori. Questo è il grosso buco.

---

## FASE 2 — Inventario dati: disponibili vs realmente usabili

Verifica fill-rate reale sul DB (psql read-only), non solo esistenza schema. **La maggior parte dei candidati del brief sono tabelle VUOTE.**

| Tabella | Righe | Usabile come feature? | Note |
|---|---|---|---|
| `tennis_predictions` | 16.578 | sì (tennis) | dedup → ~poche centinaia di match unici (vedi report notte) |
| `elo_ratings` | 1.502 | sì **ma è TENNIS** (player/clay/grass/hard) | nessun Elo football in DB |
| `wc_squad_players` | 1.245 | parziale (WC, Track A) | oggi solo gate, non feature numerica |
| `league_profiles` | 6 | sì (priors lega) | market_efficiency, predictability, avg_xg, recommended_edge_min |
| `bets` | 160 | parziale | odds+selection+status; **`profit_loss` NULL**, niente 1X2 completo, niente goals |
| `unified_predictions` | 141 | no prob. football persistite | non calibrabile |
| `fixtures_enriched` | **0** | NO | vuota (il brief la dava come popolata: non lo è) |
| `odds_snapshots` | **0** | NO | nessun movimento quote storicizzato |
| `understat_cache` | **0** | NO live | i dati xG storici vivono nei CSV `data/understat/`, non in DB |
| `derby_registry` | **0** | NO | vuota |
| `feature_memory` | **0** | NO | vuota |
| `error_patterns_log` | **0** | NO | vuota |
| `data_trust_log` | **0** | NO | vuota |
| `prediction_reasoning`/`explanations` | **0** | NO | vuote |
| `match_predictions` | **0** | — | il serve è on-the-fly, nulla persistito |

**Dati realmente sfruttabili per un backtest serio (fuori DB, nei CSV locali):**
- `data/football_data_uk/` — **5 leghe × 5 stagioni (2021-2025), ~9.000 match con quote bookmaker** (Pinnacle closing PSCH/D/A, media mercato AvgC, apertura PSH). Questo è il dataset che mancava al report di stanotte: contiene **odds + esito**. È la base di Fase 4.
- `data/understat/` — xG per-match 2021-2024, 5 leghe (joinabile per data+team).

**Conclusione Fase 2:** la frase "incrocia dati che non stiamo calcolando" si scontra con la realtà: le tabelle DB candidate sono vuote. I dati che muovono l'ago **esistono già nei CSV** (quote storiche + xG) ma il serve usa solo i gol+xG, **non il mercato**.

---

## FASE 3 — Error analysis: DOVE sbagliamo (harness walk-forward, 8.575 match)

`scripts/reliability_segments.py` — Poisson v1 vs market vs blend, sliced.

### Per fascia di quota del pick del modello
| Band quote | n | hit Poisson | hit mercato | Brier base | Brier blend |
|---|---|---|---|---|---|
| 1.00–1.60 | 2199 | 0.721 | 0.721 | 0.449 | 0.432 |
| 1.60–1.85 | 1496 | 0.574 | 0.574 | 0.590 | 0.578 |
| 1.85–2.10 | 1256 | 0.500 | 0.500 | 0.636 | 0.624 |
| 2.10–2.50 | 1608 | 0.435 | 0.435 | 0.667 | 0.652 |
| **2.50+** | **2016** | **0.308** | **0.434** | 0.693 | 0.654 |

### Per DIVERGENZA dal mercato (la fotografia più importante)
| \|p_modello − p_mercato\| sul pick | n | hit Poisson | hit mercato | hit blend a=0.3 |
|---|---|---|---|---|
| 0.00–0.05 (d'accordo) | 3091 | 0.545 | 0.544 | 0.544 |
| 0.05–0.10 | 2570 | 0.518 | 0.533 | 0.528 |
| 0.10–0.20 | 2387 | 0.483 | 0.548 | 0.537 |
| **0.20+ (massimo disaccordo)** | **527** | **0.423** | **0.545** | 0.507 |

**Findings (provati, non ipotesi):**
1. **L'ipotesi del brief è confermata in pieno:** quando il modello è d'accordo col mercato è bravo quanto il mercato (54.5%); quanto più diverge, tanto più sbaglia. Al massimo disaccordo (>0.20) il modello fa 42.3% dove il mercato fa 54.5% **sugli stessi match**. Il modello, quando "vede valore", per lo più sta sbagliando.
2. **Il segmento perdente del report (odds>2.10) è confermato:** sui longshot (2.50+) Poisson azzecca 30.8% vs 43.4% del mercato. È lì che si perde.
3. **Il draw è il punto cieco:** il modello pick "X" solo 28 volte su 8.575 e quando lo fa azzecca il 32%. Il Poisson indipendente sotto-pesa strutturalmente i pareggi.

---

## FASE 4 — Migliorie testate (harness `scripts/reliability_experiments.py`)

Walk-forward, 8.575 predizioni held-out (4.288 in eval out-of-sample), 5 leghe × 5 stagioni. Mercato = Pinnacle closing de-viggata (riferimento/ceiling).

| Modello | Brier | logloss | acc | ECE | Δ Brier vs base |
|---|---|---|---|---|---|
| **Mercato (Pinnacle de-vig)** | **0.5791** | 0.9727 | 0.538 | 0.020 | +0.0195 (ceiling) |
| Poisson v1 (servito, baseline) | 0.5986 | 1.0019 | 0.506 | 0.012 | — |
| xG-blend Poisson (V4 servito) | 0.5975 | 1.0000 | 0.511 | 0.014 | +0.0010 |
| **blend base a=0.2** (80% mercato) | **0.5802** | 0.9744 | 0.535 | 0.019 | **+0.0184** |
| blend base a=0.3 | 0.5812 | 0.9761 | 0.532 | 0.020 | +0.0174 |
| blend base a=0.5 | 0.5844 | 0.9809 | 0.527 | 0.015 | +0.0142 |
| blend xgb a=0.6 | 0.5862 | 0.9834 | 0.525 | 0.007 | +0.0123 |
| isotonic recal (base) | 0.6006 | 1.0048 | 0.507 | 0.022 | **−0.0020 (peggiora)** |
| isotonic recal (xgb) | 0.5994 | 1.0033 | 0.508 | 0.024 | −0.0008 |
| underdog-shrink beta=0.3 | 0.5875 | 0.9849 | 0.518 | 0.019 | +0.0110 |
| blend a=0.2 + isotonic | 0.5801 | 0.9743 | 0.538 | 0.013 | +0.0185 |

### Robustezza out-of-sample (`scripts/reliability_robustness.py`)
α selezionato sulle stagioni passate, applicato alla stagione successiva held-out:

| Stagione eval | n | α* scelto | Brier base | Brier blend | Brier mercato |
|---|---|---|---|---|---|
| 2022 | 1812 | **0.0** | 0.604 | 0.581 | 0.581 |
| 2023 | 1745 | **0.0** | 0.593 | 0.566 | 0.566 |
| 2024 | 1746 | **0.0** | 0.590 | 0.571 | 0.571 |
| 2025 | 1746 | **0.0** | 0.598 | 0.582 | 0.582 |

**L'ottimo out-of-sample è α=0 ogni stagione** → in aggregato il modello non aggiunge nulla alla closing line; più peso al mercato = meglio è. Il blend è monotòno: qualsiasi α<1 aiuta.

### Test ROI (l'unico test onesto di edge)
Flat-stake 1u su ogni pick +EV alle closing odds, su tutti gli ~10k match:

| Strategia | bets | profit | ROI |
|---|---|---|---|
| Poisson v1 | 10.566 | −753.6u | −7.13% |
| blend a=0.5 | 9.400 | −738.1u | −7.85% |
| blend a=0.3 | 8.096 | −708.0u | −8.75% |

**Nessuna strategia batte la closing line.** Tutte perdono ~7-9%. Blendare migliora la *calibrazione* ma **non crea edge** — non può, perché la closing line contiene già tutto. Questo è il risultato atteso e onesto su mercati liquidi.

### Classifica migliorie (ordinata per affidabilità/costo)
| # | Miglioria | Δ Brier | Δ acc | Robusta? | Costo impl. | Verdetto |
|---|---|---|---|---|---|---|
| 1 | **Market blend** (α basso, ~0.2-0.3) | **+0.018** | **+3pt** | Sì (ogni stagione) | ~1-2 gg (serve persistere quote) | **Adottare** |
| 2 | Persistenza prob servite | abilita misura | — | — | ~0.5 gg | **Prerequisito** |
| 3 | xG blend (già live) | +0.001 | +0.5pt | sì ma trascurabile | già fatto | tenere, neutrale |
| 4 | Underdog-shrink selettivo | +0.011 | +1pt | sì | ~0.5 gg | dominato dal blend, non serve |
| 5 | Isotonic recalibration | **−0.002** | 0 | no | ~1 gg | **NON fare** (Poisson già calibrato) |
| 6 | Dixon-Coles promozione | −0.04 | −2pt | — | — | **NON fare** (gate chiuso, vedi report notte) |

**Sorpresa controintuitiva (la richiesta "sorprendimi"):** la cosa più efficace NON è aggiungere feature nostre (form/infortuni/xG danno ~0). È **smettere di fidarci del modello quando diverge dal mercato** e lasciare che sia il mercato a guidare. Il nostro valore non è battere la line: è darne una versione calibrata, leggibile e arricchita.

---

## FASE 5 — PROPOSAL (gate: NON implementare senza APPROVE umano)

### PROPOSAL A — Persistenza delle probabilità servite (prerequisito)
- **Task:** persistere le probabilità football che oggi vengono calcolate on-the-fly e buttate, così da poter misurare la calibrazione *live* (oggi strutturalmente impossibile: `match_predictions`/`predictions` vuote).
- **Approccio:** già esiste l'INSERT in `match_predictions` dentro `computeAndStore()`. Il buco è a valle: i settled non conservano (prob, odds, esito). Aggiungere uno snapshot immutabile al settlement.
- **COSA CAMBIERÀ ESATTAMENTE:**
  - File: `lib/unified-adapter.ts` (o nuovo `lib/prediction-log.ts`) + nuova tabella `prediction_log` (append-only: match_id, kickoff, p_home/draw/away, lambda_home/away, odds_home/draw/away, market_p_home/draw/away de-vig, model_version, computed_at).
  - DB Supabase: `CREATE TABLE prediction_log` (additiva, nessuna tabella esistente toccata).
  - Settlement job: alla chiusura match scrive `result` accanto allo snapshot.
  - prima→dopo: prima nessuna prob persistita → dopo ogni predizione servita ha un record con esito.
  - reversibilità: drop della tabella nuova; zero impatto sul serve esistente.
  - blast radius: **nullo sul cliente** (solo append in nuova tabella; il GET resta invariato).
  - verifica: dopo 1 settimana, reliability curve su prob_servite vs esiti reali.
- **Owner esecuzione:** ML Engineer + chi gestisce migrazioni Supabase.
- **Serve OK da:** Andrea (è equivalente a una migrazione DB su company aziendale).

### PROPOSAL B — Market blend nelle probabilità servite (combo vincente)
- **Task:** far entrare la closing line nel numero servito: `p_servita = α·p_modello + (1−α)·p_mercato_devig`, con α≈0.3 (configurabile). Mantiene la leggibilità del modello + la calibrazione del mercato. Sistema il segmento underdog/longshot dove oggi perdiamo.
- **Approccio scelto:** blend, non sostituzione. α=0 (pure market) è l'ottimo statistico ma azzera il "nostro" contributo e ci rende un mirror del bookmaker; α≈0.3 conserva quasi tutto il guadagno di calibrazione mantenendo identità di prodotto. α in settings.
- **COSA CAMBIERÀ ESATTAMENTE:**
  - File `lib/poisson-model.ts`: nuova funzione pura `blendWithMarket(p, marketDevig, alpha)`; **nessuna modifica a `predict()`** (il blend è uno step successivo, fail-safe se manca il mercato → α effettivo 1, comportamento attuale).
  - File `app/api/predictions/route.ts` (`computeAndStore`): dopo `predict()`, se esistono odds reali 1X2 → de-vig (riusare la logica di `core/football_data_uk.implied_probs`, portata in TS) → blend → è QUESTA la `p` scritta in `match_predictions`. Se odds assenti → nessun blend (resta `is_estimate=true`, regola P0 #2 intatta).
  - Nuova costante `MARKET_BLEND_ALPHA=0.3` in `lib/poisson-model.ts` (commento con il backtest che la giustifica).
  - **Guardia anti-edge fittizio:** poiché il blend tira verso il mercato, l'`edge` calcolato a valle si riduce (corretto: il vero edge oltre la line è ~0). NON pubblicare l'edge come "value vs mercato"; il prodotto resta probabilità calibrate + hit-rate, mai "battiamo il book". Cambio coerente con la linea già decisa (P0 #2).
  - prima→dopo: prima p_servita = Poisson(gol+xG), spesso lontana dal mercato e sbagliata sugli underdog → dopo p_servita calibrata verso la line (Brier 0.599→~0.585, acc 50.6%→~53%, longshot sistemati).
  - reversibilità: `MARKET_BLEND_ALPHA=1.0` ripristina esattamente il comportamento odierno (rollback a costante).
  - blast radius: **alto** — tocca il numero mostrato a ogni cliente football → è un deploy produzione. Tennis/WC non toccati.
  - piano di verifica: (1) backtest già fatto (questo report); (2) shadow-run con PROPOSAL A attiva per ≥2 settimane confrontando prob blended vs esiti prima di esporre; (3) check visivo board su un campione di match.
- **Owner esecuzione:** ML Engineer (codice) + UI per il copy "no edge claim".
- **Serve OK da:** Andrea (deploy produzione sul numero servito al cliente).
- **Dipendenza:** richiede odds reali al momento del compute (oggi The Odds API è già fetchato in `computeAndStore`). Dove mancano → fallback al comportamento attuale.

---

## Metodologia & riproducibilità
- DB: psql read-only, conteggi via `information_schema` + `query_to_xml`.
- Dataset: `data/football_data_uk/` (quote+esiti, 5×5 stagioni), `data/understat/` (xG).
- Harness Fase 4 (creati, **temporanei/research, read-only, nessun import prod di scrittura**):
  - `scripts/reliability_experiments.py` — tabella migliorie (Brier/logloss/acc/ECE).
  - `scripts/reliability_segments.py` — error analysis per fascia/divergenza/classe.
  - `scripts/reliability_robustness.py` — α per-stagione out-of-sample + ROI.
- Poisson v1 = port fedele di `lib/poisson-model.ts` (stesso shrinkage, stessa griglia, stesso blend xG w=0.5), riusando i loader esistenti `core/football_data_uk`.
- Onestà statistica: ROI negativo su closing line ⇒ nessun edge dimostrato. n=8.575 è solido per la calibrazione; l'edge resta indistinguibile dal break-even (coerente col report di stanotte su n=160 bets).
- Nessuno script di produzione modificato. Nessun commit/push/deploy.
```
```

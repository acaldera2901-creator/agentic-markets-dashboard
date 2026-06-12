# Track Record esteso — Storico 2025 (Live + ricostruzione walk-forward)

**Data:** 2026-06-12
**Autori:** Andrea (idea/direzione) · Claude calde-aziendale (design)
**Stato:** Design approvato in brainstorming — da trasformare in piano di implementazione
**Owner backend:** lab Michele (michele-claude) · **Owner frontend:** lato Andrea
**Rischio:** medium/high (claim pubblici + write su DB prod) → implementazione/deploy GATED (PROPOSAL + APPROVE)

---

## 1. Problema

Il track record live mostra hit-rate altissimi ma su **campione minuscolo**: oggi il football pubblico è 94,4% su **18 pick decise** (17W/1L), perché il floor gate (giustamente) esclude le pick sotto-soglia. Numeri così, su pochi eventi, sono:
- **poco credibili** per uno scommettitore esperto (sanno di small-sample),
- **fragili**: regrediranno verso il ~70% sostenibile che il walk-forward di Michele prevede,
- **non dimostrabili**: non c'è modo per un utente di verificare un edge reale su 18 eventi.

## 2. Obiettivo

Costruire uno **storico ampio e verificabile** applicando la **stessa identica logica di serving** (modello + floor) al passato dei campionati più importanti **dal 2025**, per:
- **uso interno**: capire il nostro edge reale su campione statisticamente serio;
- **uso esterno**: dare all'utente (anche anonimo) dati dimostrabili, separati e onesti.

## 3. Perimetro (v1)

**Incluso:**
- **Football top-5 leghe**: Premier League, Serie A, La Liga, Bundesliga, Ligue 1 (dati `football-data.co.uk` già in repo, con closing odds).
- **Tennis ATP/WTA**.
- **Periodo: dal 2025** (recente = rappresentativo del modello servito oggi).

**Escluso da v1** (eventuale v2): Champions/Europa/Conference League (solo ESPN, niente CSV storico affidabile), altri sport, anni < 2025.

## 4. Principi non-negoziabili

1. **Preservare logica e dati esistenti (NON una sostituzione).** La pipeline attuale resta intatta: i match **continuano a settlarsi ed entrare nella history quando finiscono**, le pick reali di quest'anno restano e si accumulano. Il backfill **aggiunge** dati vecchi, non rimpiazza nulla. Cambia il **frontend** (presentazione) + si **aggiungono** i dati storici. Niente regressioni su settlement, gate, serving, numeri reali.
2. **Zero leakage.** Le predizioni storiche si generano in **walk-forward**: per ogni match il modello vede solo dati precedenti alla data del match. Stesse ricette del servito (Dixon-Coles club, elo_surface tennis). Niente fit sul periodo intero.
3. **Stesso floor del live.** Surfacing gate identico (club 56, tennis 62 — `core/surfacing_gate.py` / `lib/surfacing-gate.ts`). Si storicizzano e contano **solo le pick sopra-soglia**, esattamente come ciò che avremmo servito.
4. **Due storici distinti per anno, mai fusi.**
   - **Storico 2025** = ricostruzione walk-forward delle partite 2025 (periodo chiuso, fisso), marcata "ricostruzione walk-forward".
   - **Storico quest'anno (2026)** = pick reali servite, in cui **le partite entrano man mano che si concludono** (flusso settlement esistente). Include le partite nuove in corso ("da giocare").
   - Si selezionano (toggle anno); registro e sintesi riflettono l'anno scelto. Mai sommati in un unico headline.
5. **Costruito ≠ Verificato.** Il backfill va validato da Michele (owner del modello e dell'infra leak-free) prima di essere mostrato.

### 4ter. ⚠️ Scoperta tecnica (2026-06-12) — separazione backfill obbligatoria
`/api/v2/history` filtra `is_historical = TRUE`, e **le pick reali 2026 sono già `is_historical = TRUE`** (è il flag "riga nel track record", non "backfill"). Perciò:
- Il backfill 2025 **NON** può usare `is_historical=TRUE` da solo, o si mescolerebbe col 2026 reale nella query di default → inquinerebbe i numeri live.
- Serve un **marcatore distinto** sulle righe backfill (es. colonna/tag `source='backfill_2025'`, da decidere lato backend Michele).
- La query **di default** (nessun `year`) deve **escludere il backfill** → numeri live invariati. `year=2025` lo include esplicitamente; `year=2026` resta il reale.
- **Decisione backend (owner Michele).** Finché non è definita, non si tocca `route.ts` per il filtro anno (rischio: numeri reali).

### 4bis. Cosa NON cambia (esplicito)
- Il **settlement pipeline** (`/api/cron/settle`, scoring, transizione a `settled`) e il flusso "match finito → in history".
- I **numeri reali** del track record live (restano quelli, invariati).
- Il **floor gate** e la logica di serving/predizione.
- Le righe `unified_predictions` esistenti: il backfill aggiunge righe nuove (`is_historical=true`), non riscrive le reali.

## 5. Architettura

### 5.1 Parte 1 — Backend: pipeline storico (owner: lab Michele)

Pipeline batch (riusa gli script lab esistenti: `lab_backtest_10y.py`, `backtest_tennis.py`, loader `core/football_data_uk.py`):

1. **Genera** predizioni match-per-match (top-5 leghe + tennis, 2025+) in walk-forward con ricette identiche al servito.
2. **Filtra** col surfacing floor → tiene solo pick sopra-soglia.
3. **Settla** dal risultato reale (CSV football-data per leghe; ESPN/ATP per tennis).
4. **Calcola ROI/CLV**:
   - Football: closing odds presenti nei CSV (Pinnacle/avg) → CLV e ROI reali.
   - Tennis: quote storiche incerte → **football-first per H**; tennis con hit-rate, CLV best-effort se reperiamo le quote.
5. **Persiste** in `unified_predictions` con `is_historical=true` + tag `backfill_2025` (la colonna `is_historical` esiste già). L'API serve queste righe **separate** dal live.
6. **Aggrega** metriche: hit per segmento / mese / fascia-confidenza, ROI, CLV, Brier → JSON o endpoint dedicato per alimentare il frontend.

**Output dati che il frontend consuma** (nuovo endpoint o estensione di `/api/v2/history`):
- aggregato storico per segmento e per mese (per B, E, G)
- ROI/CLV storico + baseline mercato (per H)
- lista pick storiche paginata e filtrabile (per I)
- il tutto parametrizzato `scope=live|historical`

### 5.2 Parte 2 — Frontend: pagina track record (owner: lato Andrea)

Stile BetRedge "Sleek Coral" (token reali in `app/globals.css`). Sostituisce **la presentazione** del tab Storico attuale, non la sua logica.
- **Registro pick** = solo pick **concluse** (won/lost) di quest'anno; **una pick entra quando la partita finisce** e le statistiche si aggiornano partita per partita (niente "da giocare"/upcoming nel registro). Filtro sport.
- **Ognuna delle 3 schede di sintesi** (Battiamo il mercato / Per segmento / Costanza nel tempo) ha un **bottone 2025 indipendente**: cliccandolo, *quella* scheda mostra i numeri del 2025 (ricostruzione walk-forward) per confronto col 2026. Le schede non si influenzano tra loro e i due anni non si sommano.

| # | Sezione | Concept | Note |
|---|---------|---------|------|
| 1 | **H — "Batti il mercato"** (hero) | ROI BetRedge vs flat-favorito + CLV medio + % pick che battono la chiusura | Football-first per i dati odds |
| 2 | **B — Àncora + forma + scoreboard** | Numero storico grande (hit% · N pick) · forma live a fianco · tabella per segmento Storico vs Live | Il blocco di credibilità |
| 3 | **E — Heatmap di costanza** | Griglia mese×settimana colorata per hit-rate | Risponde diretto al "campione piccolo" |
| 4 | **I — Registro pick verificabile** (PRIMA sezione) | Lista filtrabile (sport/fonte) di **tutte** le pick: **partite in corso** (prediction nuove, stato "da giocare") + settlate (won/lost) + storico ricostruito. Colonne: data · match · sel · prob-al-pick · esito/stato. Ordine dal più recente | Trasparenza + mostra le pick attive, non solo il passato |

### 5.3 Gating (accesso)

Coerente con la policy gating attuale (anonimo vede leaderboard + storico settlato):
- **Pubblico (anche anonimo):** H (hero edge), B (summary + scoreboard), E (heatmap).
- **Login / Pro:** I (registro completo + drill-down per-pick con prob-al-pick). L'ispezione dettagliata è valore premium.

## 6. Componenti e confini

- **Pipeline backfill** (Python, lab): input = CSV leghe + dati tennis; output = righe `unified_predictions(is_historical)` + aggregati. Testabile in isolamento (dato un set di match storici → pick attese floor-gated → metriche).
- **Endpoint dati storico** (`/api/v2/history?scope=historical` + aggregati): legge le righe `is_historical`, mai mischia col live. Contratto chiaro: stats + lista + serie temporale.
- **4 componenti frontend** (uno per sezione H/B/E/I), ciascuno consuma il proprio slice dell'endpoint, stato condiviso = toggle scope + filtro sport.

## 7. Rischi

| Rischio | Mitigazione |
|---|---|
| **Leakage** (numero falso → brucia credibilità) | Walk-forward rigoroso, ricette = servito, **validazione Michele** prima del display |
| Quote tennis storiche mancanti | H football-first; tennis hit-rate, CLV opzionale |
| Claim pubblici + write su prod = medium/high | PROPOSAL + APPROVE prima di implementare/deployare; coinvolgere Michele |
| Pagina già lunga | Toggle Live/Storico + sezioni: una vista per volta, non tutto impilato |

## 8. Criteri di successo (verificabili)

1. Backfill genera pick storiche **floor-gated, walk-forward, leak-free** per top-5 leghe + tennis 2025, validate da Michele.
2. Hit-rate storico per segmento **coerente** con i numeri walk-forward del lab (es. football ~70%).
3. Frontend mostra H/B/E/I con dati reali, **storico e live mai sommati**, storico etichettato "walk-forward".
4. Gating: anonimo vede H/B/E; I dietro login/Pro.
5. Nessun impatto sul track record live esistente (numeri live invariati).

## 9. Fuori scope

- Aggiornamento automatico/continuo del backfill (v1 = batch una tantum + estendibile).
- Sport/competizioni oltre il perimetro §3.
- Redesign di altre pagine.

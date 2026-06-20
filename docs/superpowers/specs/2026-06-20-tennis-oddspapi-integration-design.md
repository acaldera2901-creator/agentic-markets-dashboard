# Integrazione OddsPapi — 2ª sorgente quote tennis — Design

**Data:** 2026-06-20
**Owner:** Andrea
**Stato:** design approvato in brainstorming, in attesa review spec

## Contesto e motivazione

Le card prediction mostrano **Market %** (1/quota) ed **Edge** (modello − mercato) solo
quando esistono quote reali. Il **tennis** oggi usa **The Odds API** (`core/tennis_odds_api_client.py`)
che copre ATP/WTA **500+/Slam** ma **non i tornei 250 né i Challenger**. Tra Roland
Garros e Wimbledon il board tennis è quasi tutto erba-250 (Eastbourne, Bad Homburg,
Mallorca, Nottingham…): **0/43 match con quote** → niente Market/Edge.

Verificato (free tier, 2026-06-20) che **OddsPapi** copre esattamente questi tornei con
quote reali match-winner + **Pinnacle**, e i fixture portano i **nomi giocatori**
(`participant1Name`/`participant2Name`), mappabili ai nostri match.

Obiettivo: **OddsPapi come 2ª sorgente quote tennis**, solo per i match che The Odds API
non copre, con consumo dentro il **free tier (250 req/mese)** → policy **fetch-once
near-kickoff**. Misurare il consumo reale dopo il deploy; se servirà un piano pagato,
si decide con i numeri in mano.

## Vincolo chiave: cadenza

`agents/tennis_data_collector.py` gira **ogni 1800s (30 min)** e chiama
`get_tennis_odds()` (The Odds API). OddsPapi NON va alla stessa cadenza (1 `/odds` per
match × 48 cicli/giorno brucerebbe il free). Serve una policy separata: **1 sola
chiamata `/odds` per match scoperto, vicino al kickoff, senza re-fetch.**

## Design

### Unità 1 — `core/tennis_oddspapi_client.py` (nuovo)

API OddsPapi (base `https://api.oddspapi.io/v4`, auth `apiKey` query, tennis `sportId=12`):

- `get_oddspapi_fixtures(date_from, date_to) -> list[dict]`
  `GET /fixtures?apiKey&sportId=12&from&to&hasOdds=true` → solo fixture **con quote**.
  Ritorna per fixture: `fixtureId`, `participant1Name`, `participant2Name`,
  `tournamentName`, `categoryName` (ATP/WTA), `startTime`, `hasOdds`.
- `get_oddspapi_match_odds(fixture_id) -> dict | None`
  `GET /odds?apiKey&fixtureId=<id>&bookmakers=pinnacle` → estrae il market
  **match-winner (id `121`)**, preferendo **Pinnacle** (anchor), fallback al
  miglior book disponibile se Pinnacle assente. Ritorna `{odds_p1, odds_p2}` o `None`.
- Matching nomi: normalizzazione condivisa con `core/tennis_names.py` (cognome/iniziale,
  gestione "Last, First" di OddsPapi vs nostro formato). Un fixture OddsPapi matcha un
  nostro match se nomi normalizzati coincidono **e** stesso giorno.
- Fail-soft: ogni errore/timeout/HTTP≠200 → ritorna lista vuota / `None`. Mai eccezioni
  che bloccano il collector. Mai quote inventate.

### Unità 2 — policy fetch-once near-kickoff in `agents/tennis_data_collector.py`

Nel loop esistente, **dopo** il merge The Odds API: per i nostri fixture **ancora senza
`odds_p1/p2`** che soddisfano TUTTE:
1. kickoff entro **NEAR_KICKOFF_HOURS** (default **6h**) e nel futuro;
2. non già tentati (vedi sotto, no re-fetch);

→ recupera 1 volta da OddsPapi: chiama `get_oddspapi_fixtures` (1 req per ciclo,
filtra ai nostri match per nome+giorno), poi per ciascun match matchato chiama
`get_oddspapi_match_odds(fixtureId)` (1 req per match), merge `odds_p1/p2`.

**No re-fetch** (idempotenza/risparmio quota): marcare il tentativo. Opzione scelta —
**in-process set** dei `match_id` già tentati nel processo del collector (semplice, zero
schema). Se il processo riparte si ritenta (accettabile: il near-kickoff window è
piccolo). [Alternativa valutata: colonna `oddspapi_attempted_at` su `tennis_predictions`
= persistente ma richiede migration su DB condiviso → scartata per ora, YAGNI.]

Costanti in testa al modulo: `NEAR_KICKOFF_HOURS=6`. Niente magic number sparsi.

### Unità 3 — config

`ODDSPAPI_KEY` letta da env (`os.environ`), come le altre API key del progetto. Se
assente → il client è no-op (log una volta, nessun crash): la feature si "spegne" da
sola senza rompere il tennis esistente. La chiave va aggiunta all'env del runtime del
collector (LaunchAgent / .env) — step di config (Andrea/Tommy), non nel codice.

### Cosa NON cambia

Schema DB (uso colonne `odds_p1/p2` esistenti su `tennis_predictions`) · modello ·
`_market_edge` (calcola l'edge da odds, invariato) · frontend (la card mostra
market+edge appena `odds_p1/p2` ci sono) · The Odds API (resta anchor primario) ·
cadenza ESPN/score.

## Flusso dati

```
collector loop (30 min)
  ESPN scores + The Odds API odds → merge (come oggi)
  → fixtures ancora SENZA odds, kickoff < 6h, non tentati:
      get_oddspapi_fixtures(hasOdds=true)  [1 req/ciclo]
      match per nome+giorno → get_oddspapi_match_odds(fixtureId, pinnacle)  [1 req/match]
      merge odds_p1/p2 + marca tentato
  → persist su tennis_predictions (odds_p1/p2)
       ↓
  tennis_model_agent → _market_edge (model − 1/odds) → edge
       ↓
  /api/tennis → card mostra Market% (1/odds) + Edge
```

## Error handling / edge cases

- `ODDSPAPI_KEY` assente → client no-op, tennis invariato.
- OddsPapi down / timeout / 429 → fail-soft, nessuna quota, nessun crash.
- Nessun match OddsPapi per il nostro fixture (nome non matchato o no odds) → resta
  senza market/edge (onesto, niente invenzioni).
- Pinnacle assente sul fixture → fallback al miglior book; se nessun 2-way → `None`.
- Match già con odds da The Odds API → OddsPapi **non** viene chiamato (priorità anchor).

## Budget richieste (free 250/mese)

Solo match scoperti, near-kickoff, 1 volta: ~1 `/odds` per match + ~1 `/fixtures` per
ciclo (solo quando ci sono candidati). Stima **~180/mese** (≈40 match/settimana attiva).
Dopo il deploy: **misurare il consumo reale** ~2-4 settimane; se sfora il free → scegliere
piano pagato OddsPapi col numero esatto.

## Piano di verifica

1. **Test unitario** del parser `get_oddspapi_match_odds` su un payload OddsPapi reale
   salvato (fixture con Pinnacle): estrae market 121 → `odds_p1/odds_p2` corretti;
   Pinnacle assente → fallback; nessun 2-way → `None`.
2. **Test matching nomi** ("Stevens, Zane" OddsPapi ↔ nostro formato) con casi reali.
3. **Test fail-soft**: key assente → no-op; HTTP 500 → lista vuota, nessuna eccezione.
4. **Verifica live (gated, con key)**: in shadow/staging, un match erba-250 reale (es.
   Eastbourne) riceve `odds_p1/p2` da OddsPapi → la card mostra Market% + Edge; conteggio
   richieste consumate coerente con la stima.

## Note implementative

- Branch da `main`: `feat/tennis-oddspapi` (worktree `~/Desktop/agentic-markets-oddspapi`).
- Rischio: medio (pipeline servita + dipendenza esterna), ma additivo e fail-soft; nessuna
  migration. **Deploy = gate APPROVE**; scrive su `tennis_predictions` (DB condiviso) →
  governance Tommy (portare in council). Avvio in free, consumo monitorato.
- `bookmakers=pinnacle` su `/odds` se supportato riduce il payload (da verificare nel plan).

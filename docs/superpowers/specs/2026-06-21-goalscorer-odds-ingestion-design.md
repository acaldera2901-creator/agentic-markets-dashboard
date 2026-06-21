# Goalscorer Odds Ingestion — Design (sotto-progetto B-odds)

**Data:** 2026-06-21
**Stato:** Design (shape API VERIFICATA contro The Odds API reale) — build in corso sul branch feat/player-data-foundation
**Scope:** SOLO ingestione quote anytime-goalscorer da The Odds API → tabella `player_odds`. Nessun modello (B-model), nessuna card (B-card).

## Contesto

Decisione Andrea (2026-06-21): per le card player-props serve l'Edge (Modello−Mercato), quindi **prima le quote**. Provider scelto: **The Odds API** (già pagato nello stack, `ODDS_API_KEY`). Mercato MVP: **anytime goalscorer**. Leghe: top-5 europee — ma l'ingester è **agnostico alla lega** perché:

- Verificato 2026-06-21: in giugno le top-5 sono in pausa e i player-props sono **vuoti** (EPL/Serie A eventi di agosto → `bookmakers: []`, costo 0). I props compaiono solo vicino al kickoff.
- L'**unica** competizione con quote marcatore live ora è il **World Cup** (che già serviamo in card). Codice league-agnostic ⇒ WC acceso subito, top-5 da sole ad agosto.

### Shape API verificata (reale)

`GET /v4/sports/{sport}/events` → lista eventi (NON consuma quota): `{id, home_team, away_team, commence_time}`.

`GET /v4/sports/{sport}/events/{id}/odds?regions=us&markets=player_goal_scorer_anytime&oddsFormat=decimal` → costo **1 credit** se ci sono mercati, **0** altrimenti. Forma:
```
{ id, home_team, away_team, commence_time,
  bookmakers: [ { key, title, last_update,
    markets: [ { key: "player_goal_scorer_anytime",
      outcomes: [ { name: "Yes", description: "<nome giocatore>", price: <decimale> }, ... ] } ] } ] }
```
- Book disponibili (verificato): `betrivers, fanduel, draftkings, betmgm, bovada` — **solo book US** (limite documentato e confermato).
- Anytime = lato "Yes" per giocatore; il lato "No" tipicamente non è restituito.
- `commence_time` ISO UTC; i props compaiono vicino al match.

## Decisioni di scope (lockate)

| Tema | Decisione |
|------|-----------|
| Provider | The Odds API, `ODDS_API_KEY` esistente |
| Mercato | `player_goal_scorer_anytime` only |
| Regione | `us` (unica con player-props) |
| Copertura | League-agnostic; sport key configurabili; WC live ora + top-5 ad agosto |
| Edge | Fuori scope qui: si atterra solo quota + implied prob. Edge lo calcola B-model |
| Vincolo DB | Tabella `player_odds` additiva. Migration GATED (deploy-gate + APPROVE) |
| Quota | `/events` gratis per gli ID; `/events/{id}/odds` 1 credit/evento; collector solo su fixture in finestra pre-match |
| FTC | Edge sarà "modello vs book US": va dichiarato nella card (B-card). Qui solo dato grezzo |

## Architettura

```
The Odds API
  /events (free)         -> lista eventi per sport key
  /events/{id}/odds      -> anytime-goalscorer per evento (regions=us)
        |
        v
core/odds_api_goalscorer.py   (client: fetch eventi + odds evento)
        |  raw json
        v
core/goalscorer_odds_normalize.py  (puro: parse outcomes -> righe PlayerOddRow)
        |  + match evento->match_id (nomi squadra+data) + nome book->player_id (norm, fail-open)
        v
core/goalscorer_odds_collector.py  (orchestratore quota-aware -> upsert player_odds)
        |
        v
Supabase player_odds  (consumato da B-model per l'Edge)
```

Riuso: `config.settings.ODDS_API_KEY`; pattern writer PATCH-then-POST da `core/supabase_client.py`; normalizzatore nomi condiviso con A (`core/understat_players.normalize_name` o equivalente).

## Schema DB (additivo, GATED)

`player_odds` (NUOVA):
`id BIGSERIAL PK, match_id VARCHAR, sport_key VARCHAR, event_id VARCHAR, player_id VARCHAR (nullable, match best-effort), player_name VARCHAR, market VARCHAR DEFAULT 'anytime_goalscorer', bookmaker VARCHAR, region VARCHAR DEFAULT 'us', price FLOAT, implied_prob FLOAT, captured_at TIMESTAMPTZ DEFAULT NOW(), is_closing BOOLEAN DEFAULT false`
- Dedup: `UNIQUE(event_id, bookmaker, player_name, market)` (una riga per giocatore-book-mercato; refresh aggiorna price/implied/captured).
- Indici: `(match_id)`, `(event_id)`.
- `implied_prob = 1/price` (NB: include il vig; l'anytime è yes/no indipendente per giocatore, NON normalizzato cross-player — documentato; la de-vig spetta a B-model se servirà).

## Componenti

1. **`core/odds_api_goalscorer.py`** — `async get_events(sport_key) -> list[dict]` (no quota) e `async get_event_goalscorer_odds(sport_key, event_id, region="us") -> dict` (fail-soft: `{}` su no-key/non-200/errore).
2. **`core/goalscorer_odds_normalize.py`** — puro:
   - `parse_event_odds(event_json, match_id) -> list[PlayerOddRow]` — appiattisce bookmakers→markets→outcomes (solo `name=="Yes"`, market key giusto), price→implied_prob, salta price<=1.0.
   - `@dataclass PlayerOddRow(match_id, sport_key, event_id, player_id, player_name, market, bookmaker, region, price, implied_prob)` (`player_id` riempito dal collector).
3. **`core/goalscorer_odds_collector.py`** — `async collect_goalscorer_odds(sport_keys, match_resolver, player_resolver) -> dict`:
   - per ogni sport key: `get_events` → per evento in finestra pre-match → `get_event_goalscorer_odds` → `parse_event_odds` → risolvi `match_id` (resolver per nomi squadra+data) e `player_id` (resolver per nome normalizzato, fail-open None) → upsert.
   - quota-aware: salta eventi fuori finestra; fail-soft per evento; ritorna summary `{events, rows_written, errors[]}`.
4. **Writer** `upsert_player_odds(rows)` in `core/player_data_writers.py` (PATCH-then-POST su dedup key).
5. **Migration** `supabase/migrations/20260621xxxxxx_player_odds.sql` (GATED).

## Error handling
- No key / quota esaurita / non-200 → fail-soft, log, summary errors. Mai raise.
- Evento senza player-props (mercati vuoti, costo 0) → 0 righe, nessun errore.
- Nome giocatore book non risolto → riga salvata con `player_id=NULL` (fail-open: il dato grezzo non si perde; il match si può migliorare dopo).
- Evento non risolto a match_id → riga salvata con `match_id=NULL`? No: senza match_id la riga è inutile per la card → si SALTA e si logga (evita righe orfane).

## Test (Costruito ≠ Verificato)
- Unit: `parse_event_odds` su un fixture = risposta REALE catturata (Spain vs Saudi Arabia, salvata come fixture di test) → verifica outcomes, implied_prob, filtro "Yes".
- Unit: client fail-soft (no key → {}); collector fail-soft per evento; dedup key.
- Integrazione (manuale, NON gated perché è solo lettura API): uno script di probe che colpisce 1 evento WC reale e stampa righe — già eseguito in fase di design (5 book, 17 giocatori).

## Fuori scope (→ B-model / B-card)
- Esporre/persistere λ squadra (Dixon-Coles `predict_lambdas`).
- λ giocatore + P(anytime) modello.
- Edge = Modello − Mercato.
- De-vig delle quote.
- Card UI marcatore + redirect ai book (richiede visual check Andrea).
- Mercati diversi da anytime (first/last scorer, tiri, assist).

## Criteri di successo (verificabili)
1. `player_odds` popolabile da eventi WC reali (dati veri, 5 book US).
2. `parse_event_odds` testato contro la risposta reale catturata.
3. League-agnostic: aggiungere un sport key (es. `soccer_epl`) non richiede modifiche di codice.
4. Quota-aware: `/events` gratis, 1 credit/evento con dati, collector salta eventi fuori finestra.
5. Fail-soft end-to-end; nessuna riga orfana (match_id sempre risolto o riga saltata).
6. Migration additiva, GATED; nessuna regressione su `odds_snapshots`.

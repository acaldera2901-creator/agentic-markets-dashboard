# Player Data Foundation — Design (sotto-progetto A)

**Data:** 2026-06-20
**Stato:** Design approvato (brainstorming) — in attesa review spec prima del piano
**Scope:** SOLO fondamenta dati giocatore. Nessun modello goalscorer, nessuna card (→ sotto-progetto B). Nessuna news (→ sotto-progetto C).

## Contesto e motivazione

Richiesta originale (Andrea): aggiungere dati sui giocatori e news calcistiche giorno-per-giorno per (1) aumentare l'accuratezza delle card e (2) abilitare predizioni a livello giocatore ("far bettare sui giocatori" = predizioni player-prop + redirect ai book, **noi non prendiamo scommesse** — vincolo non-gambling/FTC).

La richiesta è stata decomposta in 3 sotto-progetti distinti per ROI:

- **A — Fondamenta dati giocatore** (questo spec, prerequisito di B). Consegna anche, di rimbalzo, il miglioramento di accuracy delle card esistenti via formazioni confermate.
- **B — Prodotto player props** (modello goalscorer/assist + card + redirect + substantiation FTC). Dipende da A. Spec separato.
- **C — News come contenuto utente** (feed editoriale nelle card, non tocca il modello). Indipendente, ROI più basso. Spec separato, ultimo.

### Stato reale verificato (sola lettura del repo, 2026-06-20)

- Infortuni e formazioni **già ingeriti** da api-football (`core/football_api_client.py`: `get_lineups()`, `get_injuries()`) ed ESPN (`core/espn_soccer_client.py`), già usati via `core/squad_condition.py` / `core/squad_condition_sync.py`.
- Tabella `player_profiles` **esiste nello schema ma è vuota / mai popolata** (`docs/supabase_schema.sql`).
- Modello calcio = Dixon-Coles analitico (`models/dixon_coles.py`) su gol di squadra + xG di squadra. **Nessuna feature a livello giocatore** entra nelle predizioni.
- Storico marcatori / assist / **xG individuale = assente** nel sistema. Va costruito.
- News/testo/NLP = **zero** infrastruttura.
- Card calcio servono 1X2, O/U (1.5/2.5/3.5), BTTS, Double (`lib/poisson-model.ts`). **Nessun mercato giocatore.**

## Decisioni di scope (lockate in brainstorming)

| Tema | Decisione |
|------|-----------|
| Copertura | Tutte le leghe servite oggi + World Cup |
| Architettura dati | A **tier** + **fail-closed** (vedi sotto) |
| Storico backfill | **2 stagioni** come base rate |
| Finestra modello | Rolling sulle ultime ~8-10 presenze (forma) — la usa B |
| Vincolo DB | Solo modifiche **additive** (nuove tabelle + popolamento). Migration dietro deploy-gate + APPROVE |
| Vincolo FTC | Mai un mercato/claim giocatore dove il dato non regge |

### Architettura a tier

- **Tier 1** — leghe con copertura Understat verificata (top-5 europei + eventuali extra confermati): xG individuale disponibile → base per modello goalscorer pieno.
- **Tier 2** — altre leghe servite + WC: solo eventi-partita api-football (marcatori, assist, minuti, titolarità) → modello a frequenza, senza xG, confidenza dichiarata più bassa.
- **Fail-closed** — leghe/giocatori sotto soglia minima di storico utile (es. <5 presenze) o con dato stale → **nessun profilo eleggibile** ai mercati giocatore; restano le card squadra attuali.

`LEAGUE_DATA_TIER`: mappa statica lega→tier. La soglia fail-closed è per-giocatore, non per-lega.

## Architettura (data flow)

```
FONTI                          NORMALIZZAZIONE             STORAGE                  CONSUMA
api-football (eventi,    ┐
  lineup, infortuni)     ├─→  player_data_sync.py    ─→  player_profiles (live)  ─→  sotto-progetto B
Understat (xG indiv.)    ┘     - tier detection          player_match_stats           (modello + card)
ESPN (squad WC)                - rolling window           player_lineups (T-40')
                               - fail-closed gate
                               - data_trust_log
```

Loader esistenti riusati (no riscrittura): `football_api_client.py`, `understat_data.py`, `espn_soccer_client.py`. Nuovo orchestratore `core/player_data_sync.py` li compone, applica tier + fail-closed, scrive nel DB.

## Schema DB (additivo)

**`player_profiles`** (esiste, vuota → popolata):
`player_id, name, team, league, role, tier, importance_score, goals_per90_season, xg_per90_season, minutes_share, penalty_taker, eligible_for_player_markets (bool), last_updated`

**`player_match_stats`** (NUOVA, backfill 2 stagioni, 1 riga per giocatore-partita):
`player_id, match_id, league, date, minutes, goals, assists, shots, xg (nullable per Tier 2), started`

**`player_lineups`** (NUOVA, formazioni confermate ~T-40' da api-football):
`match_id, player_id, side, position, is_starter, confirmed_at`

Tutto additivo. La migration resta dietro deploy-gate + APPROVE (DB condiviso Supabase, regola governance Tommy).

## Pipeline operativa

- **Backfill one-shot** — 2 stagioni: Understat xG (Tier 1) + eventi api-football (Tier 1+2). Script dedicato, **idempotente** (re-run safe), **gated** (scrive su DB condiviso).
- **Sync giornaliero** — aggiorna `player_profiles` (profili + forma rolling). Riusa pattern LaunchAgent esistente.
- **Sync formazioni T-40'** — trigger pre-match sui fixture del giorno → `player_lineups`. api-football pubblica le formazioni ~20-40' prima del kickoff.

## Data-trust & fail-closed

Riuso `data_trust_log` esistente. Ogni giocatore marcato con `tier`, `data_points`, `last_updated`. Sotto soglia o stale → `eligible_for_player_markets=false`. **B leggerà solo i `true`.** Questo è il guard-rail FTC: nessun claim giocatore dove il dato non regge, coerente con lo standard "card oneste anche below-floor".

## Error handling

- Fonte non raggiungibile → degradazione al tier inferiore disponibile; mai crash della pipeline calcio esistente.
- Giocatore presente in lineup ma assente da `player_profiles` (es. neo-acquisto) → profilo minimo creato, `eligible=false` finché non accumula presenze.
- Backfill parziale → idempotente, riprende senza duplicati (chiave `player_id+match_id`).
- Mismatch nomi giocatore tra fonti → matching per id api-football quando disponibile; fallback nome normalizzato (rischio noto, loggato).

## Test (Costruito ≠ Verificato ≠ Operativo)

- **Unit**: tier detection; finestra rolling forma; fail-closed gate (soglia presenze + staleness).
- **Integrazione**: backfill su 1 lega Tier 1 (Premier League) + 1 Tier 2 (es. Eliteserien Norvegia) + WC → verifica reale che Tier 2/WC degradino senza xG e che i fail-closed non producano profili eleggibili.
- **Verifica dato**: cross-check marcatori di N partite note vs realtà (no fiducia cieca sul loader).

## Fuori scope (esplicito)

- Modello probabilistico goalscorer/assist → B.
- Template card giocatore, ancore-quota, redirect ai book → B.
- Substantiation FTC dei claim player → B.
- News / NLP / feed editoriale → C.
- Mercati giocatore su sport diversi dal calcio (tennis, ecc.) → non in roadmap qui.

## Criteri di successo (verificabili)

1. `player_profiles` popolata per tutte le leghe servite + WC, con `tier` e `eligible_for_player_markets` corretti.
2. `player_match_stats` con 2 stagioni di storico per Tier 1 (con xg), Tier 2 (senza xg).
3. `player_lineups` aggiornata a T-40' per i fixture del giorno.
4. Fail-closed dimostrato: leghe a dato scarso → zero profili eleggibili, card squadra invariate.
5. Backfill re-eseguibile senza duplicati.
6. Nessuna regressione sulla pipeline predizioni squadra esistente.

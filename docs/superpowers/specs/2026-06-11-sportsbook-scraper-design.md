# Design — Scraper odds Stake/Roobet (#SPORTSBOOK-SCRAPER-1)

**Data:** 2026-06-11 · **Stato:** design approvato a sezioni, in attesa review spec
**Owner:** Claude (aziendale) · **Sport:** calcio + tennis

## Obiettivo
Raccogliere in modo continuo le quote pre-match di **Stake** e **Roobet** per (a) **valutare empiricamente** se quei dati migliorano o degradano i nostri modelli di prediction (misurare, non assumere) e (b) tenere aggiornate le quote del book dove l'utente scommette davvero (display + edge-vs-book + CLV).

## Vincoli e decisioni
- **Estrazione via scraping non autorizzato**, misura **interim fino ai contratti** di collaborazione con Stake/Roobet. Rischi noti e accettati da Andrea: ToS (lo scraping è in genere vietato), anti-bot (Cloudflare), geo-block, possibile ban IP/account, profilo legale su tema gambling. Mitigazione: client isolati e sostituibili 1:1 con l'API ufficiale quando arriva.
- **Scraper sempre attivo** (nessun master off-switch di default). Restano i **kill-switch per-book** (`STAKE_ENABLED`/`ROOBET_ENABLED`, default ON) per spegnere un singolo book se bannato.
- **Sport/mercati:** calcio (1X2) + tennis (match-winner), più over/under e gli altri mercati che già paghiamo su The Odds API (per un confronto pulito).
- **Cadenza:** pre-match periodico (refresh ogni N minuti, più fitto vicino al kickoff) + snapshot di chiusura per il CLV. Niente in-play in Fase 1.
- **Modello live invariato in Fase 1**: l'integrazione è puramente additiva; le odds Stake/Roobet entrano nel modello live solo dopo un gate sui numeri (shadow-eval).
- **Legale-compliance:** rimandato per ora (decisione Andrea 2026-06-11); resta consigliato prima di scalare o esporre la feature.

## Approccio (A — l'agente scrapa, estrazione decisa allo step 1)
Il rischio numero uno è la fattibilità dell'estrazione. L'agente fa lo scraping; il suo primo step determina il metodo di estrazione prima di scrivere il parser:

### Step 1 dell'agente — Determinare il metodo di estrazione (deliverable interno)
È l'agente stesso a fare lo scraping; il suo **primo step di sviluppo** è capire COME estrarre i dati in modo affidabile. Apertura di Stake e Roobet con browser headless, ispezione del traffico di rete sulle pagine calcio/tennis. Output per ciascun sito:
- esiste un **endpoint JSON/XHR/WS interno** che serve le quote? (sì/no)
- serve login? serve proxy/geo? formato dati? copertura mercati 1X2 + O/U?
- match-rate atteso sui nomi squadra/giocatore.

Esito → fissa il metodo di estrazione del client: **API-interna** (preferita, via httpx) o **DOM-scraping** (fallback, via headless browser). Se un sito risulta impraticabile, si procede con l'altro e si logga. Questo step precede la scrittura della logica di fetch del client (non si scrive un parser alla cieca), ma fa parte della costruzione dell'agente, non è una fase separata che la rimanda.

## Componenti (Fase 1)
1. **`core/stake_client.py` + `core/roobet_client.py`** — un client per book, stessa interfaccia `fetch_odds(sport) -> list[OddsEvent]`. Normalizzazione, geo/proxy e anti-bot incapsulati qui dentro, così l'arrivo dell'API ufficiale richiede di riscrivere **solo** il client.
2. **`agents/sportsbook_scraper.py`** — agente isolato nello stack LaunchAgent locale (Vercel non può scrapare in modo persistente). Loop pre-match periodico + snapshot di chiusura. Kill-switch per-book. Scrive in `odds_snapshots`.
3. **Schema:** riuso `odds_snapshots` (ha già `team_pair_key`, `commence_time`, `is_closing`, totals). Aggiunte minime: tag `source IN ('stake','roobet')` (+ `market` se non già discriminato). Migration additiva.

## Data flow
```
sportsbook_scraper (agent, pre-match loop)
  → stake_client / roobet_client (fetch + normalize)
  → odds_snapshots (source-tagged, team_pair_key, is_closing)
  → join via team_pair_key con unified_predictions / prediction_log
      ├─ (a) USO IMMEDIATO (sicuro, no model change):
      │     • display quota Stake/Roobet sulla card (book giocabile)
      │     • edge-vs-book = nostra prob-fair vs quota del book
      │     • CLV = closing snapshot del book sul nostro pick
      └─ (b) SHADOW-EVAL (misura impatto modello):
            • log doppio per ogni pred: blend-attuale vs blend+Stake/Roobet
            • a settlement confronta Brier/log-loss, CLV, edge realizzato, hit-rate
            • promozione a input live SOLO con evidenza → PROPOSAL coi numeri
```

## Matching evento → prediction
- **Calcio:** `team_pair_key = "<data-utc>:<home_norm>|<away_norm>"` ordinato (ricetta esistente di `odds_snapshots`).
- **Tennis:** stessa ricetta sui nomi giocatore (riuso `core/tennis_names.canonical_player_key`).
- Punto fragile = **normalizzazione nomi** (i book scrivono diversamente). Riuso i normalizzatori esistenti; eventi non matchati → **loggati** (per la metrica match-rate %) ma **non usati**.

## Isolamento, sicurezza, kill-switch
- Fase 1 **additiva**: nuovi file client+agente, scritture `odds_snapshots` + shadow-log + letture display. **Nessuna modifica al codice del modello live** (proprietà di sicurezza chiave).
- Kill-switch per-book (default ON). Rate-limit rispettoso: intervalli con jitter, backoff su 403/429/challenge, cap concorrenza, header realistici, sessione riusata, proxy solo se lo spike lo richiede.
- **Auto-disable** di un book dopo N fail consecutivi + log rumoroso. Guard su dati stale (non mostrare quote oltre X minuti).
- Osservabilità: log di match-rate, successi/fail fetch, segnali di ban.
- Dati = quote (fatti), taggati per fonte → purgabili facilmente.

## Testing (solo fixture registrate, nessuna chiamata ai siti reali)
- Client: parsing/normalizzazione mercati (1X2, O/U) + edge-case nomi su payload campione.
- Matching: join `team_pair_key` calcio+tennis, gestione non-match.
- **Test di isolamento:** output del modello live **identico** con scraper ON e OFF (dimostra zero degrado finché non si promuove).
- Edge-vs-book e CLV su casi noti.

## Error handling
- Ogni fetch in try/except: l'agent loop non crasha mai; backoff su challenge; auto-disable book dopo N fail; guard dati stale.

## Fuori scope (Fase 1)
- In-play / live odds. Promozione automatica al modello live (richiede gate). Integrazione UI affiliate completa (si aggancia alla feature affiliate già spec'd, ma il display qui è solo lettura della quota). Contratti/partnership (sostituiranno lo scraping).

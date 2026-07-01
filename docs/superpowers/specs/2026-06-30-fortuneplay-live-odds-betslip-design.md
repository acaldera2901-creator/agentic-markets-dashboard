# FortunePlay — quote live sulle card + deep-link partita (betslip)

- **Tag**: `#FORTUNEPLAY-LIVE-ODDS-1`
- **Data**: 2026-06-30
- **Owner**: Andrea
- **Stato**: design approvato in brainstorming — spec da rivedere prima del piano
- **Rischio**: MEDIUM/HIGH (codice prodotto + claim edge FTC) → esecuzione/deploy **gated** (APPROVE umano + OK legale sul copy edge)

## Obiettivo

Mostrare sulle card delle partite la **quota live del partner FortunePlay** (per ora unico
partner) e trasformare il bottone "Place bet" in un **deep-link alla pagina-partita**
FortunePlay (con affiliate code), invece del landing generico attuale.

## Scelte di prodotto (decise in brainstorming)

1. **Sport**: calcio + tennis + World Cup (tutto ciò che il feed FortunePlay già copre).
2. **Edge**: edge **ricalcolato vs la quota FortunePlay** specifica ("value su FortunePlay"),
   non solo info. ⚠️ FTC-esposto → guardrail di copy + review legale obbligatoria.
3. **Freschezza**: intento "real-time" onorato con **fetch server-side della lista FortunePlay
   + cache TTL ~30s + match a tutte le card** (NON una chiamata per-card: il cap anti-hammering
   dello scraper esiste apposta). Quote fresche ~30s, zero martellamento del partner.

## Stato attuale (ricognizione)

- **Ingestione FortunePlay GIÀ esistente** (lato Python): `core/sportsbook/fortuneplay.py`
  (`#FORTUNEPLAY-ODDS-1`) scarica dall'endpoint REST pubblico BetConstruct
  (`https://www.fortuneplay.com/_sb_api/api/v2/matches`) calcio+tennis, 1X2/match-winner + U/O,
  prematch+live, e scrive in `odds_snapshots` (`source='fortuneplay'`, `market='match'`,
  chiave `team_pair_key`). Lo scraper agent (`agents/sportsbook_scraper.py`) lo esegue.
- **`odds_snapshots` è write-only**: nessun consumer la rilegge per il serving → il lato app
  TypeScript non sa nulla delle quote FortunePlay. `team_pair_key` non compare nel TS.
- **Affiliate link attuale**: `lib/affiliate.ts:29` `FORTUNEPLAY_BET_URL = "https://mediaroosters.com/aacugmydl8"`
  (short-link → landing). Bottone card `app/app/page.tsx:8143` `onBetNow` apre questo landing.
- **Adapter**: `lib/sportsbooks/adapters/fortuneplay.ts` = `landingAdapter` (prefilled=false).
  Registry/infra multi-book (`lib/sportsbooks/*`, `app/api/bet-links/route.ts`) pronta ma unwired dal FE.
- **Card**: `PredictionCard` (`app/app/page.tsx:4479-4721`) e `TennisMatchCard`
  (`~4951-5180`). Mostrano già una quota "di mercato" da The Odds API (Pinnacle/Bet365/Betfair)
  via `match_predictions.odds_*` + `lib/odds-api.ts`. Tipo `Prediction` ~1605-1637.
- **Feasibility deep-link**: il match object FortunePlay porta `slug` (es. "netherlands-morocco"),
  `id` (es. 70395717), `urn_id` (es. "bc:match:30142329"). Campi `url`/`seo` sono null.
  → abbastanza per costruire l'URL pagina-partita; **pattern esatto da verificare** (step 0).

## Architettura proposta

### Unità 1 — `lib/fortuneplay-live.ts` (server, sorgente quote)
- `fetchFortuneplayBoard(): Promise<Map<string, FpMatch>>`
  - Scarica la lista BetConstruct (paginata, `_MAX_PAGES` cap come lo scraper Python), header come lo scraper.
  - In-memory TTL-cache (~30s) per evitare hammering tra richieste ravvicinate.
  - Per ogni match estrae: `team_pair_key` (riuso `normName` da `lib/odds-api.ts`, stessa
    normalizzazione del Python `_pair_key`: `YYYY-MM-DD:norm_a|norm_b` ordinato; tennis usa
    canonical player key), `slug`, `id`, `urn_id`, odds 1X2/match-winner + U/O.
  - Parse **per posizione** (come il Python: il `name` è localizzato, inaffidabile). Odds
    BetConstruct = intero ÷ 1000.
  - Ritorna mappa `team_pair_key → FpMatch` per lookup O(1).
- Errore/timeout → mappa vuota (mai solleva: la card degrada al landing).
- **Dipende da**: endpoint pubblico FortunePlay, `normName`. **Non dipende da** DB.

### Unità 2 — `GET /api/fortuneplay-odds` (API serving)
- Input: lista di partite del board (o nessuno → tutte). Output JSON:
  `{ [team_pair_key]: { odds_home, odds_draw, odds_away, total_line, total_over, total_under, matchUrl, prefilled } }`.
- `matchUrl`: costruito da slug+id con affiliate code; **fallback al landing** se la partita
  non è nel feed o non deep-linkabile (`prefilled=false`).
- `dynamic = "force-dynamic"`, cache breve coerente con la TTL della sorgente.
- **Alternativa considerata e scartata**: arricchire `/api/predictions` direttamente. Scartata
  per isolamento (predictions è già pesante/lenta, `maxDuration=300`) e per poter aggiornare le
  quote più spesso del board predizioni. Endpoint separato = refresh indipendente lato FE.

### Unità 3 — deep-link adapter `lib/sportsbooks/adapters/fortuneplay.ts`
- **Step 0 (bloccante)**: verificare su una partita live reale (browser) il pattern URL pagina-partita
  FortunePlay e quali campi servono (slug? id? locale?). Documentare il pattern verificato nel codice.
- Da `landingAdapter` → builder `(sel, book) => { url, prefilled:true }` che produce l'URL
  pagina-partita; se mancano i dati → `landingAdapter` (prefilled=false).
- Mantiene la firma `BookAdapter` esistente → zero impatto su Stake/Roobet.

### Unità 4 — UI card (`app/app/page.tsx`)
- Tipo `Prediction` (o stato FE separato): aggiungere campo opzionale
  `fortuneplay?: { oddsHome, oddsDraw, oddsAway, total*, matchUrl, prefilled }`.
- FE: fetch `/api/fortuneplay-odds` per il board visibile, refresh ~30s (es. SWR/interval),
  merge per `team_pair_key`.
- Render in `PredictionCard` e `TennisMatchCard`:
  - Riga "Quota FortunePlay: X.XX" sulla pick (`best_selection`).
  - **Edge vs FortunePlay**: `edgeFp = p_pick * fpOdds_pick − 1` (model prob × quota decimale − 1).
    Mostrato con guardrail di copy (vedi sotto). Se quota FP assente → niente edge FP, card invariata.
  - Bottone "Place bet" → `matchUrl` (deep-link) invece del landing.
- **Degradazione**: se l'endpoint fallisce o la partita non è nel feed, la card resta esattamente
  come oggi (landing link, nessuna riga FP). Nessuna regressione.

## Guardrail FTC (copy edge vs FortunePlay)
- Niente "batti il bookmaker"/"profitto garantito"/"vinci". Linguaggio: "value indicativo del
  nostro modello rispetto alla quota FortunePlay", probabilistico, con disclaimer.
- Disclaimer +18 / gioco responsabile già presenti devono coprire anche questa sezione.
- **Review legale (`legale-compliance`) obbligatoria sul copy prima del go-live** — parte del gate.

## Matching & edge cases
- Match per `team_pair_key` (data + nomi normalizzati). Mismatch nomi (alias) → quota FP assente
  per quella partita (degradazione pulita), come già accade per il live-score matching.
- Tennis: `canonical_player_key` lato TS — verificare parità con il Python (`core/tennis_names.py`).
  Se non c'è equivalente TS, è un sotto-task (porting minimo o esporre via piccola util).
- Doppio mercato U/O: mostrare solo la linea principale (come il Python).
- Quota FP per la pick del modello: se la pick è "draw" ma è match-winner a 2 vie (tennis) → niente draw.

## Cosa NON tocchiamo (surgical)
- Modello di prediction, `match_predictions`, edge "di mercato" storico (resta vs consenso sharp dove già usato).
- Scraper Python → `odds_snapshots` (resta per shadow-eval; non diventa il path di serving).
- Stake/Roobet adapters, registry multi-book.

## Verifica (Costruito ≠ Verificato ≠ Operativo)
- Step 0 URL pattern verificato su partita reale (screenshot/HAR).
- Unit test parse `lib/fortuneplay-live.ts` (riuso fixtures stile `tests/test_fortuneplay_parse.py`).
- Test match `team_pair_key` TS == Python su un set di partite reali.
- Visual check da loggato (calcio + tennis + WC): quota FP mostrata, edge FP coerente, bottone
  apre la partita giusta su FortunePlay. Degradazione verificata (partita non nel feed → landing).
- Verifica che lo scraper/feed FortunePlay sia effettivamente raggiungibile in prod (env, IP).

## Gate di approvazione
- Task medium/high-risk → **PROPOSAL + APPROVE umano** prima di deploy.
- Blocco aggiuntivo: **OK legale sul copy edge vs FortunePlay**.
- Env: confermare `SPORTSBOOK_FORTUNEPLAY_*` su Vercel (oggi il book è OFF lato TS perché manca la URL).

## Follow-up (fuori scope)
- Mercati soft FortunePlay (800+: corner/cartellini/props) — `#FORTUNEPLAY-SOFT-MARKETS-2`.
- Schedina precompilata vera (selezione aggiunta al betslip) — richiede supporto operatore BetConstruct.
- Riattivazione UI dropdown multi-book quando arrivano altri partner (`app/api/bet-links` già pronta).

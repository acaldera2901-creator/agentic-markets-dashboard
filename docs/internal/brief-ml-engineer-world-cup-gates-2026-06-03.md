# Brief ML-Engineer — World Cup Gates: national_team_model + venue_context
**Data:** 2026-06-03 · **Owner:** ml-engineer-agentic · **Deadline:** 2026-06-11
**Richiedente:** Andrea (segretaria) · **Priorità:** Alta — gate bloccante per publication tier

---

## Contesto

Il World Cup 2026 inizia l'**11 giugno**. Il sistema Agentic Markets ha già:
- Fixture feed live da The-Odds-API (`soccer_fifa_world_cup`, 72 match confermati, kickoff UTC da 2026-06-11 a 2026-06-28, endpoint `/events` a 0 crediti)
- Struttura di scoring dati (`core/world_cup_data_quality.py`) con pesi precisi
- Modello national-team vuoto (`core/world_cup_team_model.py`) che restituisce `data_quality=0.0` su tutti i match perché non ci sono match storici nel history buffer

La publication_tier attuale è `monitor_only` su tutti i match WC. Per passare a `paper_only` (score >= 0.65) e poi a `signal_allowed` (score >= 0.78) servono due gate ML:

1. `national_team_model` — peso 0.15 nella formula totale
2. `venue_context` — peso 0.10 nella formula totale

---

## Gate 1 — `national_team_model`

### Obiettivo
Popolare il buffer storico di `matchup_profile()` con risultati internazionali reali, in modo che `build_profile()` restituisca `data_quality >= 0.75` per le 32+ squadre partecipanti al WC2026.

### File coinvolti
- `~/Desktop/agentic-markets/core/world_cup_team_model.py` — logica principale (129 righe). La funzione `build_profile()` legge una lista di dict `{home_team, away_team, home_goals, away_goals}`. La `data_quality` scala linearmente: `min(1.0, n/20)`. Serve n >= 20 match per squadra per raggiungere quality=1.0; n >= 15 per quality=0.75 (soglia signal).
- `~/Desktop/agentic-markets/agents/model.py` (righe 216-245) — passa `self._history.get(league, [])` a `matchup_profile()`. Questo buffer va popolato al bootstrap o tramite un loader dedicato.
- `~/Desktop/agentic-markets/tests/test_world_cup_team_model.py` — test esistenti, da far passare tutti.

### Cosa serve fare
1. **Dataset storico nazionali** — raccogliere >= 20 match per squadra (idealmente 30-50) per le 32+ nazioni WC2026. Formato minimo: `{home_team, away_team, home_goals, away_goals, date}`.
2. **Loader** — integrare nel bootstrap di `ModelAgent` (o in un `WorldCupHistoryLoader` separato) che popola `self._history["WC2026"]` prima del loop principale.
3. **Team name normalization** — i nomi delle squadre nell'history devono matchare quelli dell'API (`South Korea`, `USA`, `Bosnia & Herzegovina` ecc. — vedi lista esatta fixture sotto).

### Fonti dati candidate (NO API-Football, 0 costo)

| Fonte | Cosa dà | Path suggerito |
|---|---|---|
| **Rsssf.com** (free) | Archivio storico risultati internazionali FIFA, tutte le nazioni, dal 1990 ad oggi | Scraping HTML o CSV da mirrors |
| **football-data.co.uk** | Non copre nazionali direttamente, ma ha WC/EURO storici | Controlla `int/` section |
| **Wikipedia / API MediaWiki** | Risultati WC 2022, 2018, 2014, EURO, AFCON, COPA America (strutturati nelle tabelle wiki) | Via `requests` + `BeautifulSoup` |
| **Kaggle dataset "International Football Results 1872-2024"** | CSV gratuito, 47K+ match internazionali, include qualificazioni | `kaggle datasets download martj42/international-football-results-from-1872-to-2017` — aggiornato a 2024 |
| **GitHub jfjelstul/worldcup** | Dataset WC completo strutturato (R/CSV) | Clone + `data/matches.csv` |
| **StatsBomb Open Data** | Event data campione WC 2018 (free JSON) | Per feature future, non per questo gate |

**Raccomandazione:** il dataset Kaggle `martj42/international-football-results` è il quickest win — CSV pronto, copre tutte le nazioni WC2026 con abbondanza di match. Filtrare su `tournament` in (`FIFA World Cup`, `FIFA World Cup qualification`, `Friendly`, `AFC Asian Cup`, `CAF Africa Cup of Nations`, `CONMEBOL Copa America`, `UEFA Euro`) e su `date >= 2016-01-01` per avere dati recenti.

### Definition of Done
- `build_profile(matches, team)` restituisce `data_quality >= 0.75` per almeno 30 delle 32 nazioni WC2026
- `matchup_profile(matches, team_a, team_b)` restituisce `data_quality >= 0.75` e `blocked_reason=None` per le prime 8 fixture del 11-12 giugno (Mexico/SA, SKorea/CzechRep, Canada/Bosnia, USA/Paraguay, Qatar/Switzerland, Brazil/Morocco, Haiti/Scotland, Australia/Turkey)
- `world_cup_national_model_quality` nel payload model.py >= 0.75
- Tutti i test in `tests/test_world_cup_team_model.py` passano
- **Impatto sul total_score:** con `historical_depth_quality=0.75` e `fixture/odds/identity` a piena copertura, il contributo sale da 0.00 a +0.1125 (0.75 × 0.15). Sufficiente a portare un match ben quotato da `monitor_only` a `paper_only`.

### Nomi squadre presenti nelle fixture (da normalizzare)
Mexico, South Africa, South Korea, Czech Republic, Canada, Bosnia & Herzegovina, USA, Paraguay, Qatar, Switzerland, Brazil, Morocco, Haiti, Scotland, Australia, Turkey (estratte dalle prime 8 fixture — lista completa a 72 match nell'endpoint `/events`).

---

## Gate 2 — `venue_context`

### Obiettivo
Popolare i campi `rest_days_team_a`, `rest_days_team_b`, `travel_distance_km_team_a`, `travel_distance_km_team_b`, `timezone_shift_team_a`, `timezone_shift_team_b` nel `WorldCupContext` per ogni fixture WC2026.

Oggi questi 6 campi sono `None` in `build_world_cup_context()`, il che abbassa `data_completeness_score` a 0.4 (4 su 10 campi presenti: stage, venue, host_city, venue_country quando inferibili) e tiene `venue_context_quality` bassa.

### File coinvolti
- `~/Desktop/agentic-markets/core/world_cup_context.py` — classe `WorldCupContext` (righe 49-72) con i 6 campi None, funzione `build_world_cup_context()` (righe 186-243). I campi `required` che mancano sono esplicitamente listati a riga 199-210.
- `~/Desktop/agentic-markets/core/world_cup_data_quality.py` — `_score_context()` usa `data_completeness_score` dal context. Serve >= 0.78 per score context pieno.
- `~/Desktop/agentic-markets/tests/test_world_cup_context.py` — test esistenti.

### Cosa serve fare
1. **rest_days** — derivabile dal calendario fixture (già disponibile dai 72 eventi `/events`): `rest_days = (kickoff_match_n - kickoff_match_n-1).days` per ogni squadra. Richiede un registro per squadra degli ultimi kickoff. In fase di group stage: ogni squadra gioca ogni ~4gg quindi rest tipicamente 3-5gg. Questo va calcolato iterativamente man mano che si popola il calendario.

2. **travel_distance_km** — distanza geografica dal paese di origine al venue. Serve una lookup table `{team → home_country_lat_lon}` e `{venue_city → lat_lon}` (le città host sono già in `HOST_CITY_COUNTRY` del file). La distanza può essere calcolata con `geopy.distance.great_circle()` o la formula Haversine — nessuna API esterna richiesta.

3. **timezone_shift** — differenza di fuso orario tra paese di origine e venue. Serve `{team → home_timezone}` + `{venue_city → timezone}` (Atlanta=ET, Dallas=CT, Houston=CT, Miami=ET, NewYork=ET, Philadelphia=ET, SanFrancisco=PT, Seattle=PT, Toronto=ET, Vancouver=PT, Guadalajara=CT, MexicoCity=CT, Monterrey=CT). Calcolo con `pytz` o `zoneinfo` stdlib.

### Approccio consigliato
Creare `core/world_cup_venue_context.py` con:
```python
TEAM_HOME_COORDS = {...}          # dict {team_name → (lat, lon)}
TEAM_HOME_TIMEZONE = {...}        # dict {team_name → tz_string}
VENUE_CITY_COORDS = {...}         # già derivabile da HOST_CITY_COUNTRY + geocoords statici
VENUE_CITY_TIMEZONE = {...}       # come sopra

def enrich_venue_context(fixture: dict, team_a_prev_kickoff: datetime | None, team_b_prev_kickoff: datetime | None) -> dict:
    # Restituisce i 6 campi da passare a build_world_cup_context()
```

Le coordinate e timezone sono dati statici (< 100 nazioni) — nessuna API esterna, nessun costo.

### Definition of Done
- `build_world_cup_context()` restituisce `data_completeness_score >= 0.78` per i match dove stage+venue+city+venue_country sono noti (tutti i 72 già scheduled)
- I 6 campi (`rest_days_*`, `travel_distance_km_*`, `timezone_shift_*`) sono valorizzati e non `None` per le prime 8 fixture
- `venue_context_quality >= 0.78` nel `WorldCupDataQuality` output
- Test `tests/test_world_cup_context.py` tutti passanti
- **Impatto sul total_score:** con `venue_context_quality=0.78`, il contributo passa da 0.00 a +0.078 (0.78 × 0.10).

---

## Impatto cumulativo sul total_score (stima)

Con entrambi i gate completati, su un match con fixture completa + odds buone:

| Layer | Peso | Score attuale | Score target | Contributo |
|---|---|---|---|---|
| fixture_quality | 0.20 | 1.00 | 1.00 | +0.20 |
| odds_quality | 0.20 | 0.85 (overround ~5%) | 0.85 | +0.17 |
| team_identity_quality | 0.15 | 1.00 | 1.00 | +0.15 |
| historical_depth_quality | 0.15 | 0.00 | **0.75** | **+0.1125** |
| venue_context_quality | 0.10 | 0.00 | **0.78** | **+0.078** |
| squad_news_quality | 0.10 | 0.00 | 0.00 | +0.00 |
| settlement_quality | 0.10 | 0.00 | 0.00 | +0.00 |
| **TOTALE** | | **~0.52** | **~0.71** | |

Score 0.71 = **paper_only** (>= 0.65). Per raggiungere `signal_allowed` (>= 0.78) serve anche `squad_news_quality` (terzo gate, separato). Ma `paper_only` è il primo livello funzionale — sufficiente per il lancio 11/06.

---

## Output atteso dall'ml-engineer

Entro **2026-06-11 ore 08:00 UTC** (prima delle prime fixture):

1. Dataset storico nazionali caricato e accessibile al `ModelAgent` (file CSV in `data/national_teams/` o loader integrato)
2. `core/world_cup_venue_context.py` con lookup tables complete per le 32 nazioni
3. Tutti i test WC passanti (`pytest tests/test_world_cup_team_model.py tests/test_world_cup_context.py -v`)
4. Verifica manuale: `python scripts/verify_world_cup_gates.py` (da creare o equivalente) che stampa `total_score` e `publication_tier` per i primi 8 match
5. Report "cosa è cambiato vs questo brief" (file `docs/internal/gate-delivery-YYYY-MM-DD.md`)

Nessun deploy in produzione senza OK Andrea. Tutto gira in paper/parallelo finché non arriva la conferma.

---

## Riferimenti
- `~/Desktop/agentic-markets/core/world_cup_data_quality.py` — formula scoring completa
- `~/Desktop/agentic-markets/core/world_cup_context.py` — WorldCupContext struct
- `~/Desktop/agentic-markets/core/world_cup_team_model.py` — NationalTeamProfile + matchup_profile
- `~/Desktop/agentic-markets/agents/model.py` — ModelAgent, punto di integrazione
- `~/Desktop/agentic-markets/docs/research/prediction-upgrade-2026-06.md` — contesto tecnico completo
- The-Odds-API sport key: `soccer_fifa_world_cup` — 72 fixture confermati, endpoint `/events` (0 crediti)

# Prediction Upgrade — Deep Research & Architettura Multi-Sport
**Data:** 2026-06-03 · **Owner:** ml-engineer-agentic · **Stato:** ricerca + design (pre-implementazione)
**Obiettivo (Andrea):** alzare la precisione reale delle predizioni football + tennis, implementare i dati necessari nel flusso, architettura pronta a sport futuri.

---

## 0. Il vero collo di bottiglia (dato dal backtest precedente)

Backtest Dixon-Coles vs Poisson v1 sugli stessi 3214 match: **identici** (Brier ~0.571 vs ~0.569). La letteratura conferma un **tetto di accuratezza ~56-59%** per i modelli a soli gol (Poisson/Dixon-Coles/xG-Poisson). Quindi:

> **Non è il modello a essere debole — è l'informazione che gli diamo in pasto e il modo in cui validiamo.** Cambiare la forma del modello a parità di dati non muove l'ago. Il guadagno vero arriva da: (1) **dati di mercato** (closing odds → CLV/ROI, l'unico metro che dice se batti il bookmaker), (2) **feature informative** (xG shot-based, formazioni, riposo/fatigue), (3) **calibrazione** (conformal/isotonic), (4) **validazione walk-forward seria**.

---

## 0bis. BASELINE MISURATO (2026-06-03) — CLV/ROI vs Pinnacle closing

Backtest su 6804 match reali (PL/BL1/SA/PD/FL1, stagioni 2021-2024), `scripts/backtest_clv.py`:

| Metrica | Dixon-Coles | Poisson v1 | Mercato (Pinnacle) |
|---|---|---|---|
| Brier | 0.651 | 0.599 | **0.575** |
| ROI @ closing | −6.57% | −6.44% | — |

**Conclusioni dure:** (1) il mercato è più accurato dei nostri modelli; (2) nessun modello batte la chiusura (−6.5% ROI = marginalità bookmaker); (3) DC senza time-decay è peggio del Poisson. Implicazione strategica: battere Pinnacle sul 1X2 è il bar più alto possibile; l'edge va cercato in mercati meno efficienti (leghe minori, props, in-play, exchange) + feature ricche, non sulla main line dei top book.

**Update 2026-06-03 — time-decay aggiunto al DC (half-life 120gg):**

| Metrica | DC no-decay | DC + time-decay | Poisson v1 | Mercato |
|---|---|---|---|---|
| Brier | 0.6507 | 0.6495 | 0.599 | 0.575 |
| ROI @ closing | −6.57% | −5.26% | −6.44% | — |

Il time-decay migliora l'ROI ma non il Brier. **Il DC resta meno calibrato del Poisson v1 perché il Poisson ha lo shrinkage e il DC no.** Decisione di rotta (Andrea, 2026-06-03): il prodotto vende **probabilità calibrate + insight**, non edge sul bookmaker. Quindi il modello base resta il Poisson v1 shrinkato (già servito); i prossimi lever di calibrazione sono: (a) regolarizzare il DC, (b) calibrazione conformal/isotonic, (c) feature reali (xG/riposo). Non altro tuning del DC.

**Update 2026-06-03b — Poisson v2 + calibrazione + sweep (verdetto definitivo):**

Costruito `models/poisson.py` (PoissonModel: shrinkage + time-decay + tau Dixon-Coles) e `models/calibration.py` (isotonic). Sweep su 6829 match (`scripts/sweep_poisson.py`):

| Config | Brier |
|---|---|
| Poisson v1 (baseline) | 0.59944 |
| v2 plain (s4) | 0.59944 |
| v2 +tau (rho −.10) | 0.59918 |
| v2 +decay (hl120) | 0.60301 (peggio) |
| v2 +both | 0.60308 |
| **v2 shrink8 (best)** | **0.59891** |
| v2 shrink2 | 0.60144 |
| Market (Pinnacle) | 0.57493 |

Calibrazione isotonic (`scripts/backtest_poisson.py`, split temporale): guadagno Brier ~0 → **le probabilità sono già calibrate**.

**Verdetto:** il miglior Poisson su soli gol = **shrinkage 8 + tau −0.10, NO time-decay**, ma batte il v1 solo dello 0.09% (rumore). Time-decay peggiora (top league stabili). La calibrazione non aggiunge informazione. **Il gap col mercato (0.575 vs 0.599, ~4% rel.) è un gap di INFORMAZIONE, non di forma/calibrazione.** → Il prossimo lavoro che muove davvero l'ago è l'ingest delle **feature** (xG, formazioni/assenze, riposo/congestione), non altro tuning del modello a gol.

**Stato modelli:** v1 (servito ai clienti) resta il base; v2 è disponibile, marginale; nessuna promozione al cliente (l'upgrade vero arriva con le feature).

## 0ter. INVENTARIO DATI + FEATURE CHE ABBIAMO (2026-06-03c)

**Audit storico repo:** abbiamo solo risultati/gol/date/matchday + medie lega (`match_results.csv`, `team_stats.csv`, `league_stats.csv`, `matches_cache.json`). Nessuno xG/formazioni/infortuni storici. Le funzioni in `models/features.py` (xg_luck_streak, ah_odds_movement, referee) esistono ma **aspettano dati che non abbiamo**.

**Implementato (`models/match_features.py`, derivato da dati che abbiamo):** PiRating incrementale (port di lib/pi-rating.ts), riposo, congestione, form. Stacking logistico su Poisson + queste feature (`scripts/backtest_features.py`):

| Modello | Brier |
|---|---|
| Poisson v1 (base) | 0.59887 |
| Poisson + feature HAVE (logit) | 0.59746 (+0.24%) |
| Market | 0.57731 |

→ chiude **6.5%** del gap col mercato. Influenza feature (mean |coef|): **pi_diff 0.117 (la più forte)**, form 0.086, rest 0.027, congestion 0.007. Riposo/congestione quasi inutili sui top campionati. **Il ~93.5% del gap residuo è informazione esterna mancante (xG/formazioni).**

### ✅ ABBIAMO (storico/backtestabile) — IMPLEMENTATO
pi-rating · form · riposo · congestione · medie lega · closing odds (solo validazione).

### 🎾 TENNIS — implementato (2026-06-03d)
Ingest Sackmann (`core/tennis_data.py`, 11712 match ATP 2021-24, free GitHub), surface-Elo (`models/tennis_elo.py`), serve/return + fatigue + H2H, stacking logistico (`scripts/backtest_tennis.py`):

| Modello | Brier | Acc |
|---|---|---|
| Rank baseline | — | 63.5% |
| Surface-Elo only | 0.21959 | 63.3% |
| Elo + serve/return/fatigue/H2H | 0.21749 | **64.6%** |

Le feature contano (elo_diff 0.521, rank 0.433, **serve_diff 0.219**). Architettura multi-sport validata. Manca: odds tennis-data.co.uk per il baseline-mercato.

### 🔧 xG — INGESTITO E MISURATO (2026-06-03e) ✅ IL LEVER
Understat aveva cambiato struttura (niente più `datesData`; ora endpoint XHR `/getLeagueData/{slug}/{season}` con header `X-Requested-With`, dietro Cloudflare). Risolto con Playwright (`scripts/scrape_understat_xg.py`): **7156 match con xG per-match** scaricati in `data/understat/` (5 leghe × 4 stagioni). Loader `core/understat_data.py`, backtest `scripts/backtest_xg.py` (xG-form running attack/difesa per squadra).

| Modello (Understat, 3415 eval) | Brier | Gap chiuso |
|---|---|---|
| Poisson only | 0.59348 | — |
| + pi + form (no xG) | 0.58921 | 23% |
| **+ xG form** | **0.58236** | **60%** |
| Market (Pinnacle ref) | 0.575 | 100% |

**Lo xG è la feature più forte (|coef| xg_off 0.182, la più alta di tutte) e chiude il 60% del gap col mercato.** Confermato col dato reale: il gap era informazione = xG.

**Compensare prima del contratto API-Football (2026-06-03f):** aggiunti npxG + pressing (ppda) dall'endpoint Understat. Risultato: 0.58236 → 0.58233, **nessun guadagno** — npxG è collineare con xG, ppda |coef| 0.024 trascurabile. **Lo xG è il soffitto di Understat (60% del gap).** Il restante 40% = formazioni/infortuni/team-news (API-Football) — nessun sostituto gratuito lo recupera. In attesa del contratto.

Prossimi: join xG↔fd.co.uk (name-map) + productionization nel serving cliente (Python→unified_predictions, gated da conferma Andrea = deploy); formazioni/infortuni dopo il contratto.

### 🚀 PRODUCTIONIZATION xG (2026-06-03g) — paper/parallelo, NON ancora servito ai clienti
- `core/team_mapping.py`: Understat→fd.co.uk, **copertura 100%** su tutte le leghe (test live).
- `models/xg_model.py`: `XGModel` riutilizzabile (fit/predict/**update**) — impacchetta il modello validato (Poisson v2 + pi + form + xG-form → logistic).
- `core/supabase_client.py::xg_prediction_to_unified_row`: riga `unified_predictions` taggata `model_version=football-xg-v1`, `source_table=xg_predictions`, `is_paper=True` — dedup namespace distinto, **non sovrascrive mai il Poisson v1 servito**.
- `scripts/verify_xg_path.py`: verifica end-to-end (dry-run, nessun insert live).

**Verifica:** path OK end-to-end. Brier held-out con **stato fresco** 0.587 (batte base 0.589, verso mercato 0.575); con **stato congelato** 0.593 (edge svanisce). → **Requisito operativo: il modello va ri-allenato/aggiornato a ogni giornata** (`update()` per i risultati in arrivo tra un retrain e l'altro). Il backtest pulito (split 50/50 + refit) resta il riferimento di qualità: 0.582 = 60% del gap.

**Resta gated (= deploy, conferma Andrea):** il flip al serving cliente. Tutto il resto è paper/parallelo e non tocca ciò che vedono i clienti.

### ❌ MANCANTI — da ingestire (in ordine di impatto atteso)
1. **xG storico** (Understat/FBref scraping) — il pezzo più grosso del gap residuo.
2. **Formazioni/assenze** (API-Football, già pagata; serve storicizzarle).
3. **Odds movement** apertura→chiusura (fd.co.uk ha le aperture).
4. **Importanza/motivazione** (classifica, derivabile — `motivation_score` pronto).
5. **Arbitro**, **meteo storico** (impatto minore).
6. **Tennis (Sackmann)** — non ancora ingestito.

## 1. FOOTBALL — cosa manca e dove prenderlo

### 1.1 Dati mancanti, in ordine di impatto
| # | Dato | Perché muove l'ago | Nel repo oggi? |
|---|---|---|---|
| 1 | **Closing odds** (Pinnacle/Bet365/Betfair) | Unico ground truth per misurare edge reale (CLV) e calibrare. Pinnacle ≈ probabilità "vera". | ❌ assente |
| 2 | **xG / xGA shot-based** (per team, storico) | Segnale predittivo > gol grezzi; XGBoost su shot data → AUC 0.878, Brier 0.069. | ⚠️ parziale (Understat lib TS esiste, no storico strutturato) |
| 3 | **Formazioni confermate + assenze** | Un titolare chiave out sposta le quote del 5-15%. | ❌ (API-Football enrichment c'è ma non integrato come feature) |
| 4 | **Riposo / congestione calendario** | Giorni dall'ultima gara, viaggi, terzo match in 7gg. Derivabile dal calendario, costo zero. | ❌ derivabile |
| 5 | **Importanza match** | Lotta titolo/salvezza/nulla da chiedere a fine stagione. | ⚠️ parziale (`context/match_type.py`) |
| 6 | **Market movement** (apertura→chiusura) | La direzione in cui si muove il mercato è informativa. | ❌ |

### 1.2 Fonti — FREE vs PAID
| Fonte | Cosa dà | Costo | Note |
|---|---|---|---|
| **football-data.co.uk** | Risultati + **closing odds** Pinnacle/Bet365/Betfair, 16+ leghe, dal 2000 a 2025/26, CSV | **FREE** | ⭐ Sblocca subito #1 e #6. Rate-limit gentile. Update entro pochi giorni dal turno. |
| **Understat** (già in `lib/understat.ts`) | xG/xA team+player, Big5 | FREE (scraping) | Grigio legale per uso commerciale, si rompe se cambiano il sito. |
| **FBref (StatsBomb-powered)** | xG/xA + 100+ competizioni | FREE (scraping) | ToS-risk in produzione. |
| **StatsBomb Open Data** | Event data campione | FREE (GitHub) | Non live, ottimo per training xG, non per fixture correnti. |
| **API-Football** (già usata nel repo) | Fixture, formazioni, infortuni, predictions | **PAID ~$19/mo** Pro | Già integrata (`lib/api-football-enrichment.ts`). Copre #3. |
| **TheStatsAPI** | 80 competizioni, xG, odds, 10 anni | **PAID ~$50/mo** | Singola integrazione al posto dello scraping Understat/FBref. |
| Opta / Sportmonks pro | Dati enterprise | PAID alto/enterprise | Fuori scope individuale. |

**Raccomandazione football:** #1 + #6 **subito e gratis** (football-data.co.uk). #2 xG storico via Understat/FBref (free, accettando il rischio scraping) o consolidarlo via TheStatsAPI ($50/mo) se vogliamo robustezza produzione. #3 già pagato (API-Football) — va solo trasformato in feature.

---

## 2. TENNIS — cosa manca e dove prenderlo

### 2.1 Dati mancanti, in ordine di impatto
| # | Dato | Perché | Nel repo oggi? |
|---|---|---|---|
| 1 | **Closing odds tennis** | Stesso ruolo del football: misura edge reale. | ❌ |
| 2 | **Surface-Elo + serve/return stats** | Lo standard tennistico. Serve strength = predittore #1 (random forest). | ⚠️ `models/elo_surface.py` c'è, ma senza serve/return |
| 3 | **Fatigue** (minuti/distanza recenti, match negli ultimi 7-14gg) | Forte su best-of-5 e tornei fitti. | ❌ derivabile |
| 4 | **H2H pesato + ranking dynamics** | H2H per superficie, momentum ranking. | ❌ |
| 5 | **Ritiri / point-by-point** | Per modelli mid-match e gestione rischio. | ❌ |

### 2.2 Fonti — FREE vs PAID
| Fonte | Cosa dà | Costo | Note |
|---|---|---|---|
| **Jeff Sackmann `tennis_atp`/`tennis_wta`** (GitHub) | **60K+ match ATP+WTA 1968-2024**, surface/round/result + **serve/return stats** | **FREE** | ⭐ Base completa per surface-Elo + serve/return + fatigue. |
| **Sackmann Match Charting Project** | **Point-by-point** (Slam, 2018-2024) | **FREE** | Per modelli mid-match / live. |
| **tennis-data.co.uk** | Risultati + **odds** ATP/WTA | **FREE** | Sblocca le closing odds tennis. |
| **jgollub1/tennis_match_prediction** | Codice ricerca win-prob / serve forecasting | FREE (ref) | Riferimento metodologico. |

**Raccomandazione tennis:** tutto il necessario è **FREE** (Sackmann + tennis-data.co.uk). Il tennis è il quick win: zero costi, dati ricchi, modello attuale (`elo_surface.py`) già pronto da potenziare.

---

## 3. Upgrade di METODO (a prescindere dai dati)

1. **Time-decay weighting** nel fit Dixon-Coles (oggi pesa tutte le gare uguali). Letteratura: half-life ~ alcune settimane. *(warm-start già aggiunto per rendere il walk-forward sostenibile.)*
2. **Validazione walk-forward corretta**: stesso refresh-rate per i modelli confrontati, niente staleness asimmetrica (l'artefatto visto prima).
3. **Metriche di mercato**: oltre a Brier/log-loss → **CLV e ROI** vs closing Pinnacle. È il solo metro che conta commercialmente.
4. **Calibrazione**: conformal (già in `models/conformal.py`) o isotonic, a valle del modello, per affidabilità reale → sostituisce la guardia min-match grezza del P0 #3.
5. **Ensemble** (fase 2): gradient boosting (CatBoost/XGBoost) su feature ricche, blendato col Dixon-Coles. Da fare solo DOPO aver caricato le feature (#2,#3 football).

---

## 4. Architettura MULTI-SPORT (design)

Astrazione sport-agnostica, contratti chiari, serving cliente invariato:

```
core/sports/
  base.py            # Protocol: SportAdapter
  football.py        # FootballAdapter
  tennis.py          # TennisAdapter
  registry.py        # SPORTS = {"football": ..., "tennis": ...}

# Pipeline condivisa (per ogni sport):
DataSource → FeatureBuilder → Model(fit/predict) → Calibrator → UnifiedWriter
```

**Contratti (Protocol):**
- `DataSource.fetch_history() / fetch_upcoming()` → record normalizzati
- `FeatureBuilder.build(records)` → feature frame (sport-specifico ma interfaccia comune)
- `Model.fit(X) / predict(X)` → probabilità calibrate + reliability
- `UnifiedWriter` → unico writer verso `unified_predictions` (già esiste per il football DC), parametrizzato per `sport`/`model_version`/`source_table`

**Principi:**
- Aggiungere uno sport = implementare 1 adapter + registrarlo. Zero modifiche al serving TS.
- `unified_predictions` resta la tabella unica di output (già multi-sport: ha football e tennis).
- Niente logica sport-specifica hard-coded fuori dagli adapter.

---

## 5. ROADMAP PRIORITIZZATA

### P0 — FREE, alto impatto (implementabile subito, zero costi/chiavi)
- [ ] **Ingest football-data.co.uk** (closing odds + risultati storici) → `data/`, loader in `core/`.
- [ ] **Ingest Sackmann + tennis-data.co.uk** (match + serve/return + odds) → `data/`.
- [ ] **Backtest CLV/ROI** vs closing Pinnacle (non solo Brier). Ri-baseline DC e Poisson sul metro vero.
- [ ] **Time-decay** nel Dixon-Coles + walk-forward corretto → misura delta.
- [ ] **Feature riposo/congestione** (football + tennis) — derivabili dal calendario, costo zero.
- [ ] **Scheletro `core/sports/`** (adapter football+tennis) senza rompere il serving.

### P1 — FREE ma più fragile / o PAID già posseduto
- [ ] **xG storico** via Understat/FBref (free, rischio scraping) → feature.
- [ ] **Formazioni/assenze** da API-Football (già pagata $19/mo) → feature.
- [ ] **Surface-Elo + serve/return** potenziato nel tennis.
- [ ] **Calibrazione conformal/isotonic** al posto della guardia min-match.

### P2 — richiede DECISIONE/SPESA di Andrea
- [ ] **TheStatsAPI $50/mo** — xG+odds robusti in un'unica fonte produzione (alternativa allo scraping). → vale se vogliamo togliere il rischio legale/fragilità dello scraping.
- [ ] **Ensemble gradient boosting** (CatBoost) — dopo che le feature P0/P1 sono in casa.

---

## 6. DECISIONI PER ANDREA
1. **P0 è tutto FREE** → posso procedere a implementarlo senza spese né tue chiavi. OK a partire?
2. **xG in produzione**: scraping Understat/FBref (free, fragile, grigio legale) **oppure** TheStatsAPI $50/mo (robusto, pulito)? Per un prodotto venduto ai clienti, la seconda è più difendibile.
3. **Promozione al cliente**: nessun modello passa al serving cliente senza tuo OK esplicito (= deploy produzione). I miglioramenti girano in paper/parallelo finché non c'è un edge dimostrato su CLV.

---

## Fonti
- football-data.co.uk (closing odds free) · Understat · FBref/StatsBomb · API-Football · TheStatsAPI
- Jeff Sackmann tennis_atp/tennis_wta + Match Charting Project · tennis-data.co.uk · jgollub1/tennis_match_prediction
- Dixon-Coles + time-weighting (dashee87) · Journal of Big Data 2025 (tennis ML) · XGBoost xG (AUC 0.878 / Brier 0.069)

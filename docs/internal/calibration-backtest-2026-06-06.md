# Calibration & Backtest — Agentic Markets

**Data:** 2026-06-06
**Autore:** ML Engineer (analisi su richiesta di Andrea)
**Scope:** read-only sul DB Supabase aziendale. Zero scritture, zero commit/deploy.
**Tempo:** analisi, non tesi. Profondità sufficiente per un verdetto onesto.

---

## 0. Inventario dati (dove stanno davvero le predizioni)

| Tabella | Righe | Con prob. modello | Settled (esito noto) | Note |
|---|---|---|---|---|
| `predictions` | 0 | — | — | vuota |
| `match_predictions` | 0 | sì (`p_home/p_draw/p_away`) | 0 | **vuota** — qui starebbero le prob. football, ma non c'è nulla |
| `unified_predictions` | 136 | **no** | 15 (`status=settled`) | è la tabella che serve il sito; NON ha `p_home/p_draw/p_away`; i settled hanno `odds` NULL → inutili per calibrazione |
| `tennis_predictions` | 16.261 | sì (`p1/p2`) | vedi sotto | l'unica fonte con prob + esito |
| `tennis_fixtures` | 240 | — | — | |
| `bets` | 160 | **no** (solo `selection/odds/status`) | 160 (87W/73L) | base per l'analisi a fasce di quota |
| `tennis_bets` | 0 | — | — | vuota |

**Chiarimento sul "predictions 14241" di `/api/health`:** non è football. La query in `app/api/health/route.ts:48` conta `tennis_predictions`. Oggi sono 16.261 righe. Non esiste un grande store di predizioni football: `match_predictions` e `predictions` sono entrambe vuote, il football servito al cliente è calcolato **on-the-fly** da `lib/poisson-model.ts` ad ogni richiesta API, non persistito.

**Caveat dimensione campione (il punto più importante del report):**
Le 752 righe `tennis_predictions` con `outcome` valorizzato (P1_WIN/P2_WIN) **non sono 752 match**. Sono lo stesso scheduler che riscrive gli stessi incontri ad ogni run. Deduplicando per numero-evento ESPN restano **13 match unici settled** (tutti clay, Roland Garros quali/early rounds, 5-6 giugno). Qualsiasi metrica di calibrazione "live" poggia su n=13. È un campione da pilot, non da track record.

---

## 1. Calibrazione sulle predizioni del sito

### 1a. Football — NON CALIBRABILE sui dati persistiti
Non esiste un solo record football con (probabilità modello + esito reale) nel DB.
`unified_predictions` settled football = 1 riga, `result=void`, prob assenti. Il modello Poisson v1 che serve il cliente non scrive le sue probabilità da nessuna parte → impossibile fare una reliability curve sul "servito". L'unica via per il football è il backtest out-of-sample (Parte 3).

### 1b. Tennis — calibrabile ma su n=13 (campione minuscolo)
Modello: `elo_surface_v4_features_odds`. Set canonico = 13 match unici, deduplicati per evento ESPN.

**Headline:**
- Favorito del modello azzeccato: **9 / 13 = 69.2%**
- Probabilità media assegnata al favorito: **59.9%** → se calibrato, ci aspetteremmo ~60% hit-rate. Osservato 69%: il modello è semmai **leggermente sotto-confidente** su questo campione (indovina più di quanto si dia).
- **Brier (player1-reference, 1-classe): 0.2175** vs baseline coin-flip 0.25 → batte il caso, di poco.

**Reliability curve (bin sulla prob. del lato favorito):**

| Bin prob. | n | mean pred | osservato | gap (pred−oss) |
|---|---|---|---|---|
| 0.50–0.60 | 7 | 0.547 | 0.571 | −0.024 |
| 0.60–0.70 | 5 | 0.628 | 0.800 | −0.172 |
| 0.80–0.90 | 1 | 0.812 | 1.000 | −0.188 |

**ECE (Expected Calibration Error): 0.094.**

**Lettura onesta:** i gap sono tutti negativi (osservato > predetto) → nessun segno di over-confidence, che è il difetto pericoloso. Ma con 7/5/1 match per bin questi numeri sono rumore: un solo match diverso ribalta un bin. **Nessuna conclusione forte è lecita su n=13.** Va letto come "non ci sono red flag", non come "il modello è calibrato".

> Nota: il modello live tennis è su clay-only e WTA/ATP quali. Le metriche solide vengono dal backtest storico (Parte 3.2), non da queste 13 righe.

---

## 2. Hit-rate per fascia di quota — i 160 bets (verifica "fortunato vs vendibile")

160 bets paper, tutti settled, stake flat. `profit_loss` è NULL in DB → il P&L è **simulato** da odds+esito (flat 1u). Solo per analisi interna; la linea prodotto resta hit-rate-only.

| Fascia | n | won | hit-rate | break-even (1/avg_odds) | delta | avg_odds | yield sim. |
|---|---|---|---|---|---|---|---|
| < 1.60 | 28 | 21 | 75.0% | 69.7% | **+5.3%** | 1.434 | +7.4% |
| 1.60–1.85 | 34 | 23 | 67.6% | 58.7% | **+8.9%** | 1.703 | +14.8% |
| 1.85–2.10 | 28 | 18 | 64.3% | 51.1% | **+13.2%** | 1.957 | +24.6% |
| 2.10–2.50 | 48 | 17 | 35.4% | 44.0% | **−8.6%** | 2.271 | −20.2% |
| > 2.50 | 22 | 8 | 36.4% | 38.7% | −2.3% | 2.586 | −7.0% |
| **TOTALE** | **160** | **87** | **54.4%** | **50.2%** | **+4.2%** | 1.992 | **+1.7%** |

**Split favoriti vs underdog (la fotografia più netta):**

| Segmento | n | won | hit-rate | avg_odds |
|---|---|---|---|---|
| Favoriti (odds ≤ 2.10) | 94 | 64 | **68.1%** | 1.72 |
| Underdog (odds > 2.10) | 66 | 23 | **34.8%** | 2.39 |

**Findings critici:**
1. **Tutto il valore è sui favoriti (odds ≤ 2.10).** Le tre fasce basse sono nettamente sopra break-even (+5/+9/+13%). Le due fasce alte (odds > 2.10, 70 bet su 160) sono **sotto** break-even e perdono denaro simulato (−20% e −7% di yield). Il modello/selezione sa fare i favoriti, non gli underdog.
2. **Il 54.4% complessivo è statisticamente indistinguibile dal break-even.** Test binomiale contro la quota implicita media: z = **1.06** (p ≈ 0.29 una coda). A n=160 non possiamo affermare che il 54.4% sia skill e non varianza. È incoraggiante, non probante.
3. Yield simulato totale **+1.7%** — risicato e trainato interamente dalle fasce basse. Da non pubblicare e da non considerare un edge dimostrato.

**CLV:** `scripts/backtest_clv.py` non ha dati utilizzabili — `unified_predictions.closing_odds`/`closing_line_value` sono vuoti per i settled e i `bets` non hanno closing line. Nessun calcolo CLV possibile sui dati attuali.

---

## 3. Backtest dei modelli (out-of-sample, dove i numeri sono solidi)

### 3.1 Football — Dixon-Coles vs Poisson v1 (walk-forward)
Harness: `scripts/backtest_dc_vs_poisson.py` su `data/match_results.csv` (3.816 match, 5 leghe × stagioni). Poisson v1 = port fedele di `lib/poisson-model.ts`. Walk-forward, refit DC ogni 40 match.

Match confrontati (entrambi i modelli hanno predetto): **3.214**.

| Metrica | Dixon-Coles | Poisson v1 | Vincitore |
|---|---|---|---|
| Brier (più basso = meglio) | 0.64130 | **0.59991** | **Poisson v1** |
| Log-loss | 1.40956 | **1.00339** | **Poisson v1** |
| Pick accuracy 1X2 | 0.4823 | **0.5050** | **Poisson v1** |
| ECE (calibrazione) | 0.0953 | **0.0310** | **Poisson v1** |

**Reliability — Poisson v1** (ben calibrato fino a 0.8):

| bin | n | avg_pred | hit_rate |
|---|---|---|---|
| 0.3–0.4 | 421 | 0.380 | 0.347 |
| 0.4–0.5 | 1140 | 0.447 | 0.416 |
| 0.5–0.6 | 814 | 0.548 | 0.559 |
| 0.6–0.7 | 511 | 0.648 | 0.591 |
| 0.7–0.8 | 245 | 0.743 | 0.755 |
| 0.8–0.9 | 80 | 0.838 | 0.750 |
| 0.9–1.0 | 3 | 0.935 | 0.333 (n=3, rumore) |

**Reliability — Dixon-Coles** (over-confidente, sistematicamente sopra la diagonale):

| bin | n | avg_pred | hit_rate | gap |
|---|---|---|---|---|
| 0.5–0.6 | 732 | 0.548 | 0.454 | +0.094 |
| 0.6–0.7 | 559 | 0.646 | 0.517 | +0.129 |
| 0.7–0.8 | 354 | 0.747 | 0.636 | +0.111 |
| 0.8–0.9 | 189 | 0.846 | 0.698 | +0.148 |
| 0.9–1.0 | 151 | 0.951 | 0.636 | +0.315 |

**RISULTATO CHIAVE PER IL GATE DI PROMOZIONE — Dixon-Coles NON va promosso.**
Su 3.214 match walk-forward (PL/SA/PD/BL1/FL1), il **Poisson v1 attualmente servito batte Dixon-Coles su tutte le metriche**: Brier (0.600 vs 0.641), log-loss (1.00 vs 1.41), accuracy (50.5% vs 48.2%) e calibrazione (ECE 0.031 vs 0.095). DC è marcatamente **over-confidente** (assegna 0.95 e vince 0.64). Il gate di promozione (TASK punto 2) si chiude **negativo**: i dati dicono di tenere il Poisson v1. Conformal calibration su DC non basta a colmare il gap di base. Da rivedere il DC (pesi temporali troppo aggressivi? τ? prior?) prima di riproporlo.

### 3.2 Tennis — surface-Elo + feature stack (walk-forward)
Harness: `scripts/backtest_tennis.py`, dati Sackmann ATP+WTA, train su prima metà / eval su seconda metà.

| Dataset | Modello | Brier | Accuracy 1X2 (held-out) |
|---|---|---|---|
| ATP (15.978 match, eval 7.589) | Rank baseline | — | 64.0% |
| | Surface-Elo | 0.21924 | 64.0% |
| | **Elo + serve/return/fatigue/H2H** | **0.21786** | **64.9%** |
| WTA (14.653 match, eval 6.927) | Rank baseline | — | 63.0% |
| | Surface-Elo | 0.21918 | 63.5% |
| | **Elo + serve/return/fatigue/H2H** | **0.21427** | **65.3%** |

**Lettura:** il modello tennis batte la baseline (rank/coin) in modo consistente su ~14.5k match held-out per tour. Il feature stack aggiunge poco sopra il solo Elo-surface (Brier −0.001/−0.005), ma è positivo. Influenza feature: `elo_diff` domina (|coef| ~0.5), poi `rank_diff`, poi serve/return; H2H quasi nullo. **Questi sono i numeri tennis affidabili**, non le 13 righe live.

### 3.3 Nazionali — mini-backtest WC 2022 (`wc-poisson-rates-v1`, approssimato)
Modello WC servito non persiste prob. e ha 0 settled (28 righe `upcoming`). Ho fatto un mini-backtest **proxy**: Poisson attacco/difesa stile Dixon-Coles, addestrato su tutte le internazionali 2018→pre-WC dal CSV (`data/national_teams/international_results_raw.csv`, 4.402 match train, 271 nazionali), testato sui 64 match del Mondiale 2022.

| Metrica | Valore |
|---|---|
| n test (WC2022) | 64 |
| Brier modello | **0.6345** |
| Brier baseline uniforme (1/3,1/3,1/3) | 0.6667 |
| Accuracy 1X2 | 32/64 = **50.0%** |

**Caveat forte:** questo NON è esattamente `wc-poisson-rates-v1` di produzione (non ho portato i suoi prior di forza-squadra né i fattori venue/contesto; l'ottimizzatore L-BFGS si ferma a gtol, fit usabile ma non a convergenza piena). È una sanity-check che dice una cosa sola e onesta: **un Poisson rate base sulle nazionali batte il caso al Mondiale, ma di pochissimo** (Brier 0.635 vs 0.667; 50% pick accuracy in un torneo dove i favoriti vincono ~50-55%). Per un backtest vero del modello di produzione servirebbe: (a) il codice esatto di `core/world_cup_probability.py` esposto in modo backtestabile, (b) i prior squadra usati in prod, (c) gestione neutral-venue/groStage come in `core/world_cup_venue_context.py`.

---

## 4. Verdetto

**Il modello è calibrato? Dove sì, dove no, quanto è solido il 54.4%?**

- **Tennis (out-of-sample, solido):** sì, batte la baseline su ~30k match storici, Brier ~0.214–0.219, accuracy ~65%. È l'unico modello con evidenza statistica vera. Sulla manciata di match live (n=13) non ci sono red flag di over-confidence, ma il campione è troppo piccolo per dire "calibrato".
- **Football servito (Poisson v1):** non valutabile sui dati *live persistiti* (prob. mai salvate), ma il backtest walk-forward su 3.214 match dice che **è ben calibrato** (ECE 0.031, reliability sulla diagonale fino a 0.8) e **batte Dixon-Coles** su ogni metrica. Buona notizia: il modello che già serve il cliente è il migliore dei due.
- **Dixon-Coles NON è pronto:** over-confidente, Brier/log-loss/accuracy/ECE tutti peggiori del Poisson v1. Il gate di promozione (TASK #2) si chiude negativo. Niente promozione a fiducia, e i dati la negano.
- **Nazionali/WC:** il rate-Poisson base batte il caso ma di poco; nessun track record reale (0 settled).
- **Il 54.4% dei 160 bets:** **non è ancora vendibile come edge dimostrato.** È statisticamente indistinguibile dal break-even (z=1.06). Tutto il margine vive sui favoriti (odds ≤ 2.10); sugli underdog (>2.10, 44% dei bet) il sistema **perde**. La storia onesta è: "buono a prezzare i favoriti, debole sugli outsider, e su 160 bet non possiamo ancora distinguere skill da fortuna".

**Raccomandazioni tecniche (no deploy, solo direzione):**
1. **Persistere le probabilità football del modello servito** (oggi calcolate e buttate). Senza questo, la calibrazione football è strutturalmente impossibile da misurare.
2. **Deduplicare `tennis_predictions`**: 16k righe = poche centinaia di match riscritti. Settlement e calibrazione vanno fatti su match unici, non su righe.
3. **Restringere o riprezzare il segmento odds > 2.10**: è dove il sistema perde. È la leva più ovvia per spostare il 54.4% verso un edge reale.
4. Per promuovere DC al cliente serve il numero della sez. 3.1 (DC < Poisson su Brier) + un campione live ben più grande di 13/160.

---

## Metodologia & riproducibilità
- Estrazioni DB: psql read-only, dedup tennis per `split_part(match_id,':',3)` (numero ESPN), riga più recente per evento.
- Calibrazione/fasce: `/tmp/analysis_final.py` (sorgenti CSV `/tmp/tennis_canonical.csv`, `/tmp/bets.csv`).
- Backtest football: `scripts/backtest_dc_vs_poisson.py` (esistente). Backtest tennis: `scripts/backtest_tennis.py` (esistente). WC proxy: `/tmp/wc_backtest.py` (ad-hoc, non di produzione).
- `bets.profit_loss` NULL → yield simulato da odds+status (flat 1u), uso interno.
- Nessuno script di repo modificato/committato.

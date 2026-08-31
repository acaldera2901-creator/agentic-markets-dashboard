# Modello di calcolo calcio — dove siamo davvero e cosa muove l'ago

**Data:** 2026-08-30 · **Owner:** Andrea (approvazione) / Claude (esecuzione)
**Stato:** documento consolidato. Sostituisce le versioni precedenti della giornata, che contenevano due affermazioni sbagliate corrette qui sotto (§0).
**Origine:** richiesta di Andrea — «migliorare il modello di calcolo nel migliore dei modi» + integrare le leghe mancanti.

Tutte le misure sono state prese il 30/08/2026 eseguendo il codice, non ereditate da documenti precedenti. Dove un numero viene da un documento più vecchio, è dichiarato.

---

## 0. Due correzioni, in testa perché hanno viziato il resto

**«In produzione gira Dixon-Coles» — falso.** Il serving che i clienti vedono è `app/api/predictions/route.ts` → `lib/poisson-model.ts`, in TypeScript. Dixon-Coles è un percorso Python parallelo che scrive righe `unified_predictions`.

**«Il modello xG non è mai stato acceso» — falso.** `lib/poisson-model.ts:80-92` documenta il blend xG in produzione: *«2026-06: blending xG into the ratings closes ~60% of the Brier gap to market»*, peso tarato walk-forward il 05/06/2026 via `scripts/verify-xg-blend.ts`. `route.ts:432` logga `(xG blend on)`. **Il 60% del gap è già incassato da giugno.**

L'errore a monte: `models/xg_model.py` (Python, paper) non è referenziato dal serving, e da lì ho concluso che xG non fosse in produzione — senza cercare l'implementazione TypeScript.

**Conseguenza:** i backtest Python (`backtest_ou`, `backtest_clv`) misurano modelli Python, **non il serving**. Le loro conclusioni non descrivono ciò che i clienti vedono.

---

## 1. Lo stato reale, misurato

### 1.1 Cosa gira in produzione

Il serving calcola in TypeScript: Poisson v1 shrinkato + **blend xG** sulle ratings + **blend col mercato** (`p = α·p_model + (1−α)·p_market`). Quest'ultimo è documentato in `docs/internal/reliability-upgrade-2026-06-06.md` su 8.575 predizioni, con un avvertimento esplicito nel codice: *«no ROI beats the closing line (everything loses ~7-9% to vig). The blend improves CALIBRATION, not edge; the product copy must never present it as "value vs market"»*.

### 1.2 Nessun edge contro la closing line — riconfermato

`scripts/backtest_clv.py` sulle top-5 (2021-2024), eseguito due volte con riaddestramento raro e frequente — 6.512 e 6.804 partite predette:

| Metrica | Dixon-Coles | Poisson v1 | Mercato |
|---|---|---|---|
| Brier, rifit ogni 400 | 0,66328 | 0,59846 | 0,57488 |
| **Brier, rifit ogni 20** | **0,64952** | **0,59947** | **0,57517** |
| ROI @ closing, rifit 400 | −3,79% (9.049 bet) | −6,20% (8.207 bet) | — |
| **ROI @ closing, rifit 20** | **−5,26%** (9.247 bet) | **−6,44%** (8.587 bet) | — |

Il riaddestramento frequente migliora il Brier di Dixon-Coles (0,66328 → 0,64952) e ne peggiora il ROI: la misura rapida lo penalizzava sul primo e lo favoriva sul secondo. **Nessuna delle due configurazioni cambia il verdetto:** DC resta molto peggiore del Poisson, e nessun modello produce ROI positivo.

**Riproduzione verificata:** i valori con rifit 20 coincidono alla quarta decimale con il backtest del 03/06 in `docs/research/prediction-upgrade-2026-06.md` (DC + time-decay: Brier 0,6495, ROI −5,26%). Il lavoro di giugno era corretto e riproducibile.

Non è quindi una scoperta nuova: è la stessa conclusione del 3 giugno, e il prodotto ne ha già preso atto — la rotta decisa da Andrea quel giorno è «probabilità calibrate + insight, non edge sul bookmaker».

### 1.3 Le feature: cosa muove l'ago e cosa no

| Informazione aggiunta | gap col mercato chiuso | stato |
|---|---|---|
| **forma xG** (Understat) | **+60,2%** | **già in produzione** |
| pi-rating + forma + riposo | +6,5% (mis. 03/06) | già in produzione |
| npxG + pressing (ppda) | +0,1% | scartato: rumore |
| **assenze e infortuni** (API-Football) | **+1,8%** | **misurato il 30/08: non paga** |

**La Fase 3 è chiusa da una misura, non da un'opinione.** Dettaglio del test: 26.222 record di assenze (PL, Serie A, Liga, stagioni 2022-2024), agganciati a 3.403 partite con **98,7% di copertura**, alias squadra espliciti (mai fuzzy). Media 3,17 assenti certi per squadra.

| modello | Brier |
|---|---|
| Poisson v1 nudo | 0,59061 |
| + pi/forma/riposo (come oggi) | 0,59051 |
| + differenza di assenze certe | 0,59060 |
| + assenze certe e in dubbio | **0,59017** |
| Mercato | 0,57118 |

Guadagno migliore **+0,00034 di Brier su ~1.700 partite di valutazione**: dentro il rumore. Il conteggio delle assenze non aggiunge informazione, plausibilmente perché pi-rating e forma recente ne riflettono già una parte.

**Limiti dichiarati del test:** conta *quanti* mancano, non *chi* — pesare per l'importanza del giocatore richiede statistiche individuali che non abbiamo; e un effetto piccolo non sarebbe rilevabile su questo campione. Ma il verdetto operativo regge: **non giustifica i $19/mese né la pipeline.**

**Nota di metodo:** il test è costato zero. Le chiavi API-Football erano già in `.env`, il client aveva già `/injuries`, e il piano Free copre le stagioni 2022-2024 — sufficienti per un backtest storico. Misurare prima di comprare ha funzionato: ha chiuso un'ipotesi aperta da giugno senza spendere.

### 1.4 Il difetto vero: l'ancora sharp non è validata

`core/market_anchor.py::select_h2h_anchor` scende la gerarchia `pinnacle → betfair_ex_eu → betfair_ex_uk → smarkets → matchbook` e **accetta il primo book che espone un mercato h2h completo, senza controllo di plausibilità**. Il margine è calcolato in `_h2h_result` ma solo *riportato*, mai usato come filtro.

Eseguito sui 478 eventi calcio reali del 30/08: **101 (21,1%) ricevono un'ancora con margine oltre il 20%, fino al 191%**, contro una mediana sana del 5,5%. Tutti da `betfair_ex_eu`, tutti etichettati `sharp_exchange`.

Causa visibile nei dati grezzi — `San Marino v Finland`: Betfair espone `Finland 1.07 · San Marino 1.09 · Draw 1.09`, mentre i book veri quotano San Marino 25-38. Su eventi illiquidi l'exchange restituisce prezzi non formati, e il devig produce tre probabilità da un terzo ciascuna.

**Quanto costa:** su ~33.000 quote di book non-sharp confrontate col fair dell'ancora, quelle «sopra il fair di >2%» passano da **9,8% a 1,8%** una volta validata l'ancora. **L'82% del valore apparente è artefatto.**

**Chi ne è colpito:** `market_anchor` è consumato da `core/supabase_client.py`, `core/odds_api_client.py`, `core/tennis_odds_api_client.py` e `agents/tennis_model_agent.py` — cioè le righe `unified_predictions` che alimentano Telegram, settlement e track record, **e il tennis**, lo sport dove l'edge misurato è migliore (74,9%). Non la board calcio TS, che ha un percorso proprio.

**La soglia, scelta sui dati** (1.409 quotazioni sharp del 30/08): Betfair è bimodale — o ~4% o ~188%, senza zona intermedia. Pinnacle non supera il 9%, Matchbook il 13%. Una soglia a **0,15** separa i gruppi senza toccare nulla di sano.

### 1.5 L'esposizione in prodotto: il badge PICK senza floor

`app/app/page.tsx:5188-5195`, nel serving reale:

```js
const recOver = overP != null && underP != null ? overP >= underP : (overVal ?? -1) > (underVal ?? -1);
// chips: { id: "gol-over", rec: recOver }, { id: "gol-under", rec: !recOver }
```

1. **Un lato è marcato PICK sempre, per costruzione.** `rec: recOver` e `rec: !recOver` sono complementari: ogni partita con una linea Over/Under produce un badge garantito, **senza floor** — mentre l'1X2 tre righe sopra (`:5177`) lo rispetta: `rec: !belowFloor && pickKey === o.key`.
2. **Il criterio è la probabilità, non il valore.** `overP >= underP` marca il lato più probabile a prescindere dalla quota.
3. **Stesso schema sui marcatori** (`:5222`) e in `components/world-cup/WcBoard.tsx:523-524,536`.

Il `>= 0.05` a `MatchDetailSheet.tsx:143` governa solo la percentuale mostrata accanto alla chip, **non** il badge.

### 1.6 Il vincolo di copertura

Understat, unica fonte xG in casa, copre **esattamente 5 leghe**: EPL, La Liga, Serie A, Bundesliga, Ligue 1. API-Football non espone xG. **Le altre 24 leghe in board girano senza la feature che vale il 60% del gap.**

---

## 2. Cosa muove davvero l'ago, in ordine

Il quadro completo dice una cosa sola: **le due leve che restano non sono nel modello.**

**A. Riparare ciò che è rotto.** L'ancora non validata (§1.4) e il badge PICK senza floor (§1.5). Nessuna delle due richiede dati nuovi o spesa. Entrambe correggono numeri che il prodotto mostra oggi.

**B. Portare xG dove non c'è.** È l'unica informazione che ha dimostrato di valere (+60,2%), ed è assente su 24 leghe su 29. Estenderla vale più di qualsiasi rifinitura del modello sulle 5 leghe dove già c'è. Serve una sonda: quali fonti xG coprono Championship, Eredivisie, Primeira, Turchia, Brasile, MLS — FBref copre più competizioni di Understat, ma vanno verificati accesso, licenza e stabilità.

**C. Le leghe che i partner quotano e noi non copriamo.** 99 competizioni con le quote già nel feed partner; mancano ground truth per il settlement e storico per addestrare. È lavoro di dati, non di ML.

---

## 3. Cosa NON facciamo, e perché

- **Non compriamo il piano formazioni/infortuni.** Misurato: +1,8% del gap, dentro il rumore.
- **Nessuna feature nuova derivata dai dati che abbiamo.** npxG + pressing danno +0,1%: la saturazione è misurata.
- **Non rincorriamo l'edge sul 1X2 dei top book.** Nessun modello batte la closing line, misurato due volte a tre mesi di distanza.
- **Non abbassiamo il floor** per far apparire più pick.
- **Nessun claim di battere il mercato.** Il posizionamento resta «accuratezza predittiva», come già impone il commento in `lib/poisson-model.ts`.

---

## 4. Rischi

| Rischio | Mitigazione |
|---|---|
| Fuga di calibrazione | Walk-forward, artefatti congelati, campione fissato prima di guardarlo |
| Claim FTC su performance | Nessun claim di edge; solo accuratezza predittiva |
| Il fix dell'ancora cambia numeri visibili in prodotto | Misurare quante righe cambiano fonte e riportarlo prima del merge |
| Interferenza fra sessioni sullo stesso repo | Il 30/08 il repo era in detached HEAD con un'altra sessione attiva: worktree dedicato |

---

## 5. Gate

Il piano che deriva da questa spec (`docs/superpowers/plans/2026-08-30-modello-calcolo-fase1.md`) copre solo il punto **A**. I punti B e C avranno spec proprie. Il codice richiede `APPROVE #id`.

Riferimenti: `project_league_demand_audit` · `reference_anchor_margin_trap` · `docs/research/prediction-upgrade-2026-06.md` · `docs/internal/reliability-upgrade-2026-06-06.md`

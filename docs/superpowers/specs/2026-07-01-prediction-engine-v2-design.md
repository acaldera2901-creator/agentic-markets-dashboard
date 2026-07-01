# BetRedge Prediction Engine v2 — Dual-Track Meta-Model + Edge Gate

**Data:** 2026-07-01 · **Owner:** Andrea (delega piena a Claude Code per decisioni tecniche) · **Stato:** design approvato per delega, in implementazione (analisi/backtest = no-gate; serving prod = GATED)

## Problema
Il marketing promette edge ("beat the bookies", "85% win rate"), ma i backtest interni (riprodotti 2026-07-01) mostrano:
- ⚽ Calcio: modello 51–53% acc vs mercato 54.3%; Brier modello 0.582–0.599 vs mercato 0.575; ROI ~−0.25% vs chiusura Pinnacle (batte la close solo ~30% dei pick). **Il servito oggi è Poisson v1 @ Brier 0.593.**
- 🎾 Tennis: 64.9% (ATP) / 65.3% (WTA) acc, Brier ~0.214–0.218 — **verticale forte, market-blind Elo già ottimo.**
- 🥅 Soft markets: falli ROI −24% (NO-GO), corner debole, cartellini candidato (serve feature arbitro).

"Buco": nessuna base di evidenza unificata che leghi modello → edge → claim difendibile.

## Obiettivo (success criteria verificabili)
1. **Track A** (prodotto): probabilità servita meglio calibrata di quella live oggi — Brier/log-loss/ECE **< Poisson v1 (0.593)**, idealmente ≈ mercato.
2. **Track B** (verità): Edge Map onesta dove i segmenti forti noti (tennis) *passano* il gate e i deboli (mainline calcio, falli) sono correttamente gated OFF. Un segmento mainline calcio che "batte la chiusura" = red flag leakage da investigare.
3. Nessuna regressione di calibrazione vs baseline servito.

## Architettura — due binari, un substrato
Substrato = walk-forward no-leakage esistente (`scripts/backtest_clv.py`: football-data.co.uk risultati + quote apertura/chiusura Pinnacle, warmup 60/lega, refit DC ogni 20).

- **Track A — Calibrated Consensus (market-AWARE):** stacker (logistica multinomiale regolarizzata) su output modelli base **+ prob mercato de-viggata (apertura, no look-ahead)**. Poi isotonic/conformal. Target: Brier/log-loss/ECE minimi. Claim onesto: "probabilità più affidabili", non "battiamo il book".
- **Track B — Fundamental Edge (market-BLIND):** stesso stacker senza il prezzo. Value pick → ROI/CLV vs apertura, chiusura, soft-book. Metrica: CLV+ROI per segmento con **bootstrap CI**.

## Sintesi + Promotion Gate
Harness unico → **Edge Map** per segmento {calibrazione A · CLV+ROI+CI B · N · stabilità}. **Gate:** un segmento è servito come value/edge pick solo se Track B ha ROI/CLV>0 con CI bootstrap che esclude 0, N ≥ soglia, stabile ≥K mesi. Altrimenti: servito come prob calibrata Track A senza claim di edge. **Produzione = Track A ovunque + flag valore solo dove il gate passa.**

## Componenti
`scripts/backtest_meta.py` (v1: calcio 1X2 — collect feature cache + due stacker + Edge Map) · estensioni successive: tennis (`backtest_meta_tennis.py` su Sackmann+odds), Over/Under, soft markets (harness uniforme; falli attesi gated OFF; cartellini = upgrade con feature arbitro già presente in `FDMatch.referee`). Output: `reports/edge_map_*.json`. Wiring serving in `agents/model.py`+`tennis_model_agent.py` = **GATED (PROPOSAL+APPROVE)**.

## Decisioni tecniche
1. Firewall di mercato: il prezzo entra come feature solo in Track A.
2. No-leakage + audit: split temporale (train 65% più vecchio, test 35% recente); base prob già walk-forward; snapshot immutabili con model/feature version per CLV alla pubblicazione.
3. Calibrazione first-class: reliability + ECE per segmento.
4. Ensemble parsimonioso: logistica prima; gradient boosting solo se batte davvero in backtest.
5. Copertura totale nell'harness; i dati decidono cosa si promuove.

## Fuori scope (YAGNI + onestà)
Non prova a battere la chiusura Pinnacle sulle mainline (misura, non promette). Nessuna fonte dati nuova nel v1. Niente deep learning finché lo stacker semplice non è battuto.

## Rischi / gate
Analisi + backtest = low-risk (nessun gate). Serving prod = medium/high → PROPOSAL + APPROVE (Andrea/Michele). Claim FTC dalla Edge Map → sign-off legale prima del sito.

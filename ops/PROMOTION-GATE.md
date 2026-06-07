# Promotion Gate — regola di promozione dei modelli

> #HARNESS-1 (APPROVE Andrea 2026-06-07). Rende eseguibile la regola emersa
> dall'audit 2026-06-06: **ogni upgrade dei modelli è promosso solo se vince
> il backtest sul modello SERVITO**.

## La regola

**Nessuna modifica che tocca i modelli predittivi va in produzione senza:**
1. `npm run gate` **verde** (nessuna regressione oltre tolleranza), E
2. **APPROVE umano** (Andrea o Michele) sulla PROPOSAL — il gate non sostituisce
   il gate di approvazione, lo precede.

Tolleranze: Brier +0.002 · ECE +0.005 (in `config/model-baselines.json`).

## Comandi

```bash
npm run gate          # check vs baselines — exit 1 se regressione
npm run gate:update   # accetta i numeri correnti come nuove baselines
                      # (SOLO dopo APPROVE: è una decisione umana)
```

Runtime ~3-5 min. Deterministico: stessi dati → Δ 0.0000.

## Cosa misura (tutti walk-forward, codice di produzione, holdout temporali)

| Sport | Harness | Protocollo |
|---|---|---|
| football | `scripts/benchmark-served.ts` | predict (w=0.5) + applyTemperature(τ), understat, holdout stagione 2024 |
| tennis | `scripts/backtest_tennis_production.py` | EloSurfaceModel replay Sackmann, holdout 2025-26 |
| wc | inline in `promotion_gate.py` | modello nazionali + artifact isotonico, SOLO partite neutre, 2025+ |

⚠️ Il numero WC sovrappone la finestra di fit dell'artifact: rileva
**regressioni**, non è un claim assoluto di skill.

## Quando aggiornare le baselines

Solo quando un upgrade è stato validato (gate run con numeri MIGLIORI +
APPROVE) — allora `npm run gate:update` registra il nuovo riferimento.
Mai aggiornare le baselines per "far passare" un numero peggiore.

## Storia

- 2026-06-07: gate creato. Baselines iniziali: football 0.5942/0.0146 ·
  tennis 0.2209/0.0179 (acc 63.6%) · wc 0.5451/0.0466. Test negativo
  verificato (τ=2.0 → FAIL football su entrambe le metriche).
- Precedente applicazione manuale del processo: #CALIB-1 (isotonica club
  bocciata — regressione evitata), #CALIB-2 (isotonica WC promossa, tennis
  no-ship).

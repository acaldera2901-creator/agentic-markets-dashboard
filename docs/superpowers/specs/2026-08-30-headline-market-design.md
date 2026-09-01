# La testata della card mostra il mercato su cui abbiamo una convinzione

**Data:** 2026-08-30 · **Owner:** Andrea (APPROVE dato) / Claude (esecuzione)
**Ticket:** `#HEADLINE-MARKET-0830`

## Il problema, come è arrivato

Andrea, guardando una card in produzione: «ci sono predizioni con il 30 e rotti per cento, quello non è una probabilità, dobbiamo alzare questi numeri **ma realmente**».

La card era `Casa Pia v Moreirense`, Primeira Liga: **MODEL READ · Casa Pia · 35% model · quota 2,76 · conf. LOW**.

## Perché il 35% non è un difetto del modello

Quote Pinnacle di quella partita (margine 3,2%), devigate:

| esito | probabilità vera |
|---|---|
| Casa Pia | 33,9% |
| Pareggio | 30,8% |
| Moreirense | 35,4% |

È la partita più equilibrata possibile: le tre probabilità sommano a 100 e stanno tutte attorno a un terzo. **Non esiste un numero più alto da mostrare sull'1X2** — il massimo è 35,4%, ed è dell'altra squadra. Il nostro 35% coincide col mercato: il modello è calibrato bene.

**Alzare quel numero sarebbe mentire, e sappiamo cosa costa.** Il backtest del 30/08 (12.158 predizioni walk-forward) misura che la fascia con più edge dichiarato è quella che rende peggio: **−8,44%** con CI 95% [−12,14, −4,51] nella configurazione più fedele alla produzione. Un modello che dicesse 60% su una partita da 34% sarebbe più spettacolare e più sbagliato.

## Ma la richiesta è legittima, e la risposta esiste

Stessa partita, stessi dati, nessun modello nuovo:

| mercato | probabilità **vera** |
|---|---|
| Casa Pia **o pareggio** | **64,6%** |
| Moreirense o pareggio | 66,1% |
| Uno dei due vince | 69,2% |

**Il problema non è che il motore prevede poco: è che gli chiediamo sempre la domanda più difficile.** Su una partita in equilibrio «chi vince?» non ha una risposta forte; «chi non perde?» sì.

## La regola, fissata prima di guardare i risultati

> Se il favorito 1X2 è **≥ 50%**, la testata mostra quello, come oggi.
> Altrimenti mostra la **doppia chance più probabile**, dichiarando il mercato.

## L'effetto, misurato su 297 partite con ancora valida

| | oggi | con la regola |
|---|---|---|
| numero mostrato, mediano | 48,5% | **67,6%** |
| numero mostrato, medio | 51,1% | 66,2% |
| **numero più basso in board** | **35,1%** | **50,2%** |
| righe sopra il 40% | 249 (84%) | **297 (100%)** |
| righe sopra il 50% | 135 (45%) | **297 (100%)** |
| righe sopra il 60% | 60 (20%) | **222 (75%)** |

Le **48 righe** che oggi mostrano meno del 40% — la famiglia di Casa Pia — passano da un mediano di 37,4% a **65,8%**. **Nessuna card scende più sotto il 50%**, e 162 righe (55%) cambiano il mercato in testata.

## Una decisione presa scrivendo i test: niente «12»

La prima versione sceglieva la doppia chance più alta fra **tre**, incluso `12` (uno dei due vince). Sui dati di Casa Pia il `12` valeva **69,3%** — più di `X2` (66,2%) — e i test lo hanno fatto emergere subito.

**È escluso di proposito.** Su una partita equilibrata il `12` vale ~70% per costruzione e dice solo «non finirà pari»: non nomina nessuna squadra, non è una lettura. Sarebbe un numero grande e vuoto, cioè l'opposto di quello che questo lavoro deve ottenere. Restano `1X` e `X2`, che una squadra la indicano.

## Perché è onesto, e non è gonfiare

**Non è un modello nuovo né una fonte nuova.** `1X = P(casa) + P(pareggio)` viene dalla stessa tripla che serviamo già: nessun rischio di calibrazione aggiuntivo, nessuna ancora separata da validare. È la stessa previsione, su una domanda diversa.

**La probabilità si somma dalla tripla SERVITA**, non da `extra_markets`: quelli nascono dalle lambda del Poisson *prima* del blend col mercato, e userebbero un numero incoerente con il resto della card. La quota, quando serve, viene invece da `extra_markets` (`double_1x` / `double_x2` / `double_12`), che porta `market_odds` reali — **mai una quota derivata o inventata**.

**La selezione è per probabilità, mai per edge.** È la lezione già scritta in `lib/pick-selection.ts` (`#PICK-FAVOURITE-0812`): sull'edge il modello sovrastima sistematicamente i longshot, e la selezione finiva sull'underdog a quota 9.

## I due paletti

1. **La card deve dire quale mercato mostra**, sempre e in modo evidente. Un 72% senza etichetta è fuorviante; «Casa Pia o pareggio · 72%» è informazione.
2. **Probabilità più alta significa quota più bassa** (1,30-1,45 invece di 2,76). Stiamo alzando l'accuratezza dichiarata, non il valore. Se il copy lasciasse intendere il contrario, tornerebbe il rischio FTC che `project_us_pivot` marca come numero uno.

## Cosa NON fa

- Non tocca il modello, né le probabilità calcolate.
- Non cambia la **pick** su cui si regola il track record: cambia solo cosa la testata mette in evidenza.
- Non inventa quote: se manca `market_odds` per la doppia chance, mostra la probabilità senza prezzo.

## Reversibilità

Una costante: `HEADLINE_MIN_PROB = 0.50`. Portarla a `0` ripristina esattamente il comportamento attuale.

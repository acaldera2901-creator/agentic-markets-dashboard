# Post r/algobetting — bozza 2, voce umana (attende OK di Andrea)

**Canale:** r/algobetting (25.344). **Non** r/sportsanalytics: le sue Guidelines vietano alle submission di riguardare specificamente il gambling — lì restiamo ai commenti.
**Regola del sub rispettata:** contenuto interamente dentro Reddit, **nessun link**. Il link vive solo nel profilo `u/Betredge`; nei commenti si dà solo se richiesto.
**Data target:** a warm-up completato (≥40 comment karma, zero rimozioni).
**Fonte dei numeri:** `scripts/comprehensive_prediction_backtest.py` + `reports/prediction_backtest_latest.json`, riprodotti il 13/08/2026.
**Claim check:** zero riferimenti a profitto, ROI, percentuali di vincita. Il titolo stesso dice che il mercato è meglio calibrato di noi.

---

## Perché la bozza 1 andava buttata

Nel thread `1vn9cih` di r/algobetting il commento più votato dell'intera discussione (10 punti) liquida un post come *"personal blog of llm bs"*; un altro utente accusa l'autore di essere un proxy umano di un LLM; un terzo lo deride per *l'assenza* di em-dash e della formula "it's not X, it's Y". La bozza 1 aveva tutti quei tell: prosa simmetrica, tabelle impeccabili, trattini lunghi ovunque. Sarebbe stata giudicata sulla forma prima che sui dati.

Questa versione è scritta come scrive qualcuno che ha fatto il lavoro: frasi irregolari, un'ammissione che brucia, due ipotesi dichiarate come non dimostrate, un dettaglio imbarazzante che nessun ufficio marketing metterebbe in un post, e una domanda vera in fondo.

---

## Titolo

**Our football model scores worse than the closing line. Posting the calibration curves anyway.**

## Corpo

Everyone posts their edge. Almost nobody posts their calibration, and when they do it's one number with no bin counts under it. So here's ours for football and tennis, including the part where we lose.

Setup, quickly. Football is a Poisson on goals, walk forward: for every match the model only sees matches played before it in the same league, 60 match warmup. Top 5 European leagues, Sept 2021 to May 2026, 8,575 predictions. Tennis is a surface specific Elo where the expectation is computed before the rating update, second half held out: 7,589 ATP and 6,927 WTA.

Football Brier, summed over the three outcomes, so lower is better and 2.0 is the ceiling:

    uniform 1/3        0.6667
    us                 0.5991
    closing odds       0.5763   (margin stripped)

That third line is the one that matters. The market is better calibrated than we are. We've known for a while and it still stings to type it out.

Calibration on the top pick:

| predicted | n | mean predicted | observed |
|---|---|---|---|
| 30-40% | 1,177 | 38.1% | 38.9% |
| 40-50% | 3,019 | 44.9% | 43.5% |
| 50-60% | 2,148 | 54.8% | 52.4% |
| 60-70% | 1,395 | 64.6% | 61.4% |
| 70-80% | 638 | 74.3% | 74.6% |
| 80-90% | 189 | 83.5% | 82.5% |

The 90-100% bucket had 9 matches in it so I left it out. Everything else is 189 or more.

We run about 2 to 3 points over confident between 50 and 70, which is the annoying place to be wrong because that's where most of the volume sits. Current guess is the low score correction: it's a plain Poisson, no Dixon-Coles, and the draws leak. Not proven, just where I'd dig first.

Tennis is tighter. ATP Brier 0.2192 against a 0.25 baseline, WTA 0.2192 as well, which surprised me more than it probably should have.

| predicted (ATP) | n | mean predicted | observed |
|---|---|---|---|
| 20-30% | 629 | 25.5% | 31.3% |
| 30-40% | 1,049 | 35.2% | 36.0% |
| 40-50% | 1,540 | 45.3% | 45.8% |
| 50-60% | 1,509 | 54.7% | 55.0% |
| 60-70% | 1,080 | 64.6% | 62.0% |
| 70-80% | 772 | 74.7% | 73.5% |
| 80-90% | 441 | 84.7% | 82.1% |
| 90-100% | 134 | 93.4% | 91.8% |

The weak spot is the underdog band. At 20-30% we say 25.5 and the real rate is 31.3, so we under rate them by nearly six points. My suspicion is surface switches: a rating that persists across a surface change is going to be slow at exactly the moment the upset happens. Also unproven.

Two caveats that matter more than the numbers.

These are backtests on cached historical data, not our live served record. Our production log rewrites the same match every time the odds move, about 56 rows per match, so a table with ten thousand settled rows turned out to be a couple hundred distinct matches. Took me embarrassingly long to notice. If you're keeping a record the same way, go count distinct events before you bin anything.

And calibration isn't edge. A perfectly calibrated model that sits behind the closing line still loses to the vig. It's the floor you need before the question of edge is even worth asking.

Happy to get torn apart on method. If anyone has run Dixon-Coles against a plain Poisson on the 50-70 band specifically, I'd like to know whether that gap closes, because that's the experiment I keep putting off.

*(No link, this is our own work. 18+, not advice.)*

---

## Come converte senza chiedere niente

Nessuna CTA, ed è voluto: in quella community una CTA è il segnale che fa smettere di leggere. La conversione passa da tre strade più lente e più solide di un link. Il **nome utente** è il brand e compare su ogni riga. Le **domande nei commenti** sono l'occasione legittima per dare il link a chi lo chiede. E chi resta colpito **cerca il nome su Google**, che è anche il segnale che misureremo in Search Console.

La domanda finale sul Dixon-Coles non è retorica: serve a far partire una discussione tecnica in cui possiamo rispondere più volte, e ogni risposta è un'altra riga firmata col nome del brand.

## Soglia di morte

Al 27/08: sotto **30 click dal link del profilo, zero ricerche di marca nuove in Search Console e nessuna richiesta del link nei commenti**, Reddit non è il canale. Si passa all'outreach diretto, senza terzo tentativo.

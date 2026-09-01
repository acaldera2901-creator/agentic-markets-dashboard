# Reddit — i primi 3 commenti da pubblicare

**Data:** 2026-08-31 · **Account:** `u/Betredge` · **Sub:** r/algobetting
**Regole applicate:** ≤4 frasi · almeno un numero misurato · niente em-dash · niente «non è X, è Y» ·
niente struttura simmetrica · inglese · nessun link · nessuna menzione del prodotto ·
il commento regge anche senza il nome utente.

⚠️ **Non pubblicare nulla prima dei 3 gate** (vedi la strategia): commenti vecchi ancora vivi? ·
OK di Tommy · display name.

**Ritmo:** uno al giorno per i primi tre giorni, non tutti insieme. L'account è freddo e il
suo stato non è confermato: una raffica su un account a ~2 di karma è quello che fa scattare
i filtri. Dal quarto giorno si passa a 2 al giorno come da rampa.

---

## #1 — giorno 1

**Thread:** «Uncommonly mentioned things that mess up backtests/paper trading?»
`reddit.com/r/algobetting/comments/1w2m3v3/` (30/08, di u/HansEliSebastianFors)

**Perché questo:** il thread chiede esplicitamente trappole poco citate, e la nostra è
davvero poco citata. Zero rischio: è una war story tecnica, non tocca mercato, quote o
risultati. È il commento giusto per riaprire l'account.

> Name normalisation that deletes characters instead of folding them. NFKD handles ö because
> that's o plus a combining mark, but ø ß æ ł are their own codepoints, so they pass through
> untouched and then the strip-to-[a-z0-9] step quietly removes them. Bodø/Glimt came out as
> "bod glimt" from one provider and "bodo glimt" from another, dedup kept both, and nothing
> errored. Same family: the "1" in 1. FC Kaiserslautern got read as an identity token and
> blocked the merge, while 1899 Hoffenheim actually needs its digits.

**Fonte:** `reference_unicode_fold_dedup` (misurato 30/08, fix live in #309).

---

## #2 — giorno 2

**Thread:** «What tennis data actually matters most for a betting model?»
`reddit.com/r/algobetting/comments/1w2gpsj/` (30/08, di u/Due-Aide8274)

**Perché questo:** il tennis è l'unico sport su cui abbiamo un edge misurato, e la domanda
è esattamente sui dati. Si aggancia al commento di u/Pure_Cricket_3804 già nel thread
(«compressing it into stable features»), che è il modo giusto di entrare.

> Agreed with the compression point above, raw point by point never paid for itself for me.
> Surface split first, meaning separate strength estimates per surface rather than a surface
> dummy. The one that surprised me is that whether the side you want has a price at all
> behaves like a feature: matches with no quote on the picked side came in 13 points below
> the ones that had one, 58.9% against 72.1% on the same model and the same features,
> z=3.51. Point by point will not rescue that tail either, because those matches are thin
> everywhere, not only in the odds.

**Fonte:** `#TENNIS-MARKET-GATE-0805` (in `project_tennis_void_fix`).
⚠️ **Unica riga con un rischio:** il 72,1% può essere letto come vanto, e r/algobetting ha
una regola scritta contro il vanto sui campioni piccoli. La tengo perché senza i due numeri
il confronto non è verificabile, ed è presentato come uno scarto fra due sottoinsiemi dello
stesso modello, non come un risultato. Se preferisci, si taglia a «13 points lower, z=3.51».

---

## #3 — giorno 3

**Thread:** «Football value model - 8 weeks forward-tested, graded on CLV. Sanity check?»
`reddit.com/r/algobetting/comments/1vzl6fe/` (27/08, di u/mCryptog3nJ)

**Perché questo:** è il commento più forte che possiamo scrivere in assoluto. Il thread
grada tutto contro una closing line de-viggata, e quattro utenti hanno già discusso
clustering, lead time e scaling. **Nessuno ha messo in dubbio il benchmark.** Noi ci siamo
bruciati esattamente lì.

> Nobody here has questioned whether the closing prices themselves are formed. I checked 478
> football events and 21% had a reference price with an overround above 20%, up to 191%, all
> from one exchange and all on illiquid or distant fixtures. San Marino v Finland came back
> 1.07 / 1.09 / 1.09, which de-vigs to a third each and turns any model into a value machine.
> After dropping those, quotes sitting more than 2% above fair fell from 9.8% to 1.8% across
> ~33k prices, so if your closes come from an exchange I would stratify that 1.42% by
> liquidity before anything else.

**Fonte:** `reference_anchor_margin_trap` (misurato 30/08 su 478 eventi reali).
**Nota:** va per terzo, non per primo. È quello che attira più risposte, e conviene che
arrivi quando l'account ha già due commenti vivi sotto.

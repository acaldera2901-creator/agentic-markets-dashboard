# v3c — chiavi di copy della pagina partita e del price check (F10)

Fonte: `lib/v3c/match-copy.ts` (#REDESIGN-V3C F4, filone `match`). **EN è la fonte, IT è completa**
(il test `lib/v3c/match-view.test.ts` verifica che IT abbia le stesse chiavi). Le altre nove lingue
ricadono sull'inglese (`matchCopyFor`): ogni chiave qui sotto va tradotta in F10. Le chiavi «fn»
sono funzioni: i loro argomenti (nomi, prezzi, ore, numeri) vanno mantenuti.

Lessico: market · estimate · gap in points · sealed · price · record · connected books.
Legali per prime: `affiliates`, `partnerFine`, `blocked`, `oddsOnSite`, `cta`.
Una chiave nuova anche in `lib/v3c/copy.ts`: `board.openMatch` (in `docs/v3c-i18n-keys.md`).

| Chiave | EN |
|---|---|
| `crumbsBoard` | «Board» |
| `tabFootball` | «Match · football» |
| `tabTennis` | «Match · tennis» |
| `kickoffUtc` | «UTC» |
| `s1` | «Market against our estimate» |
| `market` | «Market» |
| `marketSub` | fn |
| `estimate` | «Estimate» |
| `estimateBlend` | «70% market · 30% model» |
| `estimateModel` | «model only · no market» |
| `gap` | «Gap» |
| `gapSub` | «estimate − market» |
| `explain` | fn |
| `outcome` | «Outcome» |
| `price` | «Price» |
| `largest` | «largest gap on this market» |
| `fair` | fn |
| `wrongN` | fn |
| `noMarketLong` | «No market price stored: the estimate is the model alone and there is no gap to show.» |
| `s2` | «Why they differ, and what you can check» |
| `tapeCap` | fn |
| `tapeSub` | fn |
| `legendBook` | fn |
| `legendFair` | fn |
| `legendNews` | «News, with its time» |
| `firstCapture` | «First capture» |
| `newsAt` | fn |
| `moved` | fn |
| `unchanged` | fn |
| `single` | fn → «One price so far: {p}» |
| `movedBody` | fn |
| `blendTitle` | «Estimate = 70% market + 30% model» |
| `blendBody` | «The model can move the number by 30% at most: most of the estimate is the market itself.» |
| `modelTitle` | «Estimate = our model alone» |
| `modelBody` | «No market price stored for this match, so nothing is blended and no gap is drawn.» |
| `sealTitle` | «Sealed before kick-off» |
| `sealBody` | fn |
| `notSealed` | «Not sealed yet» |
| `notSealedBody` | «This match is not in the public ledger yet: there is nothing to verify against.» |
| `record` | «View in the record» |
| `noTape` | «No stored price history for this match yet: no chart, no line.» |
| `onePoint` | fn |
| `tapeError` | «The price history didn’t load. The numbers above are unaffected.» |
| `tapeAria` | fn |
| `every` | fn |
| `outcomeChips` | «Outcome shown in the chart» |
| `strip` | fn |
| `stripTennis` | «Check the price yourself» |
| `allTools` | «All 11 tools →» |
| `s3` | «Where the price is best» |
| `bestAmong` | fn |
| `partnerMeta` | fn |
| `bestLab` | fn |
| `cta` | fn |
| `book` | «Book» |
| `vsBest` | «vs best» |
| `best` | «best» |
| `oddsOnSite` | «Odds on partner site» (ui3) |
| `open` | «Open» |
| `partnerFine` | fn |
| `affiliates` | «Affiliate links.» |
| `noBooks` | «No connected book has a price for this outcome yet.» |
| `blocked` | «Partner prices are not shown in your region.» |
| `pcBridge` | «Your book shows another price? Check it →» |
| `more` | «More on today’s board» |
| `allMatches` | «The whole board →» |
| `loading` | «Loading the match» |
| `errorTitle` | «The match didn’t load.» |
| `errorBody` | «The data source did not answer. A retry asks again.» |
| `retry` | «Try again» |
| `notFoundTab` | «Match · not found» |
| `notFoundTitle` | «No match here» |
| `notFoundBody` | «This link points to no match we price. It may be mistyped, or the fixture was never on the board.» |
| `backToBoard` | «Back to the board» |
| `offBoard` | «This match has left the board: it started over 150 minutes ago or sits outside the ten-day window. The price history stays.» |
| `tennisMarketOnlyBig` | «Market, margin removed» |
| `pc.tab` | «Price check · free» |
| `pc.title` | «What does this price claim?» |
| `pc.choose` | «Match» |
| `pc.noMatch` | «No match · just the maths» |
| `pc.hint` | «type your book’s prices» |
| `pc.useBook` | fn |
| `pc.useMarket` | «Market price» |
| `pc.fill` | «Fill with» |
| `pc.verdict` | fn |
| `pc.verdictNoEst` | fn |
| `pc.yourPrice` | «Your price» |
| `pc.implied` | «Implied» |
| `pc.noVig` | «Margin removed» |
| `pc.total` | «Book margin» |
| `pc.kept` | fn |
| `pc.under` | «under 100%: no margin» |
| `pc.invalid` | «Type a decimal price above 1.00 in every box.» |
| `pc.fine` | «Implied = 1 ÷ price. Margin removed = implied ÷ the sum. Estimate: 70% market, 30% model.» |
| `pc.fineNoEst` | «Implied = 1 ÷ price. Margin removed = implied ÷ the sum. Pick a match to see our estimate next to it.» |
| `pc.strip` | «Go further with these prices» |
| `pc.partnerTitle` | «Does another book pay more?» |
| `pc.youBeat` | fn → «Your {price} is already at or above every connected book’s price.» |
| `pc.whyTitle` | «Why the margin matters» |
| `pc.whyBody` | «Prices adding up past 100% hide the book’s fee. Removed, they show what the book believes; our estimate sits beside it.» |
| `pc.outcomes` | «1 · X · 2» |
| `pc.openMatch` | «Open the match →» |
| `pc.loading` | «Loading today’s matches» |

### ui3 (07/10) — tennis senza la nostra stima, tradotte nelle 11 lingue

Rimosse: `tennisSealed`, `tennisMarketAtSeal`, `tennisSealedEstimate`, `tennisGapAtSeal`, `tennisModelBig`, `tennisSub`, `tnMarketOnly`, `tnNotSealed`, `tnNoMarketAtSeal`, `tnAnchored`, `tnComing`. Riscritte: `oddsOnSite`, `moreBooks` («odds on partner site»).

| Chiave | EN |
|---|---|
| `s1Tennis` | «The market price, margin removed» |
| `tnSealBody` | fn → «In the public ledger since {t}. The sealed number is market-based, not an estimate of ours.» |
| `tnWhyTitle` | «Market price only» |
| `tnWhyBody` | «No estimate of ours in tennis: the number above is the books’ price, margin removed. The chart shows how it moved.» |
| `pc.fineTennis` | «Implied = 1 ÷ price. Margin removed = implied ÷ the sum. Tennis: market price only, no estimate of ours.» |
| `movedBodyTennis` | fn → «{n} captures since {since}, connected books only.» (movedBody senza la frase sul gap) |
| `pc.whyBodyTennis` | «Prices adding up past 100% hide the book’s fee. Removed, they show what the book believes.» |
| `s2Tennis` | «The price line, and what you can check» |

## tennis2 (07/10/2026) — pagina partita e price check tennis con la stima basata su Elo

11 lingue scritte; `// REVIEW-NATIVE` su `tnEloWhyBody` e `pc.fineTennisElo` nelle 9 lingue non EN/IT.
Riscritte: `tnWhyBody` («per questa partita» invece di «nel tennis»), `pc.fineTennis`.

| Chiave | EN | IT |
|---|---|---|
| `s1TennisElo` | «Market, then our Elo-based estimate» | «Il mercato, poi la nostra stima basata su Elo» |
| `tnEloWhyTitle` | «Estimate: 90% market, 10% our Elo» | «Stima: 90% mercato, 10% nostro Elo» |
| `tnEloWhyBody` | «Our player rating nudges the market price slightly. It is not sealed, so it is not in the record.» | «Il nostro rating dei giocatori sposta di poco il prezzo di mercato. Non è sigillata, quindi non entra nel registro.» |
| `pc.fineTennisElo` | «Implied = 1 ÷ price. Margin removed = implied ÷ the sum. Estimate = 90% market + 10% our Elo, not sealed.» | «Implicita = 1 ÷ prezzo. Margine tolto = implicita ÷ la somma. Stima = 90% mercato + 10% nostro Elo, non sigillata.» |
| `pc.fineTennis` | «… This match: market only, no estimate of ours.» | «… Questa partita: solo mercato, nessuna nostra stima.» |
| `tnWhyBody` | «No estimate of ours for this match: the number above is the books’ price, margin removed. The chart shows how it moved.» | «Nessuna nostra stima per questa partita: …» |

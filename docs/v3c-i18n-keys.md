# v3c — chiavi di copy da tradurre (F10)

Fonte: `lib/v3c/copy.ts` (#REDESIGN-V3C F3). **EN è la fonte, IT è completa.** Le altre nove lingue
del sito (es, de, fr, pt, ru, …) oggi ricadono sull'inglese **chiave per chiave** (`copyFor`): ogni
chiave qui sotto va tradotta in F10, nessuna esclusa — Andrea ha deciso il lancio solo con tutte e 11
le lingue complete. Le chiavi «fn» sono funzioni: i segnaposto `{a}…{e}` sono i loro argomenti
(numeri, nomi, ore) e vanno mantenuti nella traduzione.

Lessico del deck da rispettare in ogni lingua: market · estimate · gap (in points, pp) · sealed ·
blend 70/30 · connected books. Mai «tip», «edge» come profitto, ROI/CLV/hit-rate, «guaranteed».
Legali per prime (F10): `foot.disclaimer`, `foot.affiliates`, `foot.age`, `foot.responsible`,
`board.bestNote`, `board.partnerAria`, `board.partnerBlocked`.

Rigenerare la tabella: `npx tsx` su `copyKeys()` (test `lib/v3c/board-f3.test.ts` fallisce se una
chiave manca da questo file). Altre stringhe EN fuori da copy.ts, da portare in F10: gli esempi del
banco (`benchExample` in `lib/v3c/sample.ts`: «2.15 at 48%», «no stake»), il FAQ (`lib/home-faq.ts`,
oggi en/it), le etichette fisse di `ThemeToggle` e `BottomNav` (aria-label inglesi).

| Chiave | EN |
|---|---|
| `nav.board` | «Board» |
| `nav.tools` | «Tools» |
| `nav.price` | «Price check» |
| `nav.priceShort` | «Price» |
| `nav.record` | «Record» |
| `nav.books` | «Books» |
| `nav.news` | «News» |
| `nav.pro` | «Pro» |
| `nav.primary` | «Primary» |
| `fascia.tab` | «Board · football & tennis» |
| `fascia.tabPredictions` | «Predictions · football & tennis» |
| `fascia.matches` | fn → «{a} matches» |
| `fascia.pricesAsOf` | fn → «prices as of {a}» |
| `fascia.sealed` | «sealed» |
| `fascia.sealedBefore` | «sealed before kick-off» |
| `fascia.titlePredictions` | «The board» |
| `fascia.unavailable` | «board data unavailable» |
| `fascia.sealedCount` | fn → «{a} of {b} sealed before kick-off» |
| `fascia.window` | fn → «next {a} days» |
| `toolbar.sport` | «Sport» |
| `toolbar.all` | «All» |
| `toolbar.football` | «Football» |
| `toolbar.tennis` | «Tennis» |
| `toolbar.day` | «Day» |
| `toolbar.allDays` | «All days» |
| `toolbar.today` | «Today» |
| `toolbar.tomorrow` | «Tomorrow» |
| `toolbar.league` | «League» |
| `toolbar.allLeagues` | «All leagues» |
| `toolbar.explain` | «Market %: the composite price, margin removed. Estimate: 70% market, 30% model. Gap: estimate − market, in points.» |
| `toolbar.legendMarket` | «Market %, margin removed» |
| `toolbar.legendEstimate` | «Estimate: 70% market + 30% model (football), model (tennis)» |
| `toolbar.legendGap` | «Gap = estimate − market, in points.» |
| `board.label` | «Today’s board» |
| `board.kickoff` | «Kick-off» |
| `board.match` | «Match · lead outcome» |
| `board.price` | «Price» |
| `board.priceSub` | «market» |
| `board.market` | «Market» |
| `board.marketSub` | «margin removed» |
| `board.estimate` | «Estimate» |
| `board.estimateSub` | «70/30 blend» |
| `board.gap` | «Gap» |
| `board.gapSub` | «pp» |
| `board.best` | «Best price» |
| `board.bestSub` | «connected books» |
| `board.moreBooks` | «More books» |
| `board.noPrice` | «no feed price» |
| `board.inLine` | «in line» |
| `board.gapWord` | «gap» |
| `board.draw` | «Draw» |
| `board.noMarket` | «no market» |
| `board.noMarketLong` | «No market price stored: the estimate is the model alone and there is no gap to show.» |
| `board.rowNote` | «Each row shows the outcome with the largest gap, the others beneath it. Tap a row for all three and the book prices.» |
| `board.sealedAt` | fn → «sealed {a}» |
| `board.sealedWhy` | fn → «This match entered the public ledger on {a}, before kick-off. The row cannot be edited afterwards; the numbers shown are the latest estimate and can differ from the sealed ones.» |
| `board.estimateAsOf` | fn → «estimate as of {a}» |
| `board.margin` | fn → «margin removed {a}» |
| `board.blend` | «estimate = 70% market + 30% model» |
| `board.modelOnly` | «estimate = model (no market)» |
| `board.booksFor` | fn → «Connected books · {a}» |
| `board.allOutcomes` | «All three outcomes» |
| `board.open` | «Open» |
| `board.close` | «Close» |
| `board.live` | «Live» |
| `board.liveGroup` | «Live now» |
| `board.liveSince` | fn → «{a}′» |
| `board.rowAria` | fn → «{a} at {b}, market {c} percent, estimate {d} percent, gap {e} points. Show all outcomes» |
| `board.outcome` | «Outcome» |
| `board.scaleHead` | «Market → estimate» |
| `board.scaleSub` | «on a 0–100% scale» |
| `board.scaleAria` | fn → «Market {a} percent, estimate {b} percent, gap {c} points, on a 0 to 100 percent scale» |
| `board.scaleAriaNoMarket` | fn → «No market price; estimate {a} percent, model only» |
| `board.seeAll` | fn → «The whole board · {a} matches →» |
| `board.noFeedBooks` | «No connected book has a price for this outcome yet.» |
| `board.bestCta` | fn → «Best price on {a}: {b} at {c}» |
| `board.bestNote` | «Opens the book’s site in a new tab. Commercial affiliate link · 18+ · the price on the book can differ from the one shown.» |
| `board.group` | fn → «{a} matches» |
| `board.partnerAria` | fn → «{a}, affiliate link, opens in a new tab» |
| `board.partnerBlocked` | «Partner prices are not shown in your region.» |
| `board.siteOnlyLab` | «Other partners · odds on their site» (F7) |
| `board.oddsOnSite` | «Odds on site» (F7) |
| `board.siteOnlyNote` | «No price shown: we do not read these books yet. Affiliate links · 18+.» (F7) |
| `board.openMatch` | «The match: price history and best price →» |
| `tennis.title` | «Tennis» |
| `tennis.coming` | «market comparison coming» |
| `tennis.comingLong` | «Tennis rows show our estimate and the connected books’ prices. The market comparison and the gap arrive once a market/model split is stored per match.» |
| `tennis.marketOnly` | «market price only» |
| `tennis.marketOnlyLong` | «No model of ours on this match: the percentage is the book’s price with the margin removed (temperature 1.68). A gap against itself would be zero.» |
| `tennis.winner` | «Winner» |
| `tennis.estimateModel` | «Estimate · model» |
| `tennis.sealedCol` | «Sealed» |
| `tennis.gapCol` | «Gap at seal» |
| `tennis.atSeal` | «at seal» |
| `tennis.kindModel` | «Elo v4, our model» |
| `tennis.kindModelTempered` | «Elo v4 with temperature 1.68, our model (no market when served)» |
| `tennis.kindMarket` | «Market price without margin, temperature 1.68: not a model of ours» |
| `tennis.rawElo` | fn → «raw Elo {a}% (not sealed)» |
| `tennis.gapVs` | fn → «Gap = our sealed estimate − the {a} price captured on {b}, before the seal, margin removed. A difference of probabilities, not a profit.» |
| `tennis.reasonNotSealed` | «Not sealed yet: the gap appears once our estimate is in the ledger.» |
| `tennis.reasonNoMarketAtSeal` | «No FortunePlay or YBets price was captured in the 150 minutes before the seal, so there is no gap to show.» |
| `tennis.reasonAnchored` | «The sealed number is the market price itself (our Elo was anchored to it): a gap against itself would be zero.» |
| `tennis.rowAria` | fn → «{a}: {b}. Show both players» |
| `tennis.scaleAriaModel` | fn → «Estimate {a} percent, our model; no market comparison yet» |
| `tennis.scaleAriaMarket` | fn → «Market {a} percent, margin removed; no model estimate» |
| `tennis.scaleAriaSeal` | fn → «At the seal: market {a} percent, our estimate {b} percent, gap {c} points» |
| `empty.filter` | «No match for this filter.» |
| `empty.filterHint` | «Try another day or sport; the board covers the next ten days.» |
| `empty.noLive` | «No match is live right now.» |
| `empty.biggestGap` | «Biggest gap today» |
| `empty.biggestGapLine` | fn → «{a} · {b} · {c} pp» |
| `empty.nextUp` | «Next up» |
| `empty.startsIn` | fn → «starts in {a}» |
| `empty.yesterday` | «Yesterday’s review» |
| `empty.yesterdayLine` | fn → «{a} won · {b} lost, from the sealed ledger» |
| `empty.nothing` | «Nothing on the board.» |
| `empty.nothingHint` | «No published match in the next ten days. The board fills as fixtures are priced.» |
| `empty.seeAll` | «Show the whole board» |
| `empty.hours` | fn → «{a} h {b} min» |
| `empty.minutes` | fn → «{a} min» |
| `empty.days` | fn → «{a} d {b} h» |
| `error.title` | «The board didn’t load.» |
| `error.body` | «The data source did not answer. Nothing is cached in your browser, so a retry asks again.» |
| `error.retry` | «Try again» |
| `loading` | «Loading the board» |
| `yday.title` | «Yesterday, won and lost» |
| `yday.unavailable` | «Yesterday’s settlements didn’t load. The record keeps them.» |
| `yday.wonOne` | «Won» |
| `yday.lostOne` | «Lost» |
| `yday.picked` | fn → «sealed on {a} at {b}%» |
| `yday.paper` | «no market price at seal» |
| `yday.more` | fn → «{a} more in the record.» |
| `yday.lab` | fn → «Yesterday · {a} · from the sealed ledger» |
| `yday.body` | «Won and lost are the settled picks. “Expected” is the sum of the sealed probabilities: what the estimates were supposed to win.» |
| `yday.settled` | «Settled» |
| `yday.won` | «Won» |
| `yday.lost` | «Lost» |
| `yday.other` | «Void» |
| `yday.expected` | «Expected» |
| `yday.football` | «Football» |
| `yday.tennis` | «Tennis» |
| `yday.none` | «Nothing settled yesterday.» |
| `yday.noneHint` | «No sealed pick kicked off yesterday, or the settlements are still pending.» |
| `yday.full` | «Full record» |
| `yday.limited` | «limited sample» |
| `bench.lab` | «The bench · 11 tools · free, no sign-in» |
| `bench.title` | «Do the maths on any price» |
| `bench.all` | «All 11 tools →» |
| `bench.pcName` | «Price check» |
| `bench.pcLine` | «Type the three prices from your book: margin and market probability, estimate next to it.» |
| `bench.pcCta` | «Check a price» |
| `bench.marginWord` | «margin» |
| `bench.vs` | «vs» |
| `bench.note` | fn → «Examples use {a} from today’s board. Each tool takes your numbers and ends on the board, not a paywall.» |
| `bench.noteNoMatch` | «Examples use a sample price until today’s board has a match with a market.» |
| `bench.tools.ev-calculator.name` | «EV calculator» |
| `bench.tools.ev-calculator.line` | «is the price worth it at your probability?» |
| `bench.tools.probability-calculator.name` | «Probability calculator» |
| `bench.tools.probability-calculator.line` | «three prices to probabilities, margin removed» |
| `bench.tools.kelly-criterion.name` | «Kelly criterion» |
| `bench.tools.kelly-criterion.line` | «fraction of bankroll, with half and quarter Kelly» |
| `bench.tools.margin-calculator.name` | «Margin calculator» |
| `bench.tools.margin-calculator.line` | «how much the book keeps on a market» |
| `faq.title` | «Questions people ask before signing up» |
| `foot.lede` | «Market price, our estimate next to it, the sealed record. Then the best price from a connected book.» |
| `foot.product` | «Product» |
| `foot.trust` | «Trust» |
| `foot.legal` | «Legal» |
| `foot.tools` | «Tools · 11, free» |
| `foot.method` | «Method» |
| `foot.terms` | «Terms» |
| `foot.privacy` | «Privacy» |
| `foot.partners` | «Partners» |
| `foot.disclaimer` | «Analysis, not advice. BetRedge is not a bookmaker and takes no bets.» |
| `foot.blend` | «Football estimates are 70% market, 30% model.» |
| `foot.affiliates` | «Partner links are commercial affiliates.» |
| `foot.responsible` | «Gamble responsibly» |
| `foot.age` | «18+» |
| `theme.toDark` | «Switch to dark» |
| `theme.toPaper` | «Switch to paper» |

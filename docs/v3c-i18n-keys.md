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
| `toolbar.legendEstimate` | «Estimate (football only): 70% market + 30% model» |
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
| `board.noPrice` | «Odds on partner site» (ui3) |
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
| `board.shownOf` | fn → «{shown} of {total} matches» (live) |
| `board.showMore` | fn → «Show {n} more» (live) |
| `board.noFeedBooks` | «No connected book has a price for this outcome yet.» |
| `board.bestCta` | fn → «Best price on {a}: {b} at {c}» |
| `board.bestNote` | «Opens the book’s site in a new tab. Commercial affiliate link · 18+ · the price on the book can differ from the one shown.» |
| `board.sameAt` | fn → «same at {n} books» (polish) |
| `board.sharedTop` | «{label} at {price} on {n} books: same price, no single best.» (polish) |
| `board.group` | fn → «{a} matches» |
| `board.partnerAria` | fn → «{a}, affiliate link, opens in a new tab» |
| `board.partnerBlocked` | «Partner prices are not shown in your region.» |
| `board.siteOnlyLab` | «Other partners · odds on partner site» (F7, ui3) |
| `board.oddsOnSite` | «Odds on partner site» (F7, ui3) |
| `board.siteOnlyNote` | «No price shown: we do not read these books yet. Affiliate links · 18+.» (F7) |
| `board.openMatch` | «The match: price history and best price →» |
| `tennis.title` | «Tennis» |
| `tennis.winner` | «Winner» |
| `tennis.rowAria` | fn → «{a}: {b}. Show both players» |
| `tennis.scaleAriaMarket` | fn → «Market {a} percent, margin removed» |
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

## /record (F6) — `lib/v3c/copy-record.ts`

EN fonte, IT completa, le altre nove in fallback EN (`recordCopyFor`). Prefisso `record.` = chiave del dizionario del registro. Legali per prime in F10: `record.kpi.verdict.*`, `record.receipts.recipeNote`, `record.receipts.noReturn`, `record.tennis.lede`. Stringhe fuori dal dizionario: i nomi delle fonti di correzione (`SOURCE` in `components/v3c/record/Corrections.tsx`).

| Chiave | EN |
|---|---|
| `record.fascia.tab` | «Record · read only from the sealed ledger» |
| `record.fascia.title` | «Every estimate, and how it settled» |
| `record.fascia.since` | «fn: On record since {a}» |
| `record.fascia.sealed` | «fn: {a} football · {b} tennis sealed before kick-off» |
| `record.fascia.edit` | «Nothing here can be edited after publication.» |
| `record.fascia.unavailable` | «record data unavailable» |
| `record.kpi.sealed` | «Football estimates sealed» |
| `record.kpi.sealedVs` | «fn: {a} – {b} · {c} settled with a result» |
| `record.kpi.brier` | «Brier score · lower is better» |
| `record.kpi.ours` | «Our estimate» |
| `record.kpi.market` | «Market, margin removed» |
| `record.kpi.ci` | «fn: 95% interval {a}–{b}» |
| `record.kpi.verdict.market_better` | «The market is slightly better than ours. We publish it anyway.» |
| `record.kpi.verdict.tie` | «On this sample the two cannot be told apart. We publish it either way.» |
| `record.kpi.verdict.ours_lower` | «Ours is lower on this sample. A sample, not a promise.» |
| `record.kpi.diff` | «fn: Difference {a} (95%: {b} to {c}) on {d} matches with the market at seal.» |
| `record.kpi.blend` | «Football estimate = 30% our model + 70% the market, margin removed.» |
| `record.kpi.coverage` | «Coverage» |
| `record.kpi.coverageMain` | «fn: {a} of {b}» |
| `record.kpi.coverageVs` | «settled matches carry the market price at the moment of the seal» |
| `record.kpi.coverageRest` | «fn: {a} awaiting a result · {b} past kick-off without one · {c} sealed with no market (paper)» |
| `record.cal.title` | «Does a 60% happen 60 times in 100?» |
| `record.cal.lede` | «Calibration: stated probability against how often it happened. Accuracy is the Brier score above.» |
| `record.cal.fig` | «Reliability · stated against observed» |
| `record.cal.figSub` | «fn: {a} outcomes from {b} matches · bars are 95% intervals» |
| `record.cal.aria` | «Reliability diagram of our football estimate and of the market against the diagonal of perfect calibration» |
| `record.cal.ours` | «our estimate» |
| `record.cal.market` | «market» |
| `record.cal.diag` | «perfect calibration» |
| `record.cal.xAxis` | «stated probability» |
| `record.cal.yAxis` | «observed» |
| `record.cal.caption` | «Hollow marks: fewer than 30 outcomes in the bin. Dot size follows n.» |
| `record.cal.binsTitle` | «By bin, with n» |
| `record.cal.stated` | «Stated» |
| `record.cal.observed` | «Observed» |
| `record.cal.pm` | «±95%» |
| `record.cal.n` | «n» |
| `record.cal.gap` | «Gap» |
| `record.cal.limited` | «limited sample» |
| `record.cal.binsNote` | «Wilson 95% intervals. Gap = observed − stated, in points.» |
| `record.weeks.title` | «Expected against observed, by week» |
| `record.weeks.sub` | «A record is luck or measurement; this is how you tell.» |
| `record.weeks.expected` | «Expected: sum of sealed probabilities of the most likely outcome» |
| `record.weeks.observed` | «Observed: how often that outcome happened» |
| `record.weeks.aria` | «Expected against observed outcomes, by ISO week» |
| `record.weeks.week` | «fn: wk of {a}» |
| `record.weeks.caption` | «Whiskers are the 95% interval of the observed count. Weeks under 30 matches: expected bar in grey, n marked *.» |
| `record.tennis.title` | «Tennis, kept apart» |
| `record.tennis.lede` | «In tennis the sealed number is market-based, not an estimate of ours, so we show outcomes and match counts only.» |
| `record.tennis.settled` | «Settled» |
| `record.receipts.title` | «Receipts, won and lost alike» |
| `record.receipts.filter` | «Sport» |
| `record.receipts.all` | «All» |
| `record.receipts.football` | «Football» |
| `record.receipts.tennis` | «Tennis» |
| `record.receipts.sealed` | «Sealed (UTC)» |
| `record.receipts.match` | «Match» |
| `record.receipts.read` | «Outcome read» |
| `record.receipts.price` | «Price» |
| `record.receipts.marketPct` | «Market %» |
| `record.receipts.estimatePct` | «Estimate %» |
| `record.receipts.gap` | «Gap» |
| `record.receipts.result` | «Result» |
| `record.receipts.fingerprint` | «Fingerprint» |
| `record.receipts.draw` | «Draw» |
| `record.receipts.kickoff` | «kick-off» |
| `record.receipts.top` | «top outcome · no pick shown» |
| `record.receipts.pick` | «pick shown» |
| `record.receipts.noMarket` | «no market at seal» |
| `record.receipts.isMarket` | «is the market» |
| `record.receipts.paper` | «paper» |
| `record.receipts.corrected` | «corrected» |
| `record.receipts.verdict.in_favour` | «in favour» |
| `record.receipts.verdict.against` | «against» |
| `record.receipts.verdict.void` | «void» |
| `record.receipts.verdict.unresolved` | «unresolved» |
| `record.receipts.older` | «Older receipts» |
| `record.receipts.newer` | «Newer» |
| `record.receipts.page` | «fn: Page {a}» |
| `record.receipts.scroll` | «Scroll sideways for the full row.» |
| `record.receipts.recipe` | «Fingerprint = SHA-256 of v1\|table\|id\|model\|sealed at\|p home\|p draw\|p away\|price. Recompute it from the row.» |
| `record.receipts.recipeNote` | «The ledger stores no hash; this one is computed from the sealed fields, not at the seal.» |
| `record.receipts.noReturn` | «No return figure: it would not be independent of us.» |
| `record.receipts.fullHash` | «Full SHA-256» |
| `record.receipts.empty` | «Nothing settled yet. A sealed estimate appears here once its match has a result.» |
| `record.receipts.emptyFilter` | «No settled rows for this sport yet.» |
| `record.corr.title` | «Corrections, shown as corrections» |
| `record.corr.lede` | «fn: A result is never edited in place: a correction is a new row with its reason. {a} so far.» |
| `record.corr.when` | «Corrected» |
| `record.corr.match` | «Match» |
| `record.corr.change` | «Before → after» |
| `record.corr.reason` | «Reason» |
| `record.corr.cause.late_result` | «fn: Result recovered late (source: {a})» |
| `record.corr.cause.postponed` | «fn: Postponed beyond 48 h (to {a}): void» |
| `record.corr.cause.no_pick_shown` | «fn: No pick was shown: the won/lost label was voided» |
| `record.corr.cause.late_fill` | «fn: Result filled in late» |
| `record.corr.cause.other` | «fn: Correction» |
| `record.corr.byCause` | «By reason» |
| `record.corr.settle.won` | «won» |
| `record.corr.settle.lost` | «lost» |
| `record.corr.settle.void` | «void» |
| `record.corr.settle.unresolved` | «unresolved» |
| `record.corr.none` | «No result has been corrected.» |
| `record.corr.unavailable` | «Corrections didn’t load. The ledger keeps them.» |
| `record.state.loading` | «Reading the ledger» |
| `record.state.errorTitle` | «The record didn’t load.» |
| `record.state.errorBody` | «The ledger is intact; this page couldn’t read it. Try again in a moment.» |
| `record.state.retry` | «Try again» |
| `record.state.empty` | «Nothing sealed yet.» |
| `record.state.emptyBody` | «The record starts with the first estimate sealed before a kick-off.» |
| `record.limited` | «limited sample» |

## fidelity (#REDESIGN-V3C fidelity) — chiavi nuove, tradotte in tutte le 11 lingue (v3c-final; parità: `lib/v3c/i18n-parity.test.ts`)

| chiave | EN |
|---|---|
| `board.tapeHead` | «Open → now» |
| `board.tapeSub` | «fn: book price · last {h} h» |
| `board.tapeAria` | «fn: {label} price at a connected book moved from {from} to {to}, {n} captures» |
| `board.tapeNone` | «no history» |
| `yday.stripBody` | «Football: expected in favour is the sum of the sealed probabilities, the market’s Brier next to ours (same rows). Tennis: in the Record.» (final5: the home shows football only) |
| `yday.expectedFavour` | «Expected in favour» |
| `yday.observed` | «Observed» |
| `yday.brierEstimate` | «Brier · estimate» |
| `yday.brierMarket` | «fn: Brier · market · n {n}» |
| `match.chartSealed` | «fn: Sealed · {time}» (`lib/v3c/match-copy.ts`) |

v3c-final: anche `board.shownOf` / `board.showMore` (live) sono tradotte nelle 11 lingue; `toolbar.homeHorizon` è stata rimossa (live: i chip della home contano tutta la finestra).

### ui2 (07/10) — esiti W/L/V e pagina Books, tradotte nelle 11 lingue

| Chiave | EN |
|---|---|
| `yday.voidOne` | «Void» |
| `yday.pending` | «Pending» |
| `yday.showAll` | «fn: Show all {n}» |
| `record.receipts.outcome.won` | «Won» |
| `record.receipts.outcome.lost` | «Lost» |
| `record.receipts.outcome.void` | «Void» |
| `record.receipts.outcome.pending` | «Pending» |

W / L / V nelle pill (`components/v3c/ResultPill.tsx`) sono la sigla internazionale e restano tali in ogni lingua.
Books (`lib/v3c/pages-copy.ts` → `books`): nuove `filterLabel`, `all`, `sportsbooks`, `casinos`, `search`, `none`, `shown`, `order`, `typeSportsbook`, `typeCasino`, `pricesLab`, `live`, `siteOdds`; riscritte `title`, `metaStrong`, `metaRest`; rimosse `connected`, `bestOn`, `noBoard`, `bonusNone`, `bonusWhy`, `moreTitle`, `moreSub`, `sportsbook`, `casino`, `visit`. Le nove lingue sono da rivedere da madrelingua come il resto di F10.

### final2 (07/10) — grafico settimanale del record e News a feed spento, tradotte nelle 11 lingue

| Chiave | EN |
|---|---|
| `record.weeks.why` | «Shorter bars mean fewer settled matches that week: national-team breaks pause the top leagues, and this week is still being played.» |
| `record.weeks.counts` | «Under each week: matches with an outcome / sealed.» |
| `record.weeks.awaiting` | «fn: {n} awaiting» (RU/PL: «без итога: {n}» / «bez wyniku: {n}», niente plurali) |
| `record.weeks.awaitingKey` | «Awaiting: kicked off, result not in yet.» |
| `record.weeks.breakTag` | «Break» |
| `record.weeks.breakKey` | «Nations break: no top-five league match sealed that week.» |
| `record.weeks.nowTag` | «Ongoing» |
| `record.weeks.nowKey` | «This week: in progress, incomplete.» |

La sosta è letta dal registro (settimane senza partite PL/PD/SA/BL1/FL1 fra settimane che ne hanno, `TOP_LEAGUE_CODES` in `lib/v3c/record.ts`), non da un calendario. Nessuna stringa legale o di prezzo: niente REVIEW-NATIVE.
News (`lib/v3c/pages-copy.ts` → `news`): nuova `tabOff` («News · guides», la fascia a feed spento, 11 lingue); rimosse `notesTitle`, `notesBody`, `notesNot`, `boardLink` — a feed spento la pagina mostra solo le guide, senza il riquadro «note in arrivo».

### ui3 (07/10) — «Odds on partner site» e tennis senza la nostra stima, tradotte nelle 11 lingue

Decisione di Andrea: un partner senza quota letta dice ovunque «Odds on partner site» (IT «Quote sul sito del partner»; glossario aggiornato); nel tennis non diamo la nostra stima (solo mercato senza margine, quote dei partner, best price, line movement, live). Rimosse le chiavi della stima/gap tennis (`tennis.coming`, `tennis.comingLong`, `tennis.marketOnly`, `tennis.marketOnlyLong`, `tennis.estimateModel`, `tennis.sealedCol`, `tennis.gapCol`, `tennis.atSeal`, `tennis.kind*`, `tennis.rawElo`, `tennis.gapVs`, `tennis.reason*`, `tennis.scaleAriaModel`, `tennis.scaleAriaSeal`) e del Brier/calibrazione tennis del registro (`record.tennis.group`, `what`, `expected`, `observed`, `brier`, `vsMarket`, `isMarket`, `ours`, `kind*`, `paired`, `pairedDiff`, `noPaired`, `calInsufficient`, `calSufficient`, `binary`). Riscritte: `toolbar.legendEstimate`, `board.noPrice`, `board.siteOnlyLab`, `board.oddsOnSite`, `tennis.scaleAriaMarket`, `yday.stripBody`, `record.tennis.lede`, `books.siteOdds` e `books.metaRest` (pages-copy), `method.blocks.blend.detail` (pages-copy), FAQ home risposte 2 e 6 (`lib/v3c/home-faq.ts`).

| Chiave | EN |
|---|---|
| `toolbar.legendTennis` | «Tennis: market price only, no estimate of ours» |
| `tennis.noEstimate` | «Tennis: the market price with the margin removed and the books’ prices. No estimate of ours.» |
| `tennis.sealedWhy` | fn → «Entered the public ledger on {a}, before the start. The sealed number is market-based, not an estimate of ours.» |
| `yday.pickedTennis` | fn → «sealed on {a} · market-based {b}%» |
| `yday.tennisWL` | «Tennis · won–lost» |
| `record.tennis.label` | «Market-based probability» |
| `record.tennis.sealed` | «Matches sealed» |
| `record.tennis.won` | «Won» |
| `record.tennis.lost` | «Lost» |
| `record.tennis.void` | «Void» |
| `record.tennis.awaiting` | «Awaiting a result» |
| `record.tennis.note` | «Won = the picked player won. Without a price at the seal, a tempered Elo stood in. No Brier, no calibration.» |
| `record.receipts.marketBased` | «market-based» |

### final3 (07/10) — banner colore e FAQ senza fattori tennis, tradotte nelle 11 lingue

Nuovo dizionario `lib/v3c/banner-copy.ts` (`V3C_BANNER_COPY`, controllato da `i18n-parity.test.ts`, titolo ≤ 8 parole). Nessuna stringa legale o di prezzo: niente REVIEW-NATIVE. Riscritta la risposta 2 della FAQ home (`lib/v3c/home-faq.ts`): Pro mostra i fattori del modello «in any football match» (forma, gol attesi, Elo, scontri diretti) — tolti «serve and return numbers» e «surface», perché nel tennis non diamo la nostra stima.

| Chiave | EN | IT |
|---|---|---|
| `record.title` / `.link` | «Every read sealed before kick-off» / «See the record» | «Ogni lettura sigillata prima del fischio d’inizio» / «Vedi il registro» |
| `learn.title` / `.link` | «How a read is built, step by step» / «How it works» | «Come nasce una lettura, passo per passo» / «Come funziona» |
| `calcio.title` / `.link` | «Football: model and market, weights declared» / «Football on the board» | «Calcio: modello e mercato, pesi dichiarati» / «Il calcio sulla board» |
| `tennis.title` / `.link` | «Tennis: the market price, read clearly» / «Tennis on the board» | «Tennis: il prezzo di mercato, letto chiaro» / «Il tennis sulla board» |
| `live.title` / `.link` | «Matches in play, prices moving now» / «See live matches» | «Partite in corso, quote in movimento» / «Vedi le partite live» |
| `pro.title` / `.link` | «See what Pro adds» / «Compare Free and Pro» | «Scopri cosa aggiunge Pro» / «Confronta Free e Pro» |

## tennis2 (07/10/2026) — Market → Estimate → Gap nel tennis, dove c'è l'Elo fresco

Decisione di Andrea (07/10), definizione vincolante misurata da ml-engineer-agentic
(`01-BETREDGE/redesign/proposals/tennis-estimate.md`): stima tennis = 0,1·Elo + 0,9·mercato senza margine,
SOLO con Elo ≤ 6 h e circuito ATP/WTA; etichetta «Elo-based, not sealed»; altrove «Market only». Gap attenuato,
mai un segnale. Tutte e 11 le lingue scritte; `// REVIEW-NATIVE` sull'avvertenza (`tennis.caveat`) nelle 9 lingue
non EN/IT. Riscritte: `toolbar.legendEstimate`, `toolbar.legendTennis`, `tennis.noEstimate`; FAQ home risposte 2 e 6,
`method.blocks.blend.detail` (pages-copy).

| Chiave | EN | IT |
|---|---|---|
| `tennis.eloLabel` | «Elo-based, not sealed» | «basata su Elo, non sigillata» |
| `tennis.marketOnly` | «Market only» | «Solo mercato» |
| `tennis.caveat` | «In tennis our estimate is 90% market, 10% our Elo. Not sealed: the gap is information, not advice.» | «Nel tennis la nostra stima è 90% mercato e 10% nostro Elo. Non sigillata: il gap è un’informazione, non un consiglio.» |
| `tennis.estimateSub` | «90% market · Elo» | «90% mercato · Elo» |
| `tennis.blendFact` | «estimate = 90% market + 10% our Elo, not sealed» | «stima = 90% mercato + 10% nostro Elo, non sigillata» |
| `tennis.gapHidden` | «Gap not shown: our Elo is too far from the market» | «Gap non mostrato: il nostro Elo è troppo lontano dal mercato» |
| `tennis.eloAsOf` | fn → «Elo as of {a}» | fn → «Elo aggiornato al {a}» |
| `tennis.scaleAriaElo` | fn → «Market {a} percent, estimate {b} percent, Elo-based and not sealed[, gap {c} points]» | fn → «Mercato {a} per cento, stima {b} per cento, basata su Elo e non sigillata[, gap {c} punti]» |
| `toolbar.legendEstimate` | «Estimate · football: 70% market + 30% model» | «Stima · calcio: 70% mercato + 30% modello» |
| `toolbar.legendTennis` | «Tennis: 90% market + 10% our Elo where fresh, not sealed; else market only» | «Tennis: 90% mercato + 10% nostro Elo dove è recente, non sigillata; altrove solo mercato» |
| `tennis.noEstimate` | «Market only: the market price with the margin removed and the books’ prices. No estimate of ours for this match.» | «Solo mercato: il prezzo di mercato senza margine e le quote dei book. Nessuna nostra stima per questa partita.» |

## final5 (#REDESIGN-V3C final5) — merge di fixdata + fixui

Riscritte nelle 11 lingue (nessuna chiave nuova):

| Chiave | EN | IT |
|---|---|---|
| `yday.stripBody` | «… Tennis: in the Record.» (era «Tennis: outcomes only.»: la home ora mostra solo il calcio, fixdata A6); mostrata solo quando c'è il punteggio (n ≥ minimo) | «… Tennis: nel Registro.» |
| `fixdata.priceAt` | fn(time) → «price at {t}» (senza sigla: il fuso è dichiarato una volta per vista da TzNote, fixui M2) | fn(time) → «prezzo delle {t}» |


## fixui2 (#REDESIGN-V3C fixui2) — QA-REPORT-2, filone interfaccia

Dizionario nuovo `lib/v3c/fixui2-copy.ts` (11 lingue complete, `// REVIEW-NATIVE`, in `lib/v3c/i18n-parity.test.ts`):

| Chiave | EN | IT |
|---|---|---|
| `existingMembers` | «Existing members» (B3: unico link, nel piè, al flusso di accesso di oggi) | «Utenti già registrati» |
| `existingMembersTitle` | «Sign in on the current site» | «Accedi sul sito attuale» |
| `enterPrice` | «Enter the price you see» (N4) | «Scrivi il prezzo che vedi» |
| `emptyPrices` | «Type the prices from your book: the margin and the probabilities appear here.» | «Scrivi i prezzi del tuo book: margine e probabilità compaiono qui.» |
| `notListed` | «This match is not in the price check: it has started or has no prices yet.» (N6) | «Questa partita non è nel controllo prezzo: è iniziata o non ha ancora prezzi.» |
| `loggedLabel` | «logged» (N8: riga del registro dopo il calcio d'inizio) | «registrato» |
| `loggedWhy` | fn → «Entered the public ledger on {t}, after kick-off: not a pre-match seal.» | fn → «Entrata nel registro pubblico il {t}, dopo il fischio d’inizio: non è un sigillo pre-partita.» |
| `loggedTitle` | «Logged after kick-off» | «Registrata dopo il fischio d’inizio» |
| `loggedBody` | fn → «This row entered the public ledger on {t}, after the start: it is not a pre-match seal.» | fn → «Questa riga è entrata nel registro pubblico il {t}, dopo l’inizio: non è un sigillo pre-partita.» |
| `benchSample` | «Example numbers, not a real match: no match on today’s board fits the example yet.» (N1) | «Numeri d’esempio, non una partita vera: …» |
| `cmPreviewTitle` / `cmPreviewSub` / `cmLockedLine` | «Creator slips · preview» / «Matches are visible to everyone. Legs and probabilities are not shown in this preview.» / «Preview: legs and probability not shown» (N5) | «Schedine dei creator · anteprima» / … |

Riscritte nelle 11 lingue: `banner.pro` «Pro preview: nothing to buy yet» / «Read the Pro preview» (N13; era «See what Pro adds» / «Compare Free and Pro»).
Non più a schermo (chiavi lasciate per quando torneranno): `nav.signIn` (B3), `t.bench.noteNoMatch`, `pc.bankroll`, `cm.gateNoneTitle`, `cm.gateNoneSub`, `cm.gatePartial`, `cm.seePlans`, `cm.lockedLine`.

// lib/tools/copy/en.ts (#TOOLS-HUB-0805)
// Inglese: lingua canonical e riferimento per tutte le altre. Le chiavi di
// `labels` definite qui sono il contratto che le altre dieci lingue devono
// rispettare (test in lib/tools/copy.test.ts).
//
// Regole di copy: nessun profitto promesso, nessuna vincita garantita, nessun
// claim sulla nostra performance. I tool spiegano matematica, non vendono sogni.

import type { ToolsCopy } from "./types";

const en: ToolsCopy = {
  hub: {
    metaTitle: "Free Betting Tools — Odds, EV, Kelly & Margin Calculators | BetRedge",
    metaDescription:
      "11 free betting calculators: convert odds in any format, remove the bookmaker margin, work out expected value, size a stake with Kelly, check an arbitrage, price a parlay and measure ROI. No signup.",
    h1: "Free betting tools",
    lede:
      "The eleven calculations every serious bettor runs before placing a bet — converted, de-margined, sized and measured. Free, no account needed.",
    cardCta: "Open the tool",
    intro: [
      "Every bet is a comparison between a price and a probability. These eleven calculators do that comparison properly: they translate prices between formats, strip the bookmaker's margin out of a market to expose the fair line, turn a probability estimate into expected value, fold a parlay's legs into one price, show when two books disagree enough to lock an arbitrage, size the stake so a losing run does not end the bankroll, and measure afterwards what those bets actually returned.",
      "They run entirely in your browser — nothing is sent anywhere, nothing is stored, and there is no account to create. Use them on their own, or use them to check what our model already publishes on every match.",
    ],
  },

  common: {
    backLabel: "Home",
    ctaTitle: "We run these numbers on every match",
    ctaBody:
      "The calculators do one price at a time. BetRedge scans the market continuously, removes the margin, compares it to a model probability and shows where the two disagree — across football and tennis, updated all day.",
    ctaButton: "See today's board",
    otherTools: "Other free tools",
    langLabel: "Language",
    free: "Free",
    faqTitle: "Questions",
    invalid: "—",
    tgTitle: "The model’s call of the day, free on Telegram",
    tgBody:
      "No account, no email. Every day we publish the match where our model disagrees most with the market, 15 minutes before it starts — and we settle every pick we publish, won or lost.",
    tgButton: "Open the channel",
  },

  tools: {
    "odds-converter": {
      metaTitle: "Odds Converter — Decimal, Fractional, American & Implied Probability | BetRedge",
      metaDescription:
        "Free odds converter: type a price in any format — decimal, fractional, American, Hong Kong, Malay or Indonesian — and read it in all the others, with the implied probability.",
      h1: "Odds converter",
      lede:
        "Type a price in one format and read it in every other, with the probability the bookmaker is implying.",
      labels: {
        inputTitle: "Your price",
        oddsInput: "Odds",
        formatSelect: "Format",
        resultTitle: "The same price, everywhere",
        decimal: "Decimal",
        american: "American",
        fractional: "Fractional",
        hongkong: "Hong Kong",
        malay: "Malay",
        indonesian: "Indonesian",
        impliedProbability: "Implied probability",
        hint: "Decimal accepts a comma too: 2,50 works like 2.50.",
      },
      takeaway:
        "Every price is a probability in disguise. Convert first, argue second — 2.50 means the bookmaker is telling you 40%.",
      example: {
        title: "One price, every format",
        rows: [
          { label: "You type", value: "2.50" },
          { label: "American", value: "+150" },
          { label: "Fractional", value: "3/2" },
          { label: "Hong Kong · Malay · Indonesian", value: "1.50 · −0.67 · +1.50" },
          { label: "Implied probability", value: "40.00%" },
        ],
        note:
          "Change one and the rest follow. Watch the rounding: the familiar −110 is 1.9091 in decimal and implies 52.38%, while a displayed 1.91 implies 52.36% — a gap that looks like nothing and matters, because edges live in fractions of a percent.",
      },
      explainerTitle: "Reading a price in any format",
      explainer: [
        "**Odds are a probability wearing different clothes.** Decimal odds — the European default — give the total return per unit staked: 2.50 pays back 2.50 for every 1 risked, stake included. Fractional odds quote the profit instead: 3/2 is three units of profit for two risked, the same 2.50. American odds say how much you win on 100 (+150) or how much you must risk to win 100 (−110). Hong Kong, Malay and Indonesian are the Asian-market formats, and they matter because the sharpest prices often live there.",
        "The number worth reading is the last one. **Implied probability is 1 divided by the decimal price**, and it is the only figure you can compare directly against your own estimate — two prices in different notations are no easier to compare than two probabilities. One caveat this tool cannot remove for you: **implied probability still contains the bookmaker's margin**, so add up every outcome in a market and you will pass 100%. For the market's honest opinion rather than its priced one, run it through the margin calculator.",
      ],
      faq: [
        {
          q: "Which format should I work in?",
          a: "Decimal, unless you have a reason not to. Multiplying decimal prices gives you a parlay price directly, and dividing 1 by a decimal price gives you the implied probability — both operations are awkward in fractional or American notation.",
        },
        {
          q: "Why does −110 come out as 1.909090…?",
          a: "Because 100/110 is a repeating decimal. Rounded to two places it is 1.91, which is what every book displays, but the converter keeps the full precision internally so a chain of calculations does not drift.",
        },
        {
          q: "What is the difference between Malay and Indonesian odds?",
          a: "They are mirror images. Malay odds are positive for prices below 2.00 and negative above it; Indonesian odds are positive above 2.00 and negative below. Both express the same underlying price, and both convert to the same decimal.",
        },
        {
          q: "Does the converter round my price?",
          a: "Only on screen, to two decimals. Every calculation runs on the exact value you typed, so converting back and forth returns the price you started with.",
        },
      ],
    },

    "margin-calculator": {
      metaTitle: "Betting Margin Calculator — Overround, Payout & No-Vig Fair Odds | BetRedge",
      metaDescription:
        "Free margin calculator: enter the odds for every outcome in a market and get the bookmaker's margin, the payout percentage, and the fair no-vig odds and probabilities.",
      h1: "Betting margin calculator",
      lede:
        "Enter every price in a market and see the bookmaker's cut — plus the fair line hiding underneath it.",
      labels: {
        inputTitle: "The market",
        outcome: "Outcome",
        addOutcome: "Add outcome",
        removeOutcome: "Remove",
        resultTitle: "What the book is charging",
        margin: "Bookmaker margin",
        payout: "Payout",
        fairOddsTitle: "Fair line, margin removed",
        fairOdds: "Fair odds",
        fairProbability: "Fair probability",
        impliedProbability: "Implied probability",
        hint: "Add an outcome for three-way markets, or more for outright markets.",
      },
      takeaway:
        "The margin is what you pay for the right to have an opinion. Two books, the same match, and the difference is money.",
      example: {
        title: "The same match at two books",
        rows: [
          { label: "Recreational book", value: "1.90 / 1.90 · margin 5.26%" },
          { label: "Sharp book", value: "1.98 / 1.98 · margin 1.01%" },
          { label: "Fair line, both", value: "2.00 / 2.00 · 50% each" },
          { label: "Your EV on a true 50% shot", value: "−5% vs −1% per bet" },
        ],
        note:
          "Identical opinion, identical match. Staking 100 two hundred times costs 1,000 at the first book and 200 at the second: the eight cents of price difference is 800 across a season. This is the cheapest edge in betting and it requires no model at all.",
      },
      explainerTitle: "The margin is the price of the bet",
      explainer: [
        "**A fair two-way market prices both sides at 2.00.** The implied probabilities are 50% and 50%, they add to exactly 100%, and neither side has an edge. Real markets are priced 1.90 and 1.90: those implied probabilities are 52.63% each, they add to 105.26%, and **the excess 5.26 points are the bookmaker's margin** — the overround. Whichever side you back, you are paying it. Margins swing hard by market: main lines at sharp books can sit under 2%, while outrights and player props routinely carry 8% or more, because that is where books know their prices are least tested.",
        "Removing the margin gives the fair line, the no-vig line. This calculator does it proportionally — each implied probability divided by their sum, so they add back to exactly 100% — and **that fair line is the reference point for every +EV decision**: a bet is only positive expected value if your probability beats the fair one, not merely the priced one. One honest limit: real books load more margin onto long shots, so on a market with a heavy favourite this method understates the favourite slightly. On balanced main lines the distortion is small; on lottery-ticket outrights, treat the fair line as an estimate.",
      ],
      faq: [
        {
          q: "What margin should I accept?",
          a: "For main football and tennis lines, under 3% is sharp, 4–5% is normal at a recreational book, and above 7% means you are paying a lot for the privilege of having an opinion. Compare the same market across books before you decide.",
        },
        {
          q: "Is payout percentage the same as margin?",
          a: "They are two views of the same number. A 5.26% margin corresponds to a 95% payout: the book expects to return 95 of every 100 staked across the whole market. Payout is the friendlier number to compare between books.",
        },
        {
          q: "Why do the fair probabilities add up to exactly 100%?",
          a: "Because that is the definition of removing the margin. The priced probabilities add to more than 100%; dividing each one by that total rescales them so they sum to one, which is what a coherent set of probabilities must do.",
        },
        {
          q: "Can I use this on a three-way or outright market?",
          a: "Yes — add as many outcomes as the market has. The maths is identical for any number of outcomes, as long as you enter every one of them. Leaving one out understates the margin.",
        },
      ],
    },

    "ev-calculator": {
      metaTitle: "EV Calculator — Expected Value of a Bet, With or Without a Fair Line | BetRedge",
      metaDescription:
        "Free expected value calculator: enter your price, your probability and your stake to get EV in currency and percentage — or derive the fair probability from a sharp book's line.",
      h1: "EV calculator",
      lede:
        "Work out what a bet is worth on average: from your own probability, or from a sharp book's line with the margin stripped out.",
      labels: {
        inputTitle: "The bet",
        modeTitle: "Where the probability comes from",
        modeManual: "My own estimate",
        modeSharp: "From a sharp book",
        yourOdds: "Your price",
        yourProbability: "Your probability (%)",
        sharpOddsA: "Sharp price, your side",
        sharpOddsB: "Sharp price, other side",
        derivedProbability: "Fair probability, margin removed",
        stake: "Stake",
        resultTitle: "What the bet is worth",
        ev: "Expected value",
        fairOdds: "Break-even price",
        edge: "Edge",
        positive: "Positive expected value at this price.",
        negative: "Negative expected value at this price.",
        neutral: "Break-even: the price matches the probability exactly.",
        hint: "Percentages go in as numbers: 55 means 55%.",
      },
      takeaway:
        "You do not need to outguess the market — only to find a book slower than the sharpest one.",
      example: {
        title: "Borrowing the probability from a sharp book",
        rows: [
          { label: "Sharp book, both sides", value: "1.95 / 1.95" },
          { label: "Fair probability, margin removed", value: "50.00%" },
          { label: "Break-even price", value: "2.00" },
          { label: "Your book offers", value: "2.10" },
          { label: "EV on 100 staked", value: "+5.00 (+5%)" },
        ],
        note:
          "No opinion was required: the sharp line supplied the probability, and your book priced the same outcome at 2.10 where 2.00 was fair. Move the sharp prices to 1.90/1.90 and the fair probability stays 50% — that is the point of removing the margin, the answer does not move with the vig.",
      },
      explainerTitle: "What expected value actually tells you",
      explainer: [
        "**Expected value is the average result of a bet you could repeat forever.** Two inputs, no opinions: the price offered and the probability you give the outcome. Think a team wins 55% of the time and someone offers 2.00, and the arithmetic is immediate — 55% of the time you gain a unit, 45% you lose one, so you make 0.10 units per unit staked. That is a 10% edge, and that is all +EV means.",
        "**The probability is where almost everyone quietly loses.** A 5-point error turns a 4% edge into a 1% loss, and estimates made by eye miss by far more than 5 points. Hence the second mode of this calculator: instead of trusting your gut, take both sides at a sharp book, strip the margin, and use the fair probability that falls out. Read the result as a rate, not a promise — a 4% edge returns nothing on any single bet, it only appears across hundreds of them, and only if the probability was right. Which is why stake size matters as much as the edge itself.",
      ],
      faq: [
        {
          q: "How do I get a probability I can trust?",
          a: "Either from a model built on data, or from the market itself. The fair line at a sharp book — its prices with the margin removed — is a hard benchmark to beat with judgement alone, and it is free to look up.",
        },
        {
          q: "Is a positive EV bet a good bet?",
          a: "It is a necessary condition, not a sufficient one. A bet can carry positive expected value and still be a bad idea if the stake is too large for the bankroll, if the edge is inside your estimation error, or if the market moves against you before kick-off.",
        },
        {
          q: "Why does the calculator ask for both sides of the sharp market?",
          a: "Because you cannot remove a margin from one price alone. The margin is only visible when the implied probabilities of every outcome are added together, so the second price is what makes the fair probability computable.",
        },
        {
          q: "What does EV per unit staked mean?",
          a: "It is the same result expressed independently of your stake: 10% means you gain on average 0.10 for every 1 risked. Comparing bets by EV percentage rather than by currency stops a large stake on a thin edge from looking better than it is.",
        },
      ],
    },

    "kelly-criterion": {
      metaTitle: "Kelly Criterion Calculator — Optimal Bet Size From Edge and Bankroll | BetRedge",
      metaDescription:
        "Free Kelly criterion calculator: enter the price, your probability and your bankroll to get the stake that maximises long-run growth — full, half or quarter Kelly.",
      h1: "Kelly criterion calculator",
      lede:
        "The stake size that grows a bankroll fastest in the long run — and why most bettors should deliberately bet less than it says.",
      labels: {
        inputTitle: "The bet and the bankroll",
        odds: "Price",
        probability: "Your probability (%)",
        bankroll: "Bankroll",
        fractionTitle: "Kelly fraction",
        fractionFull: "Full",
        fractionHalf: "Half",
        fractionQuarter: "Quarter",
        resultTitle: "Recommended stake",
        stake: "Stake",
        stakePercent: "Share of bankroll",
        edge: "Edge",
        fullKelly: "Full Kelly",
        growth: "Expected growth per bet",
        noEdge: "No edge at this price — the optimal stake is zero.",
        hint: "Percentages go in as numbers: 55 means 55%.",
      },
      takeaway:
        "Kelly sizes the bet to the edge, not to your confidence — and almost everyone should deliberately bet less than it says.",
      example: {
        title: "What that means with 1,000 in the bank",
        rows: [
          { label: "Bankroll", value: "1,000" },
          { label: "Price · your probability", value: "2.00 · 55%" },
          { label: "Edge", value: "+10%" },
          { label: "Full Kelly", value: "10% → 100 per bet" },
          { label: "Half Kelly", value: "5% → 50 per bet" },
        ],
        note:
          "Five losses in a row — one sequence in 54 at this price — leave 590 at full Kelly, which then needs +69% to get back to 1,000. The same run at half Kelly leaves 774, needing +29%. Same edge, same bets, half the hole.",
      },
      explainerTitle: "Sizing a bet so the bad run does not end it",
      explainer: [
        "The Kelly criterion answers what expected value ignores: given an edge, how much should you actually risk? Bet too little and a real edge compounds too slowly to matter. Bet too much and the maths turns against you — a bankroll that halves needs a 100% gain to recover, so oversized stakes destroy growth even when every single bet is favourable. The optimal fraction is the edge divided by the net odds, and **it scales with the edge, not with your confidence**: a 10% edge at 2.00 asks for 10% of the bankroll, the same edge at 5.00 asks for only 2.5%.",
        "**Almost nobody should bet full Kelly**, because the formula assumes your probability is exactly right and it never is. Feed it an overestimated edge and it will happily recommend a stake too large for the edge you actually have — the fastest way to lose a bankroll while being right on average. Half Kelly gives up a quarter of the theoretical growth and roughly halves the volatility; quarter Kelly is what many professionals with real models use. And when the price offers no edge, the correct stake is zero: a negative Kelly fraction means the bet belongs on the other side, never that you should bet less on this one.",
      ],
      faq: [
        {
          q: "Should I use full, half or quarter Kelly?",
          a: "Half or quarter for almost everyone. Full Kelly is only optimal if your probability estimate is exactly right, and estimation error hurts far more on the upside of the stake than it helps. Fractional Kelly trades a little growth for a lot of survivability.",
        },
        {
          q: "What is expected growth per bet?",
          a: "The average logarithmic growth of the bankroll for one bet at that stake. It is small by design — a 0.005 figure means about half a percent of compounding growth per bet — and it is the quantity Kelly maximises.",
        },
        {
          q: "What if I have several bets at the same time?",
          a: "Single-bet Kelly overstakes when bets run simultaneously, especially if they are correlated. As a practical rule, divide the total across concurrent positions and treat correlated bets as one.",
        },
        {
          q: "Why does the calculator show zero when I think I have an edge?",
          a: "Because at the price you entered, your probability does not clear the break-even point. Check the price against 1 divided by your probability: if the price is shorter, there is no edge to stake.",
        },
      ],
      caveat:
        "The Kelly criterion maximises long-run growth, not comfort. Even at the correct stake, drawdowns of 30% or more are ordinary, and the formula assumes your probability estimate is accurate — if it is optimistic, Kelly will systematically overbet and the bankroll can be lost. Never stake money you need.",
    },

    "probability-calculator": {
      metaTitle: "Betting Probability Calculator — Odds, Break-Even & Parlay Probability | BetRedge",
      metaDescription:
        "Free probability calculator for betting: convert probability to odds and back, find the break-even probability a price demands, and combine legs into a parlay probability.",
      h1: "Probability calculator",
      lede:
        "Turn probabilities into prices and back, see what a price demands of you, and find out what a multiple is really worth.",
      labels: {
        inputTitle: "Probability and price",
        modeTitle: "What do you have?",
        modeProbability: "A probability",
        modeOdds: "A price",
        probability: "Probability (%)",
        odds: "Decimal odds",
        breakEven: "Break-even probability",
        fairOdds: "Fair price",
        parlayTitle: "Parlay",
        leg: "Leg",
        addLeg: "Add leg",
        removeLeg: "Remove",
        parlayProbability: "Combined probability",
        parlayOdds: "Combined price",
        resultTitle: "Results",
        hint: "A price and its break-even probability are the same number read from opposite sides.",
      },
      takeaway:
        "Legs multiply, and so does the bookmaker's cut. A four-fold at 1.80 needs a 9.5% event to land.",
      example: {
        title: "What a four-leg accumulator really costs",
        rows: [
          { label: "Four legs at", value: "1.80 each · 55.56%" },
          { label: "Combined price", value: "10.50" },
          { label: "Combined probability", value: "9.53%" },
          { label: "Margin per leg", value: "5%" },
          { label: "Margin on the parlay", value: "21.6%" },
        ],
        note:
          "The price looks generous until you notice what it demands: a 9.5% event. And the book's cut compounded four times — 1.05⁴ − 1 = 21.6% — so the same four selections cost you four times the margin of a single bet. Correlated legs from one match are a different animal: multiplying understates them, which is exactly why books price same-game multiples separately.",
      },
      explainerTitle: "Probability first, price second",
      explainer: [
        "**Every price is a claim about probability**, and the conversion is one division: 40% is a price of 2.50, and 2.50 is a probability of 40%. Doing that conversion before betting changes the question from \"do I like this bet?\" to \"does this happen more than 40% of the time?\" — a question you can actually be wrong about. Read from the price side, the same number is the **break-even probability**: the minimum chance an outcome needs for the bet to be neutral. 1.75 demands 57.1%; 1.50 demands 66.7%; 15.00 asks for only 6.7%, which is why long shots feel cheap and why books load their margin there.",
        "**Multiples are where probability turns counter-intuitive.** Independent legs multiply: three bets you rate at 50% each combine to 12.5%, not to something reassuringly near a half. Four legs at 60% come to 12.96%. The combined price multiplies the same way, and that is the trap — the number gets big while the chance gets small, and the margin compounds with it. Hold on to the assumption underneath: this multiplies, so it assumes the legs are independent. Two outcomes from the same match are correlated, and there the real probability is different — usually higher than the product.",
      ],
      faq: [
        {
          q: "What is break-even probability?",
          a: "The chance an outcome must have for a bet at that price to be neutral in the long run. It equals 1 divided by the decimal price, and it is the bar your own estimate has to clear before the bet makes sense.",
        },
        {
          q: "Why is my parlay probability so low?",
          a: "Because probabilities multiply. Each leg you add makes the whole bet less likely, and a chain of plausible legs quickly becomes an unlikely bet. The price rises to match, but so does the accumulated margin.",
        },
        {
          q: "Does this work for same-game multiples?",
          a: "Not exactly. Multiplying assumes the legs are independent, and outcomes inside one match usually are not. For correlated legs the real probability is different — often higher than the product — which is why books price those markets separately.",
        },
        {
          q: "Is the implied probability of a price the true probability?",
          a: "No. It still contains the bookmaker's margin, so it is systematically higher than the market's honest estimate. Use the margin calculator to strip it out before comparing with your own number.",
        },
      ],
    },

    "arbitrage-calculator": {
      metaTitle: "Arbitrage Calculator — Split a Stake Across Bookmakers | BetRedge",
      metaDescription:
        "Free arbitrage calculator: enter the best price on each outcome from different bookmakers to see the implied sum, how to split the total stake, and the profit — or that there is none.",
      h1: "Arbitrage calculator",
      lede:
        "Enter the best price available on each outcome and see whether two books together leave a margin — and how to split the stake if they do.",
      labels: {
        inputTitle: "Best price on each outcome",
        outcome: "Outcome",
        addOutcome: "Add outcome",
        removeOutcome: "Remove",
        total: "Total stake",
        resultTitle: "How to split it",
        profit: "Profit",
        impliedSum: "Sum of implied probabilities",
        stakeOn: "Stake on outcome",
        guaranteedReturn: "Return in every outcome",
        verdictArb:
          "The prices add up to less than 100%: split this way, every outcome pays back the same amount.",
        verdictNoArb:
          "The prices add up to more than 100%, so there is no arbitrage here — any split loses that margin whichever outcome lands.",
        hint: "One price per outcome, each from the book paying most on that side. Decimal accepts a comma: 2,10 works like 2.10.",
      },
      takeaway:
        "Arbitrage is not a prediction. It never asks you to be right about who wins — it asks two bookmakers to disagree by more than their own margins.",
      example: {
        title: "Two books, 1,000 to split",
        rows: [
          { label: "Prices, one book each", value: "2.10 · 2.10" },
          { label: "Sum of implied probabilities", value: "95.24%" },
          { label: "Stake on each, out of 1,000", value: "500 · 500" },
          { label: "Return in every outcome", value: "1,050" },
          { label: "Profit", value: "+50 (+5.00%)" },
        ],
        note:
          "The same market priced 1.90/1.90 inside one book sums to 105.26% and hands back −5.00% however you split it. Nothing about the match changed between the two lines: the whole difference is which book pays more on which side, and whether you had funded accounts at both while the prices were still up.",
      },
      explainerTitle: "When two books disagree enough",
      explainer: [
        "**Add up one divided by each price and you hold the whole market in a single number.** Inside one bookmaker that number always clears 100% — the margin is what keeps it there. But the best price on one side and the best price on the other often sit at different books, and combining them can drop the sum below 100%. That is the entire condition: **the implied probabilities have to add up to less than 1**. Split the total stake in proportion to those implied probabilities and every outcome returns the same amount, so what you get back stops depending on the result. Two prices of 2.10 sum to 95.24%, and 500 on each side of a 1,000 stake returns 1,050 whichever way the match goes.",
        "**In practice this closes far less often than the arithmetic suggests, and the reasons matter more than the formula.** Prices move: the gap you spotted is usually the slower book catching up, and it can vanish in the seconds between placing the first leg and the second, leaving you holding an ordinary unhedged bet at a price you chose for hedging rather than for value. Stake limits bite hardest exactly where the gap is widest, so a 5% margin on paper is often a 5% margin on forty units rather than on a thousand. And **bookmakers restrict accounts that do this systematically** — lower limits first, refused bets and closures later. Add the capital parked across several books and the currency spread between them, and arbitrage reads less like a machine and more like a slow, operationally demanding way to shave a thin margin.",
      ],
      faq: [
        {
          q: "Do I need an account at every bookmaker?",
          a: "Yes. An arbitrage exists only across the specific books quoting those specific prices, so you need funded accounts at each of them before the prices move. That capital, spread across several books and idle most of the time, is the cost most calculators leave out.",
        },
        {
          q: "What happens if the second price moves before I place it?",
          a: "You are left holding the first leg on its own — an ordinary bet, at a price you picked for hedging rather than for value. Place the leg most likely to move first, and treat being left unhedged as part of the risk rather than as an accident.",
        },
        {
          q: "Why do bookmakers restrict arbitrage bettors?",
          a: "Because their margin depends on balanced action from recreational customers, and an account that only ever takes the best price on one side is pure cost to them. Restrictions usually arrive quietly as lower stake limits, long before an account is closed outright.",
        },
        {
          q: "Is arbitrage betting legal?",
          a: "The activity itself is legal — you are placing ordinary bets at advertised prices. What can forbid it is the bookmaker's own terms, which commonly reserve the right to limit, refuse or void bets they judge to be arbitrage. Legal and permitted are not the same thing.",
        },
      ],
    },

    "parlay-calculator": {
      metaTitle: "Parlay Calculator — Combined Odds, Real Probability, Compound Margin | BetRedge",
      metaDescription:
        "Free parlay calculator: enter each leg to get the combined price, the probability the accumulator actually needs, and how the bookmaker margin compounds leg by leg.",
      h1: "Parlay calculator",
      lede:
        "Every leg you add multiplies the price — and multiplies the bookmaker's cut along with it. Here are both numbers before the bet is placed.",
      labels: {
        inputTitle: "The legs",
        leg: "Leg",
        addLeg: "Add leg",
        removeLeg: "Remove",
        marginPerLeg: "Bookmaker margin per leg (%)",
        resultTitle: "What the accumulator is worth",
        combinedOdds: "Combined price",
        impliedProb: "Probability it lands",
        compoundMargin: "Compound margin",
        verdict:
          "Multiplying assumes the legs are independent. Two selections from the same match are not: their real chance is usually higher than the product, which is why books price same-game multiples with a model of their own.",
        hint: "One decimal price per leg, up to eight. The margin per leg goes in as a number: 5 means 5%, roughly what a tight two-way market holds.",
      },
      takeaway:
        "The bookmaker's cut does not add up across the legs, it compounds — four legs at 1.80 look like four near-even bets and are a single 9.53% event.",
      example: {
        title: "Four legs at 1.80, one bet at 9.53%",
        rows: [
          { label: "Legs", value: "4 × 1.80" },
          { label: "Combined price", value: "10.50" },
          { label: "Probability it lands", value: "9.53%" },
          { label: "Margin per leg", value: "5%" },
          { label: "Compound margin", value: "21.55%" },
        ],
        note:
          "On its own each leg is the kind of bet nobody thinks twice about: 55.56% implied, 1.80 to win. Chained, the four of them need a 9.53% event — and the 5% the book holds on each leg becomes 1.05⁴ − 1 = 21.55% on the accumulator. Nothing was added to the bet except more ways to lose it: the price went up because the chance went down.",
      },
      explainerTitle: "Why the price grows faster than the chance",
      explainer: [
        "**A parlay is one bet with several ways to lose, not several bets.** The combined price is the product of the legs — 1.80 taken four times is 10.4976 — and the probability is the product of the probabilities, which is where the arithmetic stops being friendly: four selections you would each call close to a coin flip come to 9.53%. The margin behaves the same way, and that is the part almost nobody prices in. It does not add up leg by leg, it **compounds**: a book holding 5% on each of four legs holds 1.05⁴ − 1 = 21.55% on the accumulator, and by eight legs that same 5% per leg has become 47.75%. The payout looks generous because the chance collapsed, not because anyone is paying you more for the same risk.",
        "**Accumulators are the most heavily promoted product in betting and the least favourable one to the customer**, and those are the same fact seen from two sides: the larger the compounded margin, the more a bookmaker can afford to boost, insure and advertise the bet. A thin edge on one leg does not survive being multiplied by three more legs of margin — the same selections as singles pay the margin once each, the four-fold pays it four times over. Then there is what the multiplication assumes: **that the legs are independent**. Two selections from the same match are correlated, so multiplying is the wrong sum for them: a home win and its striker scoring tend to arrive together, so the pair is likelier than the product says, while legs that can barely coexist are worth far less. That is why books build same-game multiples with their own model instead of letting you assemble them out of the singles — and why this calculator is honest for legs from different matches.",
      ],
      faq: [
        {
          q: "Does this work for same-game parlays?",
          a: "Not exactly. It multiplies, and multiplying assumes the legs are independent. Outcomes inside one match usually move together, so the true chance of the pair is different — often higher than the product — which is why bookmakers price those markets with their own model rather than from the singles.",
        },
        {
          q: "Why is the combined probability so low?",
          a: "Because probabilities multiply instead of averaging. Four legs at 55.56% come to 9.53%: every leg you add makes the whole bet less likely, so a chain of plausible selections quickly becomes an unlikely bet. The price rises to match it, and the accumulated margin rises with the price.",
        },
        {
          q: "What exactly is the compound margin?",
          a: "The bookmaker's cut after every leg has multiplied it. Enter what one leg costs you — around 5% on a tight two-way market — and the calculator compounds it: one plus the margin, raised to the number of legs, minus one. Four legs at 5% cost 21.55%, eight legs cost 47.75%.",
        },
        {
          q: "Are four singles better than a four-fold?",
          a: "For anyone betting on an edge, yes: the same four selections as singles pay the margin once each instead of multiplying it, and one wrong leg costs one bet rather than the whole ticket. A parlay buys variance — a small chance of a large return — and the price of that variance is the compounded margin.",
        },
      ],
    },
    "roi-calculator": {
      metaTitle: "ROI Calculator for Betting — Return on Your Bankroll | BetRedge",
      metaDescription:
        "Free betting ROI calculator: enter capital and profit to get the return on your bankroll, the closing balance, and why the same profit reads as a 4% yield.",
      h1: "ROI calculator",
      lede:
        "What the bankroll returned over a period — and why the same 400 of profit is a 40% ROI here and a 4% yield on the other page.",
      labels: {
        inputTitle: "Capital and result",
        capital: "Capital",
        profit: "Profit",
        resultTitle: "Return on that capital",
        roi: "ROI",
        endingCapital: "Capital after",
        hint: "Profit goes in net and can be negative: -250 is a losing period. Capital is the bankroll you put at risk, not the total you staked.",
        verdict:
          "ROI depends entirely on the denominator, so declare it: 400 on a 1,000 bankroll is 40%, the same 400 against 10,000 staked is a 4% yield. Neither figure means much without the period and the number of bets behind it.",
      },
      takeaway:
        "ROI says what the bankroll returned. It does not say whether the strategy is any good, because the same 40% can come from 200 bets or from one lucky Saturday.",
      example: {
        title: "400 of profit on a 1,000 bankroll",
        rows: [
          { label: "Capital", value: "1,000" },
          { label: "Profit over the period", value: "+400" },
          { label: "ROI", value: "+40.00%" },
          { label: "Capital after", value: "1,400" },
          { label: "Same 400 against 10,000 staked", value: "yield +4.00%" },
        ],
        note:
          "Both percentages describe one identical result. Reaching +40.00% on the bankroll took 200 bets of 50 — 10,000 of turnover, ten times the capital — and 4.00% of that turnover is the same 400. Turn the bankroll over twice instead of ten times and the yield behind a 40% ROI would have to be 20%, which almost nobody sustains.",
      },
      explainerTitle: "Profit measured against the money at risk",
      explainer: [
        "**ROI is profit divided by the money you put at risk**, and all the difficulty sits in the second half of that sentence. A bankroll of 1,000 that finishes a season 400 in front returned 40.00%, and that figure can honestly be compared with anything else you might have done with the same 1,000. What it cannot describe is the betting. A 40% return says nothing about how many bets it took, over how long, or how close the balance came to zero on the way — and those are the three things that decide whether it happens again. So **declare the denominator before quoting the number**: starting bankroll, average balance and total deposits give three different percentages from one identical set of bets, and the flattering one is always the smallest.",
        "**The same 400 of profit is a 40% ROI and a 4% yield at once**, and knowing which one you are holding is most of the value of both pages. ROI measures against capital, yield measures against turnover — the sum of every stake placed. Our example got there with 200 bets of 50, so 10,000 went through the bankroll: ten times the capital, and 4.00% of it is that same 400. **That multiplier is the whole bridge between the two numbers**, and it is why ROI on its own flatters a busy bettor. Someone turning a 1,000 bankroll over ten times at a 4% yield and someone turning it over twice at a 20% yield both report 40%, and only one of those is repeatable. Work out the per-bet quality on the yield calculator, and keep ROI for what it is genuinely good at: comparing what that money returned against the alternatives.",
      ],
      faq: [
        {
          q: "What is the difference between ROI and yield?",
          a: "ROI divides profit by capital, yield divides it by turnover — the sum of every stake. The same 400 of profit is 40.00% of a 1,000 bankroll and 4.00% of 10,000 staked. ROI tells you what the money returned, yield tells you how good the bets were, and the ratio between them is how many times you turned the bankroll over.",
        },
        {
          q: "Which capital should I use as the denominator?",
          a: "Whichever one you can state and then keep fixed — the starting bankroll is the usual choice. Peak balance, average balance and total deposits each produce a different percentage from the same bets, so the number only means something next to its definition. Topping the account up mid-period without restating the denominator is the commonest way an ROI ends up overstated.",
        },
        {
          q: "Is a 40% ROI good?",
          a: "It depends on the period and the number of bets. Over a season and 200 bets it is a strong but plausible result. The same 40% over twenty bets sits well inside the range luck produces on its own, and 40% in a week usually means the stakes were large relative to the bankroll rather than that the edge was.",
        },
        {
          q: "Can ROI be negative?",
          a: "Yes, and the calculator shows it instead of hiding it: a 250 loss on a 1,000 bankroll is -25.00%. Recovery is not symmetric — after -25% you need +33.33% on what is left to get back to even — which is why the drawdown deserves as much attention as the return.",
        },
      ],
    },
    "yield-calculator": {
      metaTitle: "Yield Calculator for Betting — Profit per Unit Staked | BetRedge",
      metaDescription:
        "Free betting yield calculator: enter your number of bets, average stake and profit to get turnover and yield — and how many bets it takes before the number means anything.",
      h1: "Yield calculator",
      lede:
        "Profit measured against everything you staked, not against your bankroll — the one figure that compares two bettors with different amounts of money.",
      labels: {
        inputTitle: "Bets, stake and result",
        bets: "Number of bets",
        avgStake: "Average stake",
        profit: "Profit",
        resultTitle: "Yield on turnover",
        turnover: "Turnover",
        yieldPercent: "Yield",
        hint: "Turnover is worked out for you: bets × average stake. Count the stake of every bet, not the money exposed at one time. Profit goes in net and can be negative.",
        verdictNoise:
          "Under a thousand bets this figure is mostly noise. With flat stakes at 2.00 one standard deviation of yield is 7.07 points over 200 bets and still 3.16 over 1,000, so read it as a range rather than as a result.",
        verdictVolume:
          "Past a thousand bets the figure starts to carry information, but one standard deviation is still around 3.16 points at 2.00 — a +4% and a +7% over the same volume are not two different levels of skill.",
      },
      takeaway:
        "Yield is the number that compares bettors: 4% on 10,000 staked is worth more than a 40% ROI collected over twenty bets.",
      example: {
        title: "200 bets of 50, 400 in profit",
        rows: [
          { label: "Number of bets", value: "200" },
          { label: "Average stake", value: "50" },
          { label: "Turnover", value: "10,000" },
          { label: "Profit", value: "+400" },
          { label: "Yield", value: "+4.00%" },
          { label: "Same 400 on a 1,000 bankroll", value: "ROI +40.00%" },
        ],
        note:
          "One result, two honest percentages: 4.00% of the 10,000 that went through the book, 40.00% of the 1,000 that was ever at risk. The gap between them is nothing but the ten times the bankroll was turned over. And the sample matters more than either figure — at 200 bets one standard deviation of yield is 7.07 points, so this +4.00% sits inside the range a coin-flip run produces on its own.",
      },
      explainerTitle: "The number that compares two bettors",
      explainer: [
        "**Yield is profit divided by turnover** — the total of every stake you have placed, not the balance in the account. It is the figure bettors quote to each other precisely because it does not depend on how much money they have: 4% is 4% whether the stakes are 5 or 500. **The input people get wrong is the denominator**, and they get it wrong in the same direction every time. Turnover counts each bet's stake as it is placed, so 200 bets of 50 is 10,000 even if only 50 was ever exposed at once, and the 1,000 bankroll those bets were recycled through is not the number to divide by. That is why this page asks for the count and the average stake and works the turnover out in front of you. Measure the same profit against capital instead and you get ROI: the ROI calculator holds the other half of the comparison, where 400 of profit is 40.00% of a 1,000 bankroll and 4.00% of 10,000 staked.",
        "**A yield above roughly 5%, sustained over serious volume, is rare.** Where it exists it usually lives in soft markets with low limits, and it shrinks as the stakes grow, because the prices that allowed it do not survive being hit hard. Treat any long-run figure far above that as a short sample, a soft niche, or a different definition of turnover. And **under a few hundred bets the number is noise, not a result**: with flat stakes at 2.00 one standard deviation of yield is one divided by the square root of the number of bets — 7.07 points over 200 bets, 3.16 over 1,000, 2.00 over 2,500. A +4% yield only reaches two standard deviations from zero at around 2,500 bets. Longer prices swing wider still: at 3.00 the same 200 bets carry a standard deviation of 10 points. Which is the honest reading of twenty winning bets — not an edge measured, just a sample too short to tell the difference.",
      ],
      faq: [
        {
          q: "How do I work out my turnover?",
          a: "Add up the stake of every bet you placed, win or lose. 200 bets of 50 is 10,000 of turnover, even if the bankroll behind them was only 1,000. Do not use the net amount and do not use the balance: turnover is the money that passed through the bookmaker, counted once per bet.",
        },
        {
          q: "Is a 5% yield good?",
          a: "Sustained over thousands of bets, yes — it is around the top of what survives real limits. Yields well above it usually come from soft markets, a short sample or promotional value, and they tend to fall as stakes rise, because the prices that produced them get taken or restricted.",
        },
        {
          q: "How many bets before my yield means something?",
          a: "More than most people assume. With flat stakes at 2.00 one standard deviation of yield is 7.07 points over 200 bets, 3.16 over 1,000 and 2.00 over 2,500, so a +4% only reaches two standard deviations from zero at about 2,500 bets. Below a few hundred bets, treat the figure as a range.",
        },
        {
          q: "What if my stakes vary a lot?",
          a: "Then bets × average stake is only an approximation, and it flatters you when the wins landed on the big stakes. Add up the actual stakes and divide the profit by that total. If you stake in units, count the units: the yield per unit staked is the same figure and easier to keep honest.",
        },
      ],
    },
    "stake-calculator": {
      metaTitle: "Stake Calculator — The Stake Needed for a Target Profit | BetRedge",
      metaDescription:
        "Free stake calculator: enter the price and the profit you want to see the stake it takes, the total return, and how much of your bankroll that single bet commits.",
      h1: "Stake calculator",
      lede:
        "The stake a target profit demands at a given price — and the share of your bankroll it quietly commits.",
      labels: {
        inputTitle: "Price and target",
        odds: "Odds",
        targetProfit: "Target profit",
        bankroll: "Bankroll",
        resultTitle: "What that target costs",
        stakeNeeded: "Stake needed",
        totalReturn: "Total return",
        bankrollShare: "Share of bankroll",
        hint: "The bankroll is what turns the stake into a share: without it the stake is a number with nothing to compare it to. Odds go in decimal — 2.50, not +150.",
        verdictModest:
          "This stake commits under 5% of the declared bankroll, which a run of ten losses would not end. Read it next to the price, not on its own: the same target at a shorter price asks for a much larger bet.",
        verdictHeavy:
          "This stake commits more than 5% of the declared bankroll on one result. At that size a run of ten losses — ordinary at prices around 2.00 — takes more than half of it, so check the number against the bankroll calculator before placing it.",
      },
      takeaway:
        "Starting from the profit you want is the fastest way to bet too much: the useful question is not how much you want to win, it is how much you can afford to lose.",
      example: {
        title: "Wanting 100 of profit at 2.50",
        rows: [
          { label: "Odds", value: "2.50" },
          { label: "Target profit", value: "100" },
          { label: "Stake needed", value: "66.67" },
          { label: "Total return", value: "166.67" },
          { label: "Share of a 1,000 bankroll", value: "6.67%" },
        ],
        note:
          "The same 100 costs 25.00 at 5.00 and 400.00 at 1.25 — the target never moved, only the price did. And 66.67 on a 1,000 bankroll is exactly full Kelly for someone who thinks the outcome lands 44% of the time, when 2.50 breaks even at 40%. So the wish already contains a probability estimate of a +10% edge, just an undeclared one.",
      },
      explainerTitle: "Working backwards from a number you picked",
      explainer: [
        "The arithmetic is the easy half. A bet returns its stake plus stake × (price − 1), so **the stake a target demands is the target divided by the price minus one** — 100 at 2.50 needs 66.67, and the ticket comes back as 166.67. What makes this page worth reading is the second effect: **the shorter the price, the bigger the bet the same wish requires**. That 100 costs 25.00 at 5.00, 66.67 at 2.50, 100.00 at 2.00 and 400.00 at 1.25. Nothing about your opinion changed between those four lines, and the money at risk moved by a factor of sixteen. This is why the calculator asks for a bankroll it does not strictly need: 66.67 is neither large nor small until you know it is 6.67% of everything you have set aside.",
        "**Reasoning from the profit you want is the quickest route to a stake that is too large**, and it fails in a specific way. Lose the first bet and the target silently grows to cover it: wanting 100 again after dropping 66.67 means asking for 166.67, which at 2.00 takes a 166.67 stake, and if that goes too the next ask is 476.19 at 1.70. Three bets in, 709.52 of a 1,000 bankroll has been exposed to win the original 100, and the prices got shorter each time because short prices feel safer. **The bet gets bigger exactly as the reason for it gets weaker.** The honest version of this calculation runs the other way round, from what you can lose to what you can stake, and that is the Kelly criterion calculator: there the size comes from a measured edge, not from a figure you chose. Ours is not a coincidence either — 66.67 on 1,000 is precisely what full Kelly recommends at 2.50 to someone who believes 44%, against the 40% the price implies. If you would not defend that 44%, the stake was never about the bet.",
      ],
      faq: [
        {
          q: "How is the stake for a target profit worked out?",
          a: "Divide the profit you want by the price minus one. At 2.50 the net return per unit staked is 1.50, so 100 of profit needs 100 / 1.50 = 66.67 of stake and pays 166.67 in total. At 2.00 the net return is 1.00, which is why the stake and the target are the same number there.",
        },
        {
          q: "Why does the calculator ask for my bankroll?",
          a: "Because the stake on its own tells you nothing. 66.67 is a rounding error to one bettor and a third of the account to another, and the figure that decides which is the share of the bankroll — 6.67% here. Leave the field empty and the stake still works; the share becomes a dash, which is honest, because that assumption is yours to make and not ours to invent.",
        },
        {
          q: "Should I use this or the Kelly criterion?",
          a: "Use this one to price a wish and Kelly to size a bet. This page starts from a number you picked and works out what it costs; the Kelly criterion calculator starts from an edge you have measured and works out what the bankroll can carry. When the two disagree, the one that did not consult your probability estimate is the one to drop.",
        },
        {
          q: "Is chasing a loss with a bigger stake ever right?",
          a: "Not on this arithmetic. Each recovery ask is larger than the last, and it is usually placed at a shorter price because short prices feel safer, so the stake grows while the edge shrinks. Bankroll rules exist to make the next stake independent of the last result: fix the unit as a share of the bankroll and the sequence cannot run away.",
        },
      ],
    },
    "bankroll-calculator": {
      metaTitle: "Bankroll Calculator — Unit Size, Drawdown and Losses to Ruin | BetRedge",
      metaDescription:
        "Free bankroll calculator: set a bankroll and a unit size to see the stake per bet, what a losing run costs, the drawdown it leaves, and how many losses the bankroll covers.",
      h1: "Bankroll calculator",
      lede:
        "What a percentage unit actually commits: the stake per bet, the cost of a losing run, and how many consecutive losses the bankroll survives.",
      labels: {
        inputTitle: "Bankroll and rule",
        bankroll: "Bankroll",
        unitPercent: "Unit size (%)",
        losingStreak: "Losing streak",
        resultTitle: "What the rule costs",
        unit: "Stake per bet",
        streakLoss: "Cost of the run",
        drawdown: "Drawdown",
        betsToRuin: "Losses to ruin",
        hint: "Percentages go in as numbers: 2 means 2% of the bankroll per bet. The losing streak is a count of bets, so whole numbers only — it is the bad run you want to survive, not a prediction.",
        verdictSafe:
          "At or under 5% per unit the run you declared leaves the bankroll still working. A run of ten reaches 38.54% of bettors inside 1,000 bets at even money, so a plan that only holds if you never meet one is not a plan.",
        verdictAggressive:
          "Above 5% per unit the ordinary bad run ends the account: ten losses take half the bankroll or more, and half of it needs a 100.00% gain to come back. Since a run of ten arrives inside 1,000 even-money bets for 38.54% of bettors, this is a bet on not meeting it.",
      },
      takeaway:
        "The unit percentage is not a preference. It is your decision about how long the worst losing run is allowed to be before you are out of the game.",
      example: {
        title: "A 2,000 bankroll at 2% per bet",
        rows: [
          { label: "Bankroll", value: "2,000" },
          { label: "Unit size", value: "2%" },
          { label: "Stake per bet", value: "40.00" },
          { label: "Ten losses in a row", value: "400.00" },
          { label: "Drawdown", value: "20.00%" },
          { label: "Losses to ruin", value: "50" },
        ],
        note:
          "That 20.00% hole needs a +25.00% gain on what is left to get back to 2,000. Move the unit to 5% and the same ten losses cost 1,000 — a 50.00% drawdown needing +100.00% to recover, with the bankroll covering 20 consecutive losses instead of 50. Three points on the rule, and the run you survive is less than half as long.",
      },
      explainerTitle: "The rule that decides how long a bad run you survive",
      explainer: [
        "**A unit is a percentage of the bankroll, not an amount**, and the difference only shows up when things go wrong. Stake a fixed 40 forever and a bankroll that has fallen to 1,000 is betting 4% instead of 2%: the rule tightens exactly when it should loosen. Recalculate the unit against the current balance and every loss makes the next stake smaller, which is what stops a bad run from finishing the job. The asymmetry underneath is the whole reason to care — **losing 20% needs +25.00% to recover, losing 50% needs +100.00%, and losing 80% needs +400.00%.** Nothing in the second half of those pairs is symmetric with the first, and no edge is big enough to make a 400.00% recovery a plan rather than a hope. A 2,000 bankroll at 2% stakes 40 a bet, absorbs ten straight losses for 400.00, and comes out down 20.00% — having used ten of the 50 consecutive losses that stake could survive.",
        "**A run of ten losses at prices around 2.00 is ordinary, not bad luck**, and this is the number that makes the point. At even money any single sequence of ten has a probability of 0.098% — one in 1,024 — which reads like never until you count how many sequences a season contains. Across 1,000 bets the chance of meeting at least one losing run of ten or longer is **38.54%**; at 2.10, where a bettor with no edge wins 47.62% of the time, it is **52.31%** — better than a coin flip. Over 500 bets the same two figures are 21.45% and 30.73%, and the longest run to expect in 1,000 even-money bets is about ten, because it grows with the base-two logarithm of the number of bets. The run is not the tail of the distribution, it is the middle of it, so **a unit above 5% is a bet on not meeting the ordinary case**: at 5% those ten losses take half the bankroll, at 10% they take all of it. When the edge is measured rather than assumed, the Kelly criterion calculator sizes the unit from the edge itself — read what it gives you as a ceiling, and this page as the floor beneath it.",
      ],
      faq: [
        {
          q: "What unit size should I use?",
          a: "One to two percent of the bankroll per bet is the usual range for flat staking, and above five percent the ordinary losing run becomes an account-ending event. The honest way to pick is backwards: choose the losing run you intend to survive, then read the drawdown this calculator gives and ask whether you would keep betting the same way after it.",
        },
        {
          q: "Why does losses to ruin show a whole number?",
          a: "Because it counts bets, and a fraction of a bet is not one. A 1,000 bankroll at 3% gives a 30 unit, which is 33 losses and a third — so the answer is 33, rounded down, because the bankroll cannot cover the next one in full. Rounding up would promise a bet the money does not exist for.",
        },
        {
          q: "Is a ten-bet losing run really normal?",
          a: "Yes, and the arithmetic is not close. Any one sequence of ten losses at even money is a 0.098% event, but across 1,000 bets there are enough sequences that the chance of meeting at least one is 38.54%, rising to 52.31% at 2.10 where a bettor with no edge wins 47.62% of the time. Plan around it rather than being surprised by it.",
        },
        {
          q: "Should I use this or the Kelly criterion?",
          a: "Use this when you do not have a measured edge, which is most of the time: a percentage unit needs no probability estimate and its worst case is knowable in advance. The Kelly criterion calculator is the right tool once you can defend a probability, and it will usually recommend more than a flat 2%. Treating its answer as a ceiling and a flat rule as the floor keeps both honest.",
        },
      ],
    },
  },
};

export default en;

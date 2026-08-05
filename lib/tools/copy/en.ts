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
      "Five free betting calculators: convert odds between every format, remove the bookmaker margin, work out expected value, size a stake with the Kelly criterion and combine probabilities. No signup.",
    h1: "Free betting tools",
    lede:
      "The five calculations every serious bettor runs before placing a bet — converted, de-margined and sized. Free, no account needed.",
    cardCta: "Open the tool",
    intro: [
      "Every bet is a comparison between a price and a probability. These five calculators do that comparison properly: they translate prices between formats, strip the bookmaker's margin out of a market to expose the fair line, turn a probability estimate into expected value, and size the stake so a losing run does not end the bankroll.",
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
  },
};

export default en;

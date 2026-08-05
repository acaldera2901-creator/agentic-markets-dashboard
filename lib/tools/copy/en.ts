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
      formulaTitle: "How the conversion works",
      formula: [
        "decimal = 1 + (American / 100)          if American is positive",
        "decimal = 1 + (100 / |American|)        if American is negative",
        "decimal = 1 + (numerator / denominator) for fractional prices",
        "implied probability = 1 / decimal",
      ],
      explainerTitle: "Reading a price in any format",
      explainer: [
        "Odds are a probability wearing different clothes. Decimal odds — the European default — tell you the total return per unit staked: 2.50 returns 2.50 for every 1 risked, stake included. Fractional odds, still standard in British racing, quote the profit instead of the return: 3/2 means three units of profit for every two risked, which is the same 2.50 decimal. American odds quote how much you win on 100 (+150) or how much you must risk to win 100 (−110). Hong Kong, Malay and Indonesian odds are the formats used across Asian markets, and they matter because Asian books are often where the sharpest prices live.",
        "The number worth reading is the last one: implied probability, which is simply 1 divided by the decimal price. A price of 2.50 implies 40%. A price of 1.9091 — the familiar −110 — implies 52.38%. This is the bookmaker's stated chance of the outcome, and it is the only number you can compare directly against your own estimate. Two prices in different formats are not easier to compare than two probabilities; convert first, argue second.",
        "One caveat that this converter cannot remove for you: implied probability still contains the bookmaker's margin. Add up the implied probabilities of every outcome in a market and you will get more than 100% — that excess is the margin, and it inflates every single one of those probabilities. If you want the market's honest opinion rather than its priced opinion, run the market through the margin calculator and use the fair probabilities it returns.",
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
      formulaTitle: "How the margin is calculated",
      formula: [
        "overround = Σ (1 / oddsᵢ)",
        "margin = overround − 1",
        "payout = 1 / overround",
        "fair probabilityᵢ = (1 / oddsᵢ) / overround",
        "fair oddsᵢ = 1 / fair probabilityᵢ",
      ],
      explainerTitle: "The margin is the price of the bet",
      explainer: [
        "A fair two-way market prices both sides at 2.00: the implied probabilities are 50% and 50%, they add to exactly 100%, and neither side has an edge. Real markets are priced at 1.90 and 1.90. Those implied probabilities are 52.63% each, they add to 105.26%, and the extra 5.26 percentage points are the bookmaker's margin — the overround. Whichever side you back, you are paying it.",
        "Margin is the single most useful number for judging where to bet. A football match priced at 5% margin and the same match priced at 2% margin are not the same bet: the tighter book is handing you roughly three percentage points of expected value on identical opinions. Margins vary enormously by market — main lines at sharp books can sit under 2%, while outrights, player props and long-shot specials routinely carry 8% or more, because that is where books know their prices are least tested.",
        "Removing the margin gives you the fair line, sometimes called the no-vig line. This calculator does it proportionally: each implied probability is divided by their sum, so they add back to exactly 100%, and the fair odds are the reciprocal. That fair line is the closest thing you have to the market's honest estimate, and it is the reference point for the EV calculator — a bet is only positive expected value if your probability is higher than the fair probability, not merely higher than the priced one.",
        "One honest limitation: proportional removal spreads the margin evenly across outcomes, and real books do not. They load more margin onto long shots, because that is where casual money concentrates. On a market with a heavy favourite and a big outsider, this method slightly understates the favourite's true chance. For main lines with balanced prices the distortion is small; for lottery-ticket outrights, treat the fair line as an estimate rather than a measurement.",
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
      formulaTitle: "How expected value is calculated",
      formula: [
        "EV = p × (odds − 1) × stake − (1 − p) × stake",
        "   = (p × odds − 1) × stake",
        "edge = p × odds − 1",
        "break-even price = 1 / p",
      ],
      explainerTitle: "What expected value actually tells you",
      explainer: [
        "Expected value is the average result of a bet if you could place it an unlimited number of times. It has two inputs and no opinions: the price you are being offered, and the probability you believe the outcome has. If you think a team wins 55% of the time and someone offers you 2.00, the arithmetic is simple — 55% of the time you win one unit, 45% of the time you lose one, so on average you make 0.10 units per unit staked. That is a 10% edge, and it is what +EV means.",
        "The number that decides everything is the probability, and this is where most bettors quietly lose. A 5% error in your probability estimate is enough to turn a 4% edge into a 1% loss, and probability estimates made by eye are routinely wrong by much more than 5%. Which is why the second mode of this calculator exists: instead of trusting your gut, take the price for both sides of the market at a sharp book, strip out the margin, and use the resulting fair probability. You are no longer asking whether you are smarter than the market — you are asking whether the book you are betting at is slower than the sharpest book.",
        "Read EV as a rate, not as a promise. A bet with 4% expected value returns nothing at all on any single occasion: it wins or it loses. The 4% only appears across hundreds of independent bets, and only if the probability was right. Variance in the short run is far larger than the edge, which is exactly why the stake size matters as much as the edge itself — that is what the Kelly criterion is for.",
        "Two practical notes. First, the break-even price this calculator returns is the price at which your probability makes the bet exactly neutral; anything shorter than that is negative EV no matter how confident you feel. Second, EV says nothing about whether your bet will be accepted, limited or voided — settlement risk, limits and closing lines are real costs that no formula captures.",
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
      formulaTitle: "How the Kelly stake is calculated",
      formula: [
        "b = odds − 1",
        "f* = (p × b − (1 − p)) / b = (p × odds − 1) / b",
        "stake = bankroll × f* × fraction",
        "expected growth = p × ln(1 + f × b) + (1 − p) × ln(1 − f)",
      ],
      explainerTitle: "Sizing a bet so the bad run does not end it",
      explainer: [
        "The Kelly criterion answers a question that expected value ignores: given an edge, how much should you actually risk? Bet too little and a real edge compounds too slowly to matter. Bet too much and the mathematics turns against you — a bankroll that halves needs a 100% gain to recover, so large stakes destroy growth even when every individual bet is favourable. Kelly finds the fraction that maximises the long-run growth rate, and it turns out to be the edge divided by the net odds.",
        "The result scales with edge, not with confidence. A 10% edge at even money calls for 10% of the bankroll; the same 10% edge at 5.00 calls for only 2.5%, because the longer price means longer losing streaks and a bumpier path. This is why the formula is useful even if you never follow it exactly: it tells you that price and edge together decide the stake, and that a 'strong feeling' is not an input.",
        "Almost nobody should bet full Kelly. The formula assumes your probability is exactly right, and it never is. Feed it an overestimated edge and it will happily recommend a stake that is too large for the edge you actually have, which is the fastest way to lose a bankroll while being right on average. Half Kelly gives up a quarter of the theoretical growth rate and roughly halves the volatility; quarter Kelly is what many professionals with genuine models actually use. If your probabilities come from judgement rather than data, quarter Kelly is not conservative — it is realistic.",
        "When the price offers no edge, the correct stake is zero, and this calculator says so rather than returning a negative number dressed up as advice. A negative Kelly fraction means the bet is worth taking on the other side, if you can get it at that price — it never means bet less on this one.",
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
      formulaTitle: "How the probabilities are calculated",
      formula: [
        "odds = 1 / probability",
        "probability = 1 / odds",
        "break-even probability = 1 / odds",
        "parlay probability = p₁ × p₂ × … × pₙ",
        "parlay price = odds₁ × odds₂ × … × oddsₙ",
      ],
      explainerTitle: "Probability first, price second",
      explainer: [
        "Every price is a claim about probability, and the conversion between them is one division: a probability of 40% is a price of 2.50, and a price of 2.50 is a probability of 40%. Running that conversion before you bet changes the question from 'do I like this bet?' to 'do I think this outcome happens more than 40% of the time?' — which is a question you can actually be wrong about, and therefore a question worth asking.",
        "The same number, read from the price side, is the break-even probability: the minimum chance an outcome needs for the bet to be neutral. A price of 1.75 demands 57.1%. A price of 1.50 demands 66.7%. Long-odds bets demand very little — 15.00 needs only 6.7% — which is why they feel cheap and why books load their margin there. Break-even probability is the honest test of a bet: if you cannot argue the outcome clears it, the price is not generous, it is correct.",
        "Multiples are where probability becomes counter-intuitive. Independent legs multiply: three bets you rate at 50% each combine to 12.5%, not to something reassuringly close to a half. Four legs at 60% come to 12.96%. The combined price multiplies the same way, which is the trap — a 15.00 accumulator looks like a bargain until you notice it needs a 6.7% event, and that the bookmaker's margin has been applied to every single leg and then compounded. A four-leg parlay at 5% margin per leg carries close to 21% total margin.",
        "One assumption to hold onto: this calculator multiplies, so it assumes the legs are independent. Two outcomes from the same match — a team winning and that team's striker scoring — are correlated, and multiplying their probabilities understates the true chance of both landing. Same-game multiples are priced by books precisely because that correlation is hard to compute; treat the number here as a floor, not an answer.",
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

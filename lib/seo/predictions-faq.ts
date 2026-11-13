// lib/seo/predictions-faq.ts — #SEO-AEO-1106 (audit point 3): short, citable answers for /predictions.
// One source for the visible Q&A and the FAQPage JSON-LD (SeoProse renders both from this array: a schema answer that is not visible is a manual-action risk).
// Rules: answer-first, plain facts about how the product works, no performance numbers (hit rate, ROI), no "best odds", no promise of outcomes.

export const PREDICTIONS_INTRO: string[] = [
  "Use BetRedge to explore football and tennis fixtures and understand the numbers beside a match. Start with the source label: a card may show a model-and-market estimate, a model-only estimate or a market-only reading, depending on the available data. It is analysis, not a guarantee of any outcome.",
  "If you want to understand a price, use the odds converter below. To understand how an estimate is produced, read the football or tennis methodology guide linked above. Check the public record for eligible past predictions before drawing conclusions from a single match.",
];

export const PREDICTIONS_FAQ: Array<[string, string]> = [
  [
    "Who is the BetRedge match board for?",
    "It is for adults who want to understand football and tennis probabilities, compare available estimates with market readings and examine the limits of the data. Start with the source label and the methodology guide for that sport. A probability is not a guarantee of a result.",
  ],
  [
    "What does the probability on a BetRedge prediction mean?",
    "It describes an estimated chance, not a certain result. Check its source label: some readings include a statistical model, while market-only readings come from prices. A 60 percent probability describes an expectation across many comparable cases; it does not demonstrate that this particular model is calibrated.",
  ],
  [
    "What does market-only mean?",
    "A market-only reading comes from available market prices, not an independent model estimate. It does not show that a model has found an advantage over the market. Coverage varies by match and data source, so check the label before comparing numbers.",
  ],
  [
    "What is the difference between the model's probability and the market's probability?",
    "Market probability is derived from prices. One divided by decimal odds gives the raw implied probability; adjusting a complete set of outcomes removes the bookmaker's margin. Model estimates use statistical inputs and may be blended with market data. A difference is not proof of an advantage or a profitable bet.",
  ],
  [
    "Which sports and matches does the board cover?",
    "Football and tennis. The public fixture list covers a rolling window of roughly ten days and may include recently started matches. Available analysis depends on the feeds and source labels. Use the board's sport and time filters to narrow the selection.",
  ],
  [
    "When are predictions updated or frozen?",
    "Pre-match readings can refresh when new data arrives. Stored pre-match predictions remain frozen after the scheduled start; live scores do not turn them into new in-play model estimates. A displayed estimate and an eligible archived prediction are not always the same thing.",
  ],
  [
    "Can I check how past predictions turned out?",
    "The public track record shows eligible archived predictions and their settlement status. Not every displayed market reading or unsealed estimate is included. Check the record's coverage and source labels rather than treating the whole board as a verified performance history.",
  ],
];

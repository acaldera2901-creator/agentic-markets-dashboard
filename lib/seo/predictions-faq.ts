// lib/seo/predictions-faq.ts — #SEO-AEO-1106 (audit point 3): short, citable answers for /predictions.
// One source for the visible Q&A and the FAQPage JSON-LD (SeoProse renders both from this array: a schema answer that is not visible is a manual-action risk).
// Rules: answer-first, plain facts about how the product works, no performance numbers (hit rate, ROI), no "best odds", no promise of outcomes.

export const PREDICTIONS_INTRO: string[] = [
  "BetRedge shows, for football and tennis matches, the model's calibrated probability next to the market's probability and the reasoning behind the gap. It is analysis, not a guarantee of any outcome.",
];

export const PREDICTIONS_FAQ: Array<[string, string]> = [
  [
    "What does the probability on a BetRedge prediction mean?",
    "It is the model's estimate of how often an outcome happens over many similar matches, not a forecast that it will happen this time. A 60 percent reading should be right about six times in ten and wrong about four. BetRedge is analysis, not a guarantee.",
  ],
  [
    "What is the difference between the model's probability and the market's probability?",
    "The market's probability is implied by bookmaker prices: one divided by the decimal price, with the bookmaker's margin taken out. The model's probability comes from BetRedge's own statistical model. The gap between the two is where a reading differs from the market, and the reasoning shows why.",
  ],
  [
    "Which sports and matches does the board cover?",
    "Football and tennis. The board lists the fixtures coming up in roughly the next ten days and keeps a match visible while it is being played.",
  ],
  [
    "When are predictions updated or frozen?",
    "Pre-match readings are refreshed when new data is available. Once play begins the prediction is frozen, so what was published before the start is what gets graded.",
  ],
  [
    "Can I check how past predictions turned out?",
    "Yes. Every settled prediction is graded after the match and archived on the track record page, so published calls stay checkable.",
  ],
];

// app/community/seo.ts — la prosa SEO di /community (#SEO-AEO-0825), spostata
// qui PAROLA PER PAROLA dal layout (#REDESIGN-V3C pages) così la usano due
// cornici: SeoProse a flag spento, la FAQ v3c a flag acceso. Stesso array →
// stesso FAQPage JSON-LD in entrambe.
export const COMMUNITY_SEO: { heading: string; intro: string[]; faq: Array<[question: string, answer: string]> } = {
  heading: "What Creator Picks are",
  intro: [
          "Creator Picks are accumulators assembled by BetRedge members using the Match Builder. The selections are chosen by a person; the probability attached to each leg, and to the slip as a whole, comes from the same model that prices every match on the board. Nothing about a creator slip changes the underlying numbers.",
          "This is the difference between this page and the Weekly Pick. The Weekly Pick is selected by the model. A creator slip is a person's reading of the same probabilities, published under their name and settled the same way.",
        ],
  faq: [
          [
            "Who builds the Creator Picks?",
            "Community members, in the Match Builder. BetRedge does not assemble them and does not rank creators by profit or by returns.",
          ],
          [
            "Where do the probabilities come from?",
            "From the BetRedge model, unchanged. A creator picks the legs; the probability shown next to each one is the same number the model publishes for that match everywhere else on the site.",
          ],
          [
            "How is a creator slip different from the Weekly Pick?",
            "The Weekly Pick is the model's own selection, published once a week. A creator slip is a person's selection from the same set of probabilities, published whenever they build one.",
          ],
          [
            "Do I need a paid plan to see them?",
            "Creator Picks are included in the Base and Pro plans.",
          ],
        ],
};

/**
 * La stessa FAQ per la cornice v3c (flag acceso), con UNA risposta cambiata: nel
 * redesign i piani sono due, Free e Pro (REGOLE-CANTIERE), e «Base» sparisce
 * dalla copy. Le altre domande e risposte sono le stesse stringhe di sopra.
 */
export const COMMUNITY_SEO_V3C: typeof COMMUNITY_SEO = {
  ...COMMUNITY_SEO,
  faq: COMMUNITY_SEO.faq.map(([q, a]) =>
    q === "Do I need a paid plan to see them?" ? [q, "Creator Picks are included in Pro."] : [q, a],
  ),
};

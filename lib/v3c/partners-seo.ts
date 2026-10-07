// lib/v3c/partners-seo.ts (#REDESIGN-V3C fixui · QA A5) — la prosa SEO e la FAQ di
// /partners a flag acceso. app/partners/seo.ts resta INTATTO per il sito di oggi
// (flag spento); qui cambia solo ciò che il redesign non dice più: «predictions»,
// «picks», «call» (POSITIONING §2: il prodotto è un controllo del prezzo, non un
// pronostico). Testo visibile = FAQPage JSON-LD (components/v3c/pages/BooksPage).
// Inglese come la versione di oggi (la pagina partner non era tradotta).
import { PARTNERS_SEO_FAQ, PARTNERS_SEO_HEADING, PARTNERS_SEO_INTRO } from "@/app/partners/seo";

export const V3C_PARTNERS_HEADING = PARTNERS_SEO_HEADING;

export const V3C_PARTNERS_INTRO: string[] = [
  "BetRedge is a price check for football and tennis odds. For every match it covers it shows the market’s probability, our estimate beside it and the gap. It does not take bets, does not hold customer funds, and does not operate any of the platforms listed on this page.",
  // la seconda frase (link affiliati e paesi) è vera così com'è: la stessa di oggi
  PARTNERS_SEO_INTRO[1],
];

export const V3C_PARTNERS_FAQ: Array<[question: string, answer: string]> = [
  PARTNERS_SEO_FAQ[0],
  [
    "Does BetRedge take bets?",
    "No. BetRedge shows the market price, our estimate and the gap for each match, and explains how each number is made. Placing a bet happens elsewhere, on a platform BetRedge does not run.",
  ],
  PARTNERS_SEO_FAQ[2],
  [
    "Can a site embed BetRedge?",
    "Yes. BetRedge publishes an embeddable widget that shows current matches with their probabilities on a third-party site, with a single script tag.",
  ],
];

// lib/learn-links.ts (#SEO-ORPHANS-0908)
//
// Le sette pagine con contenuto vero — cinque guide + i due pillar di sport —
// esistevano solo in sitemap.ts e llms.txt: misurato l'08/09 su produzione,
// ZERO link interni da qualsiasi pagina del sito (la home ne linkava otto verso
// /predictions, che per un crawler è bianca: 1.459 caratteri e "0 Events").
// Questo file è l'elenco unico da cui pescano la home, il footer, l'hub dei
// tool e l'indice del blog: un link scritto in quattro posti invecchia in tre.
//
// PERCHÉ È STATICO E NON LETTO DAL DB. Le guide vivono in blog_posts e
// listPublishedPosts() è fail-soft per scelta (un hiccup del DB non deve dare
// 500 su una pagina indicizzata). Ma "fail-soft" qui significherebbe: il
// crawler passa nel minuto sbagliato e la home torna a non linkare niente —
// cioè esattamente il difetto che stiamo chiudendo, senza che nessuno se ne
// accorga. Un elenco statico è l'unico modo di garantire che i link siano
// SEMPRE nell'HTML servito.
// DEBITO ACCETTATO (owner: ui-andrea · rivedere se una guida viene spubblicata):
// se un post torna draft, questi link danno 404 finché qualcuno tocca il file.
// Sono cinque pillar evergreen scelte a mano, non un feed: il rischio è basso e
// preferibile al rischio opposto.
//
// LINGUA. I titoli sono quelli veri degli articoli, che sono scritti in
// inglese: non si traducono e non si inventano. Il testo attorno (occhiello,
// heading, "tutte le guide") vive nei dizionari di chi renderizza, nelle sole
// lingue già tradotte lì.

export type LearnGuide = {
  /** slug in blog_posts → /blog/<slug> */
  slug: string;
  /** Il concetto. È l'anchor text nel footer: più utile del titolo intero. */
  term: string;
  /** Titolo reale dell'articolo (verificato su produzione l'08/09). */
  title: string;
  /**
   * Dove quel conto si fa davvero. Presente solo dove il collegamento regge
   * per un lettore umano: la CLV non ha un calcolatore nell'hub e la casella
   * resta vuota, invece di puntare a un tool vagamente affine per riempirla.
   */
  seeAlso?: { href: string; label: string };
};

/**
 * Ordine di lettura, non ordine di pubblicazione: ogni voce è il pezzo che
 * serve alla successiva. La probabilità implicita prima del valore atteso, il
 * valore atteso prima delle value bet, la CLV per verificarsi dopo. L'xG chiude
 * perché è l'input specifico del calcio, non un passo del ragionamento.
 */
export const LEARN_GUIDES: readonly LearnGuide[] = [
  {
    slug: "implied-probability-from-betting-odds",
    term: "Implied probability",
    title: "Implied Probability From Betting Odds Explained",
    seeAlso: { href: "/tools/odds-converter", label: "Odds converter" },
  },
  {
    slug: "positive-expected-value-betting-explained",
    term: "Expected value",
    title: "Positive Expected Value Betting Explained",
    seeAlso: { href: "/tools/ev-calculator", label: "EV calculator" },
  },
  {
    slug: "finding-football-value-bets",
    term: "Value bets",
    title: "Finding Football Value Bets Without Chasing Tips",
    seeAlso: { href: "/tools/kelly-criterion", label: "Kelly criterion" },
  },
  {
    // Nessun seeAlso: la CLV si misura contro la quota di chiusura dopo che hai
    // scommesso, non è un conto che un calcolatore dell'hub sappia fare.
    slug: "closing-line-value-explained",
    term: "Closing line value",
    title: "Closing Line Value Explained for Bettors",
  },
  {
    slug: "how-xg-affects-football-odds",
    term: "Expected goals (xG)",
    title: "How xG Affects Football Odds and Prices",
    seeAlso: { href: "/ai-football-predictions", label: "How the model uses xG" },
  },
] as const;

/** I due pillar di sport. Stesse etichette ovunque = anchor text coerente. */
export const LEARN_PILLARS: readonly { href: string; label: string }[] = [
  { href: "/ai-football-predictions", label: "AI football predictions" },
  { href: "/ai-tennis-predictions", label: "AI tennis predictions" },
] as const;

export const BLOG_INDEX = "/blog";

export function guideHref(slug: string): string {
  return `${BLOG_INDEX}/${slug}`;
}

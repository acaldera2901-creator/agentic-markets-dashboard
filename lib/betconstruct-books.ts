// #MULTIBOOK-1 — Registry dei bookmaker affiliati (tutti BetConstruct).
// FortunePlay e YBets condividono la stessa piattaforma feed (stesse partite,
// mercati per-match). NON condividono lo schema URL del sito utente: FortunePlay
// espone il deep-link `/{locale}/sports/{sport}/{slug}-m-{id}?stag=`, YBets no
// (sportsbook.ybets.net è solo il feed; il sito utente ybets.net usa /sport) →
// vedi `matchUrlBase` sotto (#YBETS-DEEPLINK-404).
// Aggiungere un book BetConstruct domani = una entry qui. Gli `stag` sono ID
// affiliate PUBBLICI (compaiono nei redirect), non segreti → ok in codice.
export type BookConfig = {
  key: string;
  name: string;
  base: string;        // origin del FEED BetConstruct (dove gira l'API matches)
  apiPrefix: string;   // prefisso feed BetConstruct
  stag: string;        // codice affiliate (param ?stag=)
  landing: string;     // short-link affiliate di fallback (sempre valido + attribuzione)
  // Host del SITO UTENTE che serve le pagine-partita con lo schema
  // /{locale}/sports/{sport}/{slug}-m-{id}. Spesso ≠ `base` (l'host del feed).
  // Se assente → nessun deep-link costruibile → si usa `landing` (#YBETS-DEEPLINK-404).
  matchUrlBase?: string;
};

export const BOOKS: BookConfig[] = [
  {
    key: "fortuneplay",
    name: "FortunePlay",
    base: "https://www.fortuneplay.com",
    apiPrefix: "/_sb_api/api/v2",
    stag: "185731_6a452e784bc294a76d3f24b0",
    landing: "https://mediaroosters.com/aacugmydl8",
    matchUrlBase: "https://www.fortuneplay.com", // deep-link verificato dal vivo 2026-07-01
  },
  {
    key: "ybets",
    name: "YBets",
    base: "https://sportsbook.ybets.net", // host FEED; il sito utente è ybets.net con schema diverso (/sport)
    apiPrefix: "/api/v2",
    stag: "172759_6a452e774bc294a76d3f249e",
    landing: "https://ybetspromo.io/dputempxc",
    // matchUrlBase omesso: lo schema deep-link FortunePlay NON è valido su YBets
    // (sportsbook.ybets.net/en/sports → 404) → si usa la landing (verificata 200 + stag).
  },
];

// Book primario: fornisce id/mercati-dettaglio della scheda (il "More markets"
// fetch è per-book via id). Gli altri book aggiungono solo quote comparabili.
export const PRIMARY_BOOK = BOOKS[0];

export function bookByKey(key: string): BookConfig | undefined {
  return BOOKS.find((b) => b.key === key);
}

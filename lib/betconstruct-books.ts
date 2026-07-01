// #MULTIBOOK-1 — Registry dei bookmaker affiliati (tutti BetConstruct).
// FortunePlay e YBets condividono la stessa piattaforma: stesso feed, stesse
// partite, deep-link `/{locale}/sports/{sport}/{slug}-m-{id}?stag=`, mercati per-match.
// Cambiano SOLO: base URL, prefix API, stag code, nome/logo, landing affiliate.
// Aggiungere un book BetConstruct domani = una entry qui. Gli `stag` sono ID
// affiliate PUBBLICI (compaiono nei redirect), non segreti → ok in codice.
export type BookConfig = {
  key: string;
  name: string;
  base: string;        // origin del sito sportsbook (dove vivono le pagine-partita)
  apiPrefix: string;   // prefisso feed BetConstruct
  stag: string;        // codice affiliate (param ?stag=)
  landing: string;     // short-link affiliate di fallback (sempre valido + attribuzione)
};

export const BOOKS: BookConfig[] = [
  {
    key: "fortuneplay",
    name: "FortunePlay",
    base: "https://www.fortuneplay.com",
    apiPrefix: "/_sb_api/api/v2",
    stag: "185731_6a452e784bc294a76d3f24b0",
    landing: "https://mediaroosters.com/aacugmydl8",
  },
  {
    key: "ybets",
    name: "YBets",
    base: "https://sportsbook.ybets.net",
    apiPrefix: "/api/v2",
    stag: "172759_6a452e774bc294a76d3f249e",
    landing: "https://ybetspromo.io/dputempxc",
  },
];

// Book primario: fornisce id/mercati-dettaglio della scheda (il "More markets"
// fetch è per-book via id). Gli altri book aggiungono solo quote comparabili.
export const PRIMARY_BOOK = BOOKS[0];

export function bookByKey(key: string): BookConfig | undefined {
  return BOOKS.find((b) => b.key === key);
}

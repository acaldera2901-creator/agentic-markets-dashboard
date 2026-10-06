// #MULTIBOOK-1 — Registry dei bookmaker affiliati (tutti BetConstruct).
// FortunePlay e YBets condividono la stessa piattaforma feed (stesse partite,
// mercati per-match). NON condividono lo schema URL del sito utente: FortunePlay
// espone il deep-link `/{locale}/sports/{sport}/{slug}-m-{id}?stag=`, YBets no
// (sportsbook.ybets.net è solo il feed; il sito utente ybets.net usa /sport) →
// vedi `matchUrlBase` sotto (#YBETS-DEEPLINK-404).
// Aggiungere un book BetConstruct domani = una entry qui. Gli `stag` sono ID
// affiliate PUBBLICI (compaiono nei redirect), non segreti → ok in codice.
import { landingUrlOf } from "./affiliate";

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

// #V3C-PARTNERS (F7) — RollXO e N1 Bet: stessa piattaforma di FortunePlay
// (build netcontent.cc), stesso feed `/_sb_api/api/v2`, schema identico.
// Verificati il 06/10/2026 con una GET leggera da IP DE: 200 JSON
// (numeri e confronto col sito in docs/v3c-partners-collector-proposal.md).
// NON stanno in BOOKS: BOOKS alimenta anche il sito attuale e il collector di
// partner_price_history (lib/partner-prezzi.ts), e un feed nuovo in quei due
// posti è una decisione gated (docs/v3c-partners-collector-proposal.md).
// Li accende `BETREDGE_PARTNER_FEEDS` (lib/price-books.ts) dopo l'APPROVE.
// Deep-link: nessuno. Il tracker N1 Partners aggiunge `stag=<campagna>_<click>`
// al redirect, ma un link diretto alla partita col solo id-campagna non è stato
// verificato come attribuito → `matchUrlBase` assente, si usa la landing, e
// `stag` resta vuoto perché nessun URL lo legge.
export const EXTRA_BOOKS: BookConfig[] = [
  {
    key: "rollxo",
    name: "RollXO",
    base: "https://www.rollxo.com",
    apiPrefix: "/_sb_api/api/v2",
    stag: "",
    landing: landingUrlOf("RollXO") ?? "https://rollxo.media/n1xqevdiuw",
  },
  {
    key: "n1bet",
    name: "N1 Bet",
    base: "https://n1bet.com",
    apiPrefix: "/_sb_api/api/v2",
    stag: "",
    landing: landingUrlOf("N1 Bet") ?? "https://n1betpartners.com/n16rrb51wa",
  },
];

// Book primario: fornisce id/mercati-dettaglio della scheda (il "More markets"
// fetch è per-book via id). Gli altri book aggiungono solo quote comparabili.
export const PRIMARY_BOOK = BOOKS[0];

export function bookByKey(key: string): BookConfig | undefined {
  return BOOKS.find((b) => b.key === key);
}

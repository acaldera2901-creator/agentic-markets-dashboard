// Affiliate scaffolding. Real partner links/odds arrive once bookmaker deals are
// signed (Andrea/Maven). Until then a single placeholder partner is emitted from
// env so the UI + revenue plumbing exist. NEVER fabricates an "edge".
export type AffiliateOffer = {
  bookmaker: string;
  bonus: string;
  url: string;
  odds: number | null; // populated later from partner feed; null for now
};

export function affiliateOffer(): AffiliateOffer | null {
  const bookmaker = process.env.AFFILIATE_BOOKMAKER || "";
  const url = process.env.AFFILIATE_URL || "";
  const bonus = process.env.AFFILIATE_BONUS || "";
  if (!bookmaker || !url) return null; // not configured yet -> no CTA
  return { bookmaker, bonus, url, odds: null };
}

// Attach the offer to a revealed prediction row (no-op if not configured).
export function withAffiliate<T extends Record<string, unknown>>(row: T): T {
  const offer = affiliateOffer();
  return offer ? ({ ...row, affiliate: offer } as T) : row;
}

// #PARTNER-REMOVE-0626: single sportsbook partner for now. "Place bet" links
// straight to the FortunePlay invite link in every geo (the multi-book dropdown
// infra in lib/sportsbooks + PlaceBetMenu is kept but unwired).
// Upgrade path: when more partners return, re-wire PlaceBetMenu via /api/bet-links.
export const FORTUNEPLAY_BET_URL = "https://mediaroosters.com/aacugmydl8";

// #BETSCORE-CTA-1: partner affiliati "solo landing" (nessun feed quote). Compaiono
// come CTA di redirect nella scheda-info, accanto ai book BetConstruct (FortunePlay/
// YBets). Il link è di atterraggio/registrazione (302 → betscore1.com) → nessuna
// quota/deep-link, solo redirect con attribuzione via ?mid=.
export const LANDING_PARTNERS = [
  { name: "BetScore", url: "https://bsr.lynmonkel.com/?mid=381903_2215092" },
  // #PARTNER-FELICEBET: rete Bluewin Partners (bta=2961065). Come BetScore è solo
  // landing/registrazione (302 → felicebet<geo>.com col btag) → nessun deep-link
  // per partita. Fonte unica dell'URL: lib/partners.ts lo rilegge da qui.
  { name: "FeliceBet", url: "https://go.bluewinpartners.com/visit/?bta=2961065&nci=5732" },
  // #PARTNERS-VELOBET-CASEA: rete Velobet Partners (bta=42786). Link unico per
  // tutte le geo — verificato: 302 → 24velobet.com/sportsbook/prematch col cxd di
  // attribuzione. Casinò + sportsbook, ma il link atterra sul prematch.
  { name: "VeloBet", url: "https://track.velobetpartners.com/visit/?bta=42786&nci=6119" },
  // #PARTNER-GGBET: sportsbook esports-first. Il link della rete arriva con i macro
  // `sub_id={sub_id_1}` e `click_id={clickid}` NON risolti: verificato con curl che
  // il sub_id finisce dentro il tag di attribuzione (302 → ggbetconnect.com?…&
  // ref=gg_w267914c385808l8364p210_<sub_id>) → lasciare le graffe letterali ci
  // sporcherebbe il ref. Valorizzato `sub_id=betredge` (identifica la sorgente) e
  // rimosso `click_id` (macro della rete, noi non ne abbiamo uno). Solo landing di
  // registrazione (`encoded_url` = sports#!/auth/register), nessun deep-link evento.
  { name: "GG.BET", url: "https://ggbetbestoffer.com/l/6a6ca2b84d683c219008f152?utm_source=Aff&utm_medium=267914&utm_campaign=seo&utm_content=bet&sub_id=betredge" },
  // #PARTNER-WILDZ-BEAZT (2026-09-02): rete Rootz (go.wildzaffiliates.com, bta=1000385,
  // licenza MGA). Verificati con curl e col browser: nci=6056 → 302 su beazt.com/en/,
  // nci=5345 → 302 su wildz.com/en/, col tag `aff=cxw-1000385_<n>` (n cambia a ogni
  // click: è il click-id della rete, non fa parte del link). L'`utm_campaign=betredge`
  // sul link Wildz è quello consegnato dalla rete e il tracker NON lo propaga alla
  // destinazione (verificato): si tiene perché è il link firmato dal partner, ma non
  // vale come attribuzione. Entrambi hanno casinò + sportsbook.
  // ATTENZIONE — questi due atterrano sulla HOME (non sul prematch come VeloBet):
  // dal menu "Piazza la scommessa" l'utente arriva sulla lobby e deve navigare fino
  // allo sport da solo. Presenza nel menu = scelta esplicita di Andrea (02/09), non
  // una conseguenza del link. Se la rete ci dà un deep-link sportsbook, si sostituisce
  // qui e l'attrito sparisce.
  { name: "Beazt", url: "https://go.wildzaffiliates.com/visit/?bta=1000385&nci=6056" },
  { name: "Wildz", url: "https://go.wildzaffiliates.com/visit/?bta=1000385&nci=5345&utm_campaign=betredge" },
] as const;

export type LandingPartner = { name: string; url: string };

// #PARTNERS-VELOBET-CASEA — Casea (stessa rete di BetScore: lynmonkel, mid=383451_*)
// ci ha dato un link PER PAESE e **nessun link neutro**: ogni mid è una campagna
// SEO di quel paese. Verificati con curl: NO → ca…com/no/registration, FI →
// /fi/registration, CH → /registration (landing di default).
// Decisione Andrea (31/07): **nessun fallback** su un mid di un'altra geo → il
// partner esiste SOLO in questi paesi. Aggiungerne uno = una riga qui.
export const CASEA_GEO_URLS: Record<string, string> = {
  NO: "https://csa.lynmonkel.com/?mid=383451_2222324",
  CH: "https://csa.lynmonkel.com/?mid=383451_2222327",
  FI: "https://csa.lynmonkel.com/?mid=383451_2222329",
};

// #PARTNERS-N1-0915 — rete N1 Partners (RollXO, Hollywin, N1 Bet). Terza forma di
// geo, distinta dalle due già in casa: Casea ha un mid DIVERSO per paese (mappa
// cc→url), gli altri hanno un link unico valido ovunque. Qui il deal è un solo
// tracking link valido su PIÙ mercati (NO + DACH) → `{url, geos}`, non una mappa
// con lo stesso URL ripetuto quattro volte.
// Le geo sono il perimetro COMMERCIALE del deal (Andrea, 15/09), non un limite
// tecnico: verificato con curl da IP spagnolo che i tre link N1 risolvono comunque
// (Stonevegas no — vedi la sua nota sotto: il perimetro ce l'ha anche all'edge).
// Gestione identica a Casea, fail-closed: geo fuori lista o ignota → niente voce.
// Verificati con curl (15/09), tutti e tre 302 → welcome-page del brand col tag
// `stag=<id-campagna>_<click-id>`; il click-id cambia a ogni click (è della rete,
// non fa parte del link), l'id-campagna no: 188919 per RollXO e N1 Bet, 190219
// per Hollywin. `tr_src=seo` è aggiunto dal tracker. Nessun deep-link per evento:
// come gli altri solo-landing si atterra sulla welcome-page, non sul prematch.
//
// #GEO-PARTNERS-ALWAYS-0917 (17/09, richiesta esplicita di Andrea) — la restrizione
// geo sul menu "Piazza la scommessa" è RIMOSSA: `landingPartnersFor` include questi
// quattro in OGNI geo, come le voci di LANDING_PARTNERS. Il commento sopra resta
// perché documenta da dove viene il deal e cosa fu misurato il 15/09; quello che è
// cambiato è la decisione commerciale, non i fatti. Il campo `geos` NON si cancella:
// (a) è il perimetro originale del deal, (b) resta la fonte di `geoUrlsOf`, cioè
// della vetrina /partners — che per ora continua a rispettarlo (vedi lib/partners).
export const GEO_LANDING_PARTNERS: readonly { name: string; url: string; geos: readonly string[] }[] = [
  { name: "RollXO", url: "https://rollxo.media/n1xqevdiuw", geos: ["NO", "DE", "AT", "CH"] },
  { name: "Hollywin", url: "https://hollywin.media/n1fy3vie5j", geos: ["NO", "DE", "AT", "CH"] },
  { name: "N1 Bet", url: "https://n1betpartners.com/n16rrb51wa", geos: ["NO", "DE", "AT", "CH"] },
  // #PARTNER-STONEVEGAS-0915 — rete Playfina (tracker pleotra, schema `?mid=` come
  // BetScore/Casea su lynmonkel), NON N1: sta qui perché ha la stessa FORMA di deal,
  // un link unico su più mercati. Geo NO+DACH per istruzione esplicita di Andrea
  // (15/09), allineata agli altri tre.
  // Verificato con curl (15/09) da IP spagnolo: il tracker risolve (302 ×2) e il
  // `mid=389978_2246288` sopravvive fino all'URL finale della registration page
  // (stonevegas-1010.com/registration?mid=…&fluid=<click-id della rete>) → l'attribuzione
  // regge. La pagina però risponde 403 "Access restricted — not available for your
  // country for legal reasons": è il gate geo del PARTNER, non della rete (nello stesso
  // minuto BetScore e i tre N1 rispondono 200 dallo stesso IP). Un 403 dalla Spagna è
  // COERENTE con un perimetro NO+DACH, ma NON è una conferma: da qui non si può
  // emettere una richiesta da IP NO/DE/AT/CH. Se Playfina dichiara un perimetro
  // diverso, si corregge questa riga.
  { name: "Stonevegas", url: "https://stnvgs.pleotra.com/?mid=389978_2246288", geos: ["NO", "DE", "AT", "CH"] },
] as const;

// Le geo di un partner N1 come mappa cc→url, per chi (lib/partners) consuma
// `geoUrls`. Qui si rilegge, non si duplica: la fonte resta GEO_LANDING_PARTNERS.
export function geoUrlsOf(name: string): Record<string, string> {
  const p = GEO_LANDING_PARTNERS.find((x) => x.name === name);
  return p ? Object.fromEntries(p.geos.map((g) => [g, p.url])) : {};
}

// Partner solo-landing da mostrare in una geo: le voci a link unico (LANDING_PARTNERS
// + GEO_LANDING_PARTNERS) più quelle con un link PER PAESE, col link del paese.
// `country` viene SEMPRE da /api/geo-books (header server-side, non falsificabile
// dal client).
// FAIL-CLOSED dove serve ancora: chi non ha un link neutro (Casea) resta fuori se il
// paese è ignoto o scoperto. Chi un link neutro ce l'ha, c'è sempre — vedi
// #GEO-PARTNERS-ALWAYS-0917 sopra.
export function landingPartnersFor(country: string | null | undefined): LandingPartner[] {
  const cc = (country ?? "").trim().toUpperCase();
  const casea = cc ? CASEA_GEO_URLS[cc] : undefined;
  const n1 = GEO_LANDING_PARTNERS.map(({ name, url }) => ({ name, url }));
  return [...LANDING_PARTNERS, ...n1, ...(casea ? [{ name: "Casea", url: casea }] : [])];
}

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

// Partner solo-landing da mostrare in una geo: le voci fisse (link unico) più
// quelle geo-ristrette, col link del paese. `country` viene SEMPRE da
// /api/geo-books (header server-side, non falsificabile dal client).
// FAIL-CLOSED come il resto del gate: paese ignoto o senza link → la voce non c'è.
export function landingPartnersFor(country: string | null | undefined): LandingPartner[] {
  const cc = (country ?? "").trim().toUpperCase();
  const casea = cc ? CASEA_GEO_URLS[cc] : undefined;
  return [...LANDING_PARTNERS, ...(casea ? [{ name: "Casea", url: casea }] : [])];
}

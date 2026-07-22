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
] as const;

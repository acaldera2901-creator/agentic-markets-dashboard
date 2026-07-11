import { geoAllowed } from "@/lib/sportsbooks";

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

// Attach the offer to a revealed prediction row. #ITALIA-EU-PARERE (decisione
// Andrea 2026-07-10): il bonus-CTA è pubblicità di scommesse come i link-book →
// stessa allowlist geo (SPORTSBOOK_GEO_ALLOWLIST + hard-block IT/BE/NL). Il
// country viene dagli header Vercel/Cloudflare della route chiamante; geo non
// ammessa o sconosciuta → nessun CTA (default nascosto). No-op se non configurato.
export function withAffiliate<T extends Record<string, unknown>>(row: T, country: string | null | undefined): T {
  if (!geoAllowed(country)) return row;
  const offer = affiliateOffer();
  return offer ? ({ ...row, affiliate: offer } as T) : row;
}

// #PARTNER-REMOVE-0626: single sportsbook partner for now. "Place bet" links
// straight to the FortunePlay invite link in every geo (the multi-book dropdown
// infra in lib/sportsbooks + PlaceBetMenu is kept but unwired).
// Upgrade path: when more partners return, re-wire PlaceBetMenu via /api/bet-links.
export const FORTUNEPLAY_BET_URL = "https://mediaroosters.com/aacugmydl8";

export type SportsbookId = "stake" | "roobet" | "fortuneplay";

// #NEWSPORTS: baseball/mma added after Andrea's live-feed check (2026-07-05,
// MLB 35 matches/81 markets, UFC 32 matches on FortunePlay) — coverage-agnostic
// downstream: the CTA renders only when the match is actually in the feed.
export type BetSport = "football" | "tennis" | "worldcup" | "baseball" | "mma";

export type BetSelection = {
  sport: BetSport;
  league?: string;
  homeTeam?: string;
  awayTeam?: string;
  market: string;
  pick: string;
  odds: number | null;
  eventStartUtc?: string;
};

export type BuildResult = { url: string; prefilled: boolean };

export type Sportsbook = {
  id: SportsbookId;
  name: string;
  logo: string;
  affiliateCode: string;
  baseUrl: string;
  // path opzionali per-sport forniti dall'operatore (route verificate dall'operatore,
  // non fabbricate qui). Es: { football: "sports/soccer" }
  sportPaths?: Partial<Record<BetSport, string>>;
  // Optional per-country base URL (referral) overrides. Keys are ISO-3166-1
  // alpha-2 country codes UPPERCASE, plus an optional "default". Falls back to
  // baseUrl. Populated from SPORTSBOOK_<BOOK>_URLS env JSON.
  regionalUrls?: Record<string, string>;
  adapter: BookAdapter;
};

export type BookAdapter = (sel: BetSelection, book: Sportsbook) => BuildResult;

// payload serializzabile passato al client (no funzioni)
export type BetLinkOption = {
  id: SportsbookId;
  name: string;
  logo: string;
  url: string;
  prefilled: boolean;
};

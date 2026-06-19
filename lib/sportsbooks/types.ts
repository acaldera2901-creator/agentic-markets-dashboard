export type SportsbookId = "stake" | "roobet" | "fortuneplay";

export type BetSport = "football" | "tennis" | "worldcup";

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

export type SportsbookId = "stake" | "roobet";

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

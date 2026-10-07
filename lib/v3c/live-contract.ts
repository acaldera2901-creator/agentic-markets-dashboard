// lib/v3c/live-contract.ts (#V3C-LIVESCORES) — the JSON shape of GET /api/v3/live.
//
// Live scores are INFORMATION ONLY: nothing here feeds the record, the seal,
// the estimates or the settlement (that stays agents/result_settlement.py +
// pick_settlement_current). Every number is the source's, re-oriented to OUR
// home/away (player1/player2); a field the source does not give is null, never
// guessed.

/** pre = not started yet (late start) · live · break (half-time, end of regulation) · final · off = postponed/abandoned/cancelled/suspended */
export type V3LiveState = "pre" | "live" | "break" | "final" | "off";

export type V3LiveFootballEvent = {
  /** the source's clock, as it prints it («23'», «90'+4'») */
  minute: string;
  kind: "goal" | "own_goal" | "penalty_goal" | "red_card";
  /** the side the event counts for, in OUR orientation */
  side: "home" | "away";
  player: string | null;
};

export type V3LiveFootball = {
  sport: "football";
  state: V3LiveState;
  /** final only: ft = 90', aet = after extra time, pen = after penalties */
  final_kind: "ft" | "aet" | "pen" | null;
  /** live only: the source's match clock («67'», «45'+2'») */
  minute: string | null;
  home: number | null;
  away: number | null;
  /** shoot-out score when final_kind = pen */
  pens: { home: number; away: number } | null;
  events: V3LiveFootballEvent[];
};

export type V3LiveTennisSet = { p1: number; p2: number; tb1: number | null; tb2: number | null };

export type V3LiveTennis = {
  sport: "tennis";
  state: V3LiveState;
  /** final only: ret = a player retired */
  final_kind: "done" | "ret" | null;
  /** games per set, oldest first; the last one is the set in play while live */
  sets: V3LiveTennisSet[];
  /** who serves, when the source says it (often it does not) */
  server: "p1" | "p2" | null;
  winner: "p1" | "p2" | null;
};

/** live2: the sources, in priority order (a tie on freshness goes to the first). */
export type V3LiveSourceId = "espn" | "api_football" | "odds_api";

/** live2: how each source is named on screen (the contract file has no server imports: safe in the browser). */
export const SOURCE_NAMES: Record<V3LiveSourceId, string> = { espn: "ESPN", api_football: "API-Football", odds_api: "The Odds API" };

export type V3LiveItem = (V3LiveFootball | V3LiveTennis) & {
  /** the source event id we matched (audit), prefixed by the source («espn:…», «apif:…», «oddsapi:…») */
  source_id: string;
  /** how the row was matched: exact source id, kickoff + names, or (#V3C-LIVEFIX) «slot»: own league's scoreboard, same kick-off, one club equal (live-match.ts matchFootball) */
  matched_by: "id" | "names" | "slot";
  /** live2: the source this score comes from */
  source: V3LiveSourceId;
  /** live2: when the source last refreshed it (its own timestamp when it gives one, else when we read it) */
  updated_at: string;
};

/**
 * live2: how each source did on this build.
 *   ok       — read (or served from its own short cache) this round;
 *   idle     — nothing needed it (every row already had a score, or no row of its leagues);
 *   off      — not configured (no key);
 *   degraded — quota almost spent, backoff after errors or daily budget reached: nothing new read,
 *              its last good data (if still fresh) is kept, otherwise its rows show no score.
 */
export type V3LiveSourceStatus = {
  id: V3LiveSourceId;
  name: string;
  state: "ok" | "idle" | "off" | "degraded";
  reason: string | null;
  /** quota units this instance spent today (UTC) on live reads */
  calls_today: number;
  /** the daily budget this instance allows itself (null = no quota, e.g. ESPN) */
  budget_day: number | null;
  /** the provider's own «remaining» header, when it sends one */
  remaining: number | null;
  /** board rows whose score came from this source in this response */
  items: number;
};

export type V3LiveCoverage = {
  /** board rows in the window */
  rows: number;
  /** rows with a live item */
  matched: number;
  /** rows whose competition the source does not cover (no slug / partner-only tennis) */
  no_source: number;
  /** rows the source covers but no unique event matched */
  unmatched: number;
};

export type V3LiveResponse = {
  contract: "v3.live.1";
  generated_at: string;
  /** rows that kicked off up to this many minutes ago (and up to 15 min ahead) are looked up */
  window_min: number;
  /** the names of the sources that gave at least one score («ESPN», «ESPN + The Odds API»…) */
  source: { name: string; note: string };
  /** live2: one line per source, quota and degradation stated, never hidden */
  sources: V3LiveSourceStatus[];
  /** live2: true when a source that was needed could not be read (quota, backoff): some rows may lack a score because of it */
  degraded: boolean;
  /** keyed by board id (match_predictions / tennis_predictions match_id) */
  items: Record<string, V3LiveItem>;
  coverage: { football: V3LiveCoverage; tennis: V3LiveCoverage; failed_feeds: string[] };
};

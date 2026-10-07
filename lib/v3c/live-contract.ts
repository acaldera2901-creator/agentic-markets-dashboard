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

export type V3LiveItem = (V3LiveFootball | V3LiveTennis) & {
  /** the source event id we matched (audit) */
  source_id: string;
  /** how the row was matched: exact source id, or kickoff + names */
  matched_by: "id" | "names";
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
  source: { name: "ESPN"; note: string };
  /** keyed by board id (match_predictions / tennis_predictions match_id) */
  items: Record<string, V3LiveItem>;
  coverage: { football: V3LiveCoverage; tennis: V3LiveCoverage; failed_feeds: string[] };
};

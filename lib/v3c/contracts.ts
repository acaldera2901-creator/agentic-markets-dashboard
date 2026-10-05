// v3c data contracts — the JSON shapes served under /api/v3/*.
//
// One file, shared by the route handlers (producers) and the v3c UI
// (consumers). Every probability is a fraction in [0,1] rounded to 4 decimals
// by `roundP` (lib/v3c/prob.ts); every edge is in percentage points with sign.
// The same number (e.g. market_p of a match) is produced by ONE function
// everywhere, so it cannot differ between endpoints.
//
// Honesty rules baked into the shapes (DIRECTION.md, analisi-gpt/_brief.md):
//   * football estimate = 0.3·model + 0.7·market (de-vigged) — `blend` says so;
//   * the public record reads ONLY pick_ledger + pick_settlement_current;
//   * no ROI, no CLV, no hit-rate field exists in any contract;
//   * a price is shown only for books with a live feed (FortunePlay, YBets).

export type Outcome = "home" | "draw" | "away";

export type Triple = { home: number; draw: number; away: number };

/** Below this sample size every aggregate carries `limited_sample: true`. */
export const LIMITED_SAMPLE_N = 30;

// ─── /api/v3/board ──────────────────────────────────────────────────────────

export type V3BookPrice = {
  /** registry key in lib/betconstruct-books.ts */
  bookmaker: string;
  name: string;
  price: number;
  /** when this price was read from the book */
  captured_at: string;
  /** live_feed = read now from the BetConstruct feed; price_history = last stored capture (feed down) */
  source: "live_feed" | "price_history";
  /** affiliate deep-link to the match when the book has one, else the affiliate landing */
  url: string;
};

export type V3BoardOutcome = {
  outcome: Outcome;
  /** composite market price the market% is derived from (null = no market) */
  market_price: number | null;
  /** de-vigged market probability (proportional margin removal) */
  market_p: number | null;
  /** raw model probability, before the market blend */
  model_p: number | null;
  /** the served estimate (football: 0.3·model + 0.7·market) */
  estimate_p: number;
  /** (estimate − market) in percentage points, signed. null without market. */
  edge_pp: number | null;
  /** prices from feed books only; empty when none matched */
  book_prices: V3BookPrice[];
  /** highest price among `book_prices` (null when empty) */
  best_price: V3BookPrice | null;
};

export type V3BoardMatch = {
  /** match id (match_predictions.match_id == pick_ledger.source_id) */
  id: string;
  sport: "football";
  league: string | null;
  competition: string | null;
  kickoff: string;
  home: string;
  away: string;
  market: "1X2";
  /** bookmaker overround removed from the composite market (0.041 = 4.1%) */
  margin_removed: number | null;
  /** weights actually used for estimate_p; null = no market, estimate = model */
  blend: { model: number; market: number } | null;
  /** prediction_log.computed_at of the numbers shown */
  estimate_as_of: string;
  /** pick_ledger.captured_at — when this match was sealed (null = not sealed) */
  sealed_at: string | null;
  /** outcome with the highest estimate (the served pick rule, #PICK-FAVOURITE-0812) */
  focus: Outcome;
  outcomes: V3BoardOutcome[];
};

// ─── tennis rows (F3, additive) ─────────────────────────────────────────────
// No model/market split is stored per tennis match, so a tennis row carries the
// served estimate and the feed-book prices only: NO market_p, NO edge. The UI
// says «market comparison coming» (Andrea, provisional, 2026-10-05).

export type V3BoardTennisOutcome = {
  outcome: "home" | "away";
  /** the served probability of this player */
  estimate_p: number;
  /** price stored with the prediction (composite market), null when none */
  market_price: number | null;
  /** OPTIONAL, not served today: de-vigged market probability, once a market/model split is stored
   *  per tennis match (branch betredge/v3c-tennis). The UI shows a gap ONLY when this is present. */
  market_p?: number | null;
  /** OPTIONAL, not served today: (estimate − market) in pp, signed — same rule as football. */
  edge_pp?: number | null;
  book_prices: V3BookPrice[];
  best_price: V3BookPrice | null;
};

export type V3BoardTennisMatch = {
  id: string;
  sport: "tennis";
  /** null when the row comes from the partner feed («Partner feed» is not a tournament) */
  tournament: string | null;
  surface: string | null;
  kickoff: string;
  /** player 1 / player 2 */
  home: string;
  away: string;
  market: "winner";
  /** `market` = the probability IS the de-vigged book price (partner-market-v1), not a model */
  estimate_source: "model" | "market";
  model_version: string | null;
  estimate_as_of: string | null;
  sealed_at: string | null;
  focus: "home" | "away";
  outcomes: V3BoardTennisOutcome[];
};

export type V3BoardResponse = {
  contract: "v3.board.1";
  generated_at: string;
  window_days: number;
  matches: V3BoardMatch[];
  /** tennis rows of the same window (estimate + feed prices, no gap) — F3, additive */
  tennis: V3BoardTennisMatch[];
  coverage: {
    /** tennis rows served, how many carry a feed price, and where their probability comes from */
    tennis: { matches: number; with_book_price: Record<string, number>; from_model: number; from_market: number };
    matches: number;
    with_market: number;
    sealed: number;
    with_book_price: Record<string, number>;
    /** published rows NOT in this board, by source_table, and why */
    excluded: { source_table: string; n: number; reason: string }[];
    /** max age of a stored (fallback) book price to be shown */
    book_price_max_age_min: number;
    /** feed books whose live feed was down; their prices came from price_history */
    books_from_history: string[];
  };
  notes: string[];
};

// ─── /api/v3/yesterday ──────────────────────────────────────────────────────
// «Yesterday» on the home: the sealed picks that kicked off on a given UTC day
// and how they settled. Read ONLY from pick_ledger + pick_settlement_current.
// Counts, never a rate: won and lost are integers next to the sum of the sealed
// probabilities (what the estimates expected), so a 3-of-5 day is read against
// the 2.3 it was supposed to be.

export type V3DayPick = {
  sport: "football" | "tennis";
  home: string;
  away: string;
  competition: string | null;
  /** the sealed pick: HOME/DRAW/AWAY for football, the player's name for tennis; null = no declared direction */
  pick: string | null;
  /** sealed probability of the pick (0..1); null without a pick */
  p: number | null;
  result: "won" | "lost" | "void" | "unresolved";
  /** realised outcome: HOME/DRAW/AWAY or the winner's name */
  outcome: string | null;
  final_score: string | null;
  kickoff: string;
  sealed_at: string;
  is_paper: boolean;
};

export type V3DaySummary = {
  /** rows with a settlement row */
  settled: number;
  won: number;
  lost: number;
  /** void + unresolved */
  other: number;
  /** Σ sealed probability over the won+lost rows: how many wins the estimates expected */
  expected_wins: number | null;
  limited_sample: boolean;
};

export type V3YesterdayResponse = {
  contract: "v3.yesterday.1";
  generated_at: string;
  /** the UTC day, YYYY-MM-DD */
  day: string;
  football: V3DaySummary;
  tennis: V3DaySummary;
  picks: V3DayPick[];
  notes: string[];
};

// ─── /api/v3/match/[id]/line-movement ───────────────────────────────────────

export type V3LinePoint1x2 = {
  t: string;
  price: { home: number; draw: number | null; away: number };
  /** de-vigged, null when the draw leg is missing */
  market_p: Triple | null;
  margin: number | null;
};

export type V3LinePointAh = {
  t: string;
  line: number;
  price: { home: number; away: number };
};

export type V3SeriesCoverage = {
  n_points: number;
  first_at: string | null;
  last_at: string | null;
  /** median minutes between consecutive captures (null with < 2 points) */
  median_interval_min: number | null;
  max_gap_min: number | null;
};

export type V3LineSeries =
  | {
      market: "1X2";
      source: string;
      bookmaker: string;
      points: V3LinePoint1x2[];
      coverage: V3SeriesCoverage;
    }
  | {
      market: "AH";
      source: string;
      bookmaker: string;
      points: V3LinePointAh[];
      coverage: V3SeriesCoverage;
    };

export type V3LineMovementResponse = {
  contract: "v3.line_movement.1";
  generated_at: string;
  match: { id: string; home: string; away: string; kickoff: string; team_pair_key: string | null };
  series: V3LineSeries[];
  notes: string[];
};

// ─── /api/v3/record ─────────────────────────────────────────────────────────

export type V3Interval = { low: number; high: number };

export type V3ReliabilityBucket = {
  /** bucket bounds on the predicted probability, [from, to) — last is [0.9, 1] */
  from: number;
  to: number;
  n: number;
  mean_predicted: number | null;
  observed: number | null;
  /** Wilson 95% on `observed` */
  ci95: V3Interval | null;
  limited_sample: boolean;
};

export type V3WeekRow = {
  /** ISO Monday (UTC) of the week the match kicked off */
  week_start: string;
  n: number;
  /** Σ estimate of the estimate's top outcome */
  expected_top: number;
  /** how many times that top outcome happened */
  observed_top: number;
  observed_top_ci95: V3Interval | null;
  /** both Brier figures are on the week's PAIRED rows; null when none */
  brier_estimate: number | null;
  brier_market: number | null;
  n_paired: number;
  limited_sample: boolean;
};

export type V3RecordResponse = {
  contract: "v3.record.1";
  generated_at: string;
  scope: {
    sport: "football";
    source: "pick_ledger + pick_settlement_current";
    source_table: string;
    model_version: string;
    /** first sealed row included — the record is «since day X» */
    since: string | null;
  };
  counts: {
    sealed: number;
    /** settled with a HOME/DRAW/AWAY outcome — the scored population */
    scored: number;
    /** scored AND with the market probability at seal time */
    paired: number;
    unresolved: number;
    void_without_outcome: number;
    /** sealed, kicked off > 6h ago, no settlement row */
    orphans: number;
    /** not kicked off yet, or kicked off < 6h ago without settlement */
    pending: number;
    paper: number;
  };
  outcomes: Triple;
  brier: {
    /** 3-outcome Brier (0 = perfect, 2 = worst), lower is better */
    estimate: number | null;
    market: number | null;
    /** estimate − market on the paired rows, with a 95% normal CI */
    difference: number | null;
    difference_ci95: V3Interval | null;
    n_paired: number;
    limited_sample: boolean;
  };
  weekly: V3WeekRow[];
  reliability: V3ReliabilityBucket[];
  notes: string[];
};

// ─── /api/v3/calibration ────────────────────────────────────────────────────

export type V3TennisCalibration = {
  model_version: string;
  label: string;
  n: number;
  buckets: V3ReliabilityBucket[];
};

export type V3CalibrationResponse = {
  contract: "v3.calibration.1";
  generated_at: string;
  football: {
    /** same population as /api/v3/record (scored rows) */
    n_matches: number;
    /** one (p, happened) pair per outcome per match */
    n_pairs: number;
    estimate: V3ReliabilityBucket[];
    /** market buckets on the paired subset only */
    market: V3ReliabilityBucket[];
    n_matches_paired: number;
  };
  tennis: {
    status: "sufficient" | "insufficient";
    reason: string;
    models: V3TennisCalibration[];
  };
  notes: string[];
};

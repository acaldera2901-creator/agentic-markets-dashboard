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
//   * a price is shown only for partner books with a real feed AND an
//     affiliate link (lib/price-books.ts); every other partner is still listed
//     in `books` with oddsAvailable=false and the reason (F7).

import type { BookStatus, PartnerDirEntry } from "@/lib/price-books";

export type Outcome = "home" | "draw" | "away";

export type Triple = { home: number; draw: number; away: number };

/** Below this sample size every aggregate carries `limited_sample: true`. */
export const LIMITED_SAMPLE_N = 30;

// ─── /api/v3/board ──────────────────────────────────────────────────────────

export type V3BookPrice = {
  /** price-book key (lib/price-books.ts: BetConstruct or Altenar registry) */
  bookmaker: string;
  name: string;
  price: number;
  /** when this price was read from the book */
  captured_at: string;
  /** live_feed = read now from the book's feed; price_history = last stored capture (feed down) */
  source: "live_feed" | "price_history";
  /** affiliate deep-link to the match when the book has one, else the affiliate landing */
  url: string;
};

/**
 * One entry per partner on a fixture (F7). Nobody hides a missing price:
 * oddsAvailable=false carries the reason, and the UI shows logo + button
 * («Odds on site») instead of a number. Name, logo and link are in
 * V3BoardResponse.partners (sent once, not per fixture).
 */
export type V3BookStatus = BookStatus;
export type V3PartnerDirEntry = PartnerDirEntry;

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
  /** prices from enabled price books only, best first, at most COMPARE_MAX_BOOKS; empty when none matched */
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
  /** every partner, with oddsAvailable + reason (F7). Optional in the type for older fixtures; the board always fills it. */
  books?: V3BookStatus[];
};

// ─── tennis (shared by board, record, calibration) ──────────────────────────

export type TennisSide = "p1" | "p2";

/**
 * What a tennis probability actually IS (measured on prod 05/10, see
 * docs/v3c-data-api.md §5). The model_version alone does not say it: an
 * `elo_surface_v4_features_odds` row with a market price serves — and seals —
 * the de-vigged market, not the Elo.
 *   model           — Elo v4 as computed (only when we computed an edge vs a market)
 *   model_tempered  — Elo v4 with the τ=1.68 temperature (no market at serve time)
 *   market_tempered — de-vigged market price with τ=1.68: NOT a model of ours
 *                     (partner-market-v1, or an Elo row anchored to the market)
 */
export type TennisProbabilityKind = "model" | "model_tempered" | "market_tempered";

export type V3BoardTennisSide = {
  side: TennisSide;
  player: string;
  /** stored price the market% is derived from (tennis_predictions.odds_*) */
  market_price: number | null;
  /** de-vigged 2-way market probability (proportional) */
  market_p: number | null;
  /** raw Elo v4 from the latest prediction_log snapshot; null for partner-market rows (no model) */
  model_p: number | null;
  /** the served probability, unrounded (the published % is this rounded to an integer) */
  estimate_p: number;
  /** pick_ledger probability of this player (integer %, quantized); null = not sealed */
  sealed_p: number | null;
  /** de-vigged feed-book price at seal time (see V3BoardTennisMatch.gap_market) */
  market_p_at_seal: number | null;
  /** (sealed_p − market_p_at_seal) in signed pp; null unless our model was sealed AND a market was captured before the seal */
  gap_pp: number | null;
  book_prices: V3BookPrice[];
  best_price: V3BookPrice | null;
};

export type V3BoardTennisMatch = {
  /** tennis_predictions.match_id == pick_ledger.source_id */
  id: string;
  sport: "tennis";
  /** null when the source has no real tournament («Partner feed») */
  tournament: string | null;
  kickoff: string;
  player1: string;
  player2: string;
  market: "ML";
  model_version: string;
  probability_kind: TennisProbabilityKind;
  /** false = the probability is the market's, not ours */
  is_our_model: boolean;
  /** temperature applied to the served probability (null = none) */
  temperature: number | null;
  /** overround of the stored price pair (0.05 = 5%) */
  margin_removed: number | null;
  /** where market_price comes from and when it was stored */
  market_source: { bookmaker: string | null; as_of: string } | null;
  /** prediction_log.computed_at of model_p (client clock of the Python agent) */
  model_as_of: string | null;
  /** tennis_predictions.computed_at */
  estimate_as_of: string;
  sealed_at: string | null;
  /** side with the highest served estimate */
  focus: TennisSide;
  /** the published pick (null below the confidence floor or without a market) */
  surfaced_pick: TennisSide | null;
  /**
   * The market the gap is measured against: the last FortunePlay/YBets capture
   * in partner_price_history at or before sealed_at (≤ 150 min old). Both sides
   * of the gap carry a database timestamp before kickoff and are independent:
   * the sealed number is our Elo, the price is the book's. null = no gap.
   */
  gap_market: { bookmaker: string; captured_at: string } | null;
  /** why sides[].gap_pp is null (null when the gap exists) */
  gap_null_reason: string | null;
  sides: [V3BoardTennisSide, V3BoardTennisSide];
  /** every partner, with oddsAvailable + reason (F7); see V3BoardMatch.books */
  books?: V3BookStatus[];
};

export type V3BoardResponse = {
  contract: "v3.board.2";
  generated_at: string;
  window_days: number;
  matches: V3BoardMatch[];
  tennis: V3BoardTennisMatch[];
  /** every partner once (name, logo, affiliate link) for the per-fixture `books` (F7). Optional for older fixtures. */
  partners?: V3PartnerDirEntry[];
  coverage: {
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
    tennis: {
      matches: number;
      by_kind: Record<TennisProbabilityKind, number>;
      with_market: number;
      with_model_p: number;
      sealed: number;
      /** matches whose sides carry a gap_pp */
      with_gap: number;
      with_book_price: Record<string, number>;
    };
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
  /** fidelity: football Brier of the estimate and of the market at seal, on the same paired rows (null = none paired) */
  brier?: { n: number; estimate: number; market: number } | null;
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

/** Tennis moneyline point: p1/p2 oriented to OUR player1/player2. */
export type V3LinePointMl = {
  t: string;
  price: { p1: number; p2: number };
  market_p: { p1: number; p2: number } | null;
  margin: number | null;
};

export type V3LineSeries =
  | {
      market: "ML";
      source: string;
      bookmaker: string;
      points: V3LinePointMl[];
      coverage: V3SeriesCoverage;
    }
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
  contract: "v3.line_movement.2";
  generated_at: string;
  /** tennis: home = player1, away = player2 */
  match: { id: string; sport: "football" | "tennis"; home: string; away: string; kickoff: string; team_pair_key: string | null };
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
  /**
   * (additive) every sealed row that kicked off in the week, scored or not. `n` is the
   * part with an outcome; the rest is still to be played, awaiting a result, or void.
   */
  sealed?: number;
  /** (additive) kicked off, no settlement row yet: the result is not in */
  awaiting_result?: number;
  /** (additive) the week that contains generated_at: still being played, incomplete */
  in_progress?: boolean;
  /**
   * (additive) no sealed match of the five top leagues this week, with weeks before
   * and after that had them (lib/v3c/record.ts TOP_LEAGUE_CODES). Absent when the
   * rows carry no league.
   */
  nations_break?: boolean;
};

/** One tennis group of the sealed ledger: one model_version × probability kind. */
export type V3TennisRecordGroup = {
  model_version: string;
  kind: TennisProbabilityKind;
  label: string;
  is_our_model: boolean;
  /** first sealed row of the group */
  since: string | null;
  sealed: number;
  /** settled won/lost — the scored population */
  scored: number;
  /** settled with another result (void, retired, …) */
  settled_other: number;
  /** no settlement row yet */
  unsettled: number;
  /** Σ sealed probability of the picked player, on scored rows */
  expected_wins: number | null;
  observed_wins: number;
  /** Wilson 95% on observed_wins / scored */
  observed_ci95: V3Interval | null;
  /** binary Brier of the sealed probability on scored rows (0 best, 1 worst) */
  brier: number | null;
  /**
   * Scored rows with an independent market at seal time (last feed-book capture
   * in partner_price_history ≤ 150 min before the seal). Only our model groups
   * can be paired: a market group compared with the market is itself.
   */
  n_paired: number;
  /** binary Brier of the sealed probability on the PAIRED rows */
  brier_paired: number | null;
  /** binary Brier of the de-vigged market on the same paired rows */
  brier_market: number | null;
  /** brier_paired − brier_market on paired rows, 95% normal CI (negative = sealed more accurate) */
  difference: number | null;
  difference_ci95: V3Interval | null;
  brier_market_null_reason: string | null;
  /** sealed probabilities are whole percentages: each is ±0.5 pp off the served one */
  quantization_pp: number;
  limited_sample: boolean;
};

export type V3RecordResponse = {
  contract: "v3.record.2";
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
    /** 95% normal CI of each mean Brier on the paired rows (F6, additive) */
    estimate_ci95?: V3Interval | null;
    market_ci95?: V3Interval | null;
    /** estimate − market on the paired rows, with a 95% normal CI */
    difference: number | null;
    difference_ci95: V3Interval | null;
    n_paired: number;
    limited_sample: boolean;
  };
  weekly: V3WeekRow[];
  reliability: V3ReliabilityBucket[];
  tennis: {
    source: "pick_ledger + pick_settlement_current";
    groups: V3TennisRecordGroup[];
  };
  notes: string[];
};

// ─── /api/v3/calibration ────────────────────────────────────────────────────

export type V3TennisCalibration = {
  model_version: string;
  kind: TennisProbabilityKind;
  label: string;
  is_our_model: boolean;
  n: number;
  limited_sample: boolean;
  buckets: V3ReliabilityBucket[];
};

export type V3CalibrationResponse = {
  contract: "v3.calibration.2";
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
    /** judged on OUR model groups only (is_our_model) — the market groups never make it sufficient */
    status: "sufficient" | "insufficient";
    reason: string;
    models: V3TennisCalibration[];
  };
  notes: string[];
};

// ─── record page (F6): receipts and settlement corrections ─────────────────

/** One sealed row as the record page shows it: what was sealed, when, and how it settled. */
export type V3Receipt = {
  sport: "football" | "tennis";
  source_id: string;
  model_version: string;
  home: string;
  away: string;
  competition: string | null;
  /** pick_ledger.captured_at, full precision, UTC ISO */
  sealed_at: string;
  kickoff: string;
  /** the outcome the row reads: the pick shown, else (football) the estimate's top outcome */
  read: string;
  /** "pick" = a pick was shown; "top" = no pick shown, the estimate's most likely outcome */
  read_kind: "pick" | "top";
  /** decimal price of `read` at seal (football: the prediction_log row that was sealed; tennis: pick_ledger.odds) */
  price: number | null;
  estimate_p: number;
  /** market probability of `read` at seal; null when there is none or when the sealed number IS the market */
  market_p: number | null;
  /** estimate − market in signed pp; null with `gap_null_reason` */
  gap_pp: number | null;
  gap_null_reason: "no_market_at_seal" | "is_market" | null;
  /** football: true when there was no real market at seal (paper row) */
  is_paper: boolean;
  /** "in_favour" = `read` happened; "against" = it did not; "void"/"unresolved" = no scored outcome */
  verdict: "in_favour" | "against" | "void" | "unresolved";
  final_score: string | null;
  /** settlement revision of the current row; > 1 means it was corrected */
  revision: number;
  /** tennis only: what the sealed number is */
  tennis_kind: TennisProbabilityKind | null;
  /** SHA-256 of the sealed fields (lib/v3c/receipts.ts receiptFingerprint), recomputable by anyone */
  fingerprint: string;
};

export type V3CorrectionCause = "late_result" | "postponed" | "no_pick_shown" | "late_fill" | "other";

export type V3Correction = {
  sport: "football" | "tennis";
  home: string;
  away: string;
  kickoff: string;
  revision: number;
  corrected_at: string;
  before: string;
  after: string;
  before_score: string | null;
  after_score: string | null;
  cause: V3CorrectionCause;
  /** source of a recovered result, as stored (e.g. "espn-id") */
  source: string | null;
  /** new date of a postponed match, if stored */
  new_date: string | null;
  /** pick_settlement.correction_reason verbatim */
  reason_raw: string;
};

export type V3CorrectionsSummary = {
  total: number;
  by_cause: Record<V3CorrectionCause, number>;
  latest: V3Correction[];
};

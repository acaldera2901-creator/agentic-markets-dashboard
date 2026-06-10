export type BestBetSport = "football" | "tennis";
export type BestBetKind = "value" | "model_signal" | "none";
export type BestBetMode = "value" | "model_signal" | "mixed" | "empty";
export type BestBetSportFilter = "all" | BestBetSport;
export type BestBetSortMode = "probability" | "edge" | "time";

export type BestBetCandidate = {
  kind: BestBetSport;
  id: string;
  startsAt: string;
  label: string;
  probability: number;
  odds: number | null;
  edge: number | null;
};

export type BestBetRow = BestBetCandidate & {
  classification: Exclude<BestBetKind, "none">;
};

export type BestBetBuildOptions = {
  sportFilter: BestBetSportFilter;
  sortMode: BestBetSortMode;
  query: string;
  cap?: number;
};

const FOOTBALL_BEST_EDGE_THRESHOLD = 0.02;
const TENNIS_BEST_EDGE_THRESHOLD = 0.03;
const MIN_BEST_BET_ODDS = 1.4;
const MIN_MODEL_SIGNAL_PROBABILITY = 0.58;
const DEFAULT_CAP = 21;
const TENNIS_TRADING_WINDOW_MS = 12 * 60 * 60 * 1000;

// Model edge — the margin (in percentage points) the picked outcome holds over
// the second-most-likely outcome. Prediction-first metric: always available
// from the model's own probabilities, independent of whether a market price
// (and therefore a market edge) exists. Inputs are fractions 0..1.
export function modelEdge(pickProb: number, secondProb: number): number {
  return Math.round((pickProb - secondProb) * 1000) / 10;
}

function isFutureMarket(utc: string): boolean {
  return new Date(utc).getTime() > Date.now();
}

function isTennisMarketVisible(utc: string): boolean {
  const scheduledAt = new Date(utc).getTime();
  if (!Number.isFinite(scheduledAt)) return false;
  return scheduledAt + TENNIS_TRADING_WINDOW_MS > Date.now();
}

function isSearchMatch(candidate: BestBetCandidate, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return candidate.label.toLowerCase().includes(q);
}

function valueClassification(
  candidate: BestBetCandidate,
  edgeThreshold: number,
  isVisible: boolean,
): BestBetKind {
  if (!isVisible) return "none";
  if (
    candidate.odds != null &&
    candidate.odds >= MIN_BEST_BET_ODDS &&
    (candidate.edge ?? 0) >= edgeThreshold
  ) {
    return "value";
  }
  if (candidate.probability >= MIN_MODEL_SIGNAL_PROBABILITY) return "model_signal";
  return "none";
}

export function classifyFootballBestBet(candidate: BestBetCandidate): BestBetKind {
  return valueClassification(candidate, FOOTBALL_BEST_EDGE_THRESHOLD, isFutureMarket(candidate.startsAt));
}

export function classifyTennisBestBet(candidate: BestBetCandidate): BestBetKind {
  // LOW-15: surface as a value/model pick only PRE-match (parity with football).
  // A started match (the old isTennisMarketVisible kept it for 12h after the
  // start) must not be presented as a pre-match pick. Board visibility/live
  // display is handled separately by isTennisMarketVisible elsewhere.
  return valueClassification(candidate, TENNIS_BEST_EDGE_THRESHOLD, isFutureMarket(candidate.startsAt));
}

function classify(candidate: BestBetCandidate): BestBetKind {
  return candidate.kind === "football"
    ? classifyFootballBestBet(candidate)
    : classifyTennisBestBet(candidate);
}

function sortRows(rows: BestBetRow[], sortMode: BestBetSortMode): BestBetRow[] {
  return rows.sort((a, b) => {
    if (sortMode === "time") return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
    if (sortMode === "edge") return (b.edge ?? -999) - (a.edge ?? -999);
    return b.probability - a.probability;
  });
}

export function buildBestBetRows(
  football: BestBetCandidate[],
  tennis: BestBetCandidate[],
  options: BestBetBuildOptions,
): { mode: BestBetMode; items: BestBetRow[]; valueCount: number; modelSignalCount: number } {
  const candidates = [...football, ...tennis]
    .filter((candidate) => options.sportFilter === "all" || candidate.kind === options.sportFilter)
    .filter((candidate) => isSearchMatch(candidate, options.query));

  const classified = candidates
    .map((candidate) => ({ ...candidate, classification: classify(candidate) }))
    .filter((candidate): candidate is BestBetRow => candidate.classification !== "none");

  const valueRows = classified.filter((candidate) => candidate.classification === "value");
  const modelRows = classified.filter((candidate) => candidate.classification === "model_signal");
  // No value-mode collapse (bug Andrea 2026-06-06: 3 football value rows were
  // suppressing 30 tennis model signals → tennis section looked empty). Value
  // rows always rank first, model signals follow — both visible, one cap.
  const mode: BestBetMode =
    valueRows.length && modelRows.length ? "mixed"
    : valueRows.length ? "value"
    : modelRows.length ? "model_signal"
    : "empty";
  const cap = options.cap ?? DEFAULT_CAP;

  return {
    mode,
    items: [
      ...sortRows([...valueRows], options.sortMode),
      ...sortRows([...modelRows], options.sortMode),
    ].slice(0, cap),
    valueCount: valueRows.length,
    modelSignalCount: modelRows.length,
  };
}

// The sealed record (/api/v3/record) and football calibration, computed from
// pick_ledger + pick_settlement_current ONLY. unified_predictions is not read:
// it is mutable and its /history ROI (+4.7%) disagrees with the sealed ledger
// (DIRECTION.md). No ROI, CLV or hit-rate is computed here — by construction.
import {
  LIMITED_SAMPLE_N,
  type Triple,
  type V3RecordResponse,
  type V3ReliabilityBucket,
  type V3WeekRow,
} from "./contracts";
import { parseOutcome, roundP, topOutcome } from "./prob";
import { brier3, mean, pairedDifference, reliability, triplePairs, weekStartUtc } from "./scoring";
import { wilson95 } from "@/lib/wilson";
import { tennisRecordGroups, type SealedTennisRow } from "./tennis";
import type { PartnerPriceRow } from "./board";
import { FOOTBALL_LEDGER_MODEL_VERSION, FOOTBALL_LEDGER_SOURCE_TABLE } from "@/lib/pick-ledger-mirror";

/** A sealed row, its settlement (if any) and the market at seal time (if any). */
export type SealedFootballRow = {
  source_id: string;
  captured_at: string;
  commence_time: string;
  is_paper: boolean;
  p_home: number;
  p_draw: number;
  p_away: number;
  /** null = no row in pick_settlement_current */
  result: string | null;
  outcome: string | null;
  /** de-vigged market of the prediction_log row whose served p equals the sealed p */
  market_p_home: number | null;
  market_p_draw: number | null;
  market_p_away: number | null;
};

/** Hours after kickoff before a missing settlement counts as an orphan (= sealedOrphansSql). */
export const ORPHAN_GRACE_HOURS = 6;

export type ScoredRow = {
  kickoff: string;
  estimate: Triple;
  market: Triple | null;
  happened: NonNullable<ReturnType<typeof parseOutcome>>;
};

function marketOf(r: SealedFootballRow): Triple | null {
  if (r.market_p_home == null || r.market_p_draw == null || r.market_p_away == null) return null;
  return { home: r.market_p_home, draw: r.market_p_draw, away: r.market_p_away };
}

export function scoredRows(rows: SealedFootballRow[]): ScoredRow[] {
  const out: ScoredRow[] = [];
  for (const r of rows) {
    if (r.result == null) continue;
    const happened = parseOutcome(r.outcome);
    if (!happened) continue;
    out.push({
      kickoff: r.commence_time,
      estimate: { home: r.p_home, draw: r.p_draw, away: r.p_away },
      market: marketOf(r),
      happened,
    });
  }
  return out;
}

export function estimateReliability(scored: ScoredRow[]): V3ReliabilityBucket[] {
  return reliability(scored.flatMap((s) => triplePairs(s.estimate, s.happened)));
}

export function marketReliability(scored: ScoredRow[]): V3ReliabilityBucket[] {
  return reliability(
    scored.flatMap((s) => (s.market ? triplePairs(s.market, s.happened) : [])),
  );
}

function weekly(scored: ScoredRow[]): V3WeekRow[] {
  const byWeek = new Map<string, ScoredRow[]>();
  for (const s of scored) {
    const w = weekStartUtc(s.kickoff);
    const list = byWeek.get(w);
    if (list) list.push(s);
    else byWeek.set(w, [s]);
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week_start, list]) => {
      let expected = 0;
      let observed = 0;
      for (const s of list) {
        const top = topOutcome(s.estimate);
        expected += s.estimate[top];
        if (s.happened === top) observed += 1;
      }
      const paired = list.filter((s) => s.market);
      const be = mean(paired.map((s) => brier3(s.estimate, s.happened)));
      const bm = mean(paired.map((s) => brier3(s.market as Triple, s.happened)));
      const w = wilson95(observed, list.length);
      return {
        week_start,
        n: list.length,
        expected_top: roundP(expected),
        observed_top: observed,
        observed_top_ci95: w ? { low: roundP(w.low), high: roundP(w.high) } : null,
        brier_estimate: be == null ? null : roundP(be),
        brier_market: bm == null ? null : roundP(bm),
        n_paired: paired.length,
        limited_sample: list.length < LIMITED_SAMPLE_N,
      };
    });
}

export function buildRecord(
  rows: SealedFootballRow[],
  now: Date = new Date(),
  tennis: SealedTennisRow[] = [],
  tennisHistory: Map<string, PartnerPriceRow[]> = new Map(),
): V3RecordResponse {
  const graceMs = ORPHAN_GRACE_HOURS * 3_600_000;
  let unresolved = 0;
  let voidNoOutcome = 0;
  let orphans = 0;
  let pending = 0;
  let paper = 0;
  let since: string | null = null;
  for (const r of rows) {
    if (r.is_paper) paper += 1;
    if (since == null || Date.parse(r.captured_at) < Date.parse(since)) since = r.captured_at;
    if (r.result == null) {
      if (Date.parse(r.commence_time) < now.getTime() - graceMs) orphans += 1;
      else pending += 1;
      continue;
    }
    if (r.result === "unresolved") unresolved += 1;
    else if (r.result === "void" && !parseOutcome(r.outcome)) voidNoOutcome += 1;
  }

  const scored = scoredRows(rows);
  const paired = scored.filter((s) => s.market);
  const outcomes = { home: 0, draw: 0, away: 0 };
  for (const s of scored) outcomes[s.happened] += 1;

  const be = mean(paired.map((s) => brier3(s.estimate, s.happened)));
  const bm = mean(paired.map((s) => brier3(s.market as Triple, s.happened)));
  const diff = pairedDifference(
    paired.map((s) => brier3(s.estimate, s.happened) - brier3(s.market as Triple, s.happened)),
  );

  return {
    contract: "v3.record.2",
    generated_at: now.toISOString(),
    scope: {
      sport: "football",
      source: "pick_ledger + pick_settlement_current",
      source_table: FOOTBALL_LEDGER_SOURCE_TABLE,
      model_version: FOOTBALL_LEDGER_MODEL_VERSION,
      since,
    },
    counts: {
      sealed: rows.length,
      scored: scored.length,
      paired: paired.length,
      unresolved,
      void_without_outcome: voidNoOutcome,
      orphans,
      pending,
      paper,
    },
    outcomes,
    brier: {
      estimate: be == null ? null : roundP(be),
      market: bm == null ? null : roundP(bm),
      difference: diff ? roundP(diff.mean) : null,
      difference_ci95: diff ? { low: roundP(diff.ci95.low), high: roundP(diff.ci95.high) } : null,
      n_paired: paired.length,
      limited_sample: paired.length < LIMITED_SAMPLE_N,
    },
    weekly: weekly(scored),
    reliability: estimateReliability(scored),
    tennis: { source: "pick_ledger + pick_settlement_current", groups: tennisRecordGroups(tennis, tennisHistory) },
    notes: [
      "Source: pick_ledger (sealed before kickoff, append-only) joined to pick_settlement_current. unified_predictions is not read.",
      "Scored = settled with a HOME/DRAW/AWAY outcome, whether or not a directional pick was shown: the Brier score is on the full 1X2 estimate.",
      "Market at seal time = de-vigged market of the prediction_log row whose served probabilities equal the sealed ones, computed at or before captured_at. Rows without it are scored but not paired.",
      "Brier estimate and market are both computed on the paired rows only. Lower is better; this is a calibration/accuracy measure, not a profit claim.",
      "Football estimate = 0.3 model + 0.7 de-vigged market: it is market-anchored by design.",
      "No ROI, CLV or hit-rate is published.",
      "Tennis: one group per model_version and per what the sealed probability IS (kind). market_tempered groups are the market price, not a model of ours. Sealed tennis probabilities are whole percentages (±0.5 pp). Our-model groups are paired with the last FortunePlay/YBets capture (partner_price_history, ≤150 min) before each seal: brier_paired vs brier_market on those rows only. Market groups are never paired (they are the market).",
    ],
  };
}

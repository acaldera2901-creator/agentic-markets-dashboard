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
  /** pick_ledger teams: only used to find twin fixture rows (dedupeTwinFixtures) */
  home_team?: string;
  away_team?: string;
  /** pick_ledger.league code (PL, PD, SA, …): only used to mark the weeks without top-five league matches */
  league?: string | null;
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

/**
 * Twin fixture rows: the same match sealed twice under two source ids (measured
 * 06/10: 134 pairs, all espn:* + oddsapi:*, same teams, kickoff equal in 130 and
 * within 1h in 3 more). Same home and away team with kickoffs this close = one
 * match. Pairs 6–96h apart exist too (24) but mostly settle differently: those
 * are other games (rescheduled, another leg) and stay.
 */
export const TWIN_KICKOFF_WINDOW_HOURS = 6;

function scorable(r: SealedFootballRow): boolean {
  return r.result != null && parseOutcome(r.outcome) != null;
}

/** Which twin speaks for the match: a scored row first, then the earliest seal, then the smaller id. */
function betterTwin(a: SealedFootballRow, b: SealedFootballRow): SealedFootballRow {
  if (scorable(a) !== scorable(b)) return scorable(a) ? a : b;
  const ca = Date.parse(a.captured_at);
  const cb = Date.parse(b.captured_at);
  if (ca !== cb) return ca < cb ? a : b;
  return a.source_id <= b.source_id ? a : b;
}

/**
 * Counts each match once (read-only: nothing is deleted from the ledger). The
 * choice never looks at which side won, only at whether the row is settled and
 * when it was sealed. Rows without team names are left as they are.
 */
export function dedupeTwinFixtures(rows: SealedFootballRow[]): SealedFootballRow[] {
  const windowMs = TWIN_KICKOFF_WINDOW_HOURS * 3_600_000;
  const byFixture = new Map<string, SealedFootballRow[]>();
  for (const r of rows) {
    if (!r.home_team || !r.away_team) continue;
    const k = `${r.home_team}\u0000${r.away_team}`;
    const list = byFixture.get(k);
    if (list) list.push(r);
    else byFixture.set(k, [r]);
  }
  const dropped = new Set<SealedFootballRow>();
  for (const list of byFixture.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => Date.parse(a.commence_time) - Date.parse(b.commence_time));
    let first = list[0];
    let best = first;
    for (const r of list.slice(1)) {
      if (Date.parse(r.commence_time) - Date.parse(first.commence_time) <= windowMs) {
        const keep = betterTwin(best, r);
        dropped.add(keep === best ? r : best);
        best = keep;
      } else {
        first = r;
        best = r;
      }
    }
  }
  return dropped.size === 0 ? rows : rows.filter((r) => !dropped.has(r));
}

/** polish: gli id che dedupeTwinFixtures scarta — le ricevute escludono questi, così record e ricevute contano le stesse partite. */
export function twinDroppedIds(rows: SealedFootballRow[]): string[] {
  const kept = new Set(dedupeTwinFixtures(rows));
  return rows.filter((r) => !kept.has(r)).map((r) => r.source_id);
}

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

/**
 * The five league codes a «nations break» is read from (pick_ledger.league, measured
 * 07/10/2026: Premier League PL, La Liga PD, Serie A SA, Bundesliga BL1, Ligue 1 FL1).
 * A week is a break when none of them has a sealed match while weeks before and after
 * do: derived from the ledger, no calendar typed in. Summer weeks before the season
 * (no top-five match yet) are not a break.
 */
export const TOP_LEAGUE_CODES: ReadonlySet<string> = new Set(["PL", "PD", "SA", "BL1", "FL1"]);

type WeekTally = { sealed: number; awaiting: number; top: number };

/** Every sealed row by week: how many, how many kicked off with no settlement row yet, how many top-five. */
function tallyWeeks(rows: SealedFootballRow[], now: Date): Map<string, WeekTally> {
  const out = new Map<string, WeekTally>();
  for (const r of rows) {
    const w = weekStartUtc(r.commence_time);
    const t = out.get(w) ?? { sealed: 0, awaiting: 0, top: 0 };
    t.sealed += 1;
    if (r.result == null && Date.parse(r.commence_time) <= now.getTime()) t.awaiting += 1;
    if (r.league && TOP_LEAGUE_CODES.has(r.league)) t.top += 1;
    out.set(w, t);
  }
  return out;
}

function weekly(scored: ScoredRow[], rows: SealedFootballRow[] = [], now: Date = new Date()): V3WeekRow[] {
  const byWeek = new Map<string, ScoredRow[]>();
  for (const s of scored) {
    const w = weekStartUtc(s.kickoff);
    const list = byWeek.get(w);
    if (list) list.push(s);
    else byWeek.set(w, [s]);
  }
  const tally = tallyWeeks(rows, now);
  const thisWeek = weekStartUtc(now.toISOString());
  // a started week with sealed rows shows even before its first result (bars at 0)
  for (const w of tally.keys()) if (w <= thisWeek && !byWeek.has(w)) byWeek.set(w, []);
  // no league on any row (old callers, tests) → breaks are not computed rather than guessed
  const hasLeague = rows.some((r) => r.league);
  const topWeeks = [...tally.entries()].filter(([, t]) => t.top > 0).map(([w]) => w).sort();
  const isBreak = (w: string) =>
    hasLeague && (tally.get(w)?.top ?? 0) === 0 && topWeeks.length > 0 && topWeeks[0] < w && topWeeks[topWeeks.length - 1] > w;
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
      const t = tally.get(week_start);
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
        ...(t ? { sealed: t.sealed, awaiting_result: t.awaiting } : {}),
        in_progress: week_start === thisWeek,
        ...(hasLeague ? { nations_break: isBreak(week_start) } : {}),
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
  // F6: the record page shows each Brier with its own 95% interval (same normal CI as the difference)
  const ciE = pairedDifference(paired.map((s) => brier3(s.estimate, s.happened)));
  const ciM = pairedDifference(paired.map((s) => brier3(s.market as Triple, s.happened)));
  const ci = (c: typeof ciE) => (c ? { low: roundP(c.ci95.low), high: roundP(c.ci95.high) } : null);

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
      estimate_ci95: ci(ciE),
      market_ci95: ci(ciM),
      difference: diff ? roundP(diff.mean) : null,
      difference_ci95: diff ? { low: roundP(diff.ci95.low), high: roundP(diff.ci95.high) } : null,
      n_paired: paired.length,
      limited_sample: paired.length < LIMITED_SAMPLE_N,
    },
    weekly: weekly(scored, rows, now),
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

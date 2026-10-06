// lib/v3c/receipts.ts (#REDESIGN-V3C F6) — the record page's receipts and
// settlement corrections, from pick_ledger + pick_settlement(_current) only.
// Pure (no DB): the SQL is in queries.ts, the tests feed fictitious rows.
//
// Two facts that shape the receipt:
//  * football: the record scores the FULL 1X2 estimate, pick or no pick. A row
//    reads the pick when one was shown, otherwise the estimate's top outcome —
//    and says which. «In favour / against» is whether THAT outcome happened,
//    the same population the Brier score is computed on.
//  * tennis: the sealed number is mostly the market (docs/v3c-data-api.md §5).
//    A gap exists only for our Elo rows with a feed price before the seal.
//
// The ledger stores no hash. The fingerprint here is a SHA-256 of the sealed
// fields, recomputable by anyone from the same fields; it is NOT a commitment
// published at seal time (that would need a DB column — docs/v3c-record-proposal.md).
import { createHash } from "node:crypto";
import type { Outcome, Triple, V3Correction, V3CorrectionCause, V3CorrectionsSummary, V3Receipt } from "./contracts";
import { edgePp, parseOutcome, topOutcome } from "./prob";
import type { PartnerPriceRow } from "./board";
import { isOurModel, ledgerTennisKind, pickedMarketAtSeal, sealedTennisKey, type SealedTennisRow } from "./tennis";

export const RECEIPTS_PAGE = 30;

/** A sealed football row with its current settlement and the prediction_log row that was sealed. */
export type FootballReceiptRow = {
  source_table: string;
  source_id: string;
  model_version: string;
  home: string;
  away: string;
  competition: string | null;
  pick: string | null;
  p_home: number;
  p_draw: number;
  p_away: number;
  /** pick_ledger.odds (price on the pick at seal) */
  odds: number | null;
  is_paper: boolean;
  /** UTC ISO with microseconds, as stored */
  captured_at: string;
  commence_time: string;
  result: string;
  outcome: string | null;
  final_score: string | null;
  revision: number;
  market_p_home: number | null;
  market_p_draw: number | null;
  market_p_away: number | null;
  odds_home: number | null;
  odds_draw: number | null;
  odds_away: number | null;
};

export type TennisReceiptRow = SealedTennisRow & {
  source_table: string;
  competition: string | null;
  final_score: string | null;
  revision: number;
  /** sealed p1/p2 as stored (fingerprint fields) */
  p_home: number | null;
  p_away: number | null;
};

const fmt = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? "" : String(x));

/**
 * SHA-256 (hex) of `v1|source_table|source_id|model_version|captured_at|p_home|p_draw|p_away|odds`:
 * captured_at as stored (UTC, microseconds), numbers in shortest round-trip form,
 * null as empty. The recipe is printed on the page so anyone can recompute it.
 */
export function receiptFingerprint(f: {
  source_table: string;
  source_id: string;
  model_version: string;
  captured_at: string;
  p_home: number | null;
  p_draw: number | null;
  p_away: number | null;
  odds: number | null;
}): string {
  const s = ["v1", f.source_table, f.source_id, f.model_version, f.captured_at, fmt(f.p_home), fmt(f.p_draw), fmt(f.p_away), fmt(f.odds)].join("|");
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function tripleOf(a: number | null, b: number | null, c: number | null): Triple | null {
  return a == null || b == null || c == null ? null : { home: a, draw: b, away: c };
}

function verdictOf(read: string, happened: string | null, result: string): V3Receipt["verdict"] {
  if (happened != null) return happened === read ? "in_favour" : "against";
  return result === "unresolved" ? "unresolved" : "void";
}

export function footballReceipt(r: FootballReceiptRow): V3Receipt {
  const estimate: Triple = { home: r.p_home, draw: r.p_draw, away: r.p_away };
  const market = tripleOf(r.market_p_home, r.market_p_draw, r.market_p_away);
  const prices = tripleOf(r.odds_home, r.odds_draw, r.odds_away);
  const picked = parseOutcome(r.pick);
  const read: Outcome = picked ?? topOutcome(estimate);
  const marketP = market ? market[read] : null;
  return {
    sport: "football",
    source_id: r.source_id,
    model_version: r.model_version,
    home: r.home,
    away: r.away,
    competition: r.competition,
    sealed_at: r.captured_at,
    kickoff: r.commence_time,
    read,
    read_kind: picked ? "pick" : "top",
    price: prices ? prices[read] : picked ? r.odds : null,
    estimate_p: estimate[read],
    market_p: marketP,
    gap_pp: edgePp(estimate[read], marketP),
    gap_null_reason: marketP == null ? "no_market_at_seal" : null,
    is_paper: r.is_paper,
    verdict: verdictOf(read, parseOutcome(r.outcome), r.result),
    final_score: r.final_score,
    revision: r.revision,
    tennis_kind: null,
    fingerprint: receiptFingerprint({ ...r, odds: r.odds }),
  };
}

export function tennisReceipt(r: TennisReceiptRow, history: PartnerPriceRow[] = []): V3Receipt {
  const kind = ledgerTennisKind(r);
  const ours = isOurModel(kind);
  const marketP = ours ? pickedMarketAtSeal(r, history) : null;
  const verdict: V3Receipt["verdict"] =
    r.result === "won" ? "in_favour" : r.result === "lost" ? "against" : r.result === "unresolved" ? "unresolved" : "void";
  return {
    sport: "tennis",
    source_id: r.source_id,
    model_version: r.model_version,
    home: r.home_team,
    away: r.away_team,
    competition: r.competition,
    sealed_at: r.captured_at,
    kickoff: r.commence_time,
    read: r.pick,
    read_kind: "pick",
    price: r.odds,
    estimate_p: r.p,
    market_p: marketP,
    gap_pp: edgePp(r.p, marketP),
    gap_null_reason: !ours ? "is_market" : marketP == null ? "no_market_at_seal" : null,
    is_paper: false,
    verdict,
    final_score: r.final_score,
    revision: r.revision,
    tennis_kind: kind,
    fingerprint: receiptFingerprint({ source_table: r.source_table, source_id: r.source_id, model_version: r.model_version, captured_at: r.captured_at, p_home: r.p_home, p_draw: null, p_away: r.p_away, odds: r.odds }),
  };
}

/** Pair keys of the tennis rows whose gap needs the feed price before the seal (our model only). */
export function tennisReceiptKeys(rows: TennisReceiptRow[]): string[] {
  return rows.filter((r) => isOurModel(ledgerTennisKind(r))).map(sealedTennisKey).filter((k): k is string => k != null);
}

/** Newest seal first (the column the page leads with); ties by id, so a page is stable. */
export function mergeReceipts(a: V3Receipt[], b: V3Receipt[]): V3Receipt[] {
  return [...a, ...b].sort((x, y) => Date.parse(y.sealed_at) - Date.parse(x.sealed_at) || x.source_id.localeCompare(y.source_id));
}

// ─── corrections ────────────────────────────────────────────────────────────

export type CorrectionRow = {
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
  reason: string | null;
};

/**
 * The stored reasons are internal codes (Italian, with the ticket). Measured on
 * prod 06/10: «recupero:CALCIO-1001 fonte=<src>[ prova=…]», «nessuna pick
 * mostrata: il mastro dichiarava won|lost (#SETTLE-0909)», «backfill:RISULTATI-PARTNER-1001».
 * Anything else is «other» and the page shows the raw text.
 */
export function classifyCorrection(raw: string | null): { cause: V3CorrectionCause; source: string | null; new_date: string | null } {
  const s = (raw ?? "").trim();
  const source = /fonte=(\S+)/.exec(s)?.[1] ?? null;
  const proof = /prova=(\S+)/.exec(s)?.[1] ?? "";
  if (/^recupero:/i.test(s)) {
    const postponed = /rinviata/i.test(proof) || /POSTPONED/i.test(proof);
    const date = /(\d{4}-\d{2}-\d{2})/.exec(proof)?.[1] ?? null;
    return { cause: postponed ? "postponed" : "late_result", source, new_date: postponed ? date : null };
  }
  if (/^nessuna pick mostrata/i.test(s)) return { cause: "no_pick_shown", source: null, new_date: null };
  if (/^backfill:/i.test(s)) return { cause: "late_fill", source: null, new_date: null };
  return { cause: "other", source, new_date: null };
}

export function correctionOf(r: CorrectionRow): V3Correction {
  const c = classifyCorrection(r.reason);
  return {
    sport: r.sport,
    home: r.home,
    away: r.away,
    kickoff: r.kickoff,
    revision: r.revision,
    corrected_at: r.corrected_at,
    before: r.before,
    after: r.after,
    before_score: r.before_score,
    after_score: r.after_score,
    ...c,
    reason_raw: r.reason ?? "",
  };
}

export function summarizeCorrections(all: { reason: string | null }[], latest: CorrectionRow[]): V3CorrectionsSummary {
  const by_cause: Record<V3CorrectionCause, number> = { late_result: 0, postponed: 0, no_pick_shown: 0, late_fill: 0, other: 0 };
  for (const r of all) by_cause[classifyCorrection(r.reason).cause] += 1;
  return { total: all.length, by_cause, latest: latest.map(correctionOf) };
}

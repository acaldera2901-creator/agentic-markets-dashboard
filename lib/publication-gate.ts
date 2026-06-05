// ─── Safe Publication Gate v1 ─────────────────────────────────────────────────
//
// Single quality gate between internal model candidates and the public
// unified_predictions table (AM-CODE-REVIEW-001, critical issues #5/#6).
//
// Semantics — aligned with the reveal-board product model (the board must stay
// populated; honesty lives in the labels):
//   REJECT      → the row never reaches unified_predictions
//   FORCE PAPER → the row is published, but always as an honest model estimate
//                 (signal_type='paper', is_paper=true), never as a market signal
//   SIGNAL      → only for fresh, future events with real odds, a real computed
//                 edge and an explicit pick — and never for World Cup rows while
//                 the WC readiness status is monitor_only.

export type GateCandidate = {
  startsAt: string | null;
  pick: string | null;
  odds: number | null;
  edge: number | null;
  isWorldCup: boolean;
};

export type GateContext = {
  worldCupSignalReady: boolean;
  now?: Date;
};

export type GateVerdict =
  | { publish: false; reason: RejectReason }
  | { publish: true; signalType: "signal" | "paper"; isPaper: boolean; reasons: PaperReason[] };

export type RejectReason = "missing_start_time" | "invalid_start_time" | "stale_event";
export type PaperReason = "no_market_odds" | "no_computed_edge" | "missing_pick" | "wc_monitor_only";

// A row whose event started more than this long ago is stale: it must never be
// (re)published, even as paper.
const STALE_AFTER_MS = 3 * 3_600_000;

export function gateCandidate(candidate: GateCandidate, ctx: GateContext): GateVerdict {
  const now = ctx.now ?? new Date();

  if (candidate.startsAt == null) return { publish: false, reason: "missing_start_time" };
  const startMs = new Date(candidate.startsAt).getTime();
  if (Number.isNaN(startMs)) return { publish: false, reason: "invalid_start_time" };
  if (startMs < now.getTime() - STALE_AFTER_MS) return { publish: false, reason: "stale_event" };

  const reasons: PaperReason[] = [];
  if (candidate.odds == null) reasons.push("no_market_odds");
  if (candidate.edge == null) reasons.push("no_computed_edge");
  if (candidate.pick == null) reasons.push("missing_pick");
  if (candidate.isWorldCup && !ctx.worldCupSignalReady) reasons.push("wc_monitor_only");

  if (reasons.length > 0) {
    return { publish: true, signalType: "paper", isPaper: true, reasons };
  }
  return { publish: true, signalType: "signal", isPaper: false, reasons: [] };
}

// ─── Sync report (returned by the unified/tennis sync functions) ──────────────

export type SyncReport = {
  synced: number;
  as_signal: number;
  as_paper: number;
  rejected: number;
  paper_reasons: Record<string, number>;
  rejected_reasons: Record<string, number>;
};

export function emptySyncReport(): SyncReport {
  return { synced: 0, as_signal: 0, as_paper: 0, rejected: 0, paper_reasons: {}, rejected_reasons: {} };
}

export function recordVerdict(report: SyncReport, verdict: GateVerdict): void {
  if (!verdict.publish) {
    report.rejected += 1;
    report.rejected_reasons[verdict.reason] = (report.rejected_reasons[verdict.reason] ?? 0) + 1;
    return;
  }
  report.synced += 1;
  if (verdict.isPaper) {
    report.as_paper += 1;
    for (const reason of verdict.reasons) {
      report.paper_reasons[reason] = (report.paper_reasons[reason] ?? 0) + 1;
    }
  } else {
    report.as_signal += 1;
  }
}

// lib/v3c/record-data.server.ts (#REDESIGN-V3C F6)
// The record page's data, server-side: the SAME builders as GET /api/v3/record
// and /api/v3/calibration (one read of the sealed ledger feeds both), plus the
// receipts and the settlement corrections. Read-only. `cache()` dedupes inside
// one request: the fascia, the summary and the charts read one payload.
import { cache } from "react";
import { buildCalibration } from "./calibration";
import type { V3CalibrationResponse, V3CorrectionsSummary, V3Receipt, V3RecordResponse } from "./contracts";
import { fetchCorrections, fetchFootballReceipts, fetchPartnerHistoryByKeys, fetchSealedFootball, fetchSealedTennis, fetchTennisReceipts } from "./queries";
import { RECEIPTS_PAGE, footballReceipt, mergeReceipts, summarizeCorrections, tennisReceipt, tennisReceiptKeys } from "./receipts";
import { buildRecord, scoredRows } from "./record";
import { isOurModel, ledgerTennisKind, sealedTennisKey } from "./tennis";
import type { ReceiptSport } from "./record-view";

export type { ReceiptSport };
export const CORRECTIONS_SHOWN = 12;

export type RecordSummary = {
  record: V3RecordResponse;
  calibration: V3CalibrationResponse;
  /** kick-off of the most recent scored football row: the end of the period */
  last_scored_kickoff: string | null;
};
export type RecordSummaryResult = { ok: true; data: RecordSummary } | { ok: false };

export const getRecordSummary = cache(async (): Promise<RecordSummaryResult> => {
  try {
    const now = new Date();
    const [football, tennis] = await Promise.all([fetchSealedFootball(), fetchSealedTennis()]);
    const keys = tennis.filter((r) => isOurModel(ledgerTennisKind(r))).map(sealedTennisKey).filter((k): k is string => k != null);
    const history = await fetchPartnerHistoryByKeys(keys);
    const last = scoredRows(football).reduce<number>((mx, r) => Math.max(mx, Date.parse(r.kickoff) || 0), 0);
    return {
      ok: true,
      data: {
        record: buildRecord(football, now, tennis, history),
        calibration: buildCalibration(football, tennis, now),
        last_scored_kickoff: last ? new Date(last).toISOString() : null,
      },
    };
  } catch (e) {
    console.error("[v3c/record page]", String(e));
    return { ok: false };
  }
});

export type ReceiptsPage = { sport: ReceiptSport; page: number; rows: V3Receipt[]; hasMore: boolean };
export type ReceiptsResult = { ok: true; data: ReceiptsPage } | { ok: false };

export const getReceipts = cache(async (sport: ReceiptSport, page: number): Promise<ReceiptsResult> => {
  try {
    const offset = page * RECEIPTS_PAGE;
    // «all» merges two ordered lists: each side must deliver up to offset + page + 1 rows
    const take = sport === "all" ? offset + RECEIPTS_PAGE + 1 : RECEIPTS_PAGE + 1;
    const skip = sport === "all" ? 0 : offset;
    const [fb, tn] = await Promise.all([
      sport === "tennis" ? Promise.resolve([]) : fetchFootballReceipts(take, skip),
      sport === "football" ? Promise.resolve([]) : fetchTennisReceipts(take, skip),
    ]);
    const history = await fetchPartnerHistoryByKeys(tennisReceiptKeys(tn));
    const merged = mergeReceipts(
      fb.map(footballReceipt),
      tn.map((r) => tennisReceipt(r, history.get(sealedTennisKey(r) ?? "") ?? [])),
    );
    const window = sport === "all" ? merged.slice(offset, offset + RECEIPTS_PAGE + 1) : merged;
    return { ok: true, data: { sport, page, rows: window.slice(0, RECEIPTS_PAGE), hasMore: window.length > RECEIPTS_PAGE } };
  } catch (e) {
    console.error("[v3c/record receipts]", String(e));
    return { ok: false };
  }
});

export type CorrectionsResult = { ok: true; data: V3CorrectionsSummary } | { ok: false };

export const getCorrections = cache(async (): Promise<CorrectionsResult> => {
  try {
    const { all, latest } = await fetchCorrections(CORRECTIONS_SHOWN);
    return { ok: true, data: summarizeCorrections(all, latest) };
  } catch (e) {
    console.error("[v3c/record corrections]", String(e));
    return { ok: false };
  }
});

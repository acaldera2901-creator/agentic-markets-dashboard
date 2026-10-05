// /api/v3/calibration — reliability by 10pp bucket, football and tennis, from
// the sealed ledger only. Football uses the same scored population as
// /api/v3/record, so the two endpoints cannot disagree.
import { LIMITED_SAMPLE_N, type V3CalibrationResponse, type V3TennisCalibration } from "./contracts";
import { estimateReliability, marketReliability, scoredRows, type SealedFootballRow } from "./record";
import { reliability } from "./scoring";

/** A sealed tennis pick: `p` is the sealed probability of the picked player. */
export type SealedTennisRow = { model_version: string; p: number; result: string };

/**
 * Tennis is declared «sufficient» only if at least this many buckets have
 * n >= LIMITED_SAMPLE_N for some model. Below that the buckets are still
 * returned (with their n) but the UI must say the sample is too small.
 */
export const TENNIS_MIN_SOLID_BUCKETS = 3;

const TENNIS_LABELS: Record<string, string> = {
  "partner-market-v1": "Market-anchored (partner price)",
  elo_surface_v4_features_odds: "Elo surface model v4",
};

export function tennisCalibration(rows: SealedTennisRow[]): V3CalibrationResponse["tennis"] {
  const byModel = new Map<string, { p: number; hit: boolean }[]>();
  for (const r of rows) {
    if (r.result !== "won" && r.result !== "lost") continue;
    if (!Number.isFinite(r.p)) continue;
    const list = byModel.get(r.model_version) ?? [];
    list.push({ p: r.p, hit: r.result === "won" });
    byModel.set(r.model_version, list);
  }
  const models: V3TennisCalibration[] = [...byModel.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([model_version, pairs]) => ({
      model_version,
      label: TENNIS_LABELS[model_version] ?? model_version,
      n: pairs.length,
      buckets: reliability(pairs),
    }));
  const solid = (m: V3TennisCalibration) =>
    m.buckets.filter((b) => b.n >= LIMITED_SAMPLE_N).length;
  const best = models.reduce((mx, m) => Math.max(mx, solid(m)), 0);
  const sufficient = best >= TENNIS_MIN_SOLID_BUCKETS;
  return {
    status: sufficient ? "sufficient" : "insufficient",
    reason: sufficient
      ? `At least ${TENNIS_MIN_SOLID_BUCKETS} buckets with n >= ${LIMITED_SAMPLE_N} for one model; buckets below that are flagged limited_sample.`
      : `No tennis model has ${TENNIS_MIN_SOLID_BUCKETS} buckets with n >= ${LIMITED_SAMPLE_N}: the sample is too small to show a calibration curve.`,
    models,
  };
}

export function buildCalibration(
  football: SealedFootballRow[],
  tennis: SealedTennisRow[],
  now: Date = new Date(),
): V3CalibrationResponse {
  const scored = scoredRows(football);
  const paired = scored.filter((s) => s.market);
  return {
    contract: "v3.calibration.1",
    generated_at: now.toISOString(),
    football: {
      n_matches: scored.length,
      n_pairs: scored.length * 3,
      estimate: estimateReliability(scored),
      market: marketReliability(scored),
      n_matches_paired: paired.length,
    },
    tennis: tennisCalibration(tennis),
    notes: [
      "Football: each scored match contributes three (probability, happened) pairs, one per 1X2 outcome.",
      "Intervals are Wilson 95% on the observed frequency; buckets with n < 30 carry limited_sample.",
      "Tennis: binary (picked player won), probability = sealed probability of the picked player, non-backfill rows only.",
      "Calibration means the stated percentages match observed frequencies; it is not a claim of beating the market.",
    ],
  };
}

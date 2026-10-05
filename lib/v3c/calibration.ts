// /api/v3/calibration — reliability by 10pp bucket, football and tennis, from
// the sealed ledger only. Football uses the same scored population as
// /api/v3/record, so the two endpoints cannot disagree.
import { LIMITED_SAMPLE_N, type V3CalibrationResponse, type V3TennisCalibration } from "./contracts";
import { estimateReliability, marketReliability, scoredRows, type SealedFootballRow } from "./record";
import { reliability } from "./scoring";
import { TENNIS_KIND_LABELS, groupSealedTennis, isOurModel, isScoredTennis, type SealedTennisRow } from "./tennis";

/**
 * Tennis is declared «sufficient» only if at least this many buckets have
 * n >= LIMITED_SAMPLE_N for one of OUR model groups. Below that the buckets are
 * still returned (with their n) but the UI must say the sample is too small.
 * Market groups (is_our_model false) are returned for reference and never count.
 */
export const TENNIS_MIN_SOLID_BUCKETS = 3;

export function tennisCalibration(rows: SealedTennisRow[]): V3CalibrationResponse["tennis"] {
  const models: V3TennisCalibration[] = [...groupSealedTennis(rows).values()].map(({ key, rows: list }) => {
    const pairs = list.filter(isScoredTennis).map((r) => ({ p: r.p, hit: r.result === "won" }));
    return {
      model_version: key.model_version,
      kind: key.kind,
      label: TENNIS_KIND_LABELS[key.kind],
      is_our_model: isOurModel(key.kind),
      n: pairs.length,
      limited_sample: pairs.length < LIMITED_SAMPLE_N,
      buckets: reliability(pairs),
    };
  });
  const solid = (m: V3TennisCalibration) => m.buckets.filter((b) => b.n >= LIMITED_SAMPLE_N).length;
  const best = models.filter((m) => m.is_our_model).reduce((mx, m) => Math.max(mx, solid(m)), 0);
  const sufficient = best >= TENNIS_MIN_SOLID_BUCKETS;
  return {
    status: sufficient ? "sufficient" : "insufficient",
    reason: sufficient
      ? `At least ${TENNIS_MIN_SOLID_BUCKETS} buckets with n >= ${LIMITED_SAMPLE_N} for one of our model groups; buckets below that are flagged limited_sample. Market groups do not count.`
      : `None of our tennis model groups has ${TENNIS_MIN_SOLID_BUCKETS} buckets with n >= ${LIMITED_SAMPLE_N}: the sample is too small to show a calibration curve. Market groups do not count.`,
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
    contract: "v3.calibration.2",
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
      "Tennis: binary (picked player won), probability = sealed probability of the picked player (whole %), non-backfill rows only, grouped by what that probability is (kind): our Elo or the market price. Only our model groups decide status.",
      "Calibration means the stated percentages match observed frequencies; it is not a claim of beating the market.",
    ],
  };
}

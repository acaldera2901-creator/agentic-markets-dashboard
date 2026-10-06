import { applyTennisTemperature, TENNIS_ANCHORED_TAU } from "./tennis-calibration";
import { PARTNER_MARKET_MODEL } from "./partner-market";

export type TennisProbabilitySource = "model" | "market" | "unknown";
export type TennisPair = { p1: number; p2: number };
export type TennisProbabilityInput = {
  p1?: number | null;
  p2?: number | null;
  odds_p1?: number | null;
  odds_p2?: number | null;
  best_selection?: string | null;
  edge?: number | null;
  feature_snapshot?: unknown;
  model_version?: string | null;
};

export function validTennisPair(p1: unknown, p2: unknown): boolean {
  return typeof p1 === "number" && typeof p2 === "number"
    && Number.isFinite(p1) && Number.isFinite(p2)
    && p1 >= 0 && p1 <= 1 && p2 >= 0 && p2 <= 1
    && Math.abs(p1 + p2 - 1) <= 0.00011;
}

export function validTennisOdds(odds: unknown): odds is number {
  return typeof odds === "number" && Number.isFinite(odds) && odds > 1;
}

/** The unified odds column is NUMERIC(8,2); use the same usable price everywhere. */
export function publishedTennisOdds(odds: unknown): number | null {
  const rounded = validTennisOdds(odds) ? Math.round(odds * 100) / 100 : null;
  return validTennisOdds(rounded) ? rounded : null;
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

/** One transform at the serving boundary. No provenance is inferred from odds/edge.
 * Metadata must match the input pair: passing published values back in cannot
 * apply temperature a second time. Untagged historical pairs stay unchanged.
 */
export function resolveTennisProbability(input: TennisProbabilityInput) {
  const raw: TennisPair | null = validTennisPair(input.p1, input.p2)
    ? { p1: input.p1!, p2: input.p2! } : null;
  const metadata = object(object(input.feature_snapshot)?.probability);
  let source: TennisProbabilitySource = "unknown";
  if (raw && metadata?.version === "tennis-probability-v1"
      && metadata.raw_p1 === raw.p1 && metadata.raw_p2 === raw.p2) {
    if (metadata.source === "model") source = "model";
    if (metadata.source === "market" && validTennisOdds(input.odds_p1) && validTennisOdds(input.odds_p2)) source = "market";
  }
  // #TENNIS-PROB-PARTNER-1006: il feed partner non scrive feature_snapshot.probability
  // (836 righe su 954 dal 02/10), ma la sua provenienza e' gia' fissata dal writer:
  // partner-market-v1 = mercato devigato per costruzione. Non e' dedotta da quote/edge.
  // Senza questo ramo l'88% del tennis perdeva la temperatura che main gli applica.
  if (source === "unknown" && raw && input.model_version === PARTNER_MARKET_MODEL
      && validTennisOdds(input.odds_p1) && validTennisOdds(input.odds_p2)) source = "market";
  const calibrated = source === "market" && TENNIS_ANCHORED_TAU !== 1
    && Number.isFinite(TENNIS_ANCHORED_TAU) && TENNIS_ANCHORED_TAU > 0;
  const published = raw && (calibrated
    ? { p1: applyTennisTemperature(raw.p1 / (raw.p1 + raw.p2), TENNIS_ANCHORED_TAU),
        p2: applyTennisTemperature(raw.p2 / (raw.p1 + raw.p2), TENNIS_ANCHORED_TAU) }
    : { ...raw });
  const selection = raw
    ? (input.best_selection === "P1" || input.best_selection === "P2" ? input.best_selection : raw.p1 >= raw.p2 ? "P1" : "P2")
    : null;
  const selectedRawProbability = raw && selection ? raw[selection === "P1" ? "p1" : "p2"] : null;
  const selectedProbability = published && selection ? published[selection === "P1" ? "p1" : "p2"] : null;
  const odds = selection === "P1" ? input.odds_p1 : selection === "P2" ? input.odds_p2 : null;
  return {
    raw, published, source, selection, selectedRawProbability, selectedProbability,
    calibrationVersion: calibrated ? `tennis-temperature-${TENNIS_ANCHORED_TAU}-v1` : "identity-v1",
    confidence: selectedProbability === null ? null : Math.round(selectedProbability * 100),
    selectedOdds: publishedTennisOdds(odds),
  };
}

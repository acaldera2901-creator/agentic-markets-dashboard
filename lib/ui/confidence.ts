export type ConfidenceBucket = "alta" | "media" | "bassa";

// Normalizza a intero 0–100. Difensivo: valori ≤1 (esclusa 0) trattati come
// frazione; il resto come scala 0–100. Scala reale da confermare in SP1.
// Scorciatoia marcata: se la scala risulta diversa, si aggiorna solo qui,
// i consumer non cambiano.
export function confidencePercent(score: number | null): number {
  if (score == null || Number.isNaN(score)) return 0;
  const pct = score > 0 && score <= 1 ? score * 100 : score;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

export function confidenceBucket(score: number | null): ConfidenceBucket {
  const p = confidencePercent(score);
  if (p >= 70) return "alta";
  if (p >= 50) return "media";
  return "bassa";
}

export function confidenceLabel(bucket: ConfidenceBucket): string {
  return { alta: "Alta", media: "Media", bassa: "Bassa" }[bucket];
}

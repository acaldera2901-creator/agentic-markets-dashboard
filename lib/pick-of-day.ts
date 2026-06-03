// Deterministic daily Pick of the Day: the single highest-confidence upcoming
// prediction. Stable within a UTC day given the same row set. Returns the chosen
// row id (or null). Ties broken by earliest starts_at then id, so it never flickers.
export function pickOfDayId(
  rows: Array<{ id: string; confidence_score?: number | null; starts_at?: string | null }>
): string | null {
  let best: { id: string; c: number; t: string } | null = null;
  for (const r of rows) {
    const c = r.confidence_score ?? -1;
    const t = r.starts_at ?? "9999";
    if (!best || c > best.c || (c === best.c && (t < best.t || (t === best.t && r.id < best.id)))) {
      best = { id: r.id, c, t };
    }
  }
  return best ? best.id : null;
}

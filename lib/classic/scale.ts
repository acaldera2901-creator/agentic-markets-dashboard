// lib/classic/scale.ts — #CLASSIC-CARD-1008: portato VERBATIM da betredge/v3c-fixq:lib/v3c/scale.ts (0909e2eb).
// Solo funzioni pure; il copy v3c resta fuori.
// Il nastro mercato–stima: due punti su UNA scala comune, con la finestra
// dichiarata (es. 30–60%) ed etichette dirette sui punti. Sostituisce il
// «Price Temp» di v2. Tutto in punti percentuali (pp): la differenza fra due
// probabilità, mai fra due quote (lessico «gap», aperto per Andrea in v3b).

export const FLAT_PP = 1.5; // sotto |gap| < 1.5 pp la riga dice «in linea»

export type ScaleWindow = { lo: number; hi: number; ticks: number[] };

/**
 * La finestra: dai due valori, ±pad, arrotondata al passo, dentro 0–100.
 * Mai più stretta di due passi, così i due punti non si toccano.
 */
export function scaleWindow(market: number, estimate: number, pad = 10, step = 5): ScaleWindow {
  const min = Math.min(market, estimate);
  const max = Math.max(market, estimate);
  let lo = Math.max(0, Math.floor((min - pad) / step) * step);
  let hi = Math.min(100, Math.ceil((max + pad) / step) * step);
  if (hi - lo < step * 2) {
    hi = Math.min(100, lo + step * 2);
    lo = Math.max(0, hi - step * 2);
  }
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += step) ticks.push(v);
  return { lo, hi, ticks };
}

/** Posizione di un valore nella finestra, 0–100 (percentuale CSS). */
export function positionIn(value: number, w: ScaleWindow): number {
  if (w.hi === w.lo) return 0;
  const p = ((value - w.lo) / (w.hi - w.lo)) * 100;
  return Math.min(100, Math.max(0, p));
}

/** Gap = stima − mercato, in punti. */
export function gapPp(market: number, estimate: number): number {
  return estimate - market;
}

export function isFlat(gap: number): boolean {
  return Math.abs(gap) < FLAT_PP;
}

/**
 * Segno sempre scritto, con il MENO tipografico (U+2212) e «±» per lo zero.
 * `digits` undefined → intero se intero, altrimenti un decimale.
 * Il segno si decide DOPO l'arrotondamento: −0,04 a un decimale è «±0.0», mai
 * «−0.0» (né «+0.0»). Unica utility per i numeri con segno di v3c: board,
 * partita, price check, tool, OG.
 */
export function formatSigned(value: number, digits?: number): string {
  const a = Math.abs(value);
  const body = digits != null ? a.toFixed(digits) : Number.isInteger(a) ? String(a) : a.toFixed(1);
  const sign = Number(body) === 0 ? "±" : value > 0 ? "+" : "−";
  return sign + body;
}

export function describeScale(market: number, estimate: number): string {
  const w = scaleWindow(market, estimate);
  const g = gapPp(market, estimate);
  return `Market ${market} percent, estimate ${estimate} percent, gap ${formatSigned(g)} points. Scale ${w.lo} to ${w.hi} percent.`;
}

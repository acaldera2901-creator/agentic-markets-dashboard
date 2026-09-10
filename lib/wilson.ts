/**
 * Intervallo di Wilson al 95% per una proporzione (#SETTLE-0909 D2).
 *
 * Perché non l'intervallo normale (p ± z·√(p(1-p)/n)): su campioni piccoli o
 * con p vicino a 0 o 1 quello produce estremi fuori da [0,1] — un track record
 * che dichiara «accuratezza fra il 92% e il 104%» non è un errore di stile, è
 * un numero che squalifica chi lo pubblica. Wilson resta sempre dentro [0,1] e
 * si comporta bene anche con pochi eventi.
 *
 * Serve a dire accanto alla percentuale QUANTO è solida: 3 su 4 e 750 su 1000
 * sono entrambi «75%», ma solo uno dei due significa qualcosa.
 */
const Z95 = 1.959964; // quantile normale bilaterale al 95%

export type WilsonInterval = {
  /** proporzione osservata, 0..1 */
  p: number;
  /** estremo inferiore, 0..1 */
  low: number;
  /** estremo superiore, 0..1 */
  high: number;
  /** dimensione del campione */
  n: number;
};

export function wilson95(successes: number, total: number): WilsonInterval | null {
  if (!Number.isFinite(successes) || !Number.isFinite(total)) return null;
  if (total <= 0 || successes < 0 || successes > total) return null;

  const n = total;
  const p = successes / n;
  const z2 = Z95 * Z95;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const margin =
    (Z95 / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));

  return {
    p,
    n,
    low: Math.max(0, centre - margin),
    high: Math.min(1, centre + margin),
  };
}

/** "65.2% (62.8–67.5%)" — la forma in cui va pubblicato, mai la percentuale nuda. */
export function formatWilson(w: WilsonInterval | null): string | null {
  if (!w) return null;
  const pc = (x: number) => (x * 100).toFixed(1);
  return `${pc(w.p)}% (${pc(w.low)}–${pc(w.high)}%)`;
}

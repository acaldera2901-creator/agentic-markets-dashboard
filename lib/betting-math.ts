// lib/betting-math.ts (#TOOLS-HUB-0805)
// Matematica delle quote per i tool gratuiti di /tools. Funzioni PURE: nessun
// import, nessuno stato, nessuna dipendenza dalla UI — così sono testabili da
// sole e i cinque calcolatori non hanno logica propria da sbagliare.
//
// Due regole che valgono in tutto il file:
//   1. Nessun arrotondamento intermedio. Si arrotonda SOLO in formatOdds().
//   2. Input non valido → null. Mai NaN restituito, mai eccezioni verso la UI:
//      un readout vuoto è un'informazione, "NaN%" è un bug in faccia all'utente.

export type OddsFormat =
  | "decimal"
  | "american"
  | "fractional"
  | "hongkong"
  | "malay"
  | "indonesian";

export const ODDS_FORMATS: OddsFormat[] = [
  "decimal",
  "american",
  "fractional",
  "hongkong",
  "malay",
  "indonesian",
];

/** Una quota decimale valida paga qualcosa: deve essere > 1. */
function isOdds(decimal: number): boolean {
  return Number.isFinite(decimal) && decimal > 1;
}

/** Numero scritto da un umano: virgola europea ammessa, testo no. */
function toNumber(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (!/^[+-]?\d*\.?\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ─────────────────────────────── formati ────────────────────────────────

/** Legge una quota in qualunque formato e la porta a decimale. */
export function parseOdds(input: string, format: OddsFormat): number | null {
  if (typeof input !== "string") return null;

  if (format === "fractional") {
    const m = input.trim().match(/^(\d+(?:[.,]\d+)?)(?:\/(\d+(?:[.,]\d+)?))?$/);
    if (!m) return null;
    const num = toNumber(m[1]);
    const den = m[2] === undefined ? 1 : toNumber(m[2]);
    if (num === null || den === null || num <= 0 || den <= 0) return null;
    return 1 + num / den;
  }

  const n = toNumber(input);
  if (n === null) return null;

  switch (format) {
    case "decimal":
      return isOdds(n) ? n : null;

    case "american":
      // Fra -100 e +100 (esclusi) non esiste nessuna quota americana.
      if (n >= 100) return 1 + n / 100;
      if (n <= -100) return 1 + 100 / Math.abs(n);
      return null;

    case "hongkong":
      // Payout netto per unità: 0.90 → 1.90.
      return n > 0 ? 1 + n : null;

    case "indonesian":
      // Positiva = quanto vinci per 1 puntato; negativa = quanto devi puntare per 1.
      if (n >= 1) return 1 + n;
      if (n <= -1) return 1 + 1 / Math.abs(n);
      return null;

    case "malay":
      // Speculare all'indonesiana: |m| ≤ 1, positiva sotto la 2.00.
      if (n > 0 && n <= 1) return 1 + n;
      if (n < 0 && n >= -1) return 1 + 1 / Math.abs(n);
      return null;
  }
}

/**
 * Frazione più semplice che approssima x (frazioni continue, denominatore ≤ 1000).
 * Serve al formato frazionario: 0.909090… → 10/11, non 909090/1000000.
 */
function toFraction(x: number, maxDenominator = 1000): [number, number] {
  let h0 = 0;
  let h1 = 1;
  let k0 = 1;
  let k1 = 0;
  let b = x;
  for (let i = 0; i < 32; i++) {
    const a = Math.floor(b);
    const h2 = a * h1 + h0;
    const k2 = a * k1 + k0;
    if (k2 > maxDenominator) break;
    h0 = h1;
    h1 = h2;
    k0 = k1;
    k1 = k2;
    if (b === a || Math.abs(x - h1 / k1) < 1e-10) break;
    b = 1 / (b - a);
  }
  return [h1, k1 || 1];
}

/** Scrive una quota decimale nel formato richiesto. Quota invalida → "—". */
export function formatOdds(decimal: number, format: OddsFormat): string {
  if (!isOdds(decimal)) return "—";
  const net = decimal - 1;

  switch (format) {
    case "decimal":
      return decimal.toFixed(2);

    case "american":
      return decimal >= 2
        ? `+${Math.round(net * 100)}`
        : `-${Math.round(100 / net)}`;

    case "fractional": {
      const [num, den] = toFraction(net);
      return `${num}/${den}`;
    }

    case "hongkong":
      return net.toFixed(2);

    case "indonesian":
      return decimal >= 2 ? `+${net.toFixed(2)}` : `-${(1 / net).toFixed(2)}`;

    case "malay":
      return decimal <= 2 ? net.toFixed(2) : `-${(1 / net).toFixed(2)}`;
  }
}

// ────────────────────────────── probabilità ─────────────────────────────

/** Probabilità implicita nella quota (comprende ancora il margine del book). */
export function impliedProbability(decimal: number): number | null {
  return isOdds(decimal) ? 1 / decimal : null;
}

/** Quota equa corrispondente a una probabilità. */
export function probabilityToDecimal(probability: number): number | null {
  if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) return null;
  return 1 / probability;
}

// ─────────────────────────── margine e no-vig ───────────────────────────

/** Tutte le quote di un mercato con almeno due esiti. */
function isMarket(decimals: number[]): boolean {
  return Array.isArray(decimals) && decimals.length >= 2 && decimals.every(isOdds);
}

function overround(decimals: number[]): number {
  return decimals.reduce((sum, d) => sum + 1 / d, 0);
}

/** Margine del bookmaker: la somma delle probabilità implicite meno 1. */
export function bookmakerMargin(decimals: number[]): number | null {
  if (!isMarket(decimals)) return null;
  return overround(decimals) - 1;
}

/** Quota di ritorno del mercato: 1 / (1 + margine). 0.95 = paga il 95%. */
export function payoutPercent(decimals: number[]): number | null {
  if (!isMarket(decimals)) return null;
  return 1 / overround(decimals);
}

/**
 * Probabilità eque, margine rimosso col metodo moltiplicativo (proporzionale):
 * ogni probabilità implicita divisa per la loro somma. È il metodo standard;
 * sottostima i favoriti estremi, e questo limite è scritto nel testo del tool.
 */
export function noVigProbabilities(decimals: number[]): number[] | null {
  if (!isMarket(decimals)) return null;
  const total = overround(decimals);
  return decimals.map((d) => 1 / d / total);
}

/** Le stesse probabilità eque, riscritte come quote. */
export function noVigOdds(decimals: number[]): number[] | null {
  const probs = noVigProbabilities(decimals);
  return probs ? probs.map((p) => 1 / p) : null;
}

// ────────────────────────────── valore atteso ───────────────────────────

/**
 * EV di una puntata: quanto rende in media, ripetuta molte volte.
 *   ev = p·(quota−1)·stake − (1−p)·stake
 * `edge` è l'EV per unità puntata (p·quota − 1), `fairDecimal` la quota a cui
 * la puntata sarebbe a somma zero.
 */
export function expectedValue(args: {
  probability: number;
  decimal: number;
  stake: number;
}): { ev: number; evPercent: number; fairDecimal: number; edge: number } | null {
  const { probability: p, decimal, stake } = args;
  if (!isOdds(decimal)) return null;
  if (!Number.isFinite(p) || p <= 0 || p >= 1) return null;
  if (!Number.isFinite(stake) || stake <= 0) return null;

  const edge = p * decimal - 1;
  return {
    ev: edge * stake,
    evPercent: edge * 100,
    fairDecimal: 1 / p,
    edge,
  };
}

// ─────────────────────────────────  Kelly ───────────────────────────────

/**
 * Criterio di Kelly: la frazione di bankroll che massimizza la crescita
 * logaritmica attesa.
 *   f* = (p·quota − 1) / (quota − 1)
 * Senza edge (f* ≤ 0) lo stake è 0 — non un numero negativo travestito da
 * consiglio. `growthRate` è la crescita attesa per scommessa, in log-unità.
 */
export function kelly(args: {
  probability: number;
  decimal: number;
  bankroll: number;
  fraction: number;
}): {
  edge: number;
  fullKelly: number;
  stakeFraction: number;
  stake: number;
  growthRate: number;
} | null {
  const { probability: p, decimal, bankroll, fraction } = args;
  if (!isOdds(decimal)) return null;
  if (!Number.isFinite(p) || p <= 0 || p >= 1) return null;
  if (!Number.isFinite(bankroll) || bankroll <= 0) return null;
  if (!Number.isFinite(fraction) || fraction <= 0 || fraction > 1) return null;

  const net = decimal - 1;
  const edge = p * decimal - 1;
  const raw = edge / net;
  const fullKelly = raw > 0 ? raw : 0;
  const stakeFraction = fullKelly * fraction;

  // p < 1 garantisce stakeFraction < 1, quindi ln(1 − f) è sempre definito.
  const growthRate =
    stakeFraction > 0
      ? p * Math.log(1 + stakeFraction * net) + (1 - p) * Math.log(1 - stakeFraction)
      : 0;

  return { edge, fullKelly, stakeFraction, stake: bankroll * stakeFraction, growthRate };
}

// ───────────────────────────────── multipla ─────────────────────────────

/** Probabilità che escano TUTTI gli eventi (indipendenti). */
export function parlayProbability(probabilities: number[]): number | null {
  if (!Array.isArray(probabilities) || probabilities.length === 0) return null;
  if (!probabilities.every((p) => Number.isFinite(p) && p > 0 && p < 1)) return null;
  return probabilities.reduce((acc, p) => acc * p, 1);
}

/** Quota combinata della multipla: il prodotto delle quote. */
export function parlayOdds(decimals: number[]): number | null {
  if (!Array.isArray(decimals) || decimals.length === 0) return null;
  if (!decimals.every(isOdds)) return null;
  return decimals.reduce((acc, d) => acc * d, 1);
}

// ──────────────────────────────── arbitraggio ───────────────────────────

/**
 * Arbitraggio su un mercato coperto interamente da quote di book diversi.
 * Σ(1/quota) < 1 ⇒ esiste una divisione degli stake che vince in ogni esito.
 * Ritorna il profitto ANCHE quando è negativo (nessun arbitraggio): dire
 * "−4,99%" è un'informazione, `null` no. `null` è riservato all'input invalido.
 */
export function arbitrage(args: {
  decimals: number[];
  total: number;
}): { impliedSum: number; profitPercent: number; stakes: number[]; returns: number[] } | null {
  const { decimals, total } = args;
  // isMarket garantisce ≥2 esiti e ogni quota finita e > 1: quindi impliedSum
  // sta in (0, n) e nessuna divisione qui sotto può produrre NaN o Infinity.
  if (!isMarket(decimals)) return null;
  if (!Number.isFinite(total) || total <= 0) return null;

  const impliedSum = overround(decimals);
  // Stake proporzionale alla probabilità implicita ⇒ ritorno identico su ogni esito.
  const stakes = decimals.map((d) => (total * (1 / d)) / impliedSum);
  const returns = stakes.map((s, i) => s * decimals[i]);

  return { impliedSum, profitPercent: 1 / impliedSum - 1, stakes, returns };
}

/** Importo scritto da un umano che PUÒ essere negativo: il profitto di un
 *  periodo in perdita è un dato, non un errore di input. `parseAmount` di
 *  parts.tsx rifiuta i negativi ed è giusto così per gli stake — qui serve
 *  l'altra semantica, e vive accanto alla matematica che la consuma. */
export function parseSignedAmount(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (!/^[+-]?\d*\.?\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ─────────────────────────── ritorno: ROI e yield ───────────────────────
// Due divisioni, lo stesso numeratore e due denominatori diversi: è tutta la
// differenza fra le due metriche, e il motivo per cui vanno lette insieme.
// Stesso 400 di profitto: su 1.000 di cassa è il 40% (ROI), su 10.000 giocati è
// il 4% (yield). Il ponte fra i due è quante volte la cassa è stata rigirata.

/** ROI: profitto sul CAPITALE impiegato (la cassa), non sul giocato.
 *  Zero profitto è 0, non `null`: "non ho guadagnato niente" è un'informazione.
 *  `null` è riservato al denominatore che non esiste. */
export function roi(args: { profit: number; capital: number }): number | null {
  const { profit, capital } = args;
  if (!Number.isFinite(profit) || !Number.isFinite(capital) || capital <= 0) return null;
  return profit / capital;
}

/** Yield: profitto sul TOTALE GIOCATO (turnover). È la metrica con cui si
 *  confrontano scommettitori diversi, perché non dipende da quanta cassa hanno. */
export function yieldPercent(args: { profit: number; turnover: number }): number | null {
  const { profit, turnover } = args;
  if (!Number.isFinite(profit) || !Number.isFinite(turnover) || turnover <= 0) return null;
  return profit / turnover;
}

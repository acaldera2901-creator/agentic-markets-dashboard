// lib/v3c/sample.ts (#REDESIGN-V3C F1)
// L'UNICA utility dei dati d'esempio del design system v3c. Tutto ciò che
// esce da qui è SAMPLE: nomi di book inventati, href="#", nessun codice
// affiliato, colori club «da verificare». Gli stessi numeri del prototipo
// (Genoa 2.15 → 44% / 48% / +4 pp) così la pagina di prova parla la lingua
// della board. Chi la importa marca a schermo ciò che mostra come SAMPLE.
import { TOOL_SLUGS, type ToolSlug } from "@/lib/tools/registry";
import { bookmakerMargin, expectedValue, kelly, noVigProbabilities } from "@/lib/betting-math";
import type { TeamIdentity } from "./monogram";

export const SAMPLE = "SAMPLE" as const;

export const SAMPLE_TEAMS = {
  gen: { name: "Genoa", code: "GEN", colours: ["#A31E25", "#0F2140"], coloursVerified: false },
  fio: { name: "Fiorentina", code: "FIO", colours: ["#5B2C86", "#FFFFFF"], coloursVerified: false },
  ray: { name: "Rayo Vallecano", code: "RAY", colours: ["#FFFFFF", "#E63329"], coloursVerified: false },
  ath: { name: "Athletic Club", code: "ATH", colours: ["#EE2523", "#FFFFFF"], coloursVerified: false },
  alc: { name: "Carlos Alcaraz", code: "CA", nation: "ESP" },
  run: { name: "Holger Rune", code: "HR", nation: "DEN" },
  sin: { name: "Jannik Sinner", code: "JS", nation: "ITA" },
} as const satisfies Record<string, TeamIdentity>;

export type SampleBook = { code: string; name: string; colour: string; feed: boolean };
/** Book SAMPLE: nomi inventati. Solo chi ha `feed` mostra una quota. */
export const SAMPLE_BOOKS: readonly SampleBook[] = [
  { code: "NB", name: "NorthBet", colour: "#0B4FA8", feed: true },
  { code: "PM", name: "Playmaker", colour: "#C8102E", feed: true },
  { code: "KO", name: "Kickoff", colour: "#5B2A86", feed: true },
  { code: "TR", name: "Tribune", colour: "#0B7A3B", feed: false },
];

export type SampleOutcome = {
  key: string;
  label: string;
  price: number;
  market: number; // % mercato, margine rimosso
  estimate: number; // % stima
  prices: Record<string, number>; // per book connesso
};

export const SAMPLE_MATCH = {
  id: "genoa-fiorentina",
  league: "Serie A · Matchday 7",
  date: "Saturday 10 October",
  time: "15:00",
  venue: "Stadio Ferraris",
  home: SAMPLE_TEAMS.gen,
  away: SAMPLE_TEAMS.fio,
  sealedAt: "2026-10-10T09:02:00Z",
  hash: "a91f3c7e0b2d44c3d1e9f0a7b6c5d4e3",
  pricesAsOf: "11:40 UTC",
  outcomes: [
    { key: "home", label: "Genoa", price: 2.15, market: 44, estimate: 48, prices: { NB: 2.15, PM: 2.1, KO: 2.05 } },
    { key: "draw", label: "Draw", price: 3.2, market: 29, estimate: 28, prices: { NB: 3.15, PM: 3.2, KO: 3.1 } },
    { key: "away", label: "Fiorentina", price: 3.5, market: 27, estimate: 24, prices: { NB: 3.4, PM: 3.45, KO: 3.55 } },
  ] as readonly SampleOutcome[],
} as const;

export const SAMPLE_TENNIS = {
  id: "alcaraz-rune",
  league: "ATP Shanghai · SF",
  home: SAMPLE_TEAMS.alc,
  away: SAMPLE_TEAMS.run,
  outcomes: [
    { key: "home", label: "Alcaraz", price: 1.4, market: 70, estimate: 67, prices: { NB: 1.4, PM: 1.38, KO: 1.39 } },
    { key: "away", label: "Rune", price: 3.0, market: 30, estimate: 33, prices: { NB: 2.95, PM: 3.0, KO: 2.98 } },
  ] as readonly SampleOutcome[],
} as const;

/** La forma minima di un esito per gli esempi del banco: la board vera (F3) la soddisfa con i suoi numeri. */
export type LeadShape = { price: number; market: number; estimate: number };

/** L'esito con il gap più largo: la riga della board lo mostra per primo. */
export function leadOutcome<T extends LeadShape>(outcomes: readonly T[]): T {
  return outcomes.reduce((best, o) => (Math.abs(o.estimate - o.market) > Math.abs(best.estimate - best.market) ? o : best));
}

/** Il book connesso con il prezzo più alto per questo esito. */
export function bestBook(o: SampleOutcome): SampleBook {
  const connected = SAMPLE_BOOKS.filter((b) => b.feed && o.prices[b.code] != null);
  return connected.reduce((best, b) => (o.prices[b.code] > o.prices[best.code] ? b : best));
}

// ── Tool: gli 11 slug del registry, con la sigla del monogramma ─────────────

export type SampleTool = {
  slug: ToolSlug;
  sigla: string; // la formula sul cartellino, non un'icona
  name: string;
  line: string; // la riga d'uso
};

export const SAMPLE_TOOLS: readonly SampleTool[] = [
  { slug: "odds-converter", sigla: "1÷p", name: "Odds converter", line: "decimal, fractional, American and implied %" },
  { slug: "probability-calculator", sigla: "p%", name: "Probability calculator", line: "three prices to probabilities, margin removed" },
  { slug: "margin-calculator", sigla: "Σ%", name: "Margin calculator", line: "how much the book keeps on a market" },
  { slug: "arbitrage-calculator", sigla: "ARB", name: "Arbitrage calculator", line: "best price per outcome, across books" },
  { slug: "parlay-calculator", sigla: "×", name: "Parlay calculator", line: "combined price, true probability, compounded margin" },
  { slug: "ev-calculator", sigla: "EV", name: "EV calculator", line: "is the price worth it at your probability?" },
  { slug: "kelly-criterion", sigla: "f*", name: "Kelly criterion", line: "fraction of bankroll, with half and quarter Kelly" },
  { slug: "stake-calculator", sigla: "STK", name: "Stake calculator", line: "the stake that returns the profit you want" },
  { slug: "bankroll-calculator", sigla: "BNK", name: "Bankroll calculator", line: "unit size, losing streak, drawdown" },
  { slug: "roi-calculator", sigla: "ROI", name: "ROI calculator", line: "profit against the capital you started with" },
  { slug: "yield-calculator", sigla: "YLD", name: "Yield calculator", line: "profit against everything you staked" },
];

export function sampleTool(slug: ToolSlug): SampleTool {
  const t = SAMPLE_TOOLS.find((x) => x.slug === slug);
  if (!t) throw new Error(`sample tool missing: ${slug}`);
  return t;
}

/** Ogni slug del registry ha il suo cartellino, nessuno in più. */
export function sampleToolsCoverRegistry(): boolean {
  const have = new Set(SAMPLE_TOOLS.map((t) => t.slug));
  return TOOL_SLUGS.every((s) => have.has(s)) && have.size === TOOL_SLUGS.length;
}

export type ToolExample = { input: string; output: string; flat?: boolean; market?: boolean };

const pct = (x: number, d = 1) => `${x.toFixed(d)}%`;
const signedPct = (x: number, d = 1) => `${x > 0 ? "+" : x < 0 ? "−" : "±"}${Math.abs(x).toFixed(d)}%`;

/**
 * L'esempio «input → risultato» dei quattro tool del banco, calcolato con
 * lib/betting-math sui numeri della partita d'esempio: il tool parla la stessa
 * lingua della board.
 */
export function benchExample(slug: ToolSlug, match: { outcomes: readonly LeadShape[] } = SAMPLE_MATCH): ToolExample {
  const lead = leadOutcome(match.outcomes);
  const prices = match.outcomes.map((o) => o.price);
  const p = lead.estimate / 100;
  switch (slug) {
    case "ev-calculator": {
      const r = expectedValue({ probability: p, decimal: lead.price, stake: 1 });
      const ev = r?.evPercent ?? 0;
      return { input: `${lead.price.toFixed(2)} at ${lead.estimate}%`, output: signedPct(ev), flat: Math.abs(ev) < 1 };
    }
    case "kelly-criterion": {
      const r = kelly({ probability: p, decimal: lead.price, bankroll: 500, fraction: 1 });
      const f = (r?.fullKelly ?? 0) * 100;
      return f <= 0
        ? { input: `${lead.price.toFixed(2)} at ${lead.estimate}%`, output: "no stake", flat: true }
        : { input: `${lead.price.toFixed(2)} at ${lead.estimate}%`, output: `${pct(f)} · €${Math.round((500 * f) / 100)}` };
    }
    case "margin-calculator": {
      const m = (bookmakerMargin(prices) ?? 0) * 100;
      return { input: prices.map((x) => x.toFixed(2)).join(" · "), output: pct(m) };
    }
    case "probability-calculator": {
      const probs = noVigProbabilities(prices) ?? [];
      return { input: prices.map((x) => x.toFixed(2)).join(" · "), output: pct((probs[0] ?? 0) * 100, 0), market: true };
    }
    case "odds-converter":
      return { input: lead.price.toFixed(2), output: pct(100 / lead.price) };
    default:
      return { input: "—", output: "—", flat: true };
  }
}

/** I quattro tool del banco in home (v3c §3). */
export const BENCH_SLUGS: readonly ToolSlug[] = ["ev-calculator", "probability-calculator", "kelly-criterion", "margin-calculator"];

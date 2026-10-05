// lib/v3c/sample.ts (#REDESIGN-V3C F1)
// L'UNICA utility dei dati d'esempio del design system v3c. Tutto ciò che
// esce da qui è SAMPLE: nomi di book inventati, href="#", nessun codice
// affiliato, colori club «da verificare». Gli stessi numeri del prototipo
// (Genoa 2.15 → 44% / 48% / +4 pp) così la pagina di prova parla la lingua
// della board. Chi la importa marca a schermo ciò che mostra come SAMPLE.
import { TOOL_SLUGS, type ToolSlug } from "@/lib/tools/registry";
import type { TeamIdentity } from "./monogram";
import { TOOL_SIGLA, toolPreview } from "./tools";

export const SAMPLE = "SAMPLE" as const;

export const SAMPLE_TEAMS = {
  gen: { name: "Genoa", code: "GEN", colours: ["#A31E25", "#0F2140"], coloursVerified: false },
  fio: { name: "Fiorentina", code: "FIO", colours: ["#5B2C86", "#FFFFFF"], coloursVerified: false },
  ray: { name: "Rayo Vallecano", code: "RAY", colours: ["#FFFFFF", "#E63329"], coloursVerified: false },
  ath: { name: "Athletic Club", code: "ATH", colours: ["#EE2523", "#FFFFFF"], coloursVerified: false },
  uni: { name: "Union Berlin", code: "UNB", colours: ["#D4021D", "#F8D000"], coloursVerified: false },
  elv: { name: "Elversberg", code: "ELV", colours: ["#003C8F", "#FFFFFF"], coloursVerified: false },
  bru: { name: "Club Brugge", code: "BRU", colours: ["#0A5CB4", "#111111"], coloursVerified: false },
  and: { name: "Anderlecht", code: "AND", colours: ["#4A2A8A", "#FFFFFF"], coloursVerified: false },
  tor: { name: "Torino", code: "TOR", colours: ["#8A1E22", "#FFFFFF"], coloursVerified: false },
  udi: { name: "Udinese", code: "UDI", colours: ["#111111", "#FFFFFF"], coloursVerified: false },
  lyo: { name: "Lyon", code: "LYO", colours: ["#1A4297", "#DA291C"], coloursVerified: false },
  nic: { name: "Nice", code: "NIC", colours: ["#CE0E2D", "#111111"], coloursVerified: false },
  alc: { name: "Carlos Alcaraz", code: "CA", nation: "ESP" },
  run: { name: "Holger Rune", code: "HR", nation: "DEN" },
  sin: { name: "Jannik Sinner", code: "JS", nation: "ITA" },
  she: { name: "Ben Shelton", code: "BS", nation: "USA" },
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

export type SampleBoardMatch = {
  id: string;
  league: string;
  day: string;
  time: string;
  home: TeamIdentity;
  away: TeamIdentity;
  outcomes: readonly SampleOutcome[];
  /** Prezzo di apertura dell'esito guida (per «open → now»). */
  openPrice?: number;
};

const o = (key: string, label: string, price: number, market: number, estimate: number, prices: Record<string, number>): SampleOutcome => ({
  key,
  label,
  price,
  market,
  estimate,
  prices,
});

/**
 * La board SAMPLE di oggi: gli otto incontri del prototipo (F5), stessi numeri
 * di proto-v3c/proto.js. Serve a «la stessa matematica sul board di oggi»
 * finché F2 non consegna l'endpoint reale (vedi lib/v3c/board-source.ts).
 */
export const SAMPLE_BOARD: readonly SampleBoardMatch[] = [
  { id: SAMPLE_MATCH.id, league: "Serie A", day: "Sat", time: "15:00", home: SAMPLE_TEAMS.gen, away: SAMPLE_TEAMS.fio, outcomes: SAMPLE_MATCH.outcomes, openPrice: 2.02 },
  {
    id: "rayo-athletic",
    league: "LaLiga",
    day: "Sat",
    time: "14:00",
    home: SAMPLE_TEAMS.ray,
    away: SAMPLE_TEAMS.ath,
    openPrice: 2.3,
    outcomes: [
      o("home", "Rayo Vallecano", 2.45, 38, 41, { NB: 2.4, PM: 2.45, KO: 2.42 }),
      o("draw", "Draw", 3.3, 29, 29, { NB: 3.25, PM: 3.3, KO: 3.2 }),
      o("away", "Athletic Club", 2.9, 33, 30, { NB: 2.9, PM: 2.85, KO: 2.88 }),
    ],
  },
  {
    id: "union-elversberg",
    league: "Bundesliga",
    day: "Sat",
    time: "15:30",
    home: SAMPLE_TEAMS.uni,
    away: SAMPLE_TEAMS.elv,
    openPrice: 2.1,
    outcomes: [
      o("home", "Union Berlin", 1.95, 49, 45, { NB: 1.95, PM: 1.9, KO: 1.92 }),
      o("draw", "Draw", 3.4, 28, 29, { NB: 3.4, PM: 3.35, KO: 3.3 }),
      o("away", "Elversberg", 4.1, 23, 26, { NB: 4.0, PM: 4.1, KO: 3.95 }),
    ],
  },
  {
    id: "brugge-anderlecht",
    league: "Pro League",
    day: "Sat",
    time: "16:00",
    home: SAMPLE_TEAMS.bru,
    away: SAMPLE_TEAMS.and,
    openPrice: 1.85,
    outcomes: [
      o("home", "Club Brugge", 1.8, 53, 53, { NB: 1.78, PM: 1.8, KO: 1.77 }),
      o("draw", "Draw", 3.6, 26, 26, { NB: 3.6, PM: 3.5, KO: 3.55 }),
      o("away", "Anderlecht", 4.5, 21, 21, { NB: 4.4, PM: 4.5, KO: 4.33 }),
    ],
  },
  { id: SAMPLE_TENNIS.id, league: SAMPLE_TENNIS.league, day: "Sat", time: "18:00", home: SAMPLE_TEAMS.alc, away: SAMPLE_TEAMS.run, outcomes: SAMPLE_TENNIS.outcomes, openPrice: 1.45 },
  {
    id: "torino-udinese",
    league: "Serie A",
    day: "Sat",
    time: "20:45",
    home: SAMPLE_TEAMS.tor,
    away: SAMPLE_TEAMS.udi,
    openPrice: 2.3,
    outcomes: [
      o("home", "Torino", 2.3, 41, 40, { NB: 2.3, PM: 2.25, KO: 2.28 }),
      o("draw", "Draw", 3.2, 30, 32, { NB: 3.2, PM: 3.15, KO: 3.1 }),
      o("away", "Udinese", 3.3, 29, 28, { NB: 3.25, PM: 3.3, KO: 3.2 }),
    ],
  },
  {
    id: "lyon-nice",
    league: "Ligue 1",
    day: "Sat",
    time: "21:00",
    home: SAMPLE_TEAMS.lyo,
    away: SAMPLE_TEAMS.nic,
    openPrice: 2.15,
    outcomes: [
      o("home", "Lyon", 2.05, 47, 44, { NB: 2.05, PM: 2.0, KO: 2.02 }),
      o("draw", "Draw", 3.5, 27, 28, { NB: 3.45, PM: 3.5, KO: 3.4 }),
      o("away", "Nice", 3.7, 26, 28, { NB: 3.6, PM: 3.7, KO: 3.65 }),
    ],
  },
  {
    id: "sinner-shelton",
    league: "ATP Shanghai · SF",
    day: "Sun",
    time: "12:30",
    home: SAMPLE_TEAMS.sin,
    away: SAMPLE_TEAMS.she,
    openPrice: 1.28,
    outcomes: [o("home", "Sinner", 1.25, 78, 75, { NB: 1.25, PM: 1.24, KO: 1.25 }), o("away", "Shelton", 4.2, 22, 25, { NB: 4.1, PM: 4.2, KO: 4.0 })],
  },
];

/** L'esito con il gap più largo: la riga della board lo mostra per primo. */
export function leadOutcome(outcomes: readonly SampleOutcome[]): SampleOutcome {
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

// La sigla vive nel motore dei tool (lib/v3c/tools.ts, F5): qui si legge, non si ridichiara.
export const SAMPLE_TOOLS: readonly SampleTool[] = [
  { slug: "odds-converter", sigla: TOOL_SIGLA["odds-converter"], name: "Odds converter", line: "decimal, fractional, American and implied %" },
  { slug: "probability-calculator", sigla: TOOL_SIGLA["probability-calculator"], name: "Probability calculator", line: "three prices to probabilities, margin removed" },
  { slug: "margin-calculator", sigla: TOOL_SIGLA["margin-calculator"], name: "Margin calculator", line: "how much the book keeps on a market" },
  { slug: "arbitrage-calculator", sigla: TOOL_SIGLA["arbitrage-calculator"], name: "Arbitrage calculator", line: "best price per outcome, across books" },
  { slug: "parlay-calculator", sigla: TOOL_SIGLA["parlay-calculator"], name: "Parlay calculator", line: "combined price, true probability, compounded margin" },
  { slug: "ev-calculator", sigla: TOOL_SIGLA["ev-calculator"], name: "EV calculator", line: "is the price worth it at your probability?" },
  { slug: "kelly-criterion", sigla: TOOL_SIGLA["kelly-criterion"], name: "Kelly criterion", line: "fraction of bankroll, with half and quarter Kelly" },
  { slug: "stake-calculator", sigla: TOOL_SIGLA["stake-calculator"], name: "Stake calculator", line: "the stake that returns the profit you want" },
  { slug: "bankroll-calculator", sigla: TOOL_SIGLA["bankroll-calculator"], name: "Bankroll calculator", line: "unit size, losing streak, drawdown" },
  { slug: "roi-calculator", sigla: TOOL_SIGLA["roi-calculator"], name: "ROI calculator", line: "profit against the capital you started with" },
  { slug: "yield-calculator", sigla: TOOL_SIGLA["yield-calculator"], name: "Yield calculator", line: "profit against everything you staked" },
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

/**
 * L'esempio «input → risultato» di un tool, calcolato dal motore dei tool
 * (lib/v3c/tools.ts, con lib/betting-math) sui numeri della partita d'esempio:
 * il tool parla la stessa lingua della board. Da F5 copre tutti e 11 gli slug.
 */
export function benchExample(slug: ToolSlug, match: typeof SAMPLE_MATCH = SAMPLE_MATCH): ToolExample {
  const lead = leadOutcome(match.outcomes);
  const p = toolPreview(slug, { outcomes: match.outcomes, lead });
  return { input: p.input, output: p.output, flat: p.flat, market: p.market };
}

/** I quattro tool del banco in home (v3c §3): definiti nel motore, riesportati qui. */
export { BENCH_SLUGS } from "./tools";

// lib/v3c/tools.ts (#REDESIGN-V3C F5)
// Il motore dei tool v3c: gli 11 slug di lib/tools/registry.ts, ognuno con la
// domanda dell'utente a cui risponde, la sigla del cartellino, gli input (con
// i default del prototipo), il calcolo (SOLO lib/betting-math: nessuna
// formula riscritta qui), il prefill da un esito della board e la colonna
// «la stessa matematica sul board di oggi». Le etichette NON stanno qui: il
// motore produce chiavi, il dizionario (lib/i18n/v3c-tools) le traduce.
//
// Regola del modulo di matematica: input non calcolabile → lista vuota, mai
// "NaN". Il componente mostra il trattino.
import type { ToolSlug } from "@/lib/tools/registry";
import {
  arbitrage,
  bankrollPlan,
  bookmakerMargin,
  expectedValue,
  formatOdds,
  kelly,
  noVigProbabilities,
  parlayOdds,
  roi,
  stakeForTarget,
  yieldPercent,
} from "@/lib/betting-math";
import type { BoardOutcome } from "./board-source";
import { formatSigned } from "./scale";
import { inputProblem } from "./fixdata";

// ── Domande: tre, dimensionate per uso reale (5 · 4 · 2) ─────────────────────
export type QuestionId = "price" | "stake" | "record";
export const QUESTIONS: readonly QuestionId[] = ["price", "stake", "record"];

// ── Input ────────────────────────────────────────────────────────────────────
/** price: quota decimale > 1 · percent: 0–100 esclusi · money: > 0 ·
 *  signed: qualsiasi importo (il profitto può essere negativo) · count: intero > 0 ·
 *  rate: ≥ 0 (un margine per gamba può essere zero). */
export type InputKind = "price" | "percent" | "money" | "signed" | "count" | "rate";
/** final6: `default: null` = an empty field the visitor fills (a bankroll is never assumed). */
export type ToolInput = { key: string; kind: InputKind; default: number | null; optional?: boolean };
/** null = campo vuoto o non numerico. */
export type ToolValues = Record<string, number | null>;

/** fixdata M4: the bounds live in lib/v3c/fixdata.ts (inputBounds / inputProblem): a price is 1.01–1000. */
export function validInput(kind: InputKind, v: number | null | undefined): v is number {
  return inputProblem(kind, v) == null;
}

// ── Risultati ────────────────────────────────────────────────────────────────
export type ToolResult = {
  /** Chiave dell'etichetta nel dizionario (tools[slug].results[key]). */
  key: string;
  value: string;
  /** Il risultato grande (il primo). */
  big?: boolean;
  /** Nullo/«in linea»: si spegne, non si colora. */
  flat?: boolean;
  /** È una probabilità di mercato: sky. */
  market?: boolean;
  /** Variabili per l'etichetta («Fair price at {prob}%»). */
  vars?: Record<string, string>;
};

export type ToolPreview = { input: string; output: string; flat?: boolean; market?: boolean };

/** fixui3: the few words of a preview line («2.15 at 48%», «+400 on 1,000»), translated (lib/v3c/fixui3-copy). */
export type PreviewWords = { at: string; on: string; bets: string; unit: string; eg: string };
export const PREVIEW_WORDS_EN: PreviewWords = { at: "at", on: "on", bets: "bets", unit: "unit", eg: "e.g." };

/** Il contesto di board da cui un tool si precompila: l'esito guida e i prezzi del mercato. */
export type BoardCtx = {
  outcomes: readonly Pick<BoardOutcome, "price" | "estimate" | "market" | "prices">[];
  lead: Pick<BoardOutcome, "price" | "estimate" | "market" | "prices" | "label">;
};

export type ToolDef = {
  slug: ToolSlug;
  question: QuestionId;
  /** La sigla della formula sul cartellino, non un'icona. */
  sigla: string;
  inputs: readonly ToolInput[];
  compute(v: ToolValues): ToolResult[];
  /** La riga «input» dell'anteprima, dai valori (fixui3: con le parole della lingua). */
  previewInput(v: ToolValues, w?: PreviewWords): string;
  /**
   * fixui3 R4: the illustrative amounts of the preview line on the hub, for the tools whose inputs are money.
   * Never a prefill: the calculator's money fields start empty, and the preview shows them without «€»,
   * after «e.g.».
   */
  example?: ToolValues;
  /** I valori precompilati da un esito della board. */
  fromBoard(ctx: BoardCtx): ToolValues;
  /** La colonna del tool sul board di oggi; assente → ponte testuale. */
  column?: (ctx: BoardCtx) => ToolResult;
  /** Dove porta il ponte testuale quando non c'è colonna. */
  bridge: "board" | "record";
};

// ── Formattazione: le stesse regole del prototipo, il meno U+2212 ────────────
export const pct = (x: number, d = 1) => `${x.toFixed(d)}%`;
export const signedPct = (x: number, d = 1) => `${formatSigned(x, d)}%`;
export function eur(x: number): string {
  const a = Math.abs(x);
  const body = a >= 1000 ? Math.round(a).toLocaleString("en") : a % 1 ? a.toFixed(2) : a.toFixed(0);
  const sign = x < 0 && Number(body.replace(/,/g, "")) !== 0 ? "−" : ""; // −€0.00 mai: segno dopo l'arrotondamento
  return `${sign}€${body}`;
}
const dec = (x: number) => x.toFixed(2);
/** fixui3 R4: an amount of the preview line, no currency («1,000», «86.96»). */
const amt = (x: number) => eur(x).replace("€", "");

function prices3(v: ToolValues): number[] | null {
  const ps = [v.p1, v.p2, v.p3];
  if (!validInput("price", ps[0]) || !validInput("price", ps[1])) return null;
  if (ps[2] != null && ps[2] !== 0 && !validInput("price", ps[2])) return null;
  return ps.filter((p): p is number => validInput("price", p));
}
const joinPrices = (ps: (number | null | undefined)[]) =>
  ps
    .filter((p): p is number => p != null && p > 1)
    .map(dec)
    .join(" · ");
function marketFromCtx(ctx: BoardCtx): ToolValues {
  const ps = ctx.outcomes.map((o) => o.price);
  return { p1: ps[0] ?? null, p2: ps[1] ?? null, p3: ps[2] ?? null };
}
/** Il prezzo migliore fra i book connessi, altrimenti il prezzo di riferimento. */
export function bestPriceOf(o: Pick<BoardOutcome, "price" | "prices">): number {
  const vals = Object.values(o.prices ?? {});
  return vals.length ? Math.max(...vals) : o.price;
}

// ── Gli 11 tool ──────────────────────────────────────────────────────────────
const price = (key: string, d: number): ToolInput => ({ key, kind: "price", default: d });

export const TOOLS: readonly ToolDef[] = [
  {
    slug: "odds-converter",
    question: "price",
    sigla: "1÷p",
    inputs: [price("price", 2.15)],
    compute(v) {
      if (!validInput("price", v.price)) return [];
      return [
        { key: "implied", value: pct(100 / v.price), big: true },
        { key: "fractional", value: formatOdds(v.price, "fractional") },
        { key: "american", value: formatOdds(v.price, "american") },
      ];
    },
    previewInput: (v) => (validInput("price", v.price) ? dec(v.price) : "—"),
    fromBoard: (ctx) => ({ price: ctx.lead.price }),
    column: (ctx) => ({ key: "implied", value: pct(100 / ctx.lead.price) }),
    bridge: "board",
  },
  {
    slug: "probability-calculator",
    question: "price",
    sigla: "p%",
    inputs: [price("p1", 2.15), price("p2", 3.2), { key: "p3", kind: "price", default: 3.5, optional: true }],
    compute(v) {
      const ps = prices3(v);
      const probs = ps ? noVigProbabilities(ps) : null;
      if (!probs) return [];
      return probs.map((p, i) => ({ key: `o${i + 1}`, value: pct(p * 100), big: i === 0, market: true }));
    },
    previewInput: (v) => joinPrices([v.p1, v.p2, v.p3]),
    fromBoard: marketFromCtx,
    column: (ctx) => ({ key: "market", value: `${ctx.lead.market}%`, market: true }),
    bridge: "board",
  },
  {
    slug: "margin-calculator",
    question: "price",
    sigla: "Σ%",
    inputs: [price("p1", 2.15), price("p2", 3.2), { key: "p3", kind: "price", default: 3.5, optional: true }],
    compute(v) {
      const ps = prices3(v);
      const m = ps ? bookmakerMargin(ps) : null;
      if (m == null) return [];
      const mg = m * 100;
      return [
        { key: "margin", value: pct(mg), big: true },
        { key: "sum", value: pct(mg + 100) },
        { key: "kept", value: amt((mg / (mg + 100)) * 100) }, // fixui3 R4: per 100 staked, no «€» by default
      ];
    },
    previewInput: (v) => joinPrices([v.p1, v.p2, v.p3]),
    fromBoard: marketFromCtx,
    column: (ctx) => ({ key: "margin", value: pct((bookmakerMargin(ctx.outcomes.map((o) => o.price)) ?? 0) * 100) }),
    bridge: "board",
  },
  {
    slug: "arbitrage-calculator",
    question: "price",
    sigla: "ARB",
    // fixui3 R4: no default total — the stakes appear only once the visitor types theirs; the margin needs prices only
    inputs: [price("p1", 2.15), price("p2", 3.2), { key: "p3", kind: "price", default: 3.55, optional: true }, { key: "total", kind: "money", default: null }],
    compute(v) {
      const ps = prices3(v);
      if (!ps) return [];
      const noTotal = v.total == null;
      if (!noTotal && !validInput("money", v.total)) return [];
      const r = arbitrage({ decimals: ps, total: noTotal ? 1 : (v.total as number) });
      if (!r) return [];
      const profit = r.profitPercent * 100;
      const sum = r.impliedSum * 100;
      const out: ToolResult[] = [
        profit >= 0 ? { key: "profit", value: signedPct(profit), big: true } : { key: "shortfall", value: signedPct(profit), big: true, flat: true },
        { key: "sum", value: pct(sum) },
      ];
      if (!noTotal) r.stakes.forEach((s, i) => out.push({ key: "stake", value: eur(s), vars: { n: String(i + 1) } }));
      return out;
    },
    previewInput: (v) => joinPrices([v.p1, v.p2, v.p3]),
    fromBoard(ctx) {
      const ps = ctx.outcomes.map(bestPriceOf);
      return { p1: ps[0] ?? null, p2: ps[1] ?? null, p3: ps[2] ?? null, total: null };
    },
    column(ctx) {
      const sum = ctx.outcomes.reduce((a, o) => a + 100 / bestPriceOf(o), 0);
      return { key: "bestSum", value: pct(sum), flat: sum >= 100 };
    },
    bridge: "board",
  },
  {
    slug: "parlay-calculator",
    question: "price",
    sigla: "×",
    inputs: [price("l1", 2.15), price("l2", 1.4), { key: "mg", kind: "rate", default: 6 }],
    compute(v) {
      if (!validInput("price", v.l1) || !validInput("price", v.l2) || !validInput("rate", v.mg)) return [];
      const c = parlayOdds([v.l1, v.l2]);
      if (c == null) return [];
      const cm = (Math.pow(1 + v.mg / 100, 2) - 1) * 100;
      return [
        { key: "combined", value: dec(c), big: true },
        { key: "implied", value: pct(100 / c) },
        { key: "compounded", value: pct(cm) },
      ];
    },
    previewInput: (v) => (validInput("price", v.l1) && validInput("price", v.l2) ? `${dec(v.l1)} × ${dec(v.l2)}` : "—"),
    fromBoard: (ctx) => ({ l1: ctx.lead.price, l2: 1.4, mg: 6 }),
    bridge: "board",
  },
  {
    slug: "ev-calculator",
    question: "stake",
    sigla: "EV",
    inputs: [price("price", 2.15), { key: "prob", kind: "percent", default: 48 }],
    compute(v) {
      if (!validInput("price", v.price) || !validInput("percent", v.prob)) return [];
      const r = expectedValue({ probability: v.prob / 100, decimal: v.price, stake: 1 });
      if (!r) return [];
      return [
        { key: "ev", value: signedPct(r.evPercent), big: true, flat: Math.abs(r.evPercent) < 1 },
        { key: "fair", value: dec(r.fairDecimal), vars: { prob: String(v.prob) } },
        { key: "breakeven", value: pct(100 / v.price) },
      ];
    },
    previewInput: (v, w = PREVIEW_WORDS_EN) => (validInput("price", v.price) && validInput("percent", v.prob) ? `${dec(v.price)} ${w.at} ${v.prob}%` : "—"),
    fromBoard: (ctx) => ({ price: ctx.lead.price, prob: ctx.lead.estimate }),
    column(ctx) {
      const e = (expectedValue({ probability: ctx.lead.estimate / 100, decimal: ctx.lead.price, stake: 1 })?.evPercent ?? 0);
      return { key: "evAt", value: signedPct(e), flat: Math.abs(e) < 1 };
    },
    bridge: "board",
  },
  {
    slug: "kelly-criterion",
    question: "stake",
    sigla: "f*",
    // final6: no default bankroll — empty, Kelly is the fraction only; a stake in € only from the visitor's own bankroll
    inputs: [price("price", 2.15), { key: "prob", kind: "percent", default: 48 }, { key: "bank", kind: "money", default: null, optional: true }],
    compute(v) {
      if (!validInput("price", v.price) || !validInput("percent", v.prob)) return [];
      const noBank = v.bank == null;
      if (!noBank && !validInput("money", v.bank)) return [];
      const r = kelly({ probability: v.prob / 100, decimal: v.price, bankroll: noBank ? 1 : (v.bank as number), fraction: 1 });
      if (!r) return [];
      const f = r.fullKelly * 100;
      if (f <= 0) return [{ key: "none", value: "0%", big: true, flat: true }];
      if (noBank)
        return [
          { key: "full", value: pct(f), big: true },
          { key: "half", value: pct(f / 2) },
          { key: "quarter", value: pct(f / 4) },
        ];
      return [
        { key: "full", value: `${pct(f)} · ${eur(Math.round(r.stake))}`, big: true },
        { key: "half", value: `${pct(f / 2)} · ${eur(Math.round(r.stake / 2))}` },
        { key: "quarter", value: `${pct(f / 4)} · ${eur(Math.round(r.stake / 4))}` },
      ];
    },
    previewInput: (v, w = PREVIEW_WORDS_EN) => (validInput("price", v.price) && validInput("percent", v.prob) ? `${dec(v.price)} ${w.at} ${v.prob}%` : "—"),
    fromBoard: (ctx) => ({ price: ctx.lead.price, prob: ctx.lead.estimate, bank: null }),
    column(ctx) {
      const f = (kelly({ probability: ctx.lead.estimate / 100, decimal: ctx.lead.price, bankroll: 1, fraction: 1 })?.fullKelly ?? 0) * 100;
      return f <= 0 ? { key: "kellyAt", value: "none", flat: true } : { key: "kellyAt", value: pct(f) };
    },
    bridge: "board",
  },
  {
    slug: "stake-calculator",
    question: "stake",
    sigla: "STK",
    // fixui3 R4: target and bankroll start empty (never assumed); the share of bankroll only with the visitor's bankroll
    inputs: [price("price", 2.15), { key: "target", kind: "money", default: null }, { key: "bank", kind: "money", default: null, optional: true }],
    compute(v) {
      if (!validInput("price", v.price) || !validInput("money", v.target)) return [];
      if (v.bank != null && !validInput("money", v.bank)) return [];
      const s = stakeForTarget({ targetProfit: v.target, decimal: v.price });
      if (s == null) return [];
      const out: ToolResult[] = [
        { key: "stake", value: eur(s), big: true },
        { key: "return", value: eur(s + v.target) },
      ];
      if (v.bank != null) out.push({ key: "share", value: pct((s / v.bank) * 100) });
      return out;
    },
    previewInput: (v, w = PREVIEW_WORDS_EN) => (validInput("price", v.price) && validInput("money", v.target) ? `${w.eg} ${amt(v.target)} ${w.at} ${dec(v.price)}` : "—"),
    example: { target: 100 },
    fromBoard: (ctx) => ({ price: ctx.lead.price, target: null, bank: null }),
    // fixui3 R4: the board column is the stake per 1 of profit, no amount in € (it was «Stake for €100»)
    column: (ctx) => ({ key: "stakeFor", value: dec(stakeForTarget({ targetProfit: 1, decimal: ctx.lead.price }) ?? 0) }),
    bridge: "board",
  },
  {
    slug: "bankroll-calculator",
    question: "stake",
    sigla: "BNK",
    inputs: [
      // final6: no default bankroll — empty, the plan speaks in percentages of the visitor's bankroll
      { key: "bank", kind: "money", default: null, optional: true },
      { key: "unit", kind: "percent", default: 2 },
      { key: "streak", kind: "count", default: 10 },
    ],
    compute(v) {
      if (!validInput("percent", v.unit) || !validInput("count", v.streak)) return [];
      const noBank = v.bank == null;
      if (!noBank && !validInput("money", v.bank)) return [];
      const r = bankrollPlan({ bankroll: noBank ? 100 : (v.bank as number), unitPercent: v.unit / 100, losingStreak: v.streak });
      if (!r) return [];
      if (noBank)
        return [
          { key: "unit", value: pct(v.unit), big: true },
          { key: "streakLoss", value: `−${pct(r.streakDrawdown * 100, 0)}`, vars: { n: String(v.streak) } },
          { key: "ruin", value: String(r.betsToRuin) },
        ];
      return [
        { key: "unit", value: eur(r.unit), big: true },
        { key: "streakLoss", value: `−${eur(r.streakLoss)} · ${pct(r.streakDrawdown * 100, 0)}`, vars: { n: String(v.streak) } },
        { key: "ruin", value: String(r.betsToRuin) },
      ];
    },
    previewInput: (v, w = PREVIEW_WORDS_EN) => (validInput("percent", v.unit) ? (validInput("money", v.bank) ? `${amt(v.bank)} ${w.at} ${v.unit}%` : `${v.unit}% ${w.unit}`) : "—"),
    fromBoard: () => ({ bank: null, unit: 2, streak: 10 }),
    bridge: "board",
  },
  {
    slug: "roi-calculator",
    question: "record",
    sigla: "ROI",
    // fixui3 R4: both empty — the visitor's own diary, never a default bankroll
    inputs: [
      { key: "cap", kind: "money", default: null },
      { key: "profit", kind: "signed", default: null },
    ],
    compute(v) {
      if (!validInput("money", v.cap) || !validInput("signed", v.profit)) return [];
      const r = roi({ profit: v.profit, capital: v.cap });
      if (r == null) return [];
      return [
        { key: "roi", value: signedPct(r * 100), big: true, flat: r === 0 },
        { key: "end", value: eur(v.cap + v.profit) },
      ];
    },
    previewInput: (v, w = PREVIEW_WORDS_EN) => (validInput("money", v.cap) && validInput("signed", v.profit) ? `${w.eg} ${amt(v.profit)} ${w.on} ${amt(v.cap)}` : "—"),
    example: { cap: 1000, profit: 400 },
    fromBoard: () => ({ cap: null, profit: null }),
    bridge: "record",
  },
  {
    slug: "yield-calculator",
    question: "record",
    sigla: "YLD",
    // fixui3 R4: all three empty — the visitor's own diary
    inputs: [
      { key: "bets", kind: "count", default: null },
      { key: "avg", kind: "money", default: null },
      { key: "profit", kind: "signed", default: null },
    ],
    compute(v) {
      if (!validInput("count", v.bets) || !validInput("money", v.avg) || !validInput("signed", v.profit)) return [];
      const turnover = v.bets * v.avg;
      const y = yieldPercent({ profit: v.profit, turnover });
      if (y == null) return [];
      return [
        { key: "yield", value: signedPct(y * 100), big: true, flat: y === 0 },
        { key: "turnover", value: eur(turnover) },
      ];
    },
    previewInput: (v, w = PREVIEW_WORDS_EN) => (validInput("count", v.bets) && validInput("money", v.avg) ? `${w.eg} ${v.bets} ${w.bets} · ${amt(v.avg)}` : "—"),
    example: { bets: 200, avg: 50, profit: 400 },
    fromBoard: () => ({ bets: null, avg: null, profit: null }),
    bridge: "record",
  },
];

export const TOOL_SIGLA: Record<ToolSlug, string> = Object.fromEntries(TOOLS.map((t) => [t.slug, t.sigla])) as Record<ToolSlug, string>;

export function toolDef(slug: ToolSlug): ToolDef {
  const t = TOOLS.find((x) => x.slug === slug);
  if (!t) throw new Error(`v3c tool missing: ${slug}`);
  return t;
}

export function toolsFor(question: QuestionId): readonly ToolDef[] {
  return TOOLS.filter((t) => t.question === question);
}

export function defaultValues(t: ToolDef): ToolValues {
  return Object.fromEntries(t.inputs.map((i) => [i.key, i.default]));
}

/** I quattro tool del banco in home (v3c §3). */
export const BENCH_SLUGS: readonly ToolSlug[] = ["ev-calculator", "probability-calculator", "kelly-criterion", "margin-calculator"];

/**
 * L'anteprima «input → risultato» di un tool su un contesto di board: il primo
 * risultato, calcolato sui numeri precompilati. Le probabilità di mercato
 * escono senza decimali, come la colonna «Market» della board.
 */
export function toolPreview(slug: ToolSlug, ctx: BoardCtx, w: PreviewWords = PREVIEW_WORDS_EN): ToolPreview {
  const t = toolDef(slug);
  // fixui3 R4: the money tools preview their declared example amounts («e.g.»), never a prefill, and without «€»
  const v = { ...t.fromBoard(ctx), ...(t.example ?? {}) };
  const [r] = t.compute(v);
  if (!r) return { input: t.previewInput(v, w), output: "—", flat: true };
  const output = r.market ? pct(parseFloat(r.value), 0) : t.example ? r.value.replace("€", "") : r.value;
  return { input: t.previewInput(v, w), output, flat: r.flat, market: r.market };
}

/** Ogni slug del registry ha il suo tool nel motore, nessuno in più. */
export function toolsCoverRegistry(slugs: readonly string[]): boolean {
  const have = new Set(TOOLS.map((t) => t.slug));
  return slugs.every((s) => have.has(s as ToolSlug)) && have.size === slugs.length;
}

/**
 * Prefill dalla query string: `?price=2.15&prob=48` (chiavi = input del tool).
 * Solo numeri finiti; tutto il resto resta al default. Nessun input entra mai
 * nel DOM come markup: sono valori di <input type="number">.
 */
export function valuesFromQuery(t: ToolDef, search: string): Partial<ToolValues> {
  const out: Partial<ToolValues> = {};
  let sp: URLSearchParams;
  try {
    sp = new URLSearchParams(search);
  } catch {
    return out;
  }
  for (const i of t.inputs) {
    const raw = sp.get(i.key);
    if (raw == null) continue;
    const n = Number(raw.replace(",", "."));
    if (Number.isFinite(n)) out[i.key] = n;
  }
  return out;
}

/** Il link a un tool con i numeri di un esito già scritti nella query. */
export function toolHrefWith(basePath: string, t: ToolDef, ctx: BoardCtx, matchId?: string, outcomeKey?: string): string {
  const v = t.fromBoard(ctx);
  const sp = new URLSearchParams();
  for (const i of t.inputs) {
    const x = v[i.key];
    if (x != null && Number.isFinite(x)) sp.set(i.key, String(x));
  }
  if (matchId) sp.set("m", matchId);
  if (outcomeKey) sp.set("o", outcomeKey);
  const q = sp.toString();
  return q ? `${basePath}?${q}` : basePath;
}

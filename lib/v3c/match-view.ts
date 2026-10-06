// lib/v3c/match-view.ts (#REDESIGN-V3C F4)
// Il modello di vista della pagina partita e del price check, puro e testato.
// Dati SOLO dai contratti v3 (board.2, line_movement.2): qui si decide quale
// partita è, quale esito guida, quali punti del nastro (tutti quelli catturati,
// nessuno inventato), quali book e in che ordine, e la matematica del price
// check (implicita, margine, margine tolto, gap con la stima).
//
// Dal vecchio sito (MatchDetailSheet/PredictionDetailModal) si prende solo ciò
// che è dato o funzione: l'ordine dei partner (sortBooksForMenu) e il
// tracciamento dei click — non il JSX.
import { bookmakerMargin, noVigProbabilities } from "@/lib/betting-math";
import { sortBooksForMenu } from "@/lib/partners";
import { toolPath, type ToolSlug } from "@/lib/tools/registry";
import type { Outcome, V3BoardMatch, V3BoardOutcome, V3BoardResponse, V3BoardTennisMatch, V3BookPrice, V3LineSeries, TennisSide } from "./contracts";
import { leadOutcome } from "./board-view";
import { FLAT_PP } from "./scale";
import { toolDef, type ToolResult, type ToolValues } from "./tools";

// ─── La partita ─────────────────────────────────────────────────────────────

export type FoundMatch = { sport: "football"; m: V3BoardMatch } | { sport: "tennis"; m: V3BoardTennisMatch } | null;

export function findMatch(board: Pick<V3BoardResponse, "matches" | "tennis">, id: string): FoundMatch {
  const f = board.matches.find((m) => m.id === id);
  if (f) return { sport: "football", m: f };
  const t = (board.tennis ?? []).find((m) => m.id === id);
  return t ? { sport: "tennis", m: t } : null;
}

/** L'URL pubblico della pagina partita (gli id contengono «:»). */
export function matchHref(id: string): string {
  return `/match/${encodeURIComponent(id)}`;
}

/** Limiti dell'id dalla URL: la stessa regola della route line-movement. */
export function cleanMatchId(raw: string): string | null {
  let id: string;
  try {
    id = decodeURIComponent(raw);
  } catch {
    return null;
  }
  return id && id.length <= 200 ? id : null;
}

/** Calcio: l'esito guida è quello con il gap più ampio (stessa regola della board). */
export { leadOutcome };

/** «Il prezzo è N punti più lungo/corto del nostro numero»: + = la stima è sopra il mercato. */
export function gapDirection(pp: number): "longer" | "shorter" | "flat" {
  if (Math.abs(pp) < FLAT_PP) return "flat";
  return pp > 0 ? "longer" : "shorter";
}

/** Quota equa di una probabilità (0..1): 100 / %. null se fuori dominio. */
export function fairPrice(p: number | null | undefined): number | null {
  return p == null || !(p > 0 && p < 1) ? null : 1 / p;
}

// ─── I book: N righe, quota oppure «quota sul sito» ──────────────────────────

/** Un book nel blocco partner: con quota (feed) oppure senza (solo link). */
export type BookListing = {
  bookmaker: string;
  name: string;
  url: string;
  /** null = il book non ha un feed: si mostra «Odds on site», mai una quota. */
  price: number | null;
  captured_at: string | null;
};

/**
 * Campo OPZIONALE che il filone partners aggiungerà al contratto (oggi assente):
 * i book connessi senza feed per questa partita, con il loro link affiliato.
 * Letto in difesa: forma sbagliata o URL non http(s) → ignorato.
 */
export type V3BookLink = { bookmaker: string; name: string; url: string };

export function readBookLinks(src: unknown): V3BookLink[] {
  const raw = src && typeof src === "object" ? (src as { more_books?: unknown }).more_books : undefined;
  if (!Array.isArray(raw)) return [];
  const out: V3BookLink[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const { bookmaker, name, url } = x as Record<string, unknown>;
    if (typeof bookmaker !== "string" || typeof name !== "string" || typeof url !== "string") continue;
    if (!/^https?:\/\//i.test(url)) continue;
    out.push({ bookmaker, name, url });
  }
  return out;
}

/** Prima i book con quota, dalla più alta; poi quelli senza, nell'ordine del menu partner di oggi. Un book compare una volta sola. */
export function bookList(prices: readonly V3BookPrice[], links: readonly V3BookLink[] = []): BookListing[] {
  const seen = new Set<string>();
  const priced: BookListing[] = [];
  for (const b of [...prices].filter((b) => Number.isFinite(b.price) && b.price > 1).sort((a, b) => b.price - a.price)) {
    if (seen.has(b.bookmaker)) continue;
    seen.add(b.bookmaker);
    priced.push({ bookmaker: b.bookmaker, name: b.name, url: b.url, price: b.price, captured_at: b.captured_at || null });
  }
  const unpriced = links.filter((l) => {
    if (seen.has(l.bookmaker)) return false;
    seen.add(l.bookmaker);
    return true;
  });
  const rest = sortBooksForMenu(unpriced).map((l) => ({ ...l, price: null, captured_at: null }));
  return [...priced, ...rest];
}

/** L'ora del controllo: la cattura più recente fra i book con quota. */
export function checkedAt(list: readonly BookListing[]): string | null {
  const ts = list.map((b) => (b.captured_at ? Date.parse(b.captured_at) : NaN)).filter(Number.isFinite);
  return ts.length ? new Date(Math.max(...ts)).toISOString() : null;
}

// ─── Il nastro: i punti catturati, nient'altro ───────────────────────────────

export type TapeKey = Outcome | TennisSide;
export type TapeLine = { bookmaker: string; points: { t: number; v: number }[]; median_interval_min: number | null };

/** Una linea per book (1X2 o ML) sull'esito chiesto. Punti senza prezzo saltati, mai riempiti. */
export function tapeLines(series: readonly V3LineSeries[], key: TapeKey): TapeLine[] {
  const out: TapeLine[] = [];
  for (const s of series) {
    let pts: { t: number; v: number }[] = [];
    if (s.market === "1X2" && (key === "home" || key === "draw" || key === "away")) {
      pts = s.points.map((p) => ({ t: Date.parse(p.t), v: p.price[key] as number | null })).filter((p): p is { t: number; v: number } => p.v != null && Number.isFinite(p.t));
    } else if (s.market === "ML" && (key === "p1" || key === "p2")) {
      pts = s.points.map((p) => ({ t: Date.parse(p.t), v: p.price[key] })).filter((p) => Number.isFinite(p.t) && p.v > 1);
    } else continue;
    if (pts.length) out.push({ bookmaker: s.bookmaker, points: pts.sort((a, b) => a.t - b.t), median_interval_min: s.coverage.median_interval_min });
  }
  // la linea con più catture per prima: è quella che si disegna piena
  return out.sort((a, b) => b.points.length - a.points.length || a.bookmaker.localeCompare(b.bookmaker));
}

/**
 * Campo OPZIONALE (oggi assente nel contratto): le notizie legate al movimento
 * di linea, «news at hh:mm». Senza dato il campo non si mostra — nessuna
 * notizia inventata, nessuna causalità dichiarata.
 */
export type LineEvent = { t: number; label: string; url: string | null };

export function readLineEvents(resp: unknown): LineEvent[] {
  const raw = resp && typeof resp === "object" ? (resp as { events?: unknown }).events : undefined;
  if (!Array.isArray(raw)) return [];
  const out: LineEvent[] = [];
  for (const e of raw) {
    if (!e || typeof e !== "object") continue;
    const { t, label, url } = e as Record<string, unknown>;
    const ts = typeof t === "string" ? Date.parse(t) : NaN;
    if (!Number.isFinite(ts) || typeof label !== "string" || !label.trim()) continue;
    out.push({ t: ts, label: label.trim().slice(0, 120), url: typeof url === "string" && /^https?:\/\//i.test(url) ? url : null });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Primo e ultimo prezzo della linea principale: «moved from 2.66 to 2.84» o «unchanged». */
export function tapeSummary(lines: readonly TapeLine[]): { from: number; to: number; n: number; firstAt: number; lastAt: number } | null {
  const l = lines[0];
  if (!l || !l.points.length) return null;
  const a = l.points[0];
  const b = l.points[l.points.length - 1];
  return { from: a.v, to: b.v, n: l.points.length, firstAt: a.t, lastAt: b.t };
}

/** Il passo dell'asse delle quote: come il prototipo, adattivo allo span. */
export function priceStep(span: number): number {
  return span <= 0.25 ? 0.05 : span <= 0.6 ? 0.1 : span <= 1.2 ? 0.2 : span <= 3 ? 0.5 : 1;
}

export function priceAxis(values: readonly number[]): { lo: number; hi: number; ticks: number[] } {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = priceStep(max - min);
  const lo = Math.max(1, Math.floor((min - step * 0.6) / step) * step);
  const hi = Math.ceil((max + step * 0.6) / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return { lo, hi, ticks };
}

// ─── Il price check ─────────────────────────────────────────────────────────

export type PriceCheck = {
  /** 1/prezzo, in % */
  implied: number[];
  /** somma delle implicite, in % */
  sum: number;
  /** margine del book, in % */
  margin: number;
  /** implicite / somma, in % */
  noVig: number[];
  /** stima − margine tolto, in pp (null senza stima) */
  gaps: (number | null)[];
  /** l'esito con il gap assoluto più ampio (senza stime: 0) */
  lead: number;
};

/** null se un prezzo non è una quota decimale > 1. */
export function checkPrices(prices: readonly (number | null)[], estimates: readonly (number | null)[] = []): PriceCheck | null {
  if (prices.length < 2 || prices.some((p) => p == null || !Number.isFinite(p) || p <= 1)) return null;
  const ps = prices as number[];
  const nv = noVigProbabilities(ps);
  const mg = bookmakerMargin(ps);
  if (!nv || mg == null) return null;
  const implied = ps.map((p) => 100 / p);
  const noVig = nv.map((p) => p * 100);
  const gaps = noVig.map((m, i) => (estimates[i] == null ? null : Math.round(((estimates[i] as number) - m) * 100) / 100));
  let lead = 0;
  gaps.forEach((g, i) => {
    if (g != null && (gaps[lead] == null || Math.abs(g) > Math.abs(gaps[lead] as number))) lead = i;
  });
  return { implied, sum: (mg + 1) * 100, margin: mg * 100, noVig, gaps, lead };
}

/** Il testo di un input in una quota: virgola o punto, vuoto = null. */
export function parsePrice(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// ─── La striscia di tool precompilati ───────────────────────────────────────

export type StripItem = { slug: ToolSlug; sigla: string; result: ToolResult | null; values: ToolValues; href: string };

/** I tool di una striscia con i valori già scritti: risultato calcolato da lib/v3c/tools (stesse formule della pagina tool). */
export function toolStrip(items: readonly { slug: ToolSlug; values: ToolValues }[]): StripItem[] {
  return items.map(({ slug, values }) => {
    const def = toolDef(slug);
    const result = def.compute(values)[0] ?? null;
    const sp = new URLSearchParams();
    for (const i of def.inputs) {
      const x = values[i.key];
      if (x != null && Number.isFinite(x)) sp.set(i.key, String(Math.round(x * 100) / 100));
    }
    const q = sp.toString();
    return { slug, sigla: def.sigla, result, values, href: q ? `${toolPath(slug, "en")}?${q}` : toolPath(slug, "en") };
  });
}

/** Le tre quote del mercato di un esito come input p1/p2/p3. */
export function pricesAsInputs(ps: readonly (number | null)[]): ToolValues {
  return { p1: ps[0] ?? null, p2: ps[1] ?? null, p3: ps[2] ?? null };
}

/** Percentuale intera da una probabilità 0..1. */
export const pct0 = (p: number) => Math.round(p * 100);

/** L'esito calcio per indice 0/1/2. */
export const OUTCOMES: readonly Outcome[] = ["home", "draw", "away"];

export function outcomeByKey(m: V3BoardMatch, k: Outcome): V3BoardOutcome | undefined {
  return m.outcomes.find((o) => o.outcome === k);
}

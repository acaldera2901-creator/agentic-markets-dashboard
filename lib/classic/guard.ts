// lib/classic/guard.ts — #CLASSIC-CARD-1008 · Fase C (solo presentazione)
//
// Le regole d'onestà della review, portate da betredge/v3c-fixq (0909e2eb) e
// applicate ai dati che /api/predictions e /api/tennis servono OGGI. Nessuna API
// cambia: tutto si ricava da ciò che il client riceve già.
//
// Portate così come sono (con il loro nome): modelGuard + soglie 15/25 pp,
// hasStarted (fixdata.ts); sanePrice/saneMarketSet (fixdata2.ts); bestKey
// (books.ts); tzAbbr/hmLocal (time-ui.ts). Nuove qui, e dichiarate:
//
//   rawModelFromEstimate — IL LIMITE. Il modello grezzo non è pubblico: il numero
//   servito per il calcio è stima = 0,3·modello + 0,7·mercato
//   (lib/poisson-model.ts MARKET_BLEND_ALPHA). Lo si inverte:
//       modello ≈ (stima − 0,7·mercato) / 0,3
//   con il mercato de-viggato DALLE QUOTE SERVITE. Tre approssimazioni:
//   (a) il mercato con cui la pipeline ha fuso può essere un'altra cattura di
//       quelle quote; (b) l'inversione moltiplica l'errore per 3,33 (1 pp di
//       mercato sbagliato = 2,3 pp di modello sbagliato); (c) sulle righe chiuse
//       arriva una quota sola (l'esito di punta) e il suo margine non si
//       conosce: si usa DEFAULT_1X2_MARGIN (5%: misurato 4,9–5,1% sulle righe di
//       now/data/joined-football.json, 08/10), sempre lo stesso, così scheda e
//       fascia «differs most» non divergono. Va sostituito con model_p vero quando l'API lo servirà (gated).
//
//   dedupeByPair — coppia NON ordinata ±48 h (REGOLE-CLASSIC), invece della
//   coppia ordinata di dedupeFootballBoard: una gara di ritorno non cade mai
//   entro 48 ore dall'andata, quindi l'ordine non serve a separarle.
import { MODEL_WEIGHT, MARKET_WEIGHT } from "./prob";
import { bookmakerMargin } from "@/lib/betting-math";

// ─── B5 (fixdata.ts): la protezione modello–mercato ─────────────────────────

/** Above this |raw model − market| (pp, any outcome) no EV, Kelly, stake or edge badge is shown. */
export const GUARD_NO_VALUE_PP = 15;
/** Above this the estimate shown IS the market (gap 0): «Market only». */
export const GUARD_MARKET_ONLY_PP = 25;

export type ModelGuardLevel = "ok" | "no_value" | "market_only";
export type ModelGuard = { level: ModelGuardLevel; delta_pp: number | null };

/** The largest |raw model − de-vigged market| over the outcomes, in pp (verbatim from fixdata.ts). */
export function modelGuard(outcomes: readonly { model_p: number | null; market_p: number | null }[]): ModelGuard {
  let d: number | null = null;
  for (const o of outcomes) {
    if (o.model_p == null || o.market_p == null || !Number.isFinite(o.model_p) || !Number.isFinite(o.market_p)) continue;
    const x = Math.abs(o.model_p - o.market_p) * 100;
    d = d == null ? x : Math.max(d, x);
  }
  if (d == null) return { level: "ok", delta_pp: null };
  const delta_pp = Math.round(d * 10) / 10;
  const level: ModelGuardLevel = d > GUARD_MARKET_ONLY_PP ? "market_only" : d > GUARD_NO_VALUE_PP ? "no_value" : "ok";
  return { level, delta_pp };
}

/** True once the kick-off has passed (verbatim from fixdata.ts). */
export function hasStarted(kickoffIso: string, now: Date): boolean {
  const k = Date.parse(kickoffIso);
  return Number.isFinite(k) && k <= now.getTime();
}

// ─── N10 (fixdata2.ts): un prezzo assurdo non è un mercato ──────────────────

export const IMPLIED_MIN = 0.005;
export const IMPLIED_MAX = 0.99;
export const MARGIN_MIN = 0;
export const MARGIN_MAX = 0.25;

export function sanePrice(x: number | null | undefined): x is number {
  return typeof x === "number" && Number.isFinite(x) && x > 1 && 1 / x >= IMPLIED_MIN && 1 / x <= IMPLIED_MAX;
}

export function saneMarketSet(prices: readonly (number | null | undefined)[]): prices is number[] {
  if (prices.length < 2 || !prices.every(sanePrice)) return false;
  const m = bookmakerMargin(prices as number[]);
  return m != null && m >= MARGIN_MIN && m <= MARGIN_MAX;
}

// ─── N3 (fixdata2.ts): il prezzo equo contro il miglior prezzo reale ─────────

/** Il prezzo equo della stima (1/p) più lontano di così dal miglior prezzo reale → nessuna stima, «Market only». */
export const FAIR_VS_BEST_MAX = 0.25;
/** La regola legge gli esiti da questa stima in su (prezzo equo ≤ 10): sui longshot il margine pesa troppo. */
export const FAIR_CHECK_MIN_P = 0.1;

/**
 * fairFarFromBest di fixdata2.ts per UN esito (quello mostrato, accanto al bottone partner):
 * true se |1/stima − miglior prezzo| / miglior prezzo > 25%. Senza prezzo o sotto il 10%: false.
 */
export function fairFarFromBest(estimateP: number | null | undefined, bestPrice: number | null | undefined): boolean {
  if (estimateP == null || !(estimateP >= FAIR_CHECK_MIN_P && estimateP < 1) || bestPrice == null || !(bestPrice > 1)) return false;
  return Math.abs(1 / estimateP - bestPrice) / bestPrice > FAIR_VS_BEST_MAX;
}

// ─── Il modello grezzo, ricavato (vedi IL LIMITE in testa) ──────────────────

/** Margine 1X2 di riserva per de-viggare una quota sola (righe chiuse senza quote partner). */
export const DEFAULT_1X2_MARGIN = 0.05;
/** Lo stesso per il testa-a-testa del tennis (misurato 4–6% sulle coppie partner del 08/10). */
export const DEFAULT_2WAY_MARGIN = 0.05;

/** modello ≈ (stima − 0,7·mercato) / 0,3, dentro [0, 1]. null senza uno dei due. */
export function rawModelFromEstimate(estimate: number | null | undefined, market: number | null | undefined, w: number = MODEL_WEIGHT): number | null {
  if (estimate == null || market == null || !Number.isFinite(estimate) || !Number.isFinite(market) || !(w > 0)) return null;
  const raw = (estimate - (1 - w) * market) / w;
  return Math.min(1, Math.max(0, raw));
}

/** La probabilità de-viggata di UNA quota, dato il margine del suo mercato. */
export function devigOne(price: number | null | undefined, margin: number): number | null {
  if (!sanePrice(price)) return null;
  return 1 / price / (1 + Math.max(0, margin));
}

export { MODEL_WEIGHT, MARKET_WEIGHT };

// ─── books.ts: il migliore solo se lo è da solo ─────────────────────────────

/** Il book col prezzo più alto, SOLO se lo è da solo: a parità (o con un solo prezzo) nessuno è «best». */
export function bestKey(prices: Record<string, number>): string | null {
  const e = Object.entries(prices).sort((a, b) => b[1] - a[1]);
  if (e.length < 2 || e[0][1] === e[1][1]) return null;
  return e[0][0];
}

// ─── B6: la stessa partita due volte (coppia non ordinata, ±48 h) ───────────

export const PAIR_TWIN_WINDOW_H = 48;

/**
 * Una riga per partita: stesse due squadre/giocatori (in qualunque ordine) entro
 * 48 h = la stessa partita riprogrammata. Si tiene la PRIMA comparsa nell'ordine
 * dato (il chiamante decide la priorità: la riga del board così com'è arriva).
 * `norm` normalizza un nome (normName per il calcio, playerKey per il tennis).
 */
export function dedupeByPair<T>(rows: readonly T[], pick: (r: T) => { a: string; b: string; at: string }, norm: (n: string) => string): T[] {
  const windowMs = PAIR_TWIN_WINDOW_H * 3_600_000;
  const seen = new Map<string, number[]>();
  const out: T[] = [];
  for (const r of rows) {
    const { a, b, at } = pick(r);
    const key = [norm(a), norm(b)].sort().join("|");
    const t = Date.parse(at);
    const prev = seen.get(key) ?? [];
    if (Number.isFinite(t) && prev.some((p) => Math.abs(p - t) <= windowMs)) continue;
    seen.set(key, [...prev, Number.isFinite(t) ? t : NaN]);
    out.push(r);
  }
  return out;
}

// ─── time-ui.ts: un fuso, dichiarato una volta ──────────────────────────────

/** La sigla del fuso («CEST», «GMT+2», «UTC») all'istante `at`; undefined = UTC. (verbatim) */
export function tzAbbr(timeZone: string | undefined, locale = "en-GB", at: Date = new Date()): string {
  if (!timeZone || timeZone === "UTC" || timeZone === "Etc/UTC") return "UTC";
  try {
    const part = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "short" }).formatToParts(at).find((p) => p.type === "timeZoneName");
    return part?.value || timeZone;
  } catch {
    return timeZone;
  }
}

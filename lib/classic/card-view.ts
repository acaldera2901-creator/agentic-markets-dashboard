// lib/classic/card-view.ts — #CLASSIC-CARD-1008 · Fasi B/C
//
// Il «modello di vista» della scheda Slab: dato quello che il desk riceve già
// (/api/predictions, /api/tennis, /api/fortuneplay-odds), decide cosa la scheda
// può dire e come. Puro, testato in card-view.test.ts. Nessuna API cambia.
//
//   estimate     protezione ok (≤15 pp): stima in lime, mercato accanto, scarto col segno
//   protected    15–25 pp: stessi numeri, NESSUN segnale di valore (niente badge,
//                EV, Kelly, stake), bottone partner neutro
//   market_only  >25 pp (o tennis fuori dal tour principale / Elo vecchio): il numero È il mercato
//   model_only   nessun mercato: il numero è il modello, niente scarto né prezzo equo
//   elo_blend    tennis ATP/WTA con Elo ≤6 h: 0,1·Elo + 0,9·mercato, «Elo-based, not sealed»
//   no_price     nessun numero: né mercato né un numero nostro che regga da solo (#CLASSIC-FIX1-1008)
//
// #CLASSIC-FIX1-1008 — il mercato che manca si ricava dai prezzi veri dei book
// partner (de-vig per book, poi media: bookImpliedMarket, come fixdata2 N3) e lo
// si dichiara (`marketFrom: "partners"`). Senza quote servite la pipeline NON ha
// fuso col mercato (app/api/predictions: blendWithMarket(…, null) = identità),
// quindi lì la stima È il modello grezzo e non si inverte il blend.
// Senza alcun mercato:
//   calcio  «Model only» solo se il numero è recente (≤ 6 h, la stessa soglia
//           dell'Elo del tennis) — l'età è `oldest_computed_at` di /api/predictions,
//           l'unica che vale per ogni riga; altrimenti «No price yet».
//   tennis  mai l'Elo da solo: la stima Elo esiste solo fusa col mercato → «No price yet».
// Sanità (fixdata2 N3): prezzo equo della stima a > 25% dal miglior prezzo del
// book con link → «Market only», dove l'esito mostrato è noto.
//
// Le quote: chip per partner sul lato della pick (il migliore evidenziato solo
// se lo è da solo); su una riga CHIUSA il lato è ciò che il Pro compra, quindi
// i chip mostrano il miglior prezzo per OGNI esito (1·X·2), che non lo rivela.
// Partita iniziata: nessun prezzo pre-match e nessun bottone.
import { normName } from "@/lib/odds-api";
import { stessaSquadra } from "@/lib/fp-odds-join";
import { PARTNER_MARKET_MODEL } from "@/lib/partner-market";
import {
  DEFAULT_1X2_MARGIN,
  DEFAULT_2WAY_MARGIN,
  bestKey,
  devigOne,
  modelGuard,
  rawModelFromEstimate,
  fairFarFromBest,
  sanePrice,
  saneMarketSet,
  type ModelGuard,
} from "./guard";
import { market1x2, market2way } from "./prob";
import { isFlat } from "./scale";
import { TENNIS_ELO_MAX_AGE_MIN, tennisEstimate } from "./tennis-estimate";
import { playerKey, tennisPairId } from "./fixdata3";
import { teamPairKey } from "@/lib/team-pair-key";
import { noVigProbabilities } from "@/lib/betting-math";

export type ClassicKind = "estimate" | "protected" | "market_only" | "model_only" | "elo_blend" | "no_price";

/** Da dove viene il mercato accanto al numero: le quote servite con la riga, o i prezzi dei book partner. */
export type ClassicMarketFrom = "served" | "partners" | null;

/** Un numero nostro senza mercato si mostra solo se ha al più quest'età (la soglia dell'Elo del tennis). */
export const MODEL_ALONE_MAX_AGE_MIN = TENNIS_ELO_MAX_AGE_MIN;

/** Un book con le sue quote ALLINEATE agli esiti della riga (calcio [1,X,2], tennis [P1,P2]). */
export type ClassicBook = { key: string; name: string; url: string; prices: (number | null)[] };

/** Un partner senza feed quote (solo landing): compare come «Odds on partner site». */
export type ClassicLanding = { name: string; url: string };

export type ClassicChip = { key: string; name: string; url: string; price: number | null; best: boolean };
export type ClassicCell = { label: string; price: number; bookKey: string; bookName: string; url: string };

export type ClassicView = {
  kind: ClassicKind;
  /** Il numero grande, 0–100. */
  bigPct: number | null;
  /** Il mercato de-viggato dello stesso esito, 0–100 (null = nessun mercato). */
  marketPct: number | null;
  marketFrom: ClassicMarketFrom;
  /** «Market only» perché il prezzo equo della stima è a > 25% dal miglior prezzo partner. */
  priceFar: boolean;
  /** stima − mercato in pp, col segno; null dove non è legittimo dirlo. */
  gapPp: number | null;
  flat: boolean;
  guard: ModelGuard;
  /** EV, Kelly, stake, badge «+X%», tag di valore: solo se true. */
  valueAllowed: boolean;
  started: boolean;
  /** Chip per partner sul lato della pick (riga aperta). */
  chips: ClassicChip[];
  /** Miglior prezzo per esito (riga chiusa). */
  cells: ClassicCell[];
  /** Il bottone partner: il book col miglior prezzo, o il primo partner. null = niente bottone. */
  cta: { key: string; name: string; url: string; price: number | null } | null;
};

const pct = (p: number | null | undefined) => (p == null || !Number.isFinite(p) ? null : p * 100);
const round1 = (x: number) => Math.round(x * 10) / 10;

function finite(x: number | null | undefined): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

/** Il mercato implicito dai book partner (de-viggato per book, medio), solo dai set sani (fixdata2 N3/N10). */
export function bookImpliedMarket(books: readonly ClassicBook[], legs: number): number[] | null {
  const sets: number[][] = [];
  for (const b of books) {
    const prices = b.prices.slice(0, legs);
    if (prices.length !== legs || !saneMarketSet(prices)) continue;
    const p = noVigProbabilities(prices as number[]);
    if (p) sets.push(p);
  }
  if (!sets.length) return null;
  return Array.from({ length: legs }, (_, i) => sets.reduce((a, s) => a + s[i], 0) / sets.length);
}

/**
 * Riga chiusa: l'esito di punta non si dice (lo compra il Pro), ma per leggerlo
 * contro il mercato dei book bisogna sapere quale sia. Il server manda l'argmax
 * della tripla (lockedHeadline); qui si prende l'esito del mercato più vicino al
 * numero, e lo si accetta SOLO se è anche il favorito del mercato (un solo
 * minimo): se il nostro esito di punta non è il favorito dei book, non si indovina.
 */
export function leadFromMarket(x: number | null | undefined, mkt: readonly number[] | null): number | null {
  if (!finite(x) || !mkt || !mkt.length) return null;
  const d = mkt.map((m) => Math.abs(x - m));
  const k = d.indexOf(Math.min(...d));
  if (d.filter((v) => v === d[k]).length > 1) return null;
  const fav = mkt.indexOf(Math.max(...mkt));
  if (mkt.filter((v) => v === mkt[fav]).length > 1) return null;
  return k === fav ? k : null;
}

/** Il miglior prezzo di un esito fra i book CON link. */
function bestLinkedPrice(books: readonly ClassicBook[], idx: number): number | null {
  let best: number | null = null;
  for (const b of books) {
    const v = b.prices[idx];
    if (b.url && sanePrice(v) && (best == null || v > best)) best = v;
  }
  return best;
}

/** Il numero ha al più MODEL_ALONE_MAX_AGE_MIN minuti? Senza data: no. */
export function freshEnough(asOf: string | null | undefined, now: Date): boolean {
  const t = asOf ? Date.parse(asOf) : NaN;
  return Number.isFinite(t) && (now.getTime() - t) / 60_000 <= MODEL_ALONE_MAX_AGE_MIN;
}


function chipsFor(books: readonly ClassicBook[], idx: number, landing: readonly ClassicLanding[], max = 3): ClassicChip[] {
  const priced: Record<string, number> = {};
  for (const b of books) {
    const v = b.prices[idx];
    if (sanePrice(v)) priced[b.key] = Math.max(priced[b.key] ?? 0, v);
  }
  const best = bestKey(priced);
  const withPrice = books
    .filter((b) => priced[b.key] != null)
    .sort((a, b) => priced[b.key] - priced[a.key])
    .map((b) => ({ key: b.key, name: b.name, url: b.url, price: priced[b.key], best: b.key === best }));
  const noPrice = [
    ...books.filter((b) => priced[b.key] == null).map((b) => ({ key: b.key, name: b.name, url: b.url })),
    ...landing.map((l) => ({ key: normName(l.name).toLowerCase(), name: l.name, url: l.url })),
  ]
    .filter((x, i, arr) => arr.findIndex((y) => y.name === x.name) === i && !withPrice.some((w) => w.name === x.name))
    .map((x) => ({ ...x, price: null, best: false }));
  return [...withPrice, ...noPrice].slice(0, max);
}

function cellsFor(books: readonly ClassicBook[], labels: readonly string[]): ClassicCell[] {
  const out: ClassicCell[] = [];
  labels.forEach((label, i) => {
    let best: ClassicCell | null = null;
    for (const b of books) {
      const v = b.prices[i];
      if (sanePrice(v) && (best == null || v > best.price)) best = { label, price: v, bookKey: b.key, bookName: b.name, url: b.url };
    }
    if (best) out.push(best);
  });
  return out.length === labels.length ? out : [];
}

function ctaFrom(chips: readonly ClassicChip[], cells: readonly ClassicCell[], books: readonly ClassicBook[], landing: readonly ClassicLanding[]): ClassicView["cta"] {
  const c = chips.find((x) => x.price != null);
  if (c) return { key: c.key, name: c.name, url: c.url, price: c.price };
  const cell = cells[0];
  if (cell) {
    const b = books.find((x) => x.key === cell.bookKey);
    if (b) return { key: b.key, name: b.name, url: b.url, price: null };
  }
  if (books[0]) return { key: books[0].key, name: books[0].name, url: books[0].url, price: null };
  if (landing[0]) return { key: normName(landing[0].name).toLowerCase(), name: landing[0].name, url: landing[0].url, price: null };
  return null;
}

function finish(
  base: Pick<ClassicView, "kind" | "bigPct" | "marketPct" | "guard"> & { gap: number | null; from?: ClassicMarketFrom; far?: boolean },
  started: boolean,
  chips: ClassicChip[],
  cells: ClassicCell[],
  cta: ClassicView["cta"],
): ClassicView {
  const legit = base.kind === "estimate" || base.kind === "protected" || base.kind === "elo_blend";
  const gapPp = legit && base.gap != null ? round1(base.gap) : null;
  return {
    kind: base.kind,
    bigPct: base.kind === "no_price" ? null : base.bigPct,
    marketPct: base.kind === "no_price" ? null : base.marketPct,
    marketFrom: base.kind === "no_price" || base.kind === "model_only" ? null : base.from ?? null,
    priceFar: base.kind === "market_only" && base.far === true,
    gapPp,
    flat: gapPp != null && isFlat(gapPp),
    guard: base.guard,
    valueAllowed: base.kind === "estimate" && base.guard.level === "ok",
    started,
    // partita iniziata: niente prezzo pre-match, niente bottone (REGOLE-CLASSIC)
    chips: started ? [] : chips,
    cells: started ? [] : cells,
    cta: started ? null : cta,
  };
}

// ─── Calcio ─────────────────────────────────────────────────────────────────

export type ClassicFootballInput = {
  started: boolean;
  /** Riga aperta: la tripla servita (stima) e le quote servite, e l'esito mostrato (0/1/2). */
  est?: [number | null | undefined, number | null | undefined, number | null | undefined] | null;
  odds?: [number | null | undefined, number | null | undefined, number | null | undefined] | null;
  leadIdx?: 0 | 1 | 2 | null;
  /** Riga chiusa: la stima e la quota dell'esito di punta, senza dire quale. */
  estLead?: number | null;
  oddsLead?: number | null;
  books: readonly ClassicBook[];
  landing?: readonly ClassicLanding[];
  labels?: readonly [string, string, string];
  /** L'età del numero senza mercato: `oldest_computed_at` di /api/predictions. Senza: mai «Model only». */
  modelAsOf?: string | null;
  now?: Date;
};

const OK_GUARD: ModelGuard = { level: "ok", delta_pp: null };

export function classicFootballView(i: ClassicFootballInput): ClassicView {
  const books = i.books;
  const landing = i.landing ?? [];
  const labels = i.labels ?? ["1", "X", "2"];
  const open = !!i.est && i.est.every(finite) && i.leadIdx != null;
  const alone = (x: number | null) =>
    x != null && freshEnough(i.modelAsOf, i.now ?? new Date())
      ? { kind: "model_only" as const, bigPct: pct(x), marketPct: null, guard: OK_GUARD, gap: null }
      : { kind: "no_price" as const, bigPct: null, marketPct: null, guard: OK_GUARD, gap: null };

  // Il numero e il suo mercato → il tipo di lettura. `raw`: la stima È il modello
  // (nessuna quota servita = nessun blend), altrimenti si inverte il 30/70.
  const read = (estimates: readonly number[], mkt: readonly number[], idx: number, raw: boolean, from: ClassicMarketFrom, best: number | null) => {
    const guard = modelGuard(estimates.map((e, k) => ({ model_p: raw ? e : rawModelFromEstimate(e, mkt[k]), market_p: mkt[k] })));
    if (guard.level === "market_only") {
      return { kind: "market_only" as const, bigPct: pct(mkt[idx]), marketPct: pct(mkt[idx]), guard, gap: null, from };
    }
    if (fairFarFromBest(estimates[idx], best)) {
      return { kind: "market_only" as const, bigPct: pct(mkt[idx]), marketPct: pct(mkt[idx]), guard, gap: null, from, far: true };
    }
    return { kind: guard.level === "ok" ? ("estimate" as const) : ("protected" as const), bigPct: pct(estimates[idx]), marketPct: pct(mkt[idx]), guard, gap: (estimates[idx] - mkt[idx]) * 100, from };
  };

  if (open) {
    const est = i.est as [number, number, number];
    const idx = i.leadIdx as 0 | 1 | 2;
    // il mercato: le quote servite se sono un mercato possibile (N10), altrimenti i book partner
    const served = i.odds && saneMarketSet(i.odds as number[]) ? market1x2({ home: i.odds[0], draw: i.odds[1], away: i.odds[2] }) : null;
    const noServed = !i.odds || i.odds.every((x) => x == null);
    const mkt = served ? [served.p.home, served.p.draw, served.p.away] : bookImpliedMarket(books, 3);
    const chips = chipsFor(books, idx, landing);
    const cta = ctaFrom(chips, [], books, landing);
    if (!mkt) return finish(alone(est[idx]), i.started, chips, [], cta);
    return finish(read(est, mkt, idx, !served && noServed, served ? "served" : "partners", bestLinkedPrice(books, idx)), i.started, chips, [], cta);
  }

  // riga chiusa: un esito solo, senza nome
  const cells = cellsFor(books, labels);
  const cta = ctaFrom([], cells, books, landing);
  const estLead = finite(i.estLead) ? i.estLead : null;
  if (estLead == null) return finish(alone(null), i.started, [], cells, cta);
  // Il margine della quota servita non si conosce: si usa quello di riserva (5%), SEMPRE —
  // non quello di un book partner, che è un altro mercato. Così la scheda e la fascia
  // «Where our estimate differs most» (che le quote partner non le ha) dicono la stessa cosa.
  const mLead = devigOne(i.oddsLead, DEFAULT_1X2_MARGIN);
  if (mLead == null) {
    // nessuna quota servita: la stima è il modello grezzo; il mercato, se c'è, dai book partner
    const bm = bookImpliedMarket(books, 3);
    const k = leadFromMarket(estLead, bm);
    if (!bm || k == null) return finish(alone(estLead), i.started, [], cells, cta);
    const one = [estLead];
    return finish(read(one, [bm[k]], 0, true, "partners", bestLinkedPrice(books, k)), i.started, [], cells, cta);
  }
  const guard = modelGuard([{ model_p: rawModelFromEstimate(estLead, mLead), market_p: mLead }]);
  if (guard.level === "market_only") {
    return finish({ kind: "market_only", bigPct: pct(mLead), marketPct: pct(mLead), guard, gap: null, from: "served" }, i.started, [], cells, cta);
  }
  return finish(
    { kind: guard.level === "ok" ? "estimate" : "protected", bigPct: pct(estLead), marketPct: pct(mLead), guard, gap: (estLead - mLead) * 100, from: "served" },
    i.started, [], cells, cta,
  );
}

// ─── Tennis ─────────────────────────────────────────────────────────────────

export type ClassicTennisInput = {
  started: boolean;
  modelVersion: string | null | undefined;
  tournament: string | null | undefined;
  player1: string;
  player2: string;
  /** Riga aperta. */
  p?: [number | null | undefined, number | null | undefined] | null;
  odds?: [number | null | undefined, number | null | undefined] | null;
  leadIdx?: 0 | 1 | null;
  /** Riga chiusa. */
  pLead?: number | null;
  oddsLead?: number | null;
  /** L'ora dello snapshot Elo (oggi: computed_at della risposta /api/tennis — vedi il limite nel report). */
  eloAsOf: string | null | undefined;
  now: Date;
  books: readonly ClassicBook[];
  landing?: readonly ClassicLanding[];
  labels?: readonly [string, string];
};

export function classicTennisView(i: ClassicTennisInput): ClassicView {
  const books = i.books;
  const landing = i.landing ?? [];
  const labels = i.labels ?? ["P1", "P2"];
  const open = !!i.p && i.p.every(finite) && i.leadIdx != null;
  const partnerRow = i.modelVersion === PARTNER_MARKET_MODEL;
  let idx: number | null = open ? (i.leadIdx as 0 | 1) : null;
  const shown = open ? (i.p as [number, number])[idx as number] : finite(i.pLead) ? i.pLead : null;

  // il mercato del lato mostrato: quote servite, altrimenti i book partner
  let mLead: number | null = null;
  let from: ClassicMarketFrom = null;
  if (open) {
    const served = i.odds && saneMarketSet(i.odds as number[]) ? market2way(i.odds[0], i.odds[1]) : null;
    const bm = served ? null : bookImpliedMarket(books, 2);
    const mkt = served ? [served.p1, served.p2] : bm;
    mLead = mkt ? mkt[idx as number] : null;
    from = served ? "served" : mkt ? "partners" : null;
  } else {
    mLead = devigOne(i.oddsLead, DEFAULT_2WAY_MARGIN); // vedi il calcio: margine di riserva, sempre
    if (mLead != null) from = "served";
    else {
      const bm = bookImpliedMarket(books, 2);
      const k = leadFromMarket(shown, bm);
      if (bm && k != null) { mLead = bm[k]; idx = k; from = "partners"; }
    }
  }
  if (partnerRow && shown != null && mLead == null) { mLead = shown; from = "served"; } // la riga partner È il mercato de-viggato

  const chips = open ? chipsFor(books, idx as number, landing) : [];
  const cells = open ? [] : cellsFor(books, labels);
  const cta = ctaFrom(chips, cells, books, landing);

  // Nel tennis il nostro numero non sta mai da solo: senza mercato, nessun numero.
  if (mLead == null) {
    return finish({ kind: "no_price", bigPct: null, marketPct: null, guard: OK_GUARD, gap: null }, i.started, chips, cells, cta);
  }
  const marketOnly = (far = false) => finish({ kind: "market_only", bigPct: pct(mLead), marketPct: pct(mLead), guard: OK_GUARD, gap: null, from, far }, i.started, chips, cells, cta);
  if (partnerRow) return marketOnly();
  // Il lato mostrato vale come «player1» della stima (l'orientamento non serve: un lato solo).
  const est = tennisEstimate(
    {
      tournament: i.tournament ?? null,
      player1: idx === 1 ? i.player2 : i.player1,
      player2: idx === 1 ? i.player1 : i.player2,
      model_version: i.modelVersion ?? "",
      market_p1: mLead,
      market_p2: 1 - mLead,
      elo_p1: shown,
      elo_p2: shown == null ? null : 1 - shown,
      elo_as_of: i.eloAsOf ?? null,
      elo_home: null,
    },
    i.now,
  );
  if (est.estimate_kind !== "elo_blend_unsealed" || !est.estimate_p) return marketOnly();
  // sanità: il prezzo equo della stima contro il miglior prezzo del book con link
  if (idx != null && fairFarFromBest(est.estimate_p.p1, bestLinkedPrice(books, idx))) return marketOnly(true);
  const g: ModelGuard = { level: est.gap_visible ? "ok" : "no_value", delta_pp: shown == null ? null : round1(Math.abs(shown - mLead) * 100) };
  return finish(
    { kind: "elo_blend", bigPct: pct(est.estimate_p.p1), marketPct: pct(mLead), guard: g, gap: est.gap_visible && est.gap_pp ? est.gap_pp.p1 : null, from },
    i.started, chips, cells, cta,
  );
}

// ─── Allineamento delle quote partner agli esiti della riga ─────────────────

type BookOddsLike = { key: string; name: string; oddsHome: number | null; oddsDraw: number | null; oddsAway: number | null; matchUrl: string };
type FpLike = { homeKey: string; awayKey: string; books?: BookOddsLike[]; oddsHome: number | null; oddsDraw: number | null; oddsAway: number | null; matchUrl: string };

/** Calcio: i book di una voce /api/fortuneplay-odds allineati a [casa, pareggio, ospite] della riga. */
export function footballBooks(fp: FpLike | null | undefined, home: string, away: string): ClassicBook[] {
  if (!fp) return [];
  const swap = !(fp.homeKey === normName(home) || stessaSquadra(fp.homeKey, home)) && (fp.homeKey === normName(away) || stessaSquadra(fp.homeKey, away));
  const list: BookOddsLike[] = fp.books?.length ? fp.books : [{ key: "fortuneplay", name: "FortunePlay", oddsHome: fp.oddsHome, oddsDraw: fp.oddsDraw, oddsAway: fp.oddsAway, matchUrl: fp.matchUrl }];
  return list.map((b) => ({ key: b.key, name: b.name, url: b.matchUrl, prices: swap ? [b.oddsAway, b.oddsDraw, b.oddsHome] : [b.oddsHome, b.oddsDraw, b.oddsAway] }));
}

/**
 * Tennis: la voce /api/fortuneplay-odds di una partita. Prima la chiave esatta
 * (teamPairKey); se manca, la stessa coppia nello stesso giorno con i nomi in
 * qualunque ordine di token (#CLASSIC-FIX1-1008: «Zheng Qinwen» = «Qinwen Zheng»,
 * «Bai Zhuoxuan» = «Zhuoxuan Bai», fixdata3 tennisPairId). Una sola candidata, o nessuna.
 */
export function tennisOddsFor<T extends FpLike>(fpOdds: Readonly<Record<string, T>>, player1: string, player2: string, startsAt: string): T | null {
  const k = teamPairKey("tennis", player1, player2, startsAt);
  if (k && fpOdds[k]) return fpOdds[k];
  const day = startsAt.slice(0, 10);
  const id = tennisPairId(player1, player2);
  const hits = Object.entries(fpOdds).filter(([key, v]) => key.startsWith(`${day}:`) && tennisPairId(v.homeKey, v.awayKey) === id);
  return hits.length === 1 ? hits[0][1] : null;
}

/** Tennis: allineati a [player1, player2] per nome (token in qualunque ordine); senza corrispondenza, nessun book. */
export function tennisBooks(fp: FpLike | null | undefined, player1: string, player2: string): ClassicBook[] {
  if (!fp) return [];
  const k1 = playerKey(player1);
  const k2 = playerKey(player2);
  const h = playerKey(fp.homeKey);
  const a = playerKey(fp.awayKey);
  const straight = h === k1 || a === k2;
  const swapped = h === k2 || a === k1;
  if (!straight && !swapped) return [];
  const list: BookOddsLike[] = fp.books?.length ? fp.books : [{ key: "fortuneplay", name: "FortunePlay", oddsHome: fp.oddsHome, oddsDraw: null, oddsAway: fp.oddsAway, matchUrl: fp.matchUrl }];
  return list.map((b) => ({ key: b.key, name: b.name, url: b.matchUrl, prices: straight ? [b.oddsHome, b.oddsAway] : [b.oddsAway, b.oddsHome] }));
}

// ─── «Where our estimate differs most» (ex Top opportunities / High edge) ────

/**
 * |scarto| in pp di una riga, se può entrare nella fascia; null = fuori.
 * Dentro solo il calcio con protezione ok (modello grezzo ≤ 15 pp dal mercato):
 * lo scarto del tennis Elo-based non è mai un criterio d'ordine (tennis-estimate.ts),
 * e una riga protetta, Market only o Model only non è un «dove differiamo».
 * Si calcola sui numeri serviti (senza le quote partner, che la lista non ha):
 * sulle righe aperte è identico alla scheda; sulle chiuse il margine è quello di riserva.
 */
export function differsBy(data: { sport: string; startsAt: string; isLive: boolean; classic?: { sport: string } & Record<string, unknown> }): number | null {
  const raw = data.classic as Parameters<typeof classicFootballView>[0] & { sport: string } | undefined;
  if (!raw || raw.sport !== "football" || data.isLive) return null;
  const v = classicFootballView({ ...raw, started: false, books: [] });
  return v.kind === "estimate" && v.gapPp != null && !v.flat ? Math.abs(v.gapPp) : null;
}

/**
 * La scheda partita (MatchDetailSheet) mostra i tag «+X%» e il «value» della testa
 * solo se la protezione della riga è ok — la stessa decisione della scheda Slab,
 * con le stesse quote partner. Tennis: mai (lo scarto Elo non è un segnale di valore).
 */
export function sheetValueAllowed(data: { sport: string; home: string; away: string; classic?: { sport: string } & Record<string, unknown> }, fp: FpLike | null | undefined): boolean {
  const raw = data.classic as (Parameters<typeof classicFootballView>[0] & { sport: string }) | undefined;
  if (!raw || raw.sport !== "football") return false;
  return classicFootballView({ ...raw, started: false, books: footballBooks(fp, data.home, data.away) }).valueAllowed;
}

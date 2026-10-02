import { dedupeByFixture } from "@/lib/dedupe-fixtures";
import { footballSurfaceDecisionFor } from "@/lib/surfacing-gate";
import { probabilitySourceOf } from "@/lib/partner-market";
import { wilson95, formatWilson } from "@/lib/wilson";

// #HITRATE-GUARD-1 (copy audit 2026-06-11, Andrea: anchor comms to sustainable
// rates, never small-sample spikes like the 93.8% football day-one figure).
//
// A published hit-rate is a CLAIM. Below this many decided picks (won+lost) the
// percentage is variance, not signal — at 4 settled matches a 75% reads like a
// promise the next weekend will break. Until the threshold is met the UI shows
// the raw record (X won · Y lost) and no percentage, everywhere a rate renders:
// WC TrackRecordStrip, History KPIs, desk header KPI, house banners.
// Sustainable anchors (walk-forward held-out): WC ~64-67%, club ~70%,
// friendlies ~74%, qualifiers ~75%, tennis ~72%.
export const MIN_DECIDED_FOR_RATE = 15;

export function isRateMeaningful(decided: number): boolean {
  return Number.isFinite(decided) && decided >= MIN_DECIDED_FOR_RATE;
}

// #SETTLE-0909 — LE DUE SOGLIE SONO DUE DECISIONI DIVERSE, non un doppione.
// Vanno dichiarate qui insieme, o il prossimo che le trova ne allinea una
// all'altra convinto di riparare un bug — ed e' esattamente cosi' che nasce un
// numero che nessuno ha deciso.
//
//   · MIN_DECIDED_FOR_RATE = 15 — la soglia di DISPLAY, per ogni percentuale
//     secondaria: un segmento, una striscia, un banner. Scelta nell'audit copy
//     dell'11/06 con Andrea: sotto i 15 esiti la percentuale e' varianza.
//
//   · MIN_SAMPLE = 30 in app/api/v2/history/route.ts — la soglia del CLAIM
//     PRINCIPALE, il numero che il prodotto mette in testa alla pagina come
//     track record. Piu' alta di proposito: e' l'unica cifra che un cliente
//     ricorda, e sopra quella soglia l'intervallo di Wilson e' abbastanza
//     stretto da non essere fuorviante.
//
// Quindi: un segmento con 20 esiti mostra la sua percentuale, l'headline no.
// Se una delle due va cambiata, si cambia con una decisione, non per simmetria.

// ─── #EDGE-SELETTIVITA-0917 ──────────────────────────────────────────────────
//
// LA TERZA SOGLIA, e non e' della stessa famiglia delle due qui sopra: quelle
// dicono QUANDO una percentuale si puo' pubblicare, questa dice SU QUALI PICK
// si puo' dire «Edge».
//
// Il fatto che la rende necessaria. #PICK-SEMPRE-0911 ha spento i floor: ogni
// partita porta una pick, e il track record e' passato da 65,1% a 59,6%. Non e'
// un peggioramento del modello — e' un cambio di popolazione. Misurato il 17/09
// sulle righe pubblicate (2.880 dopo dedup, letture read-only):
//
//   confidenza   [0,50)  40,7% · [50,56) 57,0% · [56,62) 60,1%
//                [62,70) 63,0% · [70,80) 69,9% · [80,100] 86,5%
//
// La monotonia regge sul DATO LIVE, non su un backtest: e' la stessa cosa che
// il lab aveva trovato il 08/06 (calibrazione + selettivita'), qui confermata su
// quello che abbiamo davvero servito. Alla soglia 62:
//
//   football  >=62: 77,0% (n=204)  ·  <62: 44,7% (n=996)   → +32,3 punti
//   tennis    >=62: 69,2% (n=951)  ·  <62: 60,6% (n=513)   →  +8,6 punti
//
// PERCHE' 62 E NON UN ALTRO NUMERO: e' il floor gia' deciso e gia' scritto per
// il tennis di alta fascia e per la UEFA Nations League in lib/surfacing-gate.ts
// (SURFACE_FLOOR_TENNIS, SURFACE_FLOOR_NATIONS_UEFA). Non si inventa una soglia
// nuova per una nuova etichetta: se ne riusa una che qualcuno ha gia' deciso, o
// fra un mese ce ne sono tre che nessuno sa piu' distinguere.
//
// PROBABILITY-NEUTRAL: questa soglia NON filtra cosa si serve e non tocca
// nessuna probabilita'. Separa soltanto, dentro il track record, le pick su cui
// dichiariamo un vantaggio da quelle che pubblichiamo comunque.
export const EDGE_MIN_CONFIDENCE = 62;

export function isEdgePick(confidence: number | null | undefined): boolean {
  return typeof confidence === "number"
    && Number.isFinite(confidence)
    && confidence >= EDGE_MIN_CONFIDENCE;
}

export type EdgeTally = {
  /** Pick con confidenza >= EDGE_MIN_CONFIDENCE e un esito. */
  n: number;
  won: number;
  lost: number;
  /** Quota di volume: quante delle pick decise portano l'etichetta. */
  share: number | null;
  /** null sotto MIN_DECIDED_FOR_RATE: una percentuale su 4 esiti non e' un dato. */
  win_rate: number | null;
};

/**
 * Conta le pick «Edge» fra righe gia' filtrate (mostrate + verificate).
 *
 * Funzione pura. Una riga senza confidenza NON e' Edge: l'assenza del dato non
 * si legge come se fosse sopra soglia — fail-closed, come il resto del gate.
 */
/**
 * #TRE-LIVELLI-0925-CUTOVER — il conteggio di una popolazione qualsiasi di righe
 * chiuse.
 *
 * Serve a pubblicare, accanto al numero in testa alla pagina, la popolazione
 * POST-CUTOVER che il floor di lega esclude dall'headline (righe con
 * `starts_at` da `FOOTBALL_FLOOR_CUTOVER_AT` in poi, sotto il floor della loro
 * lega). Senza questo, l'esclusione sarebbe silenziosa: una percentuale che
 * sale perche' qualcuno ha ristretto il denominatore, e nessun modo per chi
 * legge di accorgersene. Stessa forma additiva di #EDGE-SELETTIVITA-0917.
 *
 * Funzione pura. `win_rate` resta null sotto MIN_DECIDED_FOR_RATE, per la stessa
 * ragione di edgeTally: una percentuale su pochi esiti non e' un dato.
 */
export function outcomeTally(
  rows: { result?: string | null }[]
): { n: number; won: number; lost: number; win_rate: number | null } {
  const decise = rows.filter((r) => r.result === "won" || r.result === "lost");
  const won = decise.filter((r) => r.result === "won").length;
  return {
    n: decise.length,
    won,
    lost: decise.length - won,
    win_rate: isRateMeaningful(decise.length)
      ? Number(((won / decise.length) * 100).toFixed(1))
      : null,
  };
}

export function edgeTally(
  rows: { result?: string | null; confidence_score?: number | null }[]
): EdgeTally {
  const decise = rows.filter((r) => r.result === "won" || r.result === "lost");
  const edge = decise.filter((r) => isEdgePick(r.confidence_score));
  const won = edge.filter((r) => r.result === "won").length;
  const lost = edge.length - won;
  return {
    n: edge.length,
    won,
    lost,
    share: decise.length > 0 ? Number((edge.length / decise.length).toFixed(3)) : null,
    win_rate: isRateMeaningful(edge.length)
      ? Number(((won / edge.length) * 100).toFixed(1))
      : null,
  };
}

// ─── #TRE-LIVELLI-0925-CUTOVER (Andrea, 25/09: «nessun salto, nessuna
// retroattivita'») ────────────────────────────────────────────────────────────
//
// Il calcio torna ad avere un floor che decide (footballSurfaceDecisionFor in
// lib/surfacing-gate.ts, PICK_SEMPRE_FAVORITO che non lo bypassa piu' per il
// calcio). Applicarlo al numero pubblico di /api/v2/history SENZA un cutover
// sarebbe retroattivo: quel numero si ri-deriva dalla riga a ogni lettura
// (competition + confidence_score), quindi cambierebbe anche il giudizio su
// righe GIA' PUBBLICATE — la stessa survivorship contro cui avvertono i
// commenti di isSurfacedRow e di #MINORS-TIGHTEN.
//
// La regola: le righe con `starts_at` PRIMA di questo istante contano come
// contavano il 25/09 — ogni pick mostrata e' pick, il comportamento
// PICK_SEMPRE_FAVORITO di sempre, invariato. Solo le righe con `starts_at` DA
// questo istante IN POI passano dal nuovo gate a floor. Nessuna riga gia'
// pubblicata sparisce o cambia esito nel conteggio principale.
//
// PERCHE' `starts_at` e non `settled_at`: e' lo stesso campo che
// /api/v2/history usa gia' per ordinare e filtrare la history
// (#HISTORY-ORDINE-0911 — «la cronologia delle nostre previsioni, l'ordine che
// ci si aspetta e' quello degli eventi»). Introdurne uno nuovo per il cutover
// avrebbe reso la stessa riga ordinata su un campo e tagliata su un altro.
//
// Il valore E' la decisione stessa (APPROVE Andrea, 25/09/2026 — via il livello
// intermedio, il floor decide di nuovo per il calcio): non e' una soglia da
// ricalibrare, e non si sposta per far tornare un numero.
export const FOOTBALL_FLOOR_CUTOVER_AT = "2026-09-25T00:00:00Z";

/**
 * Vero se la riga e' PRIMA del cutover (conta con la regola vecchia: ogni
 * pick mostrata e' pick, nessun gate di floor). Fail-safe: `starts_at`
 * assente o non parsabile ricade su "prima del cutover" — una riga di cui non
 * si puo' leggere la data non deve poter essere retroattivamente esclusa da un
 * gate nuovo.
 */
export function isBeforeFootballFloorCutover(
  startsAt: string | Date | null | undefined
): boolean {
  if (startsAt == null) return true;
  const t = startsAt instanceof Date ? startsAt.getTime() : new Date(startsAt).getTime();
  if (!Number.isFinite(t)) return true;
  return t < new Date(FOOTBALL_FLOOR_CUTOVER_AT).getTime();
}

// ─── #COERENZA-1001 — UNA SOLA DEFINIZIONE DI «PICK CHE CONTA» ───────────────
//
// Prima la stessa domanda aveva due risposte scritte a mano: wasShownAsPick in
// app/api/v2/history/route.ts e countsAsShownPick in lib/yesterday-read.ts. La
// seconda lasciava passare `verification_state` NULL e non deduplicava le
// gemelle: due superfici, due numeri. Ora la popolazione si calcola qui, una
// volta, e la usano entrambe (il test di coerenza è lib/track-record-coherence.test.ts).

/** Le condizioni SQL della popolazione del track record: pubblicata, non demo,
 *  e FINITA — chiusa (is_historical) o iniziata da più di 48 ore. Include di
 *  proposito le righe senza esito (unresolved, NULL) e le non verificate: sono
 *  il denominatore della copertura, non della percentuale. */
export const TRACK_RECORD_BASE_CONDITIONS: readonly string[] = [
  "is_demo = FALSE",
  "published_at IS NOT NULL",
  "(is_historical = TRUE OR starts_at < NOW() - INTERVAL '48 hours')",
];

type ShownRow = { pick?: string | null; notes?: string | null; competition?: string | null };

/**
 * #TRACKREC-REAL-0626 + #WC-FLOOR-0707 — la riga è stata MOSTRATA come pick.
 * Si legge il verdetto PERSISTITO dal board, non si ri-deriva il floor:
 *   - `pick` null → nessuna pick direzionale mostrata;
 *   - notes.surface.below_floor === true → «nessun chiaro favorito», esclusa,
 *     TRANNE la World Cup (floor WC abbassato lato lab: quelle pick si mostrano);
 *   - nessun flag (righe legacy) → il board mostra la pick, quindi conta.
 */
export function isShownPick(row: ShownRow): boolean {
  if (!row.pick) return false;
  let belowFloor = false;
  try {
    const surface = (JSON.parse(row.notes ?? "{}") as { surface?: { below_floor?: boolean } }).surface;
    belowFloor = surface?.below_floor === true;
  } catch { /* unparseable/absent notes → treat as above floor → count it */ }
  if (!belowFloor) return true;
  return row.competition === "World Cup";
}

type TrackRecordRow = ShownRow & {
  sport?: string | null;
  market?: string | null;
  home_team?: string | null;
  away_team?: string | null;
  result?: string | null;
  verification_state?: string | null;
  starts_at?: string | null;
  published_at?: string | null;
  confidence_score?: number | null;
  model_version?: string | null;
};

/** #DUP-FIXTURES-0821 + #COERENZA-1001 — la stessa partita (e lo stesso
 *  mercato) conta una volta. Vince la riga con `published_at` più VECCHIO: la
 *  pick che il cliente ha visto per prima, non quella aggiornata per ultima
 *  dal settlement (prima vinceva `settled_at` più recente, una scelta
 *  amministrativa che nelle gemelle con pick opposte decideva l'esito). */
export function dedupeShownPicks<T extends TrackRecordRow>(rows: T[]): T[] {
  return dedupeByFixture(rows, {
    when: (r) => r.starts_at,
    freshness: (r) => r.published_at,
    oldest: true,
    extra: (r) => `${r.sport ?? ""}|${r.market ?? ""}`,
  });
}

const RESOLVED = new Set(["won", "lost", "void"]);

/**
 * La popolazione del track record, scomposta. L'ordine delle righe in
 * ingresso si conserva in ogni insieme.
 *
 *   surfaced     mostrate (isShownPick), deduplicate, finite → il DENOMINATORE
 *                della copertura: comprende anche le righe senza esito
 *   rows         mostrate CON esito (won/lost/void), deduplicate fra loro, e
 *                verificate → la lista dello storico
 *   headlineRows rows meno il floor calcio post-cutover → il NUMERO pubblico
 *
 * Perché due dedup e non uno: le gemelle nascono da un cambio di id del
 * provider, e spesso la riga vecchia resta senza esito mentre la nuova si
 * chiude. Deduplicando tutto insieme, la vecchia (pubblicata prima) vincerebbe
 * e un esito NOTO sparirebbe dal numero (misurato il 01/10: −101 righe). Quindi
 * l'esito si sceglie fra le gemelle che ce l'hanno — la pubblicata per prima —
 * e il denominatore conta le partite, con o senza esito.
 *
 * Le esclusioni sommano al denominatore: surfaced = headline + unverified +
 * floor + unresolved (quest'ultimo per differenza: partite mostrate e finite
 * che non hanno un esito su nessuna gemella).
 */
export function trackRecordPopulation<T extends TrackRecordRow>(fetched: T[]) {
  const shown = fetched.filter(isShownPick);
  const surfaced = dedupeShownPicks(shown);
  const shownResolved = shown.filter((r) => RESOLVED.has(r.result ?? ""));
  const resolved = dedupeShownPicks(shownResolved);
  const rows = resolved.filter((r) => r.verification_state === "verified");
  const isHeadline = (r: T) =>
    isBeforeFootballFloorCutover(r.starts_at) || footballSurfaceDecisionFor(r).isPick;
  const headlineRows = rows.filter(isHeadline);
  const excludedByFloor = rows.filter((r) => !isHeadline(r));
  const kept = new Set(resolved);
  const dropped = shownResolved.filter((r) => !kept.has(r));
  const unverifiedExcluded = resolved.length - rows.length;
  return {
    surfaced,
    rows,
    headlineRows,
    excludedByFloor,
    /** Gemelle CON esito scartate dal dedup (la lista e il numero non le contano). */
    dedupDropped: dropped.length,
    /** Di queste, quelle che da sole sarebbero entrate nella percentuale
     *  (verificate, won/lost): serve a riconciliare una SQL senza dedup con `n`. */
    dedupDroppedDecided: dropped.filter(
      (r) => r.verification_state === "verified" && (r.result === "won" || r.result === "lost"),
    ).length,
    unverifiedExcluded,
    unresolvedExcluded: Math.max(
      0, surfaced.length - headlineRows.length - excludedByFloor.length - unverifiedExcluded,
    ),
  };
}

// ─── #SPLIT-0201 — DI CHI E' LA PREVISIONE ──────────────────────────────────
//
// Le righe tennis del feed partner (model_version partner-market-v1) portano
// la quota di mercato senza margine, non una nostra previsione: il loro hit
// rate misura il mercato, non il modello. `stats.n`/`win_rate` restano il
// totale storico (invariati per widget, embed, social); qui la stessa
// popolazione si spezza per fonte, e la UI sceglie quale cifra mettere in testa.
// La partizione e' esatta: model.n + market_partner.n === stats.n.

export type SourceBlock = {
  n: number;
  won: number;
  lost: number;
  sample_sufficient: boolean;
  interval_95: { low: number; high: number } | null;
  win_rate: string | null;
  win_rate_display: string | null;
  /** Righe con esito verificato / righe mostrate e finite, della sola fonte. */
  coverage: number | null;
};

function sourceBlock(
  headline: TrackRecordRow[], rows: TrackRecordRow[], surfaced: TrackRecordRow[], minSample: number,
): SourceBlock {
  const won = headline.filter((r) => r.result === "won").length;
  const lost = headline.filter((r) => r.result === "lost").length;
  const n = won + lost;
  const w = n > 0 ? wilson95(won, n) : null;
  const ok = n >= minSample;
  return {
    n, won, lost,
    sample_sufficient: ok,
    interval_95: ok && w ? { low: Number(w.low.toFixed(4)), high: Number(w.high.toFixed(4)) } : null,
    win_rate: ok ? `${((won / n) * 100).toFixed(1)}%` : null,
    win_rate_display: ok ? formatWilson(w) : null,
    coverage: surfaced.length > 0 ? Number((rows.length / surfaced.length).toFixed(3)) : null,
  };
}

/** Stessa definizione dell'headline di /api/v2/history, spezzata per fonte. */
export function trackRecordBySource(
  pop: { headlineRows: TrackRecordRow[]; rows: TrackRecordRow[]; surfaced: TrackRecordRow[] },
  minSample: number,
): { model: SourceBlock; market_partner: SourceBlock } {
  const isMarket = (r: TrackRecordRow) => probabilitySourceOf(r.model_version) === "market";
  const isModel = (r: TrackRecordRow) => !isMarket(r);
  return {
    model: sourceBlock(
      pop.headlineRows.filter(isModel), pop.rows.filter(isModel), pop.surfaced.filter(isModel), minSample,
    ),
    market_partner: sourceBlock(
      pop.headlineRows.filter(isMarket), pop.rows.filter(isMarket), pop.surfaced.filter(isMarket), minSample,
    ),
  };
}

type HeadlineStats = {
  won?: number;
  lost?: number;
  n?: number;
  win_rate?: string | null;
  interval_95?: { low: number; high: number } | null;
  by_source?: { model?: Partial<SourceBlock>; market_partner?: Partial<SourceBlock> } | null;
};

/**
 * La cifra da mettere in testa al track record: il TOTALE storico
 * (stats.win_rate / stats.n — decisione di Andrea, 02/10: si tiene quello).
 * `breakdown` e' la sua scomposizione per fonte, da dichiarare sotto; null se
 * la risposta non porta `by_source` (deploy precedente): solo il totale.
 */
export function headlineFigure(s: HeadlineStats | null | undefined): {
  winRate: string | null;
  n: number;
  won: number;
  lost: number;
  interval95: { low: number; high: number } | null;
  breakdown: {
    model: { winRate: string | null; n: number };
    partner: { winRate: string | null; n: number };
  } | null;
} {
  const bs = s?.by_source;
  return {
    winRate: s?.win_rate ?? null,
    n: s?.n ?? (s?.won ?? 0) + (s?.lost ?? 0),
    won: s?.won ?? 0,
    lost: s?.lost ?? 0,
    interval95: s?.interval_95 ?? null,
    breakdown: bs?.model
      ? {
        model: { winRate: bs.model.win_rate ?? null, n: bs.model.n ?? 0 },
        partner: { winRate: bs.market_partner?.win_rate ?? null, n: bs.market_partner?.n ?? 0 },
      }
      : null,
  };
}

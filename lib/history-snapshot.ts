import { dbQueryStrict } from "@/lib/db";
import {
  edgeTally, outcomeTally, EDGE_MIN_CONFIDENCE,
  FOOTBALL_FLOOR_CUTOVER_AT, trackRecordPopulation, TRACK_RECORD_BASE_CONDITIONS,
  trackRecordBySource, isShownPick,
} from "@/lib/track-record";
import { UnifiedPrediction } from "@/lib/unified-adapter";
import { bySegment } from "@/lib/track-record-history";
import { wilson95, formatWilson } from "@/lib/wilson"; // #SETTLE-0909
import {
  applySealedGrading, sealedEntriesSql, sealedGradingConfig, sealedMapFrom,
  type SealedEntry, type SealedGradingStats,
} from "@/lib/ledger-sealed-grading";

import { unstable_cache } from "next/cache";
import { createHistoryReadCache } from "@/lib/history-read-cache";

type HistoryRow = Pick<
  UnifiedPrediction,
  | "id" | "sport" | "competition" | "event_name" | "home_team" | "away_team"
  | "player_one" | "player_two" | "market" | "pick" | "status"
  | "result" | "signal_type" | "is_paper" | "is_verified" | "is_demo"
  | "starts_at" | "settled_at" | "notes" | "world_cup_stage" | "group_name"
  | "confidence_score"
> & {
  verification_state?: string | null; published_at?: string | null; model_version?: string | null;
  // #LEDGER-SIGILLATA-1007 — letti solo con il flag acceso.
  source_table?: string | null; source_id?: string | null;
};

type HistoryFilters = { sport: string | null; competition: string | null; year: string | null };

// No request, identity or projected response enters this cache. Only bounded
// raw display rows and the unchanged whole-population aggregates are retained.
// This application has not enabled Cache Components; use its Data Cache API
// without changing rendering semantics globally. Bump the version if imported
// grading/population rules change outside Vercel. Vercel deployments get a
// revision-specific key because imported rules are not part of the function hash.
const coalesceSnapshot = createHistoryReadCache(Date.now, 0);
const cachedSnapshot = unstable_cache(loadHistorySnapshot, ["history-snapshot-v1", process.env.VERCEL_GIT_COMMIT_SHA ?? "local"], { revalidate: 30 });
type HistorySnapshot = Awaited<ReturnType<typeof loadHistorySnapshot>>;
class UnavailableHistorySnapshot extends Error {
  constructor(readonly snapshot: HistorySnapshot) { super("History sealed ledger unavailable"); }
}

export async function readHistorySnapshot(filters: HistoryFilters) {
  const cfg = sealedGradingConfig();
  const key = JSON.stringify(["snapshot-v1", filters, cfg]);
  try {
    // Do not persist unusually long arbitrary filter keys. Query semantics stay
    // unchanged: these requests still load and project the same population.
    if ((filters.sport?.length ?? 0) > 40 || (filters.competition?.length ?? 0) > 160) {
      return await loadHistorySnapshot(filters, cfg);
    }
    // Coalesce concurrent misses locally as well as sharing the persisted result.
    const [snapshot] = await coalesceSnapshot(key, async () => [await cachedSnapshot(filters, cfg)]);
    return snapshot;
  } catch (error) {
    if (error instanceof UnavailableHistorySnapshot) return error.snapshot;
    throw error;
  }
}

async function loadHistorySnapshot(
  { sport, competition, year }: HistoryFilters,
  sealedCfg: ReturnType<typeof sealedGradingConfig>,
) {
  // Demo rows must never appear in the public track record (defensive).
  // #TENNIS-VOID-FIX-1: 'unresolved' = the settlement source never returned a
  // result (e.g. a tennis pick that aged out of the window). It is settled only
  // to clear the live board — it is NOT a confirmed outcome, so it must stay out
  // of the track record entirely (list + win-rate + void count alike) — it is
  // counted ONLY in the coverage denominator (#COERENZA-1001), never as an outcome.
  // #TRACKREC-REAL-0626 → rivisto #TRACKREC-SURFACED-0715: il track record conta
  // le pick che abbiamo EFFETTIVAMENTE MOSTRATO all'utente. Il gate autorevole di
  // "mostrata" è isShownPick() (pick != null + sopra il floor di confidenza,
  // con l'eccezione WC), applicato sotto sul result-set. NON usiamo più is_paper
  // come pre-filtro: `is_paper` per il tennis significa "senza mercato/quote"
  // (lib/tennis-adapter.ts:114 `!hasRealMarket`), NON "mai pubblicata" — quindi
  // durante un blackout quote (#TENNIS-ODDS-BLACKOUT) escludeva pick che ERANO
  // mostrate sul board, congelando lo storico. Le shadow/below-floor mai mostrate
  // restano fuori perché isShownPick le respinge (pick null o below_floor).
  // La metrica è ACCURATEZZA delle pick mostrate (hit-rate), non "edge vs mercato".
  // #SETTLE-0909 D2 — `published_at IS NOT NULL` mancava, mentre il board che
  // serve i clienti lo applica (app/api/v2/predictions/route.ts:24-35): una
  // riga MAI PUBBLICATA poteva entrare nel track record. Il gate su
  // `verification_state` NON sta qui ma sotto, in JS: serve contare anche le
  // righe non verificate per poter dichiarare la COPERTURA — un numero senza
  // il suo denominatore è la meta' di un'informazione.
  // #COERENZA-1001 (a) — la query porta TUTTE le pick pubblicate e finite,
  // comprese quelle senza esito (unresolved, NULL): servono al denominatore
  // della copertura. Che cosa entra nel numero lo decide trackRecordPopulation
  // (lib/track-record.ts), non questo WHERE. Prima `unresolved` restava fuori
  // dalla query e la copertura dichiarata (98,4%) ignorava ~2.300 partite.
  const conditions: string[] = [...TRACK_RECORD_BASE_CONDITIONS];
  const values: unknown[] = [];

  if (sport && sport !== "all") {
    values.push(sport);
    conditions.push(`sport = $${values.length}`);
  }
  if (competition && competition !== "all") {
    values.push(`%${competition}%`);
    conditions.push(`competition ILIKE $${values.length}`);
  }
  if (year && /^\d{4}$/.test(year)) {
    values.push(Number(year));
    conditions.push(`EXTRACT(YEAR FROM starts_at) = $${values.length}`);
  }

  // #TRACKREC-REAL-0626: the public win-rate is an ALL-TIME track record, not a
  // recent window — so stats/segments must be computed over every real settled
  // signal, while `limit` only bounds the displayed pick-log list. We fetch up to
  // STATS_CAP rows for the aggregates and slice the list afterwards. Cap is a
  // defensive backstop (real surfaced signals ~75 today); raise it (or move the
  // aggregates into SQL COUNTs) if real settled signals ever approach it.
  // #COERENZA-1001: con le righe senza esito la popolazione e' ~7.000 (01/10).
  const STATS_CAP = 15000;
  // #LEDGER-SIGILLATA-1007 — flag spento: la query e' quella di main, carattere
  // per carattere. Acceso: servono la chiave del registro (source_table/id).
  const sealedCols = sealedCfg.enabled ? ", source_table, source_id" : "";
  // Authentication, history and sealed ledger are independent reads. Run
  // together so the cold path waits for the slowest read, not their sum.
  const sealedRead = sealedCfg.enabled && sealedCfg.from
    ? dbQueryStrict<SealedEntry>(sealedEntriesSql(sealedCfg.from))
        .then(entries => ({ entries, unavailable: false }), error => {
          console.error("[history] sealed ledger read failed:", String(error));
          return { entries: [] as SealedEntry[], unavailable: true };
        })
    : Promise.resolve({ entries: [] as SealedEntry[], unavailable: false });
  const [initialRows, ledger] = await Promise.all([
    dbQueryStrict<HistoryRow>(
    `SELECT id, sport, competition, event_name, home_team, away_team,
            player_one, player_two, market, pick, status,
            result, signal_type, is_paper, is_verified, is_demo,
            starts_at, settled_at, notes, world_cup_stage, group_name,
            confidence_score, verification_state, published_at, model_version${sealedCols}
     FROM unified_predictions
     WHERE ${conditions.join(" AND ")}
     -- #HISTORY-ORDINE-0911 — si ordina per QUANDO SI E' GIOCATA la partita,
     -- non per quando NOI ne abbiamo registrato l'esito.
     --
     -- Prima era COALESCE(settled_at, starts_at): la data di settlement. Basta
     -- un settlement in ritardo — o un recupero in blocco, come quello del
     -- 10/09 — perche' una partita di giugno finisca in cima come se fosse di
     -- ieri. Misurato: 544 righe settlate oltre 2 giorni dopo, 121 oltre 7, con
     -- uno scarto massimo di 91 giorni; nelle prime 300 posizioni comparivano
     -- 14 partite di giugno-agosto, fra cui Medvedev dell'11/06 in
     -- ventiseiesima posizione.
     --
     -- Per chi legge, questa e' la cronologia delle nostre previsioni: l'ordine
     -- che si aspetta e' quello degli eventi. La data di settlement e' un fatto
     -- amministrativo nostro e resta come spareggio, per dare un ordine stabile
     -- alle partite iniziate nello stesso istante (un turno di tennis ne ha
     -- molte) — senza quello la paginazione potrebbe ripetere o saltare righe.
     --
     -- (Niente backtick nei commenti: questa query e' un template literal e un
     -- backtick la chiude. E' il secondo file in cui ci inciampo oggi, dopo
     -- lib/tennis-adapter.ts — dove avevo gia' scritto questa stessa nota.)
     ORDER BY starts_at DESC NULLS LAST, settled_at DESC NULLS LAST, id DESC
     LIMIT ${STATS_CAP + 1}`,
    values
  ), sealedRead]);
  const truncated = initialRows.length > STATS_CAP;
  let fetched = initialRows.slice(0, STATS_CAP);

  // SHOWN-PICKS-ONLY track record (#WINRATE-FLOOR-1 → #TRACKREC-REAL-0626). The
  // board suppresses below-floor rows as "no clear favourite" (no directional
  // pick), so the public hit-rate must measure ONLY the picks we actually showed
  // — counting a match where we declined to pick as a "loss" understated it.
  // We now read the board's PERSISTED verdict (isShownPick) rather than
  // re-deriving the floor, so the metric matches exactly what was displayed and
  // is stable across floor changes. Probability-neutral.
  // #DUP-FIXTURES-0821 (secondo giro) — la stessa partita non conta due volte.
  // `unified_predictions` porta una riga per id del PROVIDER, e un cambio di
  // fonte (il 403 di ESPN sullo User-Agent, poi il fix) ha lasciato righe
  // gemelle: misurate il 21/08, **37 righe in eccesso su 278**, stessa partita
  // E stesso mercato. Aggregate cosi', gonfiano la percentuale pubblicata
  // contando due volte lo stesso esito.
  // Si deduplica in LETTURA, con la stessa identita' e la stessa regola del
  // board (lib/dedupe-fixtures.ts): nessun dato toccato, e due MERCATI diversi
  // sulla stessa partita restano due righe (il mercato entra nella chiave).
  // #COERENZA-1001 — vince la gemella pubblicata PER PRIMA (dedupeShownPicks).
  // #LEDGER-SIGILLATA-1007 — (c) dal LEDGER_SEALED_FROM in poi il calcio
  // conta la pick SIGILLATA prima del calcio d'inizio, gradata sul risultato
  // reale: e' cio' che il registro immutabile prova, non cio' che la riga
  // servita portava al settlement. Prima della data nulla cambia. Se il
  // registro non si legge, le righe del periodo NON ricadono sulla servita
  // (sarebbe mescolare due metodi in silenzio): escono dal numero e la
  // risposta lo dichiara in `sealed_grading.unavailable`.
  let sealedStats: (SealedGradingStats & { unavailable?: boolean }) | null = null;
  if (sealedCfg.enabled && sealedCfg.from) {
    const {entries, unavailable} = ledger;
    const applied = applySealedGrading(fetched, sealedMapFrom(entries), sealedCfg, isShownPick);
    fetched = applied.rows;
    sealedStats = applied.stats ? { ...applied.stats, ...(unavailable ? { unavailable } : {}) } : null;
  }

  const {
    surfaced, rows, headlineRows, excludedByFloor,
    dedupDropped, dedupDroppedDecided, unresolvedExcluded, unverifiedExcluded,
  } = trackRecordPopulation(fetched);

  // #SETTLE-0909 D2 — IL CANCELLO. Si pubblica solo cio' che una fonte con un
  // flag di completamento esplicito ha confermato. Il resto resta contato nel
  // denominatore (`coverage`) ma fuori dalla percentuale.
  //
  // Perche' serve: fino al 10/09 questa pagina mostrava 1.402 righe tennis di
  // cui 314 con un'etichetta dimostrabilmente falsa — punteggi da set singolo,
  // `0-0` compreso, cioe' partite gradate mentre erano in corso. La
  // ri-aggiudicazione contro l'archivio ESPN ha corretto 72 esiti e 559
  // punteggi, e ha lasciato 51 righe che nessuna fonte conferma: quelle non si
  // pubblicano, e la pagina lo dichiara invece di tacerlo.
  //
  // ⚠️ Chi scrive `result` DEVE timbrare anche `verification_state`
  // (core/supabase_client.py::settle_unified_prediction,
  // app/api/cron/settle/route.ts): senza il timbro una riga chiusa non entra
  // qui, e la pagina si fermerebbe al giorno del backfill.

  // ── #TRE-LIVELLI-0925-CUTOVER — CHE COSA ENTRA NEL NUMERO PUBBLICO ─────────
  //
  // Il track record in testa a questa pagina (e alla Home, via
  // app/landing-client.tsx) e' l'unica cifra che un cliente ricorda. Andrea ha
  // deciso: NESSUN salto, nessuna retroattivita' (25/09). Il floor di lega
  // torna a decidere per il calcio, ma SOLO per le righe con `starts_at` da
  // FOOTBALL_FLOOR_CUTOVER_AT in poi — vedi il commento su quella costante in
  // lib/track-record.ts. Le righe precedenti contano esattamente come
  // contavano oggi (58,1%, n=3.069): ogni pick mostrata e' pick, senza gate.
  // Il tennis e gli altri sport non sono toccati in nessuno dei due rami —
  // footballSurfaceDecisionFor risponde sempre "pick" per tutto cio' che non
  // e' calcio.
  //
  // La LISTA delle partite non si tocca: `history` continua a mostrarle tutte.
  // Nessuna riga sparisce dal listino, ne' qui ne' sul board — cambia solo
  // che cosa si conta nell'headline.
  // (headlineRows / excludedByFloor: calcolati in trackRecordPopulation.)

  const total    = headlineRows.length;
  const won      = headlineRows.filter((r) => r.result === "won").length;
  const lost     = headlineRows.filter((r) => r.result === "lost").length;
  const paper    = headlineRows.filter((r) => r.is_paper).length;
  // #EDGE-SELETTIVITA-0917 — additivo: l'headline NON cambia. Qui si affianca
  // la sola parte su cui dichiariamo un vantaggio (confidenza >= 62), con il
  // suo n e la sua quota di volume. Quale dei due numeri vada in testa alla
  // pagina e' una decisione di prodotto, non una che si prende in una route.
  const edge     = edgeTally(headlineRows);
  const verified = headlineRows.filter((r) => r.is_verified).length;

  // Aggregati opzionali (solo se richiesti) — sulla STESSA popolazione
  // dell'headline (#TRE-LIVELLI-0925-CUTOVER): un segmento calcolato su un
  // insieme piu' largo del titolo contraddirebbe il titolo nella stessa
  // schermata.
  const aggRows = headlineRows.map((r) => ({
    sport: r.sport, competition: r.competition, result: r.result, starts_at: String(r.starts_at),
  }));
  const segments = bySegment(aggRows);

  // #SETTLE-0909 D2 — la percentuale non si pubblica nuda.
  // `n` dice su quante partite e' calcolata, `interval_95` quanto e' solida
  // (3 su 4 e 750 su 1000 sono entrambi "75%": solo uno dei due vuol dire
  // qualcosa), e `coverage` quanta parte delle pick mostrate abbiamo potuto
  // verificare — un numero senza il suo denominatore e' meta' informazione.
  // Sotto MIN_SAMPLE la percentuale non si restituisce affatto: la UI mostra
  // le singole partite senza aggregato, invece di un titolo che sembra un dato.
  const MIN_SAMPLE = 30;
  const decisi = won + lost;
  const w = decisi > 0 ? wilson95(won, decisi) : null;
  const sufficiente = decisi >= MIN_SAMPLE;

  const snapshot = {
    rows: rows.slice(0, 300),
    stats: {
      truncated,
      population_limit: STATS_CAP,
      total,
      won,
      lost,
      void: rows.filter((r) => r.result === "void").length,
      pending: rows.filter((r) => r.result === "pending" || r.result == null).length,
      paper,
      verified,
      // n = le partite su cui la percentuale e' calcolata (won+lost), non il
      // totale delle righe: void e pending non hanno un esito da misurare.
      n: decisi,
      sample_sufficient: sufficiente,
      // #COERENZA-1001 (a) — copertura = pick con esito VERIFICATO / TUTTE le
      // pick mostrate e finite (deduplicate), comprese quelle senza esito
      // (unresolved, NULL) e quelle non verificate. Somma esatta:
      //   surfaced_total = total + post_cutover_excluded(righe) + unverified_excluded + unresolved_excluded
      coverage: surfaced.length > 0
        ? Number((rows.length / surfaced.length).toFixed(3))
        : null,
      surfaced_total: surfaced.length,
      unverified_excluded: unverifiedExcluded,
      unresolved_excluded: unresolvedExcluded,
      // Gemelle (stessa partita, stesso mercato) tolte dal dedup; `_decided` =
      // quelle verificate won/lost, per riconciliare una SQL senza dedup con `n`.
      dedup_dropped: dedupDropped,
      dedup_dropped_decided: dedupDroppedDecided,
      // #TRE-LIVELLI-0925-CUTOVER — la popolazione POST-cutover che il floor di
      // lega esclude dall'headline. Non e' diagnostica: e' la condizione che
      // rende l'esclusione onesta invece che survivorship (stessa forma
      // additiva di #EDGE-SELETTIVITA-0917). Le righe PRIMA del cutover non
      // hanno un'esclusione da riportare qui: contano tutte, come sempre.
      cutover_at: FOOTBALL_FLOOR_CUTOVER_AT,
      post_cutover_excluded: outcomeTally(excludedByFloor),
      interval_95: sufficiente && w
        ? { low: Number(w.low.toFixed(4)), high: Number(w.high.toFixed(4)) }
        : null,
      win_rate: sufficiente && decisi > 0
        ? `${((won / decisi) * 100).toFixed(1)}%`
        : null,
      win_rate_display: sufficiente ? formatWilson(w) : null,
      // #SPLIT-0201 — la stessa popolazione spezzata per fonte: il nostro
      // modello vs le quote di mercato del partner. Additivo: i campi sopra
      // restano il totale. model.n + market_partner.n === n.
      by_source: trackRecordBySource({ headlineRows, rows, surfaced }, MIN_SAMPLE),
      edge: {
        ...edge,
        min_confidence: EDGE_MIN_CONFIDENCE,
        // La percentuale del RESTO, accanto a quella dell'Edge: senza, il
        // confronto non e' verificabile da chi legge la risposta.
        rest_n: decisi - edge.n,
      },
      ...(sealedStats ? { sealed_grading: sealedStats } : {}),
      insufficient_sample_reason: sufficiente
        ? null
        : `campione insufficiente: ${decisi} esiti verificati su un minimo di ${MIN_SAMPLE}`,
    },
    segments,
  };
  // Preserve the explicit degraded response, but never cache a ledger outage.
  if (ledger.unavailable) throw new UnavailableHistorySnapshot(snapshot);
  return snapshot;
}

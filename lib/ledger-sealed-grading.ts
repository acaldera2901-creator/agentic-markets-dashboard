// #LEDGER-SIGILLATA-1007 — il registro sigillato del calcio sigilla la PRIMA
// pick pubblicata, e da una data dichiarata si grada QUELLA, non la servita.
//
// IL DIFETTO CHE CHIUDE (revisione indipendente #GATE-477, 07/10).
// `lib/unified-adapter.ts` scriveva in `pick_ledger` (immutabile: niente
// UPDATE/DELETE, CHECK pre-kickoff) la partita appena entrata in calendario,
// con ON CONFLICT DO NOTHING: una partita si sincronizza prima che esistano le
// quote o prima che il favorito superi il floor, quindi la prima riga ha spesso
// `pick` NULL e resta NULL per sempre. Misurato il 29/09: 1.350 righe club su
// 1.976 con pick NULL nel registro, 1.206 delle quali avevano una pick vera
// nella riga servita.
//
// PERCHE' NON BASTA SIGILLARE ALLA PRIMA PICK. Il calcio si grada sulla
// SERVITA (app/api/cron/settle/route.ts step C, agents/result_settlement.py
// _unified_settlement_cycle): `pick_settlement.result` e' l'esito della pick che
// la riga servita porta al momento del settlement. Se la servita cambia dopo il
// sigillo (o diventa NULL sotto floor), il registro direbbe «HOME, vinta» quando
// HOME ha perso e ha vinto la AWAY servita dopo — oppure chiuderebbe `void` una
// pick sigillata che ha un esito vero. Un registro che si aggancia all'esito di
// un'altra pick abbellisce il track record: e' esattamente cio' che il registro
// esiste per impedire.
//
// COSA FA QUESTO MODULO. Tre regole pure, condivise dai tre punti che le usano
// (adapter che sigilla, cron che chiude, route del track record):
//   a. con il flag acceso si sigilla solo una pick non NULL (la prima pubblicata);
//   b. per le partite con kickoff da LEDGER_SEALED_FROM in poi l'esito nel
//      registro e' quello della pick SIGILLATA; `void` solo per i void veri
//      (nessun punteggio: annullata/rinviata), mai perche' la servita e' cambiata;
//   c. il track record pubblico, per le stesse partite, conta le sigillate
//      gradate cosi'. Prima di LEDGER_SEALED_FROM nulla cambia.
//
// FLAG SPENTO = MAIN. Senza LEDGER_SEALED_GRADING=1 *e* una LEDGER_SEALED_FROM
// valida, `enabled` e' false e ogni funzione qui restituisce il comportamento di
// prima (test: lib/ledger-sealed-grading.test.ts, «flag spento»). Flag acceso
// con una data illeggibile = spento: un cutover senza data non e' un cutover.
//
// ⚠️ LA DATA NON E' IL GIORNO DELL'ACCENSIONE. Il registro e' immutabile e
// l'adapter sincronizza fino a ~11 giorni prima del calcio d'inizio (misurato
// 07/10: anticipo massimo captured_at→commence_time 10g 19h). Una partita gia'
// sigillata NULL prima dell'accensione non potra' mai avere la sua pick nel
// registro. LEDGER_SEALED_FROM va quindi messa ALMENO 12 giorni dopo
// l'accensione del flag, altrimenti le prime partite del periodo entrano nel
// track record solo se il vecchio sigillo aveva gia' una pick.

/** Esito di chiusura nel registro (stesso insieme di pick-ledger-mirror). */
export type SealedResult = "won" | "lost" | "void" | "unresolved";

export type SealedGradingConfig = {
  enabled: boolean;
  /** ISO normalizzato di LEDGER_SEALED_FROM, null se spento. */
  from: string | null;
  fromMs: number | null;
};

const OFF: SealedGradingConfig = { enabled: false, from: null, fromMs: null };

/** Legge il flag dall'ambiente. Fail-closed: qualunque dubbio = spento. */
export function sealedGradingConfig(
  env: Record<string, string | undefined> = process.env,
): SealedGradingConfig {
  if ((env.LEDGER_SEALED_GRADING ?? "").trim() !== "1") return OFF;
  const raw = (env.LEDGER_SEALED_FROM ?? "").trim();
  if (!raw) return OFF;
  const ms = new Date(raw).getTime();
  if (!Number.isFinite(ms)) return OFF;
  return { enabled: true, from: new Date(ms).toISOString(), fromMs: ms };
}

/**
 * (a) Si scrive la riga in `pick_ledger`? Flag spento: sempre (comportamento di
 * main, che sigilla anche le pick NULL). Flag acceso: solo una pick vera.
 * Indipendente dalla data: smettere di sigillare NULL non cambia nessun esito,
 * evita solo di congelare un vuoto.
 */
export function shouldSealFootballPick(
  pick: string | null | undefined,
  cfg: SealedGradingConfig,
): boolean {
  if (!cfg.enabled) return true;
  return typeof pick === "string" && pick.trim() !== "";
}

/** La partita appartiene al periodo gradato sulla sigillata? */
export function inSealedCohort(
  commenceTime: string | Date | null | undefined,
  cfg: SealedGradingConfig,
): boolean {
  if (!cfg.enabled || cfg.fromMs == null || commenceTime == null) return false;
  const t = commenceTime instanceof Date ? commenceTime.getTime() : new Date(commenceTime).getTime();
  return Number.isFinite(t) && t >= cfg.fromMs;
}

export type Realized = "HOME" | "DRAW" | "AWAY";

export function realizedOutcome(homeGoals: number, awayGoals: number): Realized {
  return homeGoals === awayGoals ? "DRAW" : homeGoals > awayGoals ? "HOME" : "AWAY";
}

/** «2-1» → {h:2,a:1}; tutto il resto → null (nessun punteggio = nessun esito). */
export function parseFinalScore(s: unknown): { h: number; a: number } | null {
  if (typeof s !== "string") return null;
  const m = /^\s*(\d+)\s*-\s*(\d+)\s*$/.exec(s);
  return m ? { h: Number(m[1]), a: Number(m[2]) } : null;
}

/** Esito della pick sigillata contro l'esito reale. Pick illeggibile = void. */
export function gradeSealedPick(pick: string | null | undefined, realized: Realized): "won" | "lost" | "void" {
  const p = (pick ?? "").trim().toUpperCase();
  if (p !== "HOME" && p !== "DRAW" && p !== "AWAY") return "void";
  return p === realized ? "won" : "lost";
}

/**
 * (b) L'esito da scrivere in `pick_settlement` per una partita FINITA.
 * Fuori dal periodo, o senza una pick sigillata: l'esito servito, come oggi.
 * Dentro: l'esito della sigillata. I void veri (nessun punteggio) non passano
 * di qui — i rami abbandonata/unresolved scrivono il loro esito invariato.
 */
export function ledgerSettlementResult(
  args: {
    servedResult: "won" | "lost" | "void";
    sealedPick: string | null | undefined;
    commenceTime: string | Date | null | undefined;
    homeGoals: number;
    awayGoals: number;
  },
  cfg: SealedGradingConfig,
): "won" | "lost" | "void" {
  if (!inSealedCohort(args.commenceTime, cfg)) return args.servedResult;
  if (args.sealedPick == null || String(args.sealedPick).trim() === "") return args.servedResult;
  return gradeSealedPick(args.sealedPick, realizedOutcome(args.homeGoals, args.awayGoals));
}

// ─── (c) il track record pubblico ────────────────────────────────────────────

/** Una pick sigillata del periodo, con la sua chiusura (ultima revisione). */
export type SealedEntry = {
  source_id: string;
  pick: string;
  /** probabilita' della pick al sigillo, 0..1 */
  confidence: number | null;
  commence_time: string;
  settle_result: string | null;
  settle_outcome: string | null;
};

/**
 * Le pick sigillate del calcio dal cutover, con la chiusura piu' recente.
 * NB niente alias di colonna `t`: via exec_sql restituisce [] (#ANCORA-ALIAS-1007).
 */
export function sealedEntriesSql(fromIso: string): string {
  const from = fromIso.replace(/'/g, "''");
  return `SELECT l.source_id, l.pick, l.confidence, l.commence_time,
                 ps.result AS settle_result, ps.outcome AS settle_outcome
            FROM pick_ledger l
            LEFT JOIN LATERAL (
              SELECT s.result, s.outcome
                FROM pick_settlement s
               WHERE s.source_table = l.source_table
                 AND s.source_id = l.source_id
                 AND s.model_version = l.model_version
               ORDER BY s.settlement_revision DESC NULLS LAST, s.settled_at DESC
               LIMIT 1
            ) ps ON TRUE
           WHERE l.source_table = 'match_predictions'
             AND l.model_version = 'football-v4-xg-model'
             AND l.pick IS NOT NULL
             AND l.commence_time >= '${from}'
           ORDER BY l.commence_time DESC
           LIMIT 20000`;
}

type GradableRow = {
  sport?: string | null;
  source_table?: string | null;
  source_id?: string | null;
  external_event_id?: string | null;
  starts_at?: string | null;
  pick?: string | null;
  result?: string | null;
  notes?: string | null;
  verification_state?: string | null;
  confidence_score?: number | null;
  explanation?: string | null;
  ledger_sealed?: boolean;
};

/** Campi che descrivono la pick SERVITA: se la sigillata e' un'altra, cadono. */
const SERVED_PICK_FIELDS = ["explanation", "odds", "fair_odds", "edge_percent"] as const;

export type SealedGradingStats = {
  from: string;
  /** righe del periodo che portano una pick sigillata */
  sealed_rows: number;
  /** di queste, quelle in cui la pick sigillata differisce dalla servita */
  pick_differs: number;
  /** righe in cui l'esito sigillato differisce da quello servito */
  result_changed: number;
  /** righe del periodo mostrate come pick ma SENZA sigillo: fuori dal numero */
  served_without_seal: number;
};

function finalScoreOf(notes: string | null | undefined): { h: number; a: number } | null {
  try {
    return parseFinalScore((JSON.parse(notes ?? "") as { final_score?: unknown })?.final_score);
  } catch {
    return null;
  }
}

/**
 * Riscrive, per le sole righe calcio del periodo, pick/esito/confidenza con
 * quelli SIGILLATI. Flag spento: restituisce le righe IDENTICHE (stesso array).
 *
 * Regole:
 *   - riga con sigillo: pick = sigillata; esito = sigillata contro il risultato
 *     reale (dalla chiusura del registro, o dal punteggio finale della riga);
 *     verificata se il risultato viene da un punteggio FINITO (le sole vie che
 *     scrivono un punteggio nel calcio passano dal cancello FINISHED del
 *     provider); senza punteggio resta void/unresolved come la riga servita.
 *     Se la pick differisce dalla servita, spiegazione e quote (della servita)
 *     cadono: parlerebbero di un'altra pick.
 *   - riga senza sigillo: pick = null. Non e' mai stata registrata prima del
 *     calcio d'inizio, quindi non entra nel numero; la si conta in
 *     `served_without_seal` perche' l'esclusione sia dichiarata, non silenziosa.
 */
export function applySealedGrading<T extends GradableRow>(
  rows: T[],
  sealed: Map<string, SealedEntry>,
  cfg: SealedGradingConfig,
  isShown: (r: T) => boolean,
): { rows: T[]; stats: SealedGradingStats | null } {
  if (!cfg.enabled || !cfg.from) return { rows, stats: null };
  const stats: SealedGradingStats = {
    from: cfg.from, sealed_rows: 0, pick_differs: 0, result_changed: 0, served_without_seal: 0,
  };
  const out = rows.map((r) => {
    if ((r.sport ?? "").toLowerCase() !== "football") return r;
    if (r.source_table != null && r.source_table !== "match_predictions") return r;
    if (!inSealedCohort(r.starts_at, cfg)) return r;
    const key = String(r.source_id ?? r.external_event_id ?? "");
    const e = key ? sealed.get(key) : undefined;
    if (!e) {
      if (isShown(r)) stats.served_without_seal += 1;
      return { ...r, pick: null };
    }
    stats.sealed_rows += 1;
    const servedPick = (r.pick ?? "").trim().toUpperCase();
    const sealedPick = e.pick.trim().toUpperCase();
    const differs = servedPick !== sealedPick;
    if (differs) stats.pick_differs += 1;

    let realized: Realized | null = null;
    const so = (e.settle_outcome ?? "").toUpperCase();
    if (so === "HOME" || so === "DRAW" || so === "AWAY") realized = so;
    else {
      const fs = finalScoreOf(r.notes);
      if (fs) realized = realizedOutcome(fs.h, fs.a);
    }

    let result: string | null;
    let verification = r.verification_state ?? null;
    if (realized) {
      result = gradeSealedPick(e.pick, realized);
      verification = "verified";
    } else {
      // Nessun punteggio: void/unresolved veri restano tali; altrimenti in attesa.
      const sr = e.settle_result ?? "";
      result = sr === "void" || sr === "unresolved" ? sr
        : r.result === "void" || r.result === "unresolved" ? r.result
        : null;
    }
    if ((result ?? null) !== (r.result ?? null)) stats.result_changed += 1;

    return {
      ...r,
      pick: e.pick,
      result,
      verification_state: verification,
      confidence_score: e.confidence != null ? Math.round(e.confidence * 100) : r.confidence_score,
      ...(differs
        ? Object.fromEntries(SERVED_PICK_FIELDS.filter((f) => f in r).map((f) => [f, null]))
        : {}),
      ledger_sealed: true,
    };
  });
  return { rows: out, stats };
}

export function sealedMapFrom(entries: SealedEntry[]): Map<string, SealedEntry> {
  const m = new Map<string, SealedEntry>();
  for (const e of entries) if (e?.source_id && e.pick) m.set(String(e.source_id), e);
  return m;
}

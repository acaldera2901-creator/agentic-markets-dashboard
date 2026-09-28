// lib/yesterday-read.ts — #HOOK-A-LITE-0928
//
// «La lettura di ieri, con l'esito»: per ogni sport, LA pick che ieri sarebbe
// stata in cima alla vetrina — scelta con lo stesso ordine della vetrina
// (compareShowcase: confidenza, poi edge, poi id) — servita INTERA all'anonimo:
// pick, probabilità, perché, e com'è finita.
//
// ⚠️ QUESTA È UN'ECCEZIONE ESPLICITA ALLA POLICY «l'anonimo non sblocca»
// (project_access_gating_policy: 06-09 e 31/08). Oggi anche lo storico settlato
// tiene il pick lockato per anonimo/free (/api/v2/history proietta con rank
// Infinity). Qui si apre il pick di UNA riga storica per sport — partita già
// giocata, esito già pubblico, zero valore predittivo live. Il gate live
// (lib/access-projection.ts, /api/predictions, /api/tennis, /api/v2/history)
// NON è toccato: questa selezione vive in una route sua, senza proiezione, e
// va approvata come cambio di policy, non come «solo frontend».
//
// LA SCELTA È CIECA ALL'ESITO. Si prende la riga con la confidenza più alta
// del giorno, vinta o persa che sia: mostrare «la vinta di ieri» sarebbe
// survivorship — la stessa cosa che il track record (#TRE-LIVELLI-0925) si
// vieta. `pickYesterdayReads` non legge mai `result` per decidere.
//
// La popolazione è quella dell'HEADLINE del track record: righe verificate,
// mostrate come pick (pick non nullo, sopra il floor), e per il calcio
// post-cutover solo ciò che il floor di lega promuove — così la lettura che
// l'anonimo vede è una di quelle che contano nella percentuale pubblica.
import { compareShowcase, utcDay, type ShowcaseCandidate } from "@/lib/access-projection";
import { footballSurfaceDecisionFor } from "@/lib/surfacing-gate";
import { isBeforeFootballFloorCutover } from "@/lib/track-record";

export const YESTERDAY_READ_SPORTS = ["football", "tennis"] as const;
export type YesterdayReadSport = (typeof YESTERDAY_READ_SPORTS)[number];

/** La riga come esce dalla query (campi minimi, nessuna proiezione). */
export type YesterdayCandidateRow = {
  id: string;
  sport: string;
  competition: string | null;
  league: string | null;
  home_team: string | null;
  away_team: string | null;
  market: string | null;
  /** Calcio: "HOME" | "DRAW" | "AWAY". Tennis: il nome del giocatore. */
  pick: string | null;
  confidence_score: number | null;
  fair_odds: number | null;
  odds: number | null;
  edge_percent: number | null;
  explanation: string | null;
  result: string | null;
  starts_at: string | null;
  settled_at: string | null;
  notes: string | null;
  verification_state?: string | null;
};

export type YesterdayRead = {
  id: string;
  sport: YesterdayReadSport;
  competition: string | null;
  league: string | null;
  home: string;
  away: string;
  market: string | null;
  pick: string;
  /** Probabilità del modello sull'esito scelto, 0-100. */
  model_pct: number | null;
  fair_odds: number | null;
  odds: number | null;
  explanation: string | null;
  result: "won" | "lost" | "void";
  /** Il punteggio REALE scritto dal settlement (notes.final_score); mai ricostruito. */
  final_score: string | null;
  starts_at: string;
  /** Giorno UTC della partita ("YYYY-MM-DD"). */
  day: string;
  /** true se `day` è davvero ieri rispetto a `today`; false se si è dovuto
   *  risalire a un giorno prima (nessuna riga settlata ieri per lo sport). */
  is_yesterday: boolean;
};

export type YesterdayReadOptions = {
  /** Giorno UTC di oggi ("YYYY-MM-DD"). Ieri = il giorno prima. */
  today: string;
  /** Quanti giorni indietro si può risalire se ieri è vuoto. Default 7. */
  maxLookbackDays?: number;
};

/** "YYYY-MM-DD" − n giorni, in UTC. */
export function shiftUtcDay(day: string, n: number): string {
  const t = new Date(`${day}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

function belowFloorFlag(notes: string | null): boolean {
  try {
    const surface = (JSON.parse(notes ?? "{}") as { surface?: { below_floor?: boolean } }).surface;
    return surface?.below_floor === true;
  } catch {
    return false;
  }
}

function finalScoreOf(notes: string | null): string | null {
  try {
    const parsed = JSON.parse(notes ?? "");
    return typeof parsed?.final_score === "string" ? parsed.final_score : null;
  } catch {
    return null;
  }
}

/** Stessa regola di «mostrata come pick» di /api/v2/history (wasShownAsPick)
 *  più il floor post-cutover dell'headline (#TRE-LIVELLI-0925-CUTOVER). */
export function countsAsShownPick(row: YesterdayCandidateRow): boolean {
  if (!row.pick) return false;
  if (row.verification_state != null && row.verification_state !== "verified") return false;
  if (belowFloorFlag(row.notes) && row.competition !== "World Cup") return false;
  if (isBeforeFootballFloorCutover(row.starts_at)) return true;
  return footballSurfaceDecisionFor(row).isPick;
}

function isSettledResult(r: string | null): r is "won" | "lost" | "void" {
  return r === "won" || r === "lost" || r === "void";
}

function toRead(row: YesterdayCandidateRow, day: string, isYesterday: boolean): YesterdayRead | null {
  if (!row.pick || !row.starts_at || !isSettledResult(row.result)) return null;
  const sport = row.sport as YesterdayReadSport;
  const home = row.home_team ?? "";
  const away = row.away_team ?? "";
  if (!home || !away) return null;
  const modelPct = row.confidence_score != null
    ? row.confidence_score
    : row.fair_odds != null && row.fair_odds > 0 ? Math.round((100 / row.fair_odds) * 10) / 10 : null;
  return {
    id: row.id,
    sport,
    competition: row.competition,
    league: row.league,
    home,
    away,
    market: row.market,
    pick: row.pick,
    model_pct: modelPct,
    fair_odds: row.fair_odds,
    odds: row.odds,
    explanation: row.explanation,
    result: row.result,
    final_score: finalScoreOf(row.notes),
    starts_at: row.starts_at,
    day,
    is_yesterday: isYesterday,
  };
}

/** Una lettura per sport (calcio, tennis), nell'ordine di YESTERDAY_READ_SPORTS.
 *  Uno sport senza candidati nella finestra semplicemente manca dall'array:
 *  la UI non inventa una card. */
export function pickYesterdayReads(rows: readonly YesterdayCandidateRow[], opts: YesterdayReadOptions): YesterdayRead[] {
  const yesterday = shiftUtcDay(opts.today, -1);
  const lookback = Math.max(1, opts.maxLookbackDays ?? 7);
  const out: YesterdayRead[] = [];

  for (const sport of YESTERDAY_READ_SPORTS) {
    const eligible = rows.filter((r) =>
      r.sport === sport && isSettledResult(r.result) && countsAsShownPick(r) && utcDay(r.starts_at) != null,
    );
    if (eligible.length === 0) continue;

    // Ieri, altrimenti il giorno più recente PRIMA di oggi che abbia una riga.
    let chosenDay: string | null = null;
    for (let back = 1; back <= lookback; back++) {
      const d = shiftUtcDay(opts.today, -back);
      if (eligible.some((r) => utcDay(r.starts_at) === d)) { chosenDay = d; break; }
    }
    if (!chosenDay) continue;

    const dayRows = eligible.filter((r) => utcDay(r.starts_at) === chosenDay);
    const candidates: (ShowcaseCandidate & { row: YesterdayCandidateRow })[] = dayRows.map((r) => ({
      id: r.id,
      surfaced: true,
      conf: (r.confidence_score ?? 0) / 100,
      edge: r.edge_percent,
      row: r,
    }));
    candidates.sort(compareShowcase);
    const read = toRead(candidates[0].row, chosenDay, chosenDay === yesterday);
    if (read) out.push(read);
  }
  return out;
}

/** L'etichetta della pick come la scrive la card della lobby (lib/ui/desk-card):
 *  «Arsenal vince», «Pareggio», «Sinner vince». */
export function yesterdayPickLabel(read: Pick<YesterdayRead, "sport" | "pick" | "home" | "away">, labels: { winLabel: string; drawLabel: string }): string {
  if (read.sport === "football") {
    if (read.pick === "HOME") return `${read.home} ${labels.winLabel}`;
    if (read.pick === "AWAY") return `${read.away} ${labels.winLabel}`;
    if (read.pick === "DRAW") return labels.drawLabel;
    return read.pick;
  }
  return `${read.pick} ${labels.winLabel}`;
}

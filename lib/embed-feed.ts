// #WIDGET-EMBED-0824 — dati del widget incorporabile su siti terzi.
//
// Perché una query dedicata e non /api/v2/predictions: il widget mostra ~10
// campi su una card piccola, mentre quella route attacca enrichment,
// goalscorer e mercati soft (payload ~10x). Quello che NON si duplica sono le
// decisioni di prodotto: ordine della vetrina e proiezione arrivano da
// lib/access-projection, così widget e board non possono divergere su quale
// riga è il pick né su cosa resta bloccato.
import { dbQuery } from "@/lib/db";
import { projectPrediction, showcaseRanking, type ShowcaseCandidate } from "@/lib/access-projection";
import { humanizePick } from "@/features/feed/pick-view-model";
import { dedupeByFixture } from "@/lib/dedupe-fixtures";
import { PREDICTION_WINDOW_DAYS, V2_MAX_ROWS } from "@/lib/prediction-window";

export type EmbedMode = "teaser" | "open";
/** Le cinque lingue della chrome del sito (lib/tools/registry#chromeLang). */
export type EmbedLang = "it" | "en" | "es" | "fr" | "ru";

export const EMBED_MAX_LIMIT = 6;
export const EMBED_DEFAULT_LIMIT = 3;

export type EmbedRow = {
  id: string;
  sport: string;
  competition: string;
  homeTeam: string | null;
  awayTeam: string | null;
  startsAt: string;
  /** Decisione leggibile, già localizzata. null = bloccata o sotto floor. */
  decision: string | null;
  /** Probabilità dell'esito, 0-100 interi. null quando bloccata. */
  confidence: number | null;
  locked: boolean;
  topPick: boolean;
};

/** Stessa regex del register e di /r/[code]: un codice fuori forma è INVALIDO,
 *  mai troncato in silenzio in un codice diverso (che sarebbe di un altro). */
export function normalizeEmbedRef(raw: string | null | undefined): string | null {
  const ref = (raw ?? "").trim().toUpperCase();
  return /^[A-Z0-9_-]{2,20}$/.test(ref) ? ref : null;
}

/** La versione la decide il SERVER, non l'HTML del partner: se dipendesse da un
 *  data-attribute, chiunque copiasse lo snippet otterrebbe il prodotto gratis
 *  cambiando una parola. Scorciatoia intenzionale: allowlist in env var invece
 *  che in tabella — limite: serve un redeploy per aggiungere un partner.
 *  Upgrade oltre ~10 partner: tabella embed_partners (ref, mode, domini, attivo). */
export function resolveEmbedMode(ref: string | null, allowlist: string | undefined): EmbedMode {
  if (!ref || !allowlist) return "teaser";
  const allowed = allowlist
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  return allowed.includes(ref) ? "open" : "teaser";
}

export function clampEmbedLimit(raw: string | null | undefined): number {
  const n = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n)) return EMBED_DEFAULT_LIMIT;
  return Math.min(EMBED_MAX_LIMIT, Math.max(1, n));
}

// ── Decisione localizzata ────────────────────────────────────────────────────
// L'italiano delega a humanizePick (la stessa frase del board, articoli
// inclusi). Le altre quattro lingue hanno qui la loro forma: tradurre a valle
// una frase italiana già montata produrrebbe "Vince the Inter".
const WIN: Record<Exclude<EmbedLang, "it">, (t: string) => string> = {
  en: (t) => `${t} to win`,
  es: (t) => `Gana ${t}`,
  fr: (t) => `Victoire ${t}`,
  ru: (t) => `Победа ${t}`,
};
const DRAW: Record<Exclude<EmbedLang, "it">, string> = {
  en: "Draw", es: "Empate", fr: "Match nul", ru: "Ничья",
};
const GOALS: Record<Exclude<EmbedLang, "it">, string> = {
  en: "goals", es: "goles", fr: "buts", ru: "голов",
};
/** Quando il gate di surfacing non promuove nessuna direzione la riga resta un
 *  match reale con una probabilità: il feed del sito la etichetta così, e il
 *  widget che lo promuove non può dire meno (un "—" sembra un dato mancante). */
const NO_FAVOURITE: Record<EmbedLang, string> = {
  it: "Nessun favorito netto",
  en: "No clear favourite",
  es: "Sin favorito claro",
  fr: "Pas de favori net",
  ru: "Явного фаворита нет",
};

const BTTS: Record<Exclude<EmbedLang, "it">, [string, string]> = {
  en: ["Both teams to score", "Not both to score"],
  es: ["Ambos marcan", "No marcan ambos"],
  fr: ["Les deux marquent", "Pas les deux"],
  ru: ["Обе забьют", "Не обе забьют"],
};

function localizedDecision(
  p: { market?: string | null; pick: string | null; home_team: string | null; away_team: string | null },
  lang: EmbedLang
): string | null {
  const pick = (p.pick ?? "").trim();
  // Sotto floor: nessuna direzione. Non se ne inventa una, si dice che non c'è.
  if (!pick) return NO_FAVOURITE[lang] ?? NO_FAVOURITE.en;
  if (lang === "it") return humanizePick(p) || null;

  const m = (p.market ?? "").toLowerCase();
  const win = WIN[lang];
  if (m.includes("1x2") || m.includes("match_winner") || m.includes("winner")) {
    if (p.home_team && pick.toLowerCase() === p.home_team.toLowerCase()) return win(p.home_team.trim());
    if (p.away_team && pick.toLowerCase() === p.away_team.toLowerCase()) return win(p.away_team.trim());
    if (pick === "X" || /pareg|draw/i.test(pick)) return DRAW[lang];
    if (/^(1|home|casa)$/i.test(pick) && p.home_team) return win(p.home_team.trim());
    if (/^(2|away|trasferta)$/i.test(pick) && p.away_team) return win(p.away_team.trim());
    return pick;
  }
  if (m.includes("over_under") || m.includes("over/under") || m.includes("totals")) {
    return /gol|goal|set/i.test(pick) ? pick : `${pick} ${GOALS[lang]}`;
  }
  if (m.includes("btts") || m.includes("gol/no") || m.includes("both_teams")) {
    const [yes, no] = BTTS[lang];
    return /^(yes|si|sì|gol)$/i.test(pick) ? yes : no;
  }
  return pick;
}

// ── Proiezione ───────────────────────────────────────────────────────────────
type RawRow = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** MISURATO il 2026-08-24: `unified_predictions.confidence_score` è in scala
 *  0-100 (min 34, max 79), mentre il commento di compareShowcase la descrive
 *  0-1. Moltiplicare senza guardare stampava "7100%" dentro il sito di un
 *  partner. Si accettano entrambe le scale perché su questa tabella scrivono
 *  più pipeline: sopra 1 è già una percentuale, sotto è una probabilità. */
export function toPercent(v: number | null): number | null {
  if (v === null) return null;
  const pct = v > 1 ? v : v * 100;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

/** Puro: dalle righe grezze alle card del widget. `mode` sceglie la vetrina —
 *  teaser proietta come il piano free (top-1 per sport), open come premium. */
export function toEmbedRows(rawRows: RawRow[], mode: EmbedMode, limit: number, lang: EmbedLang): EmbedRow[] {
  const state = mode === "open" ? "premium" : "free";

  // Una partita, una card. Su tre righe dentro il sito di un partner un
  // doppione è un terzo del widget — e le due copie possono portare verdetti
  // diversi. Si riusa l'identità del board (#DUP-FIXTURES-0821), che regge le
  // grafie divergenti fra fonti ("Tigre" / "CA Tigre BA"): la dedup a chiave
  // esatta di /api/v2/predictions non le prende.
  const rows = dedupeByFixture(rawRows as Array<RawRow & { home_team?: string | null; away_team?: string | null }>, {
    when: (r) => str(r.starts_at),
    freshness: (r) => str(r.updated_at),
  }) as RawRow[];

  // Rank 0-based dentro lo sport, con lo stesso comparatore della vetrina.
  const rankById = new Map<string, number>();
  const bySport = new Map<string, RawRow[]>();
  for (const r of rows) {
    const sp = str(r.sport) || "other";
    if (!bySport.has(sp)) bySport.set(sp, []);
    bySport.get(sp)!.push(r);
  }
  for (const list of bySport.values()) {
    const candidates: ShowcaseCandidate[] = list.map((r) => ({
      id: String(r.id),
      surfaced: typeof r.pick === "string" && r.pick.trim() !== "",
      conf: num(r.confidence_score) ?? 0,
      edge: num(r.edge_percent),
    }));
    for (const [id, rank] of showcaseRanking(candidates)) rankById.set(id, rank);
  }

  const cards = rows.map((r) => {
    const rank = rankById.get(String(r.id)) ?? Infinity;
    const surfaced = typeof r.pick === "string" && r.pick.trim() !== "";
    const p = projectPrediction(r, state, rank) as RawRow & { locked: boolean };
    const conf = num(p.confidence_score);
    return {
      row: {
        id: String(r.id),
        sport: str(r.sport),
        competition: str(r.competition) || str(r.league),
        homeTeam: str(r.home_team) || null,
        awayTeam: str(r.away_team) || null,
        startsAt: str(r.starts_at),
        decision: p.locked
          ? null
          : localizedDecision(
              {
                market: str(p.market) || null,
                pick: typeof p.pick === "string" ? p.pick : null,
                home_team: str(r.home_team) || null,
                away_team: str(r.away_team) || null,
              },
              lang
            ),
        confidence: p.locked ? null : toPercent(conf),
        locked: p.locked,
        topPick: rank === 0,
      } satisfies EmbedRow,
      rank,
      surfaced,
    };
  });

  // Ordine di PRESENTAZIONE (non tocca il gate: cosa è sbloccato lo decide il
  // rank della vetrina, sopra). Le sbloccate davanti perché sono ciò che
  // attira; fra queste, prima quelle con una direzione reale: MISURATO il
  // 2026-08-24, il tennis ha 0 pick su 38 righe, e senza questa riga la prima
  // card del widget diceva "nessun favorito netto" — vero, ma è la vetrina.
  cards.sort(
    (a, b) =>
      Number(a.row.locked) - Number(b.row.locked) ||
      Number(b.surfaced) - Number(a.surfaced) ||
      a.rank - b.rank ||
      a.row.startsAt.localeCompare(b.row.startsAt)
  );
  return cards.slice(0, limit).map((c) => c.row);
}

/** Stessi filtri di sicurezza del board: niente demo, niente storico, solo
 *  pubblicate, finestra di pubblicazione e 150' di coda in-play (#LIVE-1). */
export async function fetchEmbedRows(opts: {
  sport?: string | null;
  limit: number;
  mode: EmbedMode;
  lang: EmbedLang;
}): Promise<EmbedRow[]> {
  const conditions = [
    "starts_at > NOW() - interval '150 minutes'",
    "starts_at < NOW() + ($1 || ' days')::interval",
    "expires_at > NOW() - interval '150 minutes'",
    "published_at IS NOT NULL",
    "is_historical = FALSE",
    "is_demo = FALSE",
  ];
  const values: unknown[] = [PREDICTION_WINDOW_DAYS];
  if (opts.sport && opts.sport !== "all") {
    values.push(opts.sport);
    conditions.push(`sport = $${values.length}`);
  }
  values.push(V2_MAX_ROWS);

  // Il tetto è lo stesso del board di proposito: il rank della vetrina si
  // calcola sull'insieme servito, quindi leggerne di meno farebbe apparire
  // "top pick" nel widget una riga che sul sito non lo è.
  const rows = await dbQuery<RawRow>(
    `SELECT id, sport, competition, league, home_team, away_team, starts_at,
            market, pick, confidence_score, edge_percent, updated_at
       FROM unified_predictions
      WHERE ${conditions.join(" AND ")}
      ORDER BY starts_at ASC
      LIMIT $${values.length}`,
    values
  );
  return toEmbedRows(rows, opts.mode, opts.limit, opts.lang);
}

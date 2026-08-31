// #SETTLE-RECOVERY-0831 — i risultati finali dal tabellone ESPN, per DATA.
//
// PERCHE' ESISTE. football-data.org lascia partite finite con lo stato IN_PLAY.
// Misurato il 31/08/2026 alle 10:11 UTC: 5 partite del 30/08 ancora
// IN_PLAY/PAUSED a 15-17 ORE dal fischio d'inizio — e interrogare il singolo
// match per id (`/v4/matches/{id}`) rende lo STESSO stato fermo, quindi
// ri-chiedere non recupera niente. Peggio: i punteggi che porta sono congelati
// a metà partita e SBAGLIATI in 3 casi su 5 —
//   Lazio-Genoa      football-data 0-0  →  ESPN 1-0
//   Monaco-Marsiglia football-data 1-0  →  ESPN 2-0
//   Cambuur-Twente   football-data 0-2  →  ESPN 1-4
// Senza una seconda fonte quelle righe restano IN_PLAY per sempre: il
// settlement parte solo su FINISHED, quindi non passano in History e non
// entrano nel track record.
//
// ESPN, con la DATA esplicita, le ha tutte: misurato lo stesso giorno,
// `?dates=20260830` rende ogni partita con STATUS_FULL_TIME e il punteggio
// finale. La nota reference_espn_completed_results_window vale per il tabellone
// SENZA data (dove un risultato resta visibile poche ore): con `?dates` c'è
// l'archivio. E' questa la differenza che rende il recupero possibile.

import { tokenSquadra } from "@/lib/dedupe-fixtures";

const ESPN_SITE_API = "https://site.api.espn.com/apis/site/v2/sports";
const ESPN_HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; BetRedge/1.0)" };

/** Codice lega football-data → slug ESPN. SONDATI il 31/08/2026 sulla data
 *  20260830, eventi completati: eng.1 4/4, ita.1 3/3, esp.1 3/3, ger.1 2/2,
 *  fra.1 3/3. CL/EL/WC non avevano partite quel giorno (0 eventi): gli slug
 *  restano quelli che il feed live usa già per la World Cup. */
export const ESPN_SLUG_BY_FD_LEAGUE: Record<string, string> = {
  PL: "eng.1",
  SA: "ita.1",
  PD: "esp.1",
  BL1: "ger.1",
  FL1: "fra.1",
  CL: "uefa.champions",
  EL: "uefa.europa",
  WC: "fifa.world",
};

export type EspnFinal = {
  home: string; away: string; homeGoals: number; awayGoals: number;
  /** ora d'inizio dichiarata da ESPN: e' la chiave primaria dell'abbinamento. */
  kickoff: string;
};

/** yyyymmdd in UTC — la data che ESPN vuole nel parametro `dates`. */
export function yyyymmddUtc(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Parsing PURO della risposta ESPN: solo eventi COMPLETATI con due punteggi
 *  numerici. Tutto il resto si scarta — un risultato mancante non si indovina. */
export function parseEspnFinals(data: unknown): EspnFinal[] {
  const events = (data as { events?: unknown[] } | null)?.events;
  if (!Array.isArray(events)) return [];
  const out: EspnFinal[] = [];
  for (const raw of events) {
    const ev = raw as {
      date?: string;
      status?: { type?: { completed?: boolean } };
      competitions?: Array<{ competitors?: Array<{ homeAway?: string; score?: string; team?: { displayName?: string } }> }>;
    };
    if (!ev?.status?.type?.completed) continue;
    const cs = ev.competitions?.[0]?.competitors;
    if (!Array.isArray(cs) || !ev.date) continue;
    const h = cs.find((c) => c.homeAway === "home");
    const a = cs.find((c) => c.homeAway === "away");
    const hn = h?.team?.displayName, an = a?.team?.displayName;
    if (!hn || !an) continue;
    // Il punteggio si controlla PRIMA di convertirlo: `Number(null)` e' 0, non
    // NaN, quindi un punteggio ASSENTE passava per uno 0-0 reale. Trovato dal
    // test, non a occhio.
    if (typeof h?.score !== "string" || typeof a?.score !== "string") continue;
    if (!/^\d+$/.test(h.score.trim()) || !/^\d+$/.test(a.score.trim())) continue;
    out.push({ home: hn, away: an, homeGoals: Number(h.score), awayGoals: Number(a.score), kickoff: ev.date });
  }
  return out;
}

export async function fetchEspnFinalsByDate(slug: string, giorno: string): Promise<EspnFinal[]> {
  const url = `${ESPN_SITE_API}/soccer/${slug}/scoreboard?dates=${giorno}&limit=200`;
  try {
    const r = await fetch(url, { headers: ESPN_HEADERS, cache: "no-store" });
    if (!r.ok) return [];
    return parseEspnFinals(await r.json());
  } catch {
    return [];
  }
}

export type StuckRow = { match_id: string; home_team: string; away_team: string; kickoff: string };

/** Tolleranza sull'ora d'inizio fra le due fonti: gli anticipi di pochi minuti
 *  esistono, gli spostamenti di mezz'ora sono un'altra partita. */
const TOLLERANZA_MS = 20 * 60 * 1000;

/** Un token vale come conferma d'identita' solo se e' abbastanza lungo da non
 *  essere una particella: «de», «la», «rc» non identificano nessuno. */
const MIN_TOKEN = 4;

function condivideIdentita(a: string, b: string): boolean {
  const x = new Set(tokenSquadra(a).filter((t) => t.length >= MIN_TOKEN));
  const y = new Set(tokenSquadra(b).filter((t) => t.length >= MIN_TOKEN));
  if (!x.size || !y.size) return false;
  for (const t of x) if (y.has(t)) return true;
  return false;
}

/**
 * Abbina una riga bloccata al suo risultato finale.
 *
 * L'ABBINAMENTO E' SULL'ORARIO, non sui nomi. I nomi non bastano perche' le due
 * fonti li scrivono diversi e in modo asimmetrico: «Deportivo» sta per «RC
 * Deportivo La Coruña», «Marseille» per «Olympique de Marseille». La regola del
 * sottoinsieme di token — quella del dedup del nostro feed — su questi CADE, e
 * allentarla la' significherebbe rompere il dedup, dove serve severa.
 *
 * Quindi: chiave primaria l'ora d'inizio (±20 min), che le due fonti dichiarano
 * indipendentemente e in UTC; i nomi fanno da CONFERMA, perche' nella stessa
 * lega piu' partite iniziano allo stesso minuto. La conferma chiede un token
 * lungo in comune per lato, con l'orientamento giusto — casa con casa.
 *
 * E una guardia che vale piu' di tutte: se i candidati non sono ESATTAMENTE uno,
 * non si abbina niente. Ambiguo vuol dire fermo, non «prendi il primo»: qui in
 * fondo si scrive un risultato nel track record.
 */
export function abbinaFinale(row: StuckRow, finals: readonly EspnFinal[]): EspnFinal | null {
  const t = new Date(row.kickoff).getTime();
  if (!Number.isFinite(t)) return null;
  const cand = finals.filter((f) => {
    const tf = new Date(f.kickoff).getTime();
    if (!Number.isFinite(tf) || Math.abs(tf - t) > TOLLERANZA_MS) return false;
    return condivideIdentita(f.home, row.home_team) && condivideIdentita(f.away, row.away_team);
  });
  return cand.length === 1 ? cand[0] : null;
}

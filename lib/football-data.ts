import { PREDICTION_WINDOW_DAYS } from "./prediction-window";

const BASE = "https://api.football-data.org/v4";

// Competitions available on the free tier
export const LEAGUES: Record<string, string> = {
  PL: "Premier League",
  SA: "Serie A",
  PD: "La Liga",
  BL1: "Bundesliga",
  FL1: "Ligue 1",
  CL: "Champions League",
  EL: "Europa League",
  // #021: without WC here, fetchAllTodayMatches never returned World Cup
  // matches — the live score bar would have stayed empty for the whole
  // tournament (matches start 2026-06-11).
  WC: "World Cup",
};

function headers() {
  return { "X-Auth-Token": process.env.FOOTBALL_DATA_ORG_API_KEY ?? "" };
}

export interface FDMatch {
  id: string;
  utcDate: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number | null;
  awayGoals: number | null;
  status: string;
  minute: number | null;
}

function normalize(m: Record<string, unknown>): FDMatch {
  const ft = (m.score as Record<string, Record<string, number | null>>)
    ?.fullTime ?? {};
  const minute = (m.minute as number | null | undefined) ?? null;
  return {
    id: String(m.id),
    utcDate: m.utcDate as string,
    homeTeam: (m.homeTeam as { name: string }).name,
    awayTeam: (m.awayTeam as { name: string }).name,
    homeGoals: ft.home ?? null,
    awayGoals: ft.away ?? null,
    status: m.status as string,
    minute,
  };
}

// #FIXTURES-SILENT-SKIP-0910 — un fallimento qui era INDISTINGUIBILE da «questa
// lega non ha partite in programma»: `return []` in entrambi i casi, senza una
// riga di log. Conseguenza misurata il 10/09: 106 righe su 315 non ricalcolate
// dal giro delle 16:00, e le 12 righe senza quote entro 48h erano TUTTE su
// BL1/PD/FL1/SA — cioe' tutte e sole le leghe che passano da qui (le altre 21
// competizioni del board arrivano dal percorso summer-leagues, che non ha
// questo limite). Bayern, Dortmund, Mainz, Augsburg, Hoffenheim, Union Berlin,
// Osasuna, Racing, Strasburgo, Rennes, Genoa, Venezia: i big match, fermi a
// ore prima, e nessun allarme.
//
// Causa provata con una misura diretta: 10 richieste in parallelo a
// football-data.org danno 9 ok e UNA 429, e l'header
// `x-requests-available-minute` scende a 0. Il route ne lancia 7 in parallelo
// piu' lo storico per lega, quindi il tetto per minuto si tocca e le leghe
// perdenti restano ferme.
//
// Due rimedi, entrambi qui:
//   1. il 429 e' TRANSITORIO (si azzera al minuto) -> un ritentativo lo recupera;
//   2. un fallimento si DICE. Un array vuoto per errore e un array vuoto per
//      calendario vuoto non possono piu' somigliarsi.
const RITENTATIVO_DEFAULT_MS = 7000;

async function fetchMatches(
  code: string,
  params: Record<string, string>
): Promise<FDMatch[]> {
  if (!process.env.FOOTBALL_DATA_ORG_API_KEY) return [];
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE}/competitions/${code}/matches?${qs}`;
  const opzioni = { headers: headers(), cache: "no-store" as const };
  // Letto a ogni chiamata (non a load) così i test possono azzerarlo.
  const attesaMs = Number(process.env.FD_RETRY_MS ?? RITENTATIVO_DEFAULT_MS);
  try {
    let r = await fetch(url, opzioni);
    if (r.status === 429) {
      console.warn(
        `[football-data ${code}] HTTP 429 (tetto per minuto) — ritento fra ${attesaMs}ms`,
      );
      if (attesaMs > 0) await new Promise((ok) => setTimeout(ok, attesaMs));
      r = await fetch(url, opzioni);
    }
    if (!r.ok) {
      console.warn(
        `[football-data ${code}] HTTP ${r.status} — lega SALTATA: le sue righe restano quelle del giro precedente`,
      );
      return [];
    }
    const data = await r.json();
    const partite = ((data.matches ?? []) as Record<string, unknown>[]).map(normalize);
    // Zero partite con HTTP 200 e' un dato legittimo (sosta, calendario vuoto):
    // si distingue nel log da uno zero per errore.
    if (partite.length === 0) console.log(`[football-data ${code}] 0 partite in finestra (HTTP 200)`);
    return partite;
  } catch (e) {
    console.warn(`[football-data ${code}] errore di rete: ${String(e)} — lega SALTATA`);
    return [];
  }
}

export async function fetchHistory(code: string): Promise<FDMatch[]> {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 365);
  const matches = await fetchMatches(code, {
    status: "FINISHED",
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: today.toISOString().slice(0, 10),
  });
  return matches.filter((m) => m.homeGoals !== null && m.awayGoals !== null);
}

export async function fetchFixtures(code: string): Promise<FDMatch[]> {
  const today = new Date();
  const to = new Date(today);
  // Rolling publication window (#019): never fetch beyond the serving horizon.
  to.setDate(to.getDate() + PREDICTION_WINDOW_DAYS);

  // #NIGHT-GAP-0911 — `dateFrom` parte da IERI, non da oggi.
  //
  // Il bug. `dateFrom` e' una DATA UTC, ma una partita delle 02:30 UTC e' la
  // sera prima in America. Allo scoccare della mezzanotte UTC quella partita
  // finiva fuori dalla finestra richiesta e smetteva di essere ricalcolata,
  // pur mancando ore al fischio — proprio quando le quote maturano.
  //
  // Misurato su 20 giorni: delle partite con kickoff fra le 00:00 e le 04:59
  // UTC, il **90%** aveva l'ultimo ricalcolo PRIMA della mezzanotte di quel
  // giorno, contro il **18%** delle diurne. Il caso che l'ha fatto emergere e'
  // Portland Timbers v Minnesota United (MLS, kickoff 02:30): ricalcoli
  // regolari ogni due ore fino alle 22:02, poi piu' nulla per 267 minuti,
  // con tutti i run successivi regolarmente avvenuti. La mediana dell'ultimo
  // calcolo e' 267 minuti per i kickoff delle 02:00 UTC contro i 42-58 delle
  // partite pomeridiane.
  //
  // Perche' e' sicuro allargare all'indietro, e perche' solo ORA. Includere
  // ieri fa entrare anche partite gia' iniziate o finite; prima le avremmo
  // ricalcolate, che e' esattamente cio' che #FREEZE-KICKOFF-0911 ha appena
  // vietato. Con quel guard a valle ogni fixture passata viene scartata dal
  // loop, quindi questa finestra piu' larga recupera le notturne SENZA
  // riaprire il ricalcolo a gara in corso. I due cambi si reggono a vicenda:
  // se il freeze venisse rimosso, questo va rivisto con lui.
  //
  // Costo: zero richieste in piu'. E' la stessa chiamata con un giorno di
  // range in piu' — football-data fa pagare le richieste, non le date.
  //
  // Nota: `fetchAllTodayMatches`, qui sotto, parte da ieri gia' da sempre. La
  // convenzione esisteva nel file; mancava solo in questa funzione.
  const from = new Date(today);
  from.setDate(from.getDate() - 1);

  return fetchMatches(code, {
    status: "SCHEDULED,TIMED",
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: to.toISOString().slice(0, 10),
  });
}

export async function fetchAllTodayMatches(): Promise<FDMatch[]> {
  if (!process.env.FOOTBALL_DATA_ORG_API_KEY) return [];
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const competitions = Object.keys(LEAGUES).join(",");
  const qs = new URLSearchParams({
    competitions,
    dateFrom: yesterday.toISOString().slice(0, 10),
    dateTo: today.toISOString().slice(0, 10),
  }).toString();
  try {
    const r = await fetch(`${BASE}/matches?${qs}`, { headers: headers(), cache: "no-store" });
    if (!r.ok) return [];
    const data = await r.json();
    return ((data.matches ?? []) as Record<string, unknown>[]).map(normalize);
  } catch { return []; }
}

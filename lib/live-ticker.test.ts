// #LIVE-TICKER-PARITY-0831 — i casi sono quelli MISURATI il 31/08/2026 sul feed
// di football-data, non inventati: 5 partite del 30/08 ancora IN_PLAY/PAUSED a
// 15-17 ore dal fischio d'inizio, con i punteggi finali già scritti.
import { describe, it, expect } from "vitest";
import { liveFootballOnBoard, isLiveNow, type TickerLive } from "@/lib/live-ticker";

type Fx = { match_id: string; home_team: string; away_team: string };

const board: Fx[] = [
  { match_id: "fd:1", home_team: "US Lecce", away_team: "AS Roma" },
  { match_id: "fd:2", home_team: "Atalanta BC", away_team: "Bologna FC 1909" },
];

// la mappa live come arrivava davvero: i due fixture di oggi PIU' i residui di
// ieri che football-data non ha mai portato a FINISHED.
const live: Record<string, TickerLive> = {
  "fd:1": { match_status: "IN_PLAY", home_team: "US Lecce", away_team: "AS Roma" },
  "fd:2": { match_status: "SCHEDULED", home_team: "Atalanta BC", away_team: "Bologna FC 1909" },
  "fd:99": { match_status: "IN_PLAY", home_team: "SS Lazio", away_team: "Genoa CFC" },
  "fd:98": { match_status: "IN_PLAY", home_team: "Cagliari Calcio", away_team: "FC Internazionale Milano" },
  "fd:97": { match_status: "PAUSED", home_team: "SC Cambuur-Leeuwarden", away_team: "FC Twente '65" },
};
const resolve = (p: Fx) => live[p.match_id];

describe("isLiveNow", () => {
  it("solo IN_PLAY e PAUSED valgono «adesso in campo»", () => {
    expect(isLiveNow("IN_PLAY")).toBe(true);
    expect(isLiveNow("PAUSED")).toBe(true);
    for (const s of ["SCHEDULED", "TIMED", "FINISHED", "POSTPONED", "CANCELLED", "", null, undefined]) {
      expect(isLiveNow(s as string | null | undefined), `stato ${String(s)}`).toBe(false);
    }
  });
});

describe("il ticker calcio parte dai fixture in board (#LIVE-TICKER-PARITY-0831)", () => {
  it("mostra solo i fixture in board che risultano live adesso", () => {
    const out = liveFootballOnBoard(board, resolve);
    expect(out.map(([id]) => id)).toEqual(["fd:1"]);
  });

  it("le partite di IERI rimaste IN_PLAY nel feed NON entrano: non sono in board", () => {
    // era il difetto: Lazio-Genoa, Cagliari-Inter e Cambuur-Twente stavano nella
    // mappa live con stato IN_PLAY/PAUSED 15-17 ore dopo la fine.
    const out = liveFootballOnBoard(board, resolve);
    const nomi = out.flatMap(([, s]) => [s.home_team, s.away_team]);
    for (const fantasma of ["SS Lazio", "Genoa CFC", "Cagliari Calcio", "SC Cambuur-Leeuwarden"]) {
      expect(nomi, `${fantasma} non deve comparire`).not.toContain(fantasma);
    }
  });

  it("un fixture in board senza voce live non compare", () => {
    const out = liveFootballOnBoard([{ match_id: "fd:404", home_team: "X", away_team: "Y" }], resolve);
    expect(out).toEqual([]);
  });

  it("una voce live senza nomi squadra non compare (la striscia li stampa)", () => {
    const senzaNomi: Record<string, TickerLive> = { "fd:1": { match_status: "IN_PLAY", home_team: null, away_team: "AS Roma" } };
    expect(liveFootballOnBoard(board, (p) => senzaNomi[p.match_id])).toEqual([]);
  });

  it("due fixture duplicati che risolvono sullo stesso punteggio compaiono una volta sola", () => {
    const dup: Fx[] = [...board, { match_id: "fd:1-bis", home_team: "US Lecce", away_team: "AS Roma" }];
    const map: Record<string, TickerLive> = { ...live, "fd:1-bis": live["fd:1"] };
    const out = liveFootballOnBoard(dup, (p) => map[p.match_id]);
    expect(out.length).toBe(1);
  });

  it("con la board vuota il ticker è vuoto, non cade sulla mappa grezza", () => {
    expect(liveFootballOnBoard([], resolve)).toEqual([]);
  });
});

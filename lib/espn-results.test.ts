// #SETTLE-RECOVERY-0831 — i casi sono quelli MISURATI il 31/08/2026: le 5 righe
// che football-data teneva IN_PLAY/PAUSED a 15-17 ore dal kickoff, coi nomi e
// gli orari che ESPN dichiara per le stesse partite.
import { describe, it, expect } from "vitest";
import { parseEspnFinals, abbinaFinale, yyyymmddUtc, ESPN_SLUG_BY_FD_LEAGUE, type EspnFinal } from "@/lib/espn-results";

const ev = (h: string, a: string, hs: string | null, as: string | null, completed: boolean, date = "2026-08-30T18:45Z") => ({
  date,
  status: { type: { completed } },
  competitions: [{ competitors: [
    { homeAway: "home", score: hs, team: { displayName: h } },
    { homeAway: "away", score: as, team: { displayName: a } },
  ] }],
});

describe("parseEspnFinals", () => {
  it("prende solo gli eventi completati, coi due punteggi", () => {
    const out = parseEspnFinals({ events: [
      ev("Lazio", "Genoa", "1", "0", true),
      ev("Roma", "Lecce", null, null, false),          // in programma
      ev("Napoli", "Como", "1", "2", true),
    ]});
    expect(out.map((f) => [f.home, f.away, f.homeGoals, f.awayGoals])).toEqual([
      ["Lazio", "Genoa", 1, 0],
      ["Napoli", "Como", 1, 2],
    ]);
  });

  it("un completato SENZA punteggio si scarta: `Number(null)` è 0, non NaN", () => {
    expect(parseEspnFinals({ events: [ev("A", "B", null, "1", true)] })).toEqual([]);
    expect(parseEspnFinals({ events: [ev("A", "B", "", "1", true)] })).toEqual([]);
    expect(parseEspnFinals({ events: [ev("A", "B", "x", "1", true)] })).toEqual([]);
  });

  it("senza data l'evento si scarta: l'orario è la chiave dell'abbinamento", () => {
    const senzaData = { ...ev("A", "B", "1", "0", true), date: undefined };
    expect(parseEspnFinals({ events: [senzaData] })).toEqual([]);
  });

  it("una risposta malformata non fa cadere niente", () => {
    for (const bad of [null, undefined, {}, { events: null }, { events: [{}] }, { events: [{ status: {} }] }]) {
      expect(parseEspnFinals(bad)).toEqual([]);
    }
  });
});

describe("abbinaFinale — orario come chiave, nomi come conferma", () => {
  const K = "2026-08-30T18:45Z";
  const finals: EspnFinal[] = [
    { home: "Lazio", away: "Genoa", homeGoals: 1, awayGoals: 0, kickoff: K },
    { home: "Cagliari", away: "Internazionale", homeGoals: 0, awayGoals: 1, kickoff: K },
    { home: "AS Monaco", away: "Marseille", homeGoals: 2, awayGoals: 0, kickoff: K },
    { home: "Deportivo", away: "Valencia", homeGoals: 3, awayGoals: 1, kickoff: "2026-08-30T17:30Z" },
    { home: "SC Cambuur", away: "FC Twente", homeGoals: 1, awayGoals: 4, kickoff: "2026-08-30T18:00Z" },
  ];
  // le 5 righe bloccate, coi NOSTRI nomi (più lunghi) e i punteggi VERI
  const casi: Array<[string, string, string, number, number]> = [
    ["SS Lazio", "Genoa CFC", K, 1, 0],
    ["Cagliari Calcio", "FC Internazionale Milano", K, 0, 1],
    ["AS Monaco FC", "Olympique de Marseille", K, 2, 0],
    ["RC Deportivo La Coruña", "Valencia CF", "2026-08-30T17:30Z", 3, 1],
    ["SC Cambuur-Leeuwarden", "FC Twente '65", "2026-08-30T18:00Z", 1, 4],
  ];
  for (const [h, a, k, hg, ag] of casi) {
    it(`recupera «${h} v ${a}»`, () => {
      const f = abbinaFinale({ match_id: "x", home_team: h, away_team: a, kickoff: k }, finals);
      expect(f, "nessun abbinamento").not.toBeNull();
      expect([f!.homeGoals, f!.awayGoals]).toEqual([hg, ag]);
    });
  }

  it("l'ORIENTAMENTO conta: invertito non abbina (darebbe il punteggio ribaltato)", () => {
    expect(abbinaFinale({ match_id: "x", home_team: "Genoa CFC", away_team: "SS Lazio", kickoff: K }, finals)).toBeNull();
  });

  it("un orario lontano non abbina, anche se i nomi tornano", () => {
    expect(abbinaFinale({ match_id: "x", home_team: "SS Lazio", away_team: "Genoa CFC", kickoff: "2026-08-30T21:00Z" }, finals)).toBeNull();
  });

  it("uno scostamento di pochi minuti abbina: gli anticipi esistono", () => {
    const f = abbinaFinale({ match_id: "x", home_team: "SS Lazio", away_team: "Genoa CFC", kickoff: "2026-08-30T18:52Z" }, finals);
    expect(f?.homeGoals).toBe(1);
  });

  it("una partita che non c'è non abbina", () => {
    expect(abbinaFinale({ match_id: "x", home_team: "US Lecce", away_team: "AS Roma", kickoff: K }, finals)).toBeNull();
  });

  it("AMBIGUO vuol dire FERMO: due candidati → nessun abbinamento", () => {
    const doppi: EspnFinal[] = [
      { home: "Lazio", away: "Genoa", homeGoals: 1, awayGoals: 0, kickoff: K },
      { home: "Lazio", away: "Genoa", homeGoals: 2, awayGoals: 2, kickoff: K },
    ];
    expect(abbinaFinale({ match_id: "x", home_team: "SS Lazio", away_team: "Genoa CFC", kickoff: K }, doppi)).toBeNull();
  });

  it("le particelle non fanno identità: «de», «la», «rc» non bastano da sole", () => {
    const solo: EspnFinal[] = [{ home: "La Coruña", away: "De Graafschap", homeGoals: 9, awayGoals: 9, kickoff: K }];
    // «RC Deportivo La Coruña» condivide «coruna» (6) → identità vera sul lato casa,
    // ma «Valencia CF» non condivide nulla con «De Graafschap» → nessun abbinamento.
    expect(abbinaFinale({ match_id: "x", home_team: "RC Deportivo La Coruña", away_team: "Valencia CF", kickoff: K }, solo)).toBeNull();
  });

  it("un kickoff illeggibile non abbina invece di lanciare", () => {
    expect(abbinaFinale({ match_id: "x", home_team: "SS Lazio", away_team: "Genoa CFC", kickoff: "non-una-data" }, finals)).toBeNull();
  });
});

describe("contorno", () => {
  it("yyyymmddUtc usa UTC, non il fuso locale", () => {
    expect(yyyymmddUtc(new Date("2026-08-30T23:30:00Z"))).toBe("20260830");
    expect(yyyymmddUtc(new Date("2026-08-31T00:10:00Z"))).toBe("20260831");
  });
  it("gli slug sondati ci sono tutti", () => {
    for (const c of ["PL", "SA", "PD", "BL1", "FL1"]) expect(ESPN_SLUG_BY_FD_LEAGUE[c]).toBeTruthy();
  });
});

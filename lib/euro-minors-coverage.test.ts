import { describe, it, expect } from "vitest";
import {
  SUMMER_LEAGUES,
  SUMMER_LIVE_ESPN_SLUGS,
  isSummerLeague,
  fetchSummerHistory,
  matchModelTeam,
} from "./summer-leagues";
import { surfaceFloorFor, isSurfacedRow } from "./surfacing-gate";

// #EURO-MINORS-0726 — AUT/DNK/POL/SWZ ride the off-free-tier machinery with
// per-league floors from the walk-forward lab. These tests pin the wiring so a
// refactor can't drop a league or collapse a precautionary floor into the club
// default.

const CODES = ["AUT", "DNK", "POL", "SWZ"] as const;

describe("#EURO-MINORS-0726 wiring", () => {
  it("all four leagues are registered as off-free-tier leagues", () => {
    for (const code of CODES) expect(isSummerLeague(code)).toBe(true);
    expect(SUMMER_LEAGUES.AUT).toBe("Austrian Bundesliga");
    expect(SUMMER_LEAGUES.DNK).toBe("Danish Superliga");
    expect(SUMMER_LEAGUES.POL).toBe("Ekstraklasa");
    expect(SUMMER_LEAGUES.SWZ).toBe("Swiss Super League");
  });

  it("each ships a non-empty history snapshot with valid results", () => {
    for (const code of CODES) {
      const hist = fetchSummerHistory(code);
      expect(hist.length).toBeGreaterThan(100); // ~a full season each
      for (const m of hist.slice(0, 30)) {
        expect(typeof m.homeTeam).toBe("string");
        expect(typeof m.awayTeam).toBe("string");
        expect(Number.isInteger(m.homeGoals)).toBe(true);
        expect(Number.isInteger(m.awayGoals)).toBe(true);
      }
    }
  });

  it("AUT/DNK/SWZ are on the live ESPN scoreboard slugs; POL has no ESPN league", () => {
    expect(SUMMER_LIVE_ESPN_SLUGS).toContain("aut.1");
    expect(SUMMER_LIVE_ESPN_SLUGS).toContain("den.1");
    expect(SUMMER_LIVE_ESPN_SLUGS).toContain("sui.1");
    // POL fixtures come from the Odds API /events fallback (VEI pattern): no
    // ESPN slug must ever be polled for it.
    expect(SUMMER_LIVE_ESPN_SLUGS.filter((s) => s.startsWith("pol"))).toEqual([]);
  });

  it("matches ESPN-sourced fixtures exactly and fails closed on unbridgeable names", () => {
    // DNK: history snapshot ships ESPN displayNames (generator aliases handle
    // Copenhagen/AGF/Sønderjyske), and fixtures come from the SAME ESPN feed →
    // serve-time match is exact.
    const dnk = ["F.C. København", "AGF", "Brøndby IF", "Sønderjyske Fodbold"];
    expect(matchModelTeam("F.C. København", dnk)).toBe("F.C. København");
    expect(matchModelTeam("AGF", dnk)).toBe("AGF");
    // An unbridgeable name must be SKIPPED, never guessed (fail-closed):
    // "Copenhagen" is a different WORD from "København", not a diacritic away,
    // so no amount of normalization may bridge it.
    expect(matchModelTeam("FC Copenhagen", dnk)).toBeNull();
    expect(matchModelTeam("Juventus", dnk)).toBeNull();
    // POL: odds events are the PRIMARY fixtures source and its names extend the
    // CSV ones → containment bridges them.
    const pol = ["Legia", "Rakow", "Pogon Szczecin"];
    expect(matchModelTeam("Legia Warsaw", pol)).toBe("Legia");
    expect(matchModelTeam("Raków Częstochowa", pol)).toBe("Rakow");
  });
});

describe("#TEAM-NAME-FOLD-0727 lettere latine non scomponibili da NFKD", () => {
  // Le fixture POL arrivano dalla Odds API con i diacritici polacchi pieni,
  // mentre lo snapshot porta i nomi CSV in ASCII. NFKD scompone ó/ę/ż (base +
  // segno combinante) ma NON ł/ø/đ/æ/ß, che sono glifi a sé: senza la piega
  // esplicita questi nomi non si incontrano mai e la partita sparisce.
  const pol = ["Wisla Plock", "Zaglebie", "Widzew Lodz", "Legia", "Rakow"];

  it("piega la ł polacca: nomi persi il 2026-07-27 sulle fixture reali", () => {
    expect(matchModelTeam("Wisła Płock", pol)).toBe("Wisla Plock");
    expect(matchModelTeam("Zagłębie Lubin", pol)).toBe("Zaglebie");
  });

  it("«Widzew Łódź» non dipende più dall'overlap 0.50 al limite", () => {
    // Prima passava solo perché il token "widzew" da solo faceva esattamente
    // 0.50 su 2 token: bastava una squadra a nome singolo per perderla.
    expect(matchModelTeam("Widzew Łódź", pol)).toBe("Widzew Lodz");
    expect(matchModelTeam("Łódź", ["Lodz"])).toBe("Lodz");
  });

  it("piega la ø nordica nei due versi (alias danesi non più necessari)", () => {
    expect(matchModelTeam("Sønderjyske", ["Sonderjyske Fodbold"])).toBe("Sonderjyske Fodbold");
    expect(matchModelTeam("Sonderjyske", ["Sønderjyske Fodbold"])).toBe("Sønderjyske Fodbold");
    expect(matchModelTeam("Bodø/Glimt", ["Bodo/Glimt"])).toBe("Bodo/Glimt");
  });

  it("resta fail-closed: la piega non inventa accostamenti", () => {
    expect(matchModelTeam("Lech Poznan", pol)).toBeNull();
    expect(matchModelTeam("Juventus", pol)).toBeNull();
  });
});

describe("#TEAM-MATCH-SAFETY-0727 mai il modello di un'ALTRA squadra", () => {
  // Una squadra assente dal modello (neopromossa) deve dare null. Con la
  // vecchia soglia 0.50 un solo token condiviso su due bastava ad agganciarla
  // alla squadra sbagliata, e il board serviva la previsione di un'altra.
  it("non aggancia una neopromossa alla compaesana che condivide il prefisso", () => {
    expect(matchModelTeam("KV Kortrijk", ["KV Mechelen", "Club Brugge", "Anderlecht"])).toBeNull();
    expect(matchModelTeam("VfL Osnabruck", ["VfL Bochum", "Hertha Berlin"])).toBeNull();
    expect(matchModelTeam("Shanghai Port", ["Shanghai Shenhua", "Beijing Guoan"])).toBeNull();
  });

  it("un nome ambiguo (pari punteggio su due squadre) torna null, non la prima", () => {
    expect(matchModelTeam("Qingdao United FC", ["Qingdao West Coast", "Qingdao Hainiu"])).toBeNull();
  });

  it("i due aggancî sbagliati trovati sulle fixture reali del 2026-07-27", () => {
    // Erano SERVITI col modello di un'altra squadra, non saltati.
    expect(matchModelTeam("Austria Lustenau", ["Austria Vienna", "Rapid Vienna"])).toBeNull();
    expect(matchModelTeam("Lyngby Boldklub", ["Odense Boldklub", "Randers FC"])).toBeNull();
  });

  it("la punteggiatura non separa una squadra da se stessa", () => {
    // Alzare la soglia senza togliere il punto avrebbe fatto sparire St. Gallen:
    // "st." e "st" non sono lo stesso token, restava solo "gallen" = 0.50.
    expect(matchModelTeam("FC St Gallen", ["St. Gallen", "FC Basel"])).toBe("St. Gallen");
    expect(matchModelTeam("St Patricks Athletic", ["St. Patrick's Athletic"])).toBe("St. Patrick's Athletic");
    // ma due "St." diversi restano due squadre diverse
    expect(matchModelTeam("St. Pauli", ["St. Gallen"])).toBeNull();
  });

  it("continua a riconoscere le squadre che il modello HA davvero", () => {
    const csl = ["Shanghai Port", "Shanghai Shenhua", "Beijing Guoan"];
    expect(matchModelTeam("Shanghai Port", csl)).toBe("Shanghai Port");        // esatto
    expect(matchModelTeam("Shanghai Shenhua FC", csl)).toBe("Shanghai Shenhua"); // contenimento
    // overlap ancora informativo: 2 token su 3 = 0.67
    expect(matchModelTeam("Sporting Kansas City", ["Sporting Kansas Town"])).toBe("Sporting Kansas Town");
  });
});

describe("#EURO-MINORS-0726 per-league floors (lab-derived)", () => {
  it("uses the lab floors, not the club default 56", () => {
    expect(surfaceFloorFor("football", "Austrian Bundesliga")).toBe(60);
    expect(surfaceFloorFor("football", "Swiss Super League")).toBe(65);
    expect(surfaceFloorFor("football", "Danish Superliga")).toBe(70);
    expect(surfaceFloorFor("football", "Ekstraklasa")).toBe(70);
  });

  it("does NOT collide with the German Bundesliga (club default 56)", () => {
    expect(surfaceFloorFor("football", "Bundesliga")).toBe(56);
  });

  it("does NOT collide with the Chinese Super League floor (70)", () => {
    expect(surfaceFloorFor("football", "Chinese Super League")).toBe(70);
    expect(surfaceFloorFor("football", "Swiss Super League")).toBe(65);
  });

  it("surfaces a directional pick only at/above each league's floor", () => {
    expect(isSurfacedRow({ sport: "football", competition: "Austrian Bundesliga", confidence_score: 59 })).toBe(false);
    expect(isSurfacedRow({ sport: "football", competition: "Austrian Bundesliga", confidence_score: 60 })).toBe(true);
    expect(isSurfacedRow({ sport: "football", competition: "Danish Superliga", confidence_score: 69 })).toBe(false);
    expect(isSurfacedRow({ sport: "football", competition: "Ekstraklasa", confidence_score: 70 })).toBe(true);
  });
});

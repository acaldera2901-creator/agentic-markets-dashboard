import { describe, it, expect } from "vitest";
import {
  CROSS_COMPETITION_CODES,
  modelPoolIsCoherent,
  MIN_MATCHES_PER_TEAM,
} from "./poisson-model";
import { SUMMER_LEAGUES } from "./summer-leagues";
import { surfaceFloorFor } from "./surfacing-gate";

// #COVERAGE-0812-L2bis (APPROVE Andrea 12/08/2026)
//
// Il modello misura attacco/difesa RELATIVI alla media del proprio pool. In una
// competizione cross-lega il pool non e' uno: il PSG e' misurato su avversari di
// Ligue 1 e l'Aston Villa su avversari di Premier. Queste competizioni non
// possono produrre un pick finche' non esiste l'Elo cross-lega (L2b).

describe("competizioni cross-lega: mai un pick dal pool sbagliato", () => {
  it("Champions, Europa e Conference hanno il pool NON coerente", () => {
    for (const code of ["CL", "EL", "ECL"]) {
      expect(modelPoolIsCoherent(code), `${code} dovrebbe essere cross-lega`).toBe(false);
      expect(CROSS_COMPETITION_CODES.has(code)).toBe(true);
    }
  });

  it("i campionati nazionali hanno il pool coerente", () => {
    // I top-5 piu' un campione delle off-free-tier: sono tutte competizioni
    // dove ogni squadra incontra le altre dello stesso pool.
    for (const code of ["PL", "SA", "PD", "BL1", "FL1", "WC", ...Object.keys(SUMMER_LEAGUES)]) {
      expect(modelPoolIsCoherent(code), `${code} non dovrebbe essere cross-lega`).toBe(true);
    }
  });

  // La ragione per cui questo guard esiste, e per cui NON e' un floor.
  it("il gate di numerosita' da solo non fermava la Champions", () => {
    // Nella fase a campionato ogni squadra gioca 8 partite: superata la soglia
    // di 4, la riga diventava "reliable" e dalla terza-quarta giornata usciva un
    // pick calcolato su un pool di 4-8 partite.
    expect(MIN_MATCHES_PER_TEAM).toBe(4);
    const matchesPerTeamInLeaguePhase = 8;
    expect(matchesPerTeamInLeaguePhase).toBeGreaterThan(MIN_MATCHES_PER_TEAM);
    // Ed e' proprio percio' che serve un guard separato:
    expect(modelPoolIsCoherent("CL")).toBe(false);
  });

  it("e non e' un floor: la Champions resta sul floor di default", () => {
    // Un floor misura la confidence, non la validita' del pool. Su pochi dati lo
    // shrinkage lascia lambda estreme, quindi confidence ALTA: un floor alto
    // lascerebbe passare proprio i casi meno difendibili. Il floor della
    // Champions resta quello di default DI PROPOSITO — non e' la leva giusta.
    expect(surfaceFloorFor("football", "Champions League")).toBe(56);
    expect(surfaceFloorFor("football", "Europa League")).toBe(56);
  });

  it("il set e' chiuso: una lega non elencata non diventa cross-lega per sbaglio", () => {
    expect(modelPoolIsCoherent("EFLC")).toBe(true);
    expect(modelPoolIsCoherent("MLS")).toBe(true);
    expect(modelPoolIsCoherent("")).toBe(true);
    expect(CROSS_COMPETITION_CODES.size).toBe(3);
  });
});

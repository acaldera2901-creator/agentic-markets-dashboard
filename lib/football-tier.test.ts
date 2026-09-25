// #TRE-LIVELLI-0925 — i tre stati del calcio, e le tre cose che NON devono
// poter succedere: una riga che sparisce, una «lettura» contata come pick nel
// numero pubblico, un badge che raccomanda una riga sotto il floor.
//
// I numeri citati nei commenti sono misurati il 25/09 replicando la pipeline di
// app/api/v2/history/route.ts (stesso SQL, stesso wasShownAsPick, stessa
// dedup, stesso gate verification_state='verified') sul DB di produzione.
import { describe, it, expect } from "vitest";
import {
  footballTier,
  footballTierFor,
  surfaceFloorFor,
  READING_BAND,
  SURFACE_FLOOR_FOOTBALL,
  type FootballTier,
} from "./surfacing-gate";
import { outcomeTally } from "./track-record";
import { fromDeskFootball } from "./ui/desk-card";

describe("i bordi delle tre bande", () => {
  // Il floor e' INCLUSIVO (era gia' cosi' per surfaceDecision), la banda
  // intermedia e' floor-READING_BAND .. floor-1, sotto e' sola lettura.
  const f = 65; // il floor piu' diffuso in CLUB_FLOOR_OVERRIDES

  it("al floor esatto e' una pick", () => {
    expect(footballTier(65, f)).toBe("pick");
  });

  it("un punto sopra il floor e' una pick", () => {
    expect(footballTier(66, f)).toBe("pick");
  });

  it("un punto SOTTO il floor entra nella banda, non nella sola lettura", () => {
    // E' il cuore del cambiamento: prima questa riga o era pick (con
    // PICK_SEMPRE acceso) o perdeva del tutto la direzione.
    expect(footballTier(64, f)).toBe("reading");
  });

  it("il bordo BASSO della banda e' incluso", () => {
    expect(footballTier(f - READING_BAND, f)).toBe("reading");
    expect(footballTier(59, f)).toBe("reading");
  });

  it("un punto sotto il bordo basso e' sola lettura", () => {
    expect(footballTier(f - READING_BAND - 1, f)).toBe("readonly");
    expect(footballTier(58, f)).toBe("readonly");
  });

  it("la banda e' larga esattamente READING_BAND punti", () => {
    const reading: number[] = [];
    for (let c = 0; c <= 100; c++) if (footballTier(c, f) === "reading") reading.push(c);
    expect(reading.length).toBe(READING_BAND);
    expect(reading[0]).toBe(f - READING_BAND);
    expect(reading[reading.length - 1]).toBe(f - 1);
  });

  it("i tre stati sono esaustivi e mutuamente esclusivi su ogni confidenza", () => {
    const visti = new Set<FootballTier>();
    for (let c = 0; c <= 100; c++) {
      const t = footballTier(c, f);
      expect(["pick", "reading", "readonly"]).toContain(t);
      visti.add(t);
    }
    expect(visti.size).toBe(3);
  });

  it("confidenza assente o non finita → sola lettura (fail-closed)", () => {
    // Non si puo' DIMOSTRARE che stesse sopra il floor: stessa scelta gia'
    // fatta da isSurfacedRow.
    expect(footballTier(null, f)).toBe("readonly");
    expect(footballTier(undefined, f)).toBe("readonly");
    expect(footballTier(NaN, f)).toBe("readonly");
  });

  it("senza floor esplicito si usa quello del calcio di club", () => {
    expect(footballTier(SURFACE_FLOOR_FOOTBALL)).toBe("pick");
    expect(footballTier(SURFACE_FLOOR_FOOTBALL - 1)).toBe("reading");
    expect(footballTier(SURFACE_FLOOR_FOOTBALL - READING_BAND - 1)).toBe("readonly");
  });
});

describe("il floor e' quello della LEGA, non uno solo per tutti", () => {
  // La stessa confidenza cade in tier diversi secondo la lega. E' il motivo per
  // cui il 78,9% esiste: i 65 di MLS/Championship/Serie B non sono i 56 di
  // Serie A.
  const riga = (competition: string, confidence_score: number) =>
    footballTierFor({ sport: "football", competition, confidence_score });

  it("confidenza 60: pick in Serie A (floor 56), lettura in MLS (floor 65)", () => {
    expect(surfaceFloorFor("football", "Serie A")).toBe(56);
    expect(surfaceFloorFor("football", "MLS")).toBe(65);
    expect(riga("Serie A", 60)).toBe("pick");
    expect(riga("MLS", 60)).toBe("reading");
  });

  it("confidenza 63: lettura in Championship (65), sola lettura in Ekstraklasa (70)", () => {
    // Su floor 65 la banda e' 59-64; su floor 70 e' 64-69. La stessa confidenza
    // cade quindi in due stati diversi, che e' il punto dei floor per-lega.
    expect(riga("Championship", 63)).toBe("reading");
    expect(riga("Ekstraklasa", 63)).toBe("readonly");
  });

  it("su una lega a floor 70 la banda arriva fino a 64, non piu' in basso", () => {
    // Misurato il 25/09: la banda sulle cinque leghe a 70 vale 10 righe in
    // tutto lo storico (7 vinte). Non riapre il rubinetto che quei floor
    // avevano chiuso — ma la verifica sta qui perche' il sospetto era legittimo.
    expect(riga("Ekstraklasa", 69)).toBe("reading");
    expect(riga("Ekstraklasa", 64)).toBe("reading");
    expect(riga("Ekstraklasa", 63)).toBe("readonly");
  });

  it("il floor basso del Mondiale (26) vale anche qui", () => {
    expect(riga("World Cup", 26)).toBe("pick");
    expect(riga("World Cup", 25)).toBe("reading");
    expect(riga("World Cup", 19)).toBe("readonly");
  });

  it("i cinque floor a 70 restano invalicabili anche per la banda", () => {
    // Abbassare il floor di queste leghe e' proibito da surfacing-gate.test.ts.
    // Qui si verifica che la banda non lo aggiri: a 63 (70-7) siamo comunque
    // in sola lettura, non in lettura del modello.
    for (const lega of ["League of Ireland", "Chinese Super League", "Danish Superliga", "Ekstraklasa", "2. Bundesliga"]) {
      expect(riga(lega, 63), lega).toBe("readonly");
      expect(riga(lega, 69), lega).toBe("reading");
      expect(riga(lega, 70), lega).toBe("pick");
    }
  });
});

describe("il tennis e gli altri sport NON passano di qui", () => {
  // L'analisi del 24/09: nel tennis il floor non e' la leva (lo e'
  // TENNIS_REQUIRE_MARKET). Questo gate non deve poter declassare una riga di
  // tennis, ne' una di MLB/UFC, qualunque sia la sua confidenza.
  it("una riga di tennis resta «pick» anche molto sotto il suo floor", () => {
    expect(footballTierFor({ sport: "tennis", competition: "Wimbledon", confidence_score: 40 })).toBe("pick");
  });

  it("baseball e MMA non vengono declassati", () => {
    expect(footballTierFor({ sport: "baseball", competition: "MLB", confidence_score: 50 })).toBe("pick");
    expect(footballTierFor({ sport: "mma", competition: "UFC 300", confidence_score: 50 })).toBe("pick");
  });

  it("sport assente → non declassato (solo il calcio dichiarato viene giudicato)", () => {
    expect(footballTierFor({ sport: null, competition: "Serie A", confidence_score: 10 })).toBe("pick");
  });

  it("il calcio si riconosce senza badare alle maiuscole", () => {
    expect(footballTierFor({ sport: "Football", competition: "Serie A", confidence_score: 10 })).toBe("readonly");
  });
});

// ── Il numero pubblico ──────────────────────────────────────────────────────
//
// Specchio del gate in app/api/v2/history/route.ts: l'headline conta
// `footballTierFor(row) === "pick"`. Se qualcuno cambia quel predicato, questi
// test cadono.
describe("/history: la «lettura del modello» non entra nel numero pubblico", () => {
  type Riga = { sport: string; competition: string; confidence_score: number; result: string };
  const headline = (rows: Riga[]) => rows.filter((r) => footballTierFor(r) === "pick");

  // Una popolazione costruita per somigliare alla vera: poche pick che vincono
  // spesso, molte righe sotto la banda che vincono poco.
  const rows: Riga[] = [
    ...Array.from({ length: 8 }, () => ({ sport: "football", competition: "Serie A", confidence_score: 70, result: "won" })),
    ...Array.from({ length: 2 }, () => ({ sport: "football", competition: "Serie A", confidence_score: 70, result: "lost" })),
    // banda: 50-55 con floor 56
    ...Array.from({ length: 6 }, () => ({ sport: "football", competition: "Serie A", confidence_score: 52, result: "won" })),
    ...Array.from({ length: 4 }, () => ({ sport: "football", competition: "Serie A", confidence_score: 52, result: "lost" })),
    // sotto la banda
    ...Array.from({ length: 4 }, () => ({ sport: "football", competition: "Serie A", confidence_score: 40, result: "won" })),
    ...Array.from({ length: 16 }, () => ({ sport: "football", competition: "Serie A", confidence_score: 40, result: "lost" })),
  ];

  it("l'headline conta SOLO le pick", () => {
    const h = headline(rows);
    expect(h.length).toBe(10);
    expect(outcomeTally(h).n).toBe(10);
    // 8/10 — la banda (60%) e la sola lettura (20%) non lo diluiscono.
    expect(outcomeTally(h).won).toBe(8);
  });

  it("nessuna riga della banda finisce nell'headline", () => {
    const h = headline(rows);
    expect(h.some((r) => footballTierFor(r) === "reading")).toBe(false);
    expect(h.some((r) => footballTierFor(r) === "readonly")).toBe(false);
  });

  it("le popolazioni escluse restano contate e pubblicabili", () => {
    // La condizione che rende l'esclusione onesta invece che survivorship:
    // quello che esce dall'headline deve avere comunque il suo n e il suo esito.
    const reading = rows.filter((r) => footballTierFor(r) === "reading");
    const readonly = rows.filter((r) => footballTierFor(r) === "readonly");
    expect(outcomeTally(reading).n).toBe(10);
    expect(outcomeTally(readonly).n).toBe(20);
    // Somma delle tre popolazioni = tutte le righe mostrate. Nessuna evapora.
    expect(outcomeTally(headline(rows)).n + outcomeTally(reading).n + outcomeTally(readonly).n)
      .toBe(rows.length);
  });

  it("il tennis resta nell'headline senza essere toccato", () => {
    const misto: Riga[] = [
      ...rows,
      { sport: "tennis", competition: "Hamburg Open", confidence_score: 40, result: "won" },
    ];
    expect(headline(misto).length).toBe(11);
  });

  it("outcomeTally non pubblica una percentuale su pochi esiti", () => {
    // Stessa regola di edgeTally (MIN_DECIDED_FOR_RATE): sotto i 15 esiti la
    // percentuale e' varianza, e resta null.
    expect(outcomeTally([{ result: "won" }, { result: "lost" }]).win_rate).toBeNull();
    expect(outcomeTally(Array.from({ length: 20 }, () => ({ result: "won" }))).win_rate).toBe(100);
  });

  it("void e pending non entrano nel denominatore", () => {
    const t = outcomeTally([
      ...Array.from({ length: 15 }, () => ({ result: "won" })),
      { result: "void" }, { result: "pending" }, { result: null },
    ]);
    expect(t.n).toBe(15);
  });
});

// ── Nessuna riga sparisce ───────────────────────────────────────────────────
describe("nessuna card sparisce mai dal listino, in nessuno dei tre stati", () => {
  const riga = (tier: FootballTier) => ({
    match_id: `m-${tier}`,
    league: "SA",
    league_name: "Serie A",
    home_team: "Inter",
    away_team: "Lazio",
    kickoff: "2026-10-20T18:00:00Z",
    p_home: 0.61, p_draw: 0.22, p_away: 0.17,
    odds_home: 1.7, odds_draw: 3.6, odds_away: 5.0,
    best_selection: "HOME",
    confidence_score: 61,
    enrichment: { surface: { below_floor: tier === "readonly", floor: 56, tier } },
  });

  for (const tier of ["pick", "reading", "readonly"] as const) {
    it(`tier «${tier}»: la card esiste, con squadre, probabilita' e lega`, () => {
      const card = fromDeskFootball(riga(tier), { winLabel: "to win", drawLabel: "Draw" });
      expect(card.id).toBe(`m-${tier}`);
      expect(card.home).toBe("Inter");
      expect(card.away).toBe("Lazio");
      expect(card.league).toBe("Serie A");
      // La probabilita' del modello si vede SEMPRE: e' probability-neutral.
      expect(card.modelPct).toBeCloseTo(61, 5);
      expect(card.tier).toBe(tier);
    });
  }

  it("«pick» e «reading» mostrano la direzione, «readonly» no", () => {
    const opts = { winLabel: "to win", drawLabel: "Draw" };
    expect(fromDeskFootball(riga("pick"), opts).pick).toBe("Inter to win");
    // LA NOVITA': la banda intermedia una direzione ce l'ha.
    expect(fromDeskFootball(riga("reading"), opts).pick).toBe("Inter to win");
    // Il vecchio below_floor: si nomina l'esito, non si dice «vince».
    expect(fromDeskFootball(riga("readonly"), opts).pick).toBe("Inter");
  });

  it("un payload senza `tier` si comporta come prima (nessuna regressione)", () => {
    const vecchia = { ...riga("pick"), enrichment: { surface: { below_floor: false, floor: 56 } } };
    const sottoFloor = { ...riga("pick"), enrichment: { surface: { below_floor: true, floor: 56 } } };
    const opts = { winLabel: "to win", drawLabel: "Draw" };
    expect(fromDeskFootball(vecchia, opts).tier).toBe("pick");
    expect(fromDeskFootball(vecchia, opts).pick).toBe("Inter to win");
    expect(fromDeskFootball(sottoFloor, opts).tier).toBe("readonly");
    expect(fromDeskFootball(sottoFloor, opts).pick).toBe("Inter");
  });

  it("senza `enrichment` del tutto la riga resta una pick (fail-soft)", () => {
    const nuda = { ...riga("pick"), enrichment: null };
    expect(fromDeskFootball(nuda, { winLabel: "to win" }).tier).toBe("pick");
  });
});

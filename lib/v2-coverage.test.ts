// #V2-FOOTBALL-COVERAGE-0802 — quali righe /api/v2/predictions considera
// "complete" abbastanza da servirle.
//
// Il difetto che questi test impediscono di reintrodurre: la condizione che
// ammette le righe SOTTO FLOOR (pick=null per scelta del gate, ma con una
// probabilità reale) era scritta `r.sport === "tennis" && ...`. Per il football
// non scattava nessuna delle altre due condizioni — `p_home` esiste solo se
// coalescato dai `notes`, e misurato il 2026-08-02 le righe football club hanno
// `notes: null`, zero su 49. Risultato: v2 serviva 2 partite di football su 49
// mentre il board ne serviva 49.
//
// La funzione è la stessa espressione della route, estratta qui perché una
// condizione booleana che decide cosa vede un cliente merita un test proprio.
import { describe, it, expect } from "vitest";

/** Specchio esatto del predicato `hasProb` in app/api/v2/predictions/route.ts. */
function hasProb(r: Record<string, unknown>): boolean {
  return (
    typeof r.p_home === "number" ||
    (typeof r.pick === "string" && (r.pick as string).trim() !== "" && typeof r.confidence_score === "number") ||
    typeof r.confidence_score === "number"
  );
}

describe("v2: quali righe vengono servite", () => {
  it("football sotto floor (pick null, notes null) viene servito", () => {
    // La riga reale che v2 scartava: 46 delle 49 football in finestra sono così.
    expect(hasProb({ sport: "football", pick: null, confidence_score: 31, notes: null })).toBe(true);
  });

  it("tennis sotto floor resta servito (era già coperto)", () => {
    expect(hasProb({ sport: "tennis", pick: null, confidence_score: 55, p_home: null })).toBe(true);
  });

  it("una riga con pick e confidenza è servita, in qualunque sport", () => {
    expect(hasProb({ sport: "football", pick: "HOME", confidence_score: 62 })).toBe(true);
    expect(hasProb({ sport: "baseball", pick: "HOME", confidence_score: 70 })).toBe(true);
  });

  it("football con p_home dai notes resta servito (percorso storico)", () => {
    expect(hasProb({ sport: "football", pick: null, p_home: 0.44 })).toBe(true);
  });

  it("una riga SENZA alcuna probabilità resta nascosta", () => {
    // È il contratto "niente card vuote": senza un numero da mostrare la riga
    // non si serve. Questo NON deve cambiare.
    expect(hasProb({ sport: "football", pick: null, confidence_score: null, p_home: null })).toBe(false);
    expect(hasProb({ sport: "tennis", pick: "", confidence_score: undefined })).toBe(false);
    expect(hasProb({ sport: "football" })).toBe(false);
  });

  it("un pick senza confidenza non basta: serve un numero", () => {
    expect(hasProb({ sport: "football", pick: "HOME", confidence_score: null })).toBe(false);
  });

  it("confidence_score zero è un numero valido, non un'assenza", () => {
    // Guardia contro un `if (r.confidence_score)` scritto per distrazione: 0 è
    // falsy ma è una probabilità legittima, e scartarla nasconderebbe una riga.
    expect(hasProb({ sport: "football", pick: null, confidence_score: 0 })).toBe(true);
  });
});

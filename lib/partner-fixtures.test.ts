// #PARTNER-INGEST-0911 — ogni scarto qui e' una riga che NON finisce sul board,
// quindi ogni condizione va provata: una svista in piu' pubblica una partita
// falsa, una in meno la nasconde.
import { describe, it, expect } from "vitest";
import { devig2vie, fixtureDaPartner } from "./partner-fixtures";
import type { FpMatch } from "./fortuneplay-live";

const ORA = Date.parse("2026-09-11T12:00:00Z");

function m(over: Partial<FpMatch> = {}): FpMatch {
  return {
    teamPairKey: "2026-09-12:alcaraz|sinner",
    homeKey: "sinner",
    awayKey: "alcaraz",
    sport: "tennis",
    slug: "sinner-alcaraz",
    id: 1,
    urnId: "urn:1",
    oddsHome: 1.8,
    oddsAway: 2.05,
    oddsDraw: null,
    totalLine: null,
    totalOver: null,
    totalUnder: null,
    homeName: "Jannik Sinner",
    awayName: "Carlos Alcaraz",
    startTime: "2026-09-12T14:00:00Z",
    ...over,
  };
}

describe("devig2vie", () => {
  it("toglie il margine: le due probabilita' sommano a 1", () => {
    const p = devig2vie(1.8, 2.05)!;
    expect(p.p1 + p.p2).toBeCloseTo(1, 12);
    // il favorito resta il favorito
    expect(p.p1).toBeGreaterThan(p.p2);
  });

  it("il margine c'era davvero: le implicite grezze superano 1", () => {
    // Se la somma grezza fosse gia' 1, non ci sarebbe nulla da togliere e il
    // de-vig sarebbe un no-op mascherato. Qui vale ~1.043.
    expect(1 / 1.8 + 1 / 2.05).toBeGreaterThan(1);
    const p = devig2vie(1.8, 2.05)!;
    expect(p.p1).toBeLessThan(1 / 1.8); // la probabilita' scende togliendo il vig
  });

  it("quote impossibili: null, non un numero inventato", () => {
    expect(devig2vie(1.0, 2.0)).toBeNull();
    expect(devig2vie(2.0, 0.9)).toBeNull();
    expect(devig2vie(Number.NaN, 2.0)).toBeNull();
  });
});

describe("fixtureDaPartner: cosa entra e cosa viene scartato", () => {
  it("una partita futura con entrambi i prezzi diventa una fixture", () => {
    const f = fixtureDaPartner(m(), ORA)!;
    expect(f).not.toBeNull();
    expect(f.player1).toBe("Jannik Sinner");
    expect(f.player2).toBe("Carlos Alcaraz");
    expect(f.p1 + f.p2).toBeCloseTo(1, 12);
    // il pick implicito e' il favorito del mercato
    expect(f.p1).toBeGreaterThan(f.p2);
  });

  it("l'id porta l'origine e la chiave: due book danno lo STESSO id", () => {
    // E' cio' che impedisce di pubblicare due volte la stessa partita quando
    // FortunePlay e YBets la mandano entrambi (stessa piattaforma).
    const a = fixtureDaPartner(m(), ORA)!;
    const b = fixtureDaPartner(m({ id: 999, slug: "altro-slug" }), ORA)!;
    expect(a.matchId).toBe(b.matchId);
    expect(a.matchId).toContain("partner");
  });

  // ── #PARTNER-DEDUP-0911 ───────────────────────────────────────────────────
  // Il test che mancava, e la sua assenza e' costata 72 righe su 74.
  //
  // `app/api/tennis/route.ts` deduplica con
  //     DISTINCT ON (COALESCE(NULLIF(split_part(match_id, ':', 3), ''), match_id))
  // cioe' sul TERZO segmento dell'id. Il primo formato che avevo scelto —
  // `tennis:partner:2026-09-12:tizio|caio` — metteva li' la DATA, quindi tutte
  // le partite di uno stesso giorno diventavano una riga sola. In produzione:
  // 74 scritte, 2 servite. Nessun test poteva vederlo, perche' la dedup vive in
  // un'altra query: quindi la si riproduce qui.
  const terzoSegmento = (id: string) => id.split(":")[2] || id;

  it("il TERZO segmento dell'id e' univoco per partita (lo esige la dedup SQL)", () => {
    const a = fixtureDaPartner(m(), ORA)!;
    const b = fixtureDaPartner(
      m({ teamPairKey: "2026-09-12:djokovic|federer", homeName: "Novak Djokovic", awayName: "Roger Federer" }),
      ORA,
    )!;
    // stessa data, partite diverse: devono restare distinte
    expect(terzoSegmento(a.matchId)).not.toBe(terzoSegmento(b.matchId));
  });

  it("il terzo segmento non e' una data: sarebbe uguale per tutta la giornata", () => {
    const f = fixtureDaPartner(m(), ORA)!;
    expect(terzoSegmento(f.matchId)).not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // e contiene ancora i nomi, cioe' l'informazione che rende univoca la riga
    expect(terzoSegmento(f.matchId)).toContain("sinner");
  });

  it("l'id non contiene due punti oltre ai due del prefisso", () => {
    const f = fixtureDaPartner(m(), ORA)!;
    expect(f.matchId.split(":").length).toBe(3);
  });

  it("scarta il calcio: questo ingest e' solo tennis", () => {
    expect(fixtureDaPartner(m({ sport: "soccer" }), ORA)).toBeNull();
  });

  it("scarta una partita GIA' INIZIATA (la pubblicheremmo come futura)", () => {
    expect(fixtureDaPartner(m({ startTime: "2026-09-11T11:59:00Z" }), ORA)).toBeNull();
  });

  it("scarta oltre l'orizzonte di pubblicazione di 10 giorni", () => {
    expect(fixtureDaPartner(m({ startTime: "2026-09-30T14:00:00Z" }), ORA)).toBeNull();
    // ma il giorno 9 passa: il confine non e' spostato per sbaglio
    expect(fixtureDaPartner(m({ startTime: "2026-09-20T14:00:00Z" }), ORA)).not.toBeNull();
  });

  it("scarta senza orario: senza quello non si settla e non si ordina", () => {
    expect(fixtureDaPartner(m({ startTime: null }), ORA)).toBeNull();
  });

  it("scarta senza nomi veri: sono loro il motivo per cui esiste questo file", () => {
    expect(fixtureDaPartner(m({ homeName: "" }), ORA)).toBeNull();
    expect(fixtureDaPartner(m({ awayName: "" }), ORA)).toBeNull();
  });

  it("scarta se manca UNO dei due prezzi: senza de-vig niente probabilita' onesta", () => {
    expect(fixtureDaPartner(m({ oddsHome: null }), ORA)).toBeNull();
    expect(fixtureDaPartner(m({ oddsAway: null }), ORA)).toBeNull();
  });

  it("scarta una quota impossibile invece di produrre una probabilita' assurda", () => {
    expect(fixtureDaPartner(m({ oddsHome: 1.0 }), ORA)).toBeNull();
  });

  it("l'orario esce normalizzato in ISO", () => {
    const f = fixtureDaPartner(m({ startTime: "2026-09-12T14:00:00+00:00" }), ORA)!;
    expect(f.scheduledAt).toBe("2026-09-12T14:00:00.000Z");
  });
});

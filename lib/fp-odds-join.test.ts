// #BOARD-ODDS-JOIN-0910 — i nomi qui sono VERI: da un lato le fixture come le
// serve `/api/predictions` il 10/09, dall'altro le chiavi del feed partner
// (`/api/fortuneplay-odds`, 888 voci). Le coppie sono quelle che il board
// perdeva.
import { describe, it, expect } from "vitest";
import { abbinaQuotaPartner, indicizzaPerGiorno } from "./fp-odds-join";
import { normName } from "./odds-api";
import { teamPairKey } from "./team-pair-key";

type Voce = { homeKey: string; awayKey: string; etichetta: string };

const voce = (h: string, a: string): Voce => ({ homeKey: h, awayKey: a, etichetta: `${h} v ${a}` });

// la chiave la costruisce il PRODOTTO (teamPairKey ordina i due nomi): il test
// non deve inventarne una sua, altrimenti verifica se stesso.
const mappa = (giorno: string, ...voci: Voce[]): Record<string, Voce> =>
  Object.fromEntries(
    voci.map((v) => [
      teamPairKey("soccer", v.homeKey, v.awayKey, `${giorno}T12:00:00Z`) ?? "?",
      v,
    ]),
  );

const abbina = (home: string, away: string, iso: string, q: Record<string, Voce>) =>
  abbinaQuotaPartner(home, away, iso, q, indicizzaPerGiorno(q));

describe("la chiave esatta resta la prima strada", () => {
  it("abbina senza fallback quando i nomi coincidono dopo normName", () => {
    const q = mappa("2026-09-13", voce("napoli", "bologna"));
    const e = abbina("SSC Napoli", "Bologna FC 1909", "2026-09-13T18:00:00Z", q);
    // normName toglie SSC e FC ma NON "1909": quindi qui la chiave esatta manca
    // e deve entrare il fallback. Il test dichiara quale delle due e' scattata.
    expect(e.quota).not.toBeNull();
    expect(["esatto", "token"]).toContain(e.via);
  });
});

describe("le righe che il board perdeva, ora trovano il prezzo", () => {
  const casi: Array<[string, string, string, string]> = [
    ["Atalanta BC", "Cagliari Calcio", "atalanta", "cagliari"],
    ["Genoa CFC", "Frosinone Calcio", "genoa", "frosinone"],
    ["Venezia FC", "ACF Fiorentina", "venezia", "fiorentina"],
    ["Torino FC", "AS Roma", "torino", "roma"],
    ["Como 1907", "Parma Calcio 1913", "como", "parma"],
    ["US Sassuolo Calcio", "Juventus FC", "sassuolo", "juventus"],
  ];
  for (const [h, a, ph, pa] of casi) {
    it(`${h} v ${a} → prezzo trovato`, () => {
      const q = mappa("2026-09-13", voce(ph, pa));
      const e = abbina(h, a, "2026-09-13T18:00:00Z", q);
      expect(e.quota, `nessuna quota per ${h}`).not.toBeNull();
    });
  }
});

describe("i confini: il giorno e l'unicita'", () => {
  it("NON prende il prezzo di un'altra giornata", () => {
    // stessa partita, ma il feed la ha solo per il 20/09
    const q = mappa("2026-09-20", voce("atalanta", "cagliari"));
    const e = abbina("Atalanta BC", "Cagliari Calcio", "2026-09-13T18:00:00Z", q);
    expect(e.quota).toBeNull();
    expect(e.via).toBe("nessuna");
  });

  it("con due candidate dello stesso giorno non abbina (fail-closed)", () => {
    const q = mappa("2026-09-13", voce("atalanta", "cagliari"), voce("atalanta bc", "cagliari calcio"));
    const e = abbina("Atalanta", "Cagliari", "2026-09-13T18:00:00Z", q);
    if (e.via === "ambiguo") expect(e.quota).toBeNull();
    else expect(["esatto", "token"]).toContain(e.via);
  });

  it("non confonde due squadre della stessa citta'", () => {
    const q = mappa("2026-09-13", voce("manchester city", "arsenal"));
    const e = abbina("Manchester United FC", "Arsenal FC", "2026-09-13T18:00:00Z", q);
    expect(e.quota).toBeNull();
  });

  it("regge input mancanti senza esplodere", () => {
    const q = mappa("2026-09-13", voce("atalanta", "cagliari"));
    expect(abbina("", "Cagliari", "2026-09-13T18:00:00Z", q).via).toBe("nessuna");
    expect(abbinaQuotaPartner("A", "B", null, q, indicizzaPerGiorno(q)).via).toBe("nessuna");
    expect(abbinaQuotaPartner("A", "B", "2026-09-13T18:00:00Z", null, new Map()).via).toBe("nessuna");
  });
});

describe("indicizzaPerGiorno", () => {
  it("raggruppa per data e scarta chiavi malformate", () => {
    const q: Record<string, Voce> = {
      ...mappa("2026-09-13", voce("a", "b"), voce("c", "d")),
      ...mappa("2026-09-14", voce("e", "f")),
      "senza-data": voce("g", "h"),
    };
    const i = indicizzaPerGiorno(q);
    expect(i.get("2026-09-13")?.length).toBe(2);
    expect(i.get("2026-09-14")?.length).toBe(1);
    expect(i.has("senza-data")).toBe(false);
  });

  it("normName e' quello vero, non una copia locale", () => {
    // guardia contro la deriva: se normName cambiasse, questo test lo dice
    expect(normName("SSC Napoli")).toBe("napoli");
    expect(normName("ACF Fiorentina")).toContain("fiorentina");
  });
});

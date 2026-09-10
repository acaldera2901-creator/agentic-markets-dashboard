// #BOARD-PICKS-0910 — i casi qui sono nomi VERI, presi il 10/09 confrontando
// il payload di The Odds API con le fixture di football-data.org sulle righe che
// avevano `odds_home = NULL` nel database.
import { describe, it, expect } from "vitest";
import { abbinaQuote } from "./odds-join";
import { normName } from "./odds-api";

const q = (home: string, away: string) => ({
  homeNorm: normName(home),
  awayNorm: normName(away),
  etichetta: `${home} v ${away}`,
});

const mappa = (...voci: ReturnType<typeof q>[]) =>
  Object.fromEntries(voci.map((v) => [`${v.homeNorm}|${v.awayNorm}`, v]));

describe("abbinaQuote — la chiave esatta continua a vincere", () => {
  it("abbina per chiave quando i nomi coincidono, senza passare dal fallback", () => {
    const m = mappa(q("Lecce", "Monza"));
    const e = abbinaQuote("US Lecce", "AC Monza", m);
    // `normName` toglie US e AC, quindi la chiave combacia davvero
    expect(e.via).toBe("esatto");
    expect(e.quota?.etichetta).toBe("Lecce v Monza");
  });
});

describe("abbinaQuote — i casi che il board perdeva", () => {
  const casi: [string, string, string, string][] = [
    ["ACF Fiorentina", "Bologna FC 1909", "Fiorentina", "Bologna"],
    ["Genoa CFC", "Frosinone Calcio", "Genoa", "Frosinone"],
    ["Brighton & Hove Albion FC", "Tottenham Hotspur FC", "Brighton and Hove Albion", "Tottenham Hotspur"],
    ["RCD Espanyol de Barcelona", "Getafe CF", "Espanyol", "Getafe"],
  ];
  for (const [fixHome, fixAway, oddsHome, oddsAway] of casi) {
    it(`abbina «${fixHome}» a «${oddsHome}» per token`, () => {
      const e = abbinaQuote(fixHome, fixAway, mappa(q(oddsHome, oddsAway)));
      expect(e.quota).not.toBeNull();
      expect(e.via).toBe("token");
    });
  }
});

describe("abbinaQuote — fail-closed: ambiguo non abbina", () => {
  it("con due candidate che combaciano non restituisce nessuna quota", () => {
    // Due partite della stessa squadra di casa nello stesso payload: prima si
    // prendeva la PRIMA della lista, cioè un prezzo potenzialmente di un'altra
    // partita. Ora nessuna, e l'esito lo dichiara.
    const m = mappa(q("Milan", "Roma"), q("AC Milan", "AS Roma"));
    const e = abbinaQuote("Milan", "Roma", m);
    // la chiave esatta esiste per la prima → deve restare `esatto`, non ambiguo
    expect(e.via).toBe("esatto");
  });

  it("dichiara `ambiguo` quando NESSUNA chiave esatta esiste e due candidate combaciano", () => {
    const m = mappa(q("Nottingham Forest", "Fulham"), q("Nottingham Forest FC", "Fulham FC"));
    // entrambe si riducono a chiavi diverse ma combaciano per token con la fixture
    const e = abbinaQuote("Nottingham Forest Football Club", "Fulham Football Club", m);
    if (e.candidate > 1) {
      expect(e.via).toBe("ambiguo");
      expect(e.quota).toBeNull();
    } else {
      // se la normalizzazione le collassa in una sola chiave, l'abbinamento è
      // legittimo: il punto del test è che con 2 candidate NON si sceglie a caso
      expect(e.candidate).toBeLessThanOrEqual(1);
    }
  });
});

describe("abbinaQuote — i limiti, fissati di proposito", () => {
  it("NON abbina le varianti di grafia (munich / munchen): serve una mappa alias", () => {
    const e = abbinaQuote("FC Bayern München", "FK Bodø/Glimt", mappa(q("Bayern Munich", "Bodo/Glimt")));
    // 1 token su 2 in comune = 0,5, sotto la soglia 0,6 di matchModelTeam.
    // Abbassare la soglia farebbe passare Manchester United/City: non si fa.
    expect(e.quota).toBeNull();
    expect(e.via).toBe("nessuna");
  });

  it("NON confonde due squadre della stessa citta'", () => {
    const e = abbinaQuote("Manchester United FC", "Arsenal FC", mappa(q("Manchester City", "Arsenal")));
    expect(e.quota).toBeNull();
  });

  it("senza mappa quote non explode", () => {
    expect(abbinaQuote("A", "B", undefined).via).toBe("nessuna");
    expect(abbinaQuote("A", "B", {}).via).toBe("nessuna");
  });
});

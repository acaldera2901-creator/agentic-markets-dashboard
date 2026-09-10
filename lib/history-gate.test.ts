// #SETTLE-0909 D2 — il cancello che decide cosa entra nel track record
// pubblico, e come si dichiara la percentuale.
//
// Il difetto che questi test impediscono di reintrodurre: fino al 10/09
// /history pubblicava ogni riga chiusa, comprese 314 righe tennis con
// un'etichetta dimostrabilmente falsa (punteggi da set singolo, `0-0`
// incluso: partite gradate mentre erano in corso). Ora si pubblica solo cio'
// che una fonte con flag di completamento esplicito ha confermato.
//
// Come in lib/v2-coverage.test.ts, la logica e' specchiata qui perche' una
// regola che decide il numero mostrato a un cliente merita un test proprio.
import { describe, it, expect } from "vitest";
import { wilson95, formatWilson } from "./wilson";

type Riga = { result: string; verification_state?: string | null };

/** Specchio del filtro in app/api/v2/history/route.ts. */
function verificate(surfaced: Riga[]): Riga[] {
  return surfaced.filter((r) => r.verification_state === "verified");
}

const MIN_SAMPLE = 30;

/** Specchio del blocco `stats` della route. */
function stats(surfaced: Riga[]) {
  const rows = verificate(surfaced);
  const won = rows.filter((r) => r.result === "won").length;
  const lost = rows.filter((r) => r.result === "lost").length;
  const n = won + lost;
  const sufficiente = n >= MIN_SAMPLE;
  const w = n > 0 ? wilson95(won, n) : null;
  return {
    n,
    sample_sufficient: sufficiente,
    coverage: surfaced.length ? Number((rows.length / surfaced.length).toFixed(3)) : null,
    unverified_excluded: surfaced.length - rows.length,
    win_rate: sufficiente && n > 0 ? `${((won / n) * 100).toFixed(1)}%` : null,
    win_rate_display: sufficiente ? formatWilson(w) : null,
  };
}

const molte = (n: number, result: string, stato: string | null): Riga[] =>
  Array.from({ length: n }, () => ({ result, verification_state: stato }));

describe("history: cosa entra nel track record", () => {
  it("una riga NON verificata non entra, nemmeno se chiusa", () => {
    expect(verificate([{ result: "won", verification_state: "unverified" }])).toHaveLength(0);
  });

  it("una riga che nessuna fonte conferma non entra", () => {
    // Le 50 righe tennis su cui ESPN e' muto: si dichiarano, non si pubblicano.
    expect(verificate([{ result: "won", verification_state: "unverifiable" }])).toHaveLength(0);
  });

  it("una riga senza il campo (legacy) non entra: si fallisce CHIUSI", () => {
    expect(verificate([{ result: "won" }])).toHaveLength(0);
    expect(verificate([{ result: "won", verification_state: null }])).toHaveLength(0);
  });

  it("una riga corretta e ri-verificata TORNA dentro", () => {
    // Il punto che evita il bias di selezione: le 72 righe che avevamo
    // sbagliato non si nascondono, si correggono e rientrano. Nasconderle
    // gonfiava la percentuale di +0,6 punti (misurato).
    expect(verificate([{ result: "lost", verification_state: "verified" }])).toHaveLength(1);
  });
});

describe("history: come si dichiara la percentuale", () => {
  it("sotto le 30 partite NON si pubblica nessuna percentuale", () => {
    const s = stats(molte(10, "won", "verified"));
    expect(s.n).toBe(10);
    expect(s.sample_sufficient).toBe(false);
    expect(s.win_rate).toBeNull();
    expect(s.win_rate_display).toBeNull();
  });

  it("da 30 in su si pubblica, sempre con l'intervallo", () => {
    const s = stats([...molte(20, "won", "verified"), ...molte(10, "lost", "verified")]);
    expect(s.n).toBe(30);
    expect(s.win_rate).toBe("66.7%");
    expect(s.win_rate_display).toMatch(/^66\.7% \(\d\d\.\d–\d\d\.\d%\)$/);
  });

  it("la copertura dice quanta parte delle pick mostrate e' verificata", () => {
    const s = stats([...molte(60, "won", "verified"), ...molte(40, "won", "unverified")]);
    expect(s.coverage).toBe(0.6);
    expect(s.unverified_excluded).toBe(40);
  });

  it("le righe escluse NON entrano nel denominatore della percentuale", () => {
    // Sono due domande diverse: «quanto ci abbiamo preso su cio' che sappiamo»
    // e «quanto sappiamo». Mescolarle e' il modo classico di mentire coi numeri.
    const soloVere = stats([...molte(20, "won", "verified"), ...molte(10, "lost", "verified")]);
    const conSporche = stats([
      ...molte(20, "won", "verified"), ...molte(10, "lost", "verified"),
      ...molte(500, "lost", "unverified"),
    ]);
    expect(conSporche.win_rate).toBe(soloVere.win_rate);
    expect(conSporche.coverage).toBeLessThan(0.1);
  });

  it("void e pending non contano nella percentuale: non hanno un esito", () => {
    const s = stats([
      ...molte(20, "won", "verified"), ...molte(10, "lost", "verified"),
      ...molte(15, "void", "verified"),
    ]);
    expect(s.n).toBe(30);
    expect(s.win_rate).toBe("66.7%");
  });

  it("nessuna riga verificata: niente percentuale, non uno zero", () => {
    const s = stats(molte(5, "won", "unverified"));
    expect(s.n).toBe(0);
    expect(s.win_rate).toBeNull();
    expect(s.coverage).toBe(0);
  });
});

// lib/v3c/tools.test.ts (#REDESIGN-V3C F5) — il motore dei tool contro i numeri
// del prototipo (Genoa 2.15 · 3.20 · 3.50, stima 48%) e contro l'input sbagliato.
import { describe, expect, it } from "vitest";
import { TOOL_SLUGS } from "@/lib/tools/registry";
import { QUESTIONS, TOOLS, TOOL_SIGLA, bestPriceOf, defaultValues, eur, signedPct, toolDef, toolHrefWith, toolPreview, toolsCoverRegistry, toolsFor, validInput, valuesFromQuery, type BoardCtx } from "./tools";

const genoa: BoardCtx = {
  outcomes: [
    { price: 2.15, market: 44, estimate: 48, prices: { NB: 2.15, PM: 2.1, KO: 2.05 } },
    { price: 3.2, market: 29, estimate: 28, prices: { NB: 3.15, PM: 3.2, KO: 3.1 } },
    { price: 3.5, market: 27, estimate: 24, prices: { NB: 3.4, PM: 3.45, KO: 3.55 } },
  ],
  lead: { label: "Genoa", price: 2.15, market: 44, estimate: 48, prices: { NB: 2.15, PM: 2.1, KO: 2.05 } },
};

describe("il motore copre il registry", () => {
  it("11 tool, uno per slug, nessuno in più; 5 · 4 · 2 per domanda", () => {
    expect(toolsCoverRegistry(TOOL_SLUGS)).toBe(true);
    expect(TOOLS).toHaveLength(11);
    expect(toolsFor("price")).toHaveLength(5);
    expect(toolsFor("stake")).toHaveLength(4);
    expect(toolsFor("record")).toHaveLength(2);
    expect(QUESTIONS).toEqual(["price", "stake", "record"]);
  });

  it("ogni tool ha una sigla corta e il primo risultato è quello grande", () => {
    for (const t of TOOLS) {
      expect(TOOL_SIGLA[t.slug].length).toBeLessThanOrEqual(3);
      const [big] = t.compute(defaultValues(t));
      expect(big, t.slug).toBeTruthy();
      expect(big.big, t.slug).toBe(true);
    }
  });
});

describe("i numeri del prototipo (DIRECTION-v3c §1)", () => {
  it("EV: 2.15 al 48% → +3.2%, pareggio 46.5%, quota equa 2.08", () => {
    const r = toolDef("ev-calculator").compute({ price: 2.15, prob: 48 });
    expect(r.map((x) => x.value)).toEqual(["+3.2%", "2.08", "46.5%"]);
    expect(r[0].flat).toBe(false);
    expect(r[1].vars).toEqual({ prob: "48" });
  });

  it("Kelly: 2.15 al 48% su €500 → 2.8% · €14, metà, quarto", () => {
    const r = toolDef("kelly-criterion").compute({ price: 2.15, prob: 48, bank: 500 });
    expect(r[0].value).toBe("2.8% · €14");
    expect(r[1].value).toBe("1.4% · €7");
    expect(r[2].value).toBe("0.7% · €3");
  });

  it("Kelly senza edge dice «nessuna puntata», spento", () => {
    const r = toolDef("kelly-criterion").compute({ price: 2.0, prob: 40, bank: 500 });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ key: "none", value: "0%", flat: true });
  });

  it("Margine: 2.15 · 3.20 · 3.50 → 6.3%, somma 106.3%", () => {
    const r = toolDef("margin-calculator").compute({ p1: 2.15, p2: 3.2, p3: 3.5 });
    expect(r[0].value).toBe("6.3%");
    expect(r[1].value).toBe("106.3%");
    expect(r[2].value).toBe("€5.96");
  });

  it("Probabilità: la prima è il 43.7% (44% sul board), in sky", () => {
    const r = toolDef("probability-calculator").compute({ p1: 2.15, p2: 3.2, p3: 3.5 });
    expect(r[0]).toMatchObject({ key: "o1", value: "43.7%", market: true, big: true });
    expect(r).toHaveLength(3);
    // due esiti: il terzo campo vuoto
    expect(toolDef("probability-calculator").compute({ p1: 1.9, p2: 1.9, p3: null })).toHaveLength(2);
  });

  it("Arbitraggio sui prezzi migliori 2.15 · 3.20 · 3.55: 105.9% → nessun arbitraggio", () => {
    const r = toolDef("arbitrage-calculator").compute({ p1: 2.15, p2: 3.2, p3: 3.55, total: 1000 });
    expect(r[0].key).toBe("shortfall");
    expect(r[0].flat).toBe(true);
    expect(r[1].value).toBe("105.9%");
    expect(r.filter((x) => x.key === "stake")).toHaveLength(3);
    const arb = toolDef("arbitrage-calculator").compute({ p1: 2.1, p2: 2.1, p3: null, total: 1000 });
    expect(arb[0]).toMatchObject({ key: "profit", value: "+5.0%" });
  });

  it("Odds converter: 2.15 → 46.5%, 23/20, +115", () => {
    expect(toolDef("odds-converter").compute({ price: 2.15 }).map((x) => x.value)).toEqual(["46.5%", "23/20", "+115"]);
  });

  it("Multipla: 2.15 × 1.40 = 3.01, margine 6% per gamba → 12.4%", () => {
    const r = toolDef("parlay-calculator").compute({ l1: 2.15, l2: 1.4, mg: 6 });
    expect(r.map((x) => x.value)).toEqual(["3.01", "33.2%", "12.4%"]);
  });

  it("Stake: €100 a 2.15 → €86.96, ritorno €186.96, 8.7% di €1000", () => {
    expect(toolDef("stake-calculator").compute({ price: 2.15, target: 100, bank: 1000 }).map((x) => x.value)).toEqual(["€86.96", "€186.96", "8.7%"]);
  });

  it("Bankroll: €2000 al 2%, 10 perse → unità €40, −€400 · 20%, 50 giocate alla rovina", () => {
    const r = toolDef("bankroll-calculator").compute({ bank: 2000, unit: 2, streak: 10 });
    expect(r.map((x) => x.value)).toEqual(["€40", "−€400 · 20%", "50"]);
    expect(r[1].vars).toEqual({ n: "10" });
  });

  it("ROI e yield: lo stesso 400 è +40% su 1.000 di cassa e +4% su 10.000 giocati", () => {
    expect(toolDef("roi-calculator").compute({ cap: 1000, profit: 400 }).map((x) => x.value)).toEqual(["+40.0%", "€1,400"]);
    expect(toolDef("yield-calculator").compute({ bets: 200, avg: 50, profit: 400 }).map((x) => x.value)).toEqual(["+4.0%", "€10,000"]);
    // il profitto negativo è un dato, non un errore
    expect(toolDef("roi-calculator").compute({ cap: 1000, profit: -250 })[0].value).toBe("−25.0%");
  });
});

describe("input non calcolabile → nessun risultato, mai NaN", () => {
  it("quota ≤ 1, probabilità fuori range, campo vuoto", () => {
    expect(toolDef("ev-calculator").compute({ price: 1, prob: 48 })).toEqual([]);
    expect(toolDef("ev-calculator").compute({ price: 2.15, prob: 100 })).toEqual([]);
    expect(toolDef("ev-calculator").compute({ price: null, prob: 48 })).toEqual([]);
    expect(toolDef("margin-calculator").compute({ p1: 2.15, p2: null, p3: 3.5 })).toEqual([]);
    expect(toolDef("bankroll-calculator").compute({ bank: 2000, unit: 2, streak: 10.5 })).toEqual([]);
  });

  it("validInput per tipo", () => {
    expect(validInput("price", 1.01)).toBe(true);
    expect(validInput("price", 1)).toBe(false);
    expect(validInput("percent", 0)).toBe(false);
    expect(validInput("signed", -5)).toBe(true);
    expect(validInput("count", 3)).toBe(true);
    expect(validInput("count", 0)).toBe(false);
    expect(validInput("rate", 0)).toBe(true);
    expect(validInput("money", Number.NaN)).toBe(false);
  });
});

describe("anteprima, colonna e prefill dalla board", () => {
  it("l'anteprima di ogni tool su Genoa — Fiorentina ha input e risultato", () => {
    for (const s of TOOL_SLUGS) {
      const p = toolPreview(s, genoa);
      expect(p.input, s).not.toBe("—");
      expect(p.output, s).not.toBe("—");
    }
    expect(toolPreview("probability-calculator", genoa).output).toBe("44%");
    expect(toolPreview("arbitrage-calculator", genoa)).toMatchObject({ input: "2.15 · 3.20 · 3.55", flat: true });
  });

  it("la colonna sul board: EV +3.2%, Kelly 2.8%, margine 6.3%, implicita 46.5%", () => {
    expect(toolDef("ev-calculator").column!(genoa).value).toBe("+3.2%");
    expect(toolDef("kelly-criterion").column!(genoa).value).toBe("2.8%");
    expect(toolDef("margin-calculator").column!(genoa).value).toBe("6.3%");
    expect(toolDef("odds-converter").column!(genoa).value).toBe("46.5%");
    expect(toolDef("probability-calculator").column!(genoa)).toMatchObject({ value: "44%", market: true });
    expect(toolDef("stake-calculator").column!(genoa).value).toBe("€86.96");
    for (const s of ["parlay-calculator", "bankroll-calculator", "roi-calculator", "yield-calculator"] as const) expect(toolDef(s).column).toBeUndefined();
  });

  it("il prezzo migliore viene dai book connessi", () => {
    expect(bestPriceOf(genoa.outcomes[2])).toBe(3.55);
    expect(bestPriceOf({ price: 2.0, prices: {} })).toBe(2.0);
  });

  it("il link precompilato porta i valori nella query, con partita ed esito", () => {
    const href = toolHrefWith("/tools/ev-calculator", toolDef("ev-calculator"), genoa, "genoa-fiorentina", "home");
    expect(href).toBe("/tools/ev-calculator?price=2.15&prob=48&m=genoa-fiorentina&o=home");
  });
});

describe("prefill dalla query", () => {
  it("legge solo le chiavi del tool, accetta la virgola, ignora il resto", () => {
    const t = toolDef("ev-calculator");
    expect(valuesFromQuery(t, "?price=2,30&prob=51&foo=bar")).toEqual({ price: 2.3, prob: 51 });
    expect(valuesFromQuery(t, "?price=abc")).toEqual({});
    expect(valuesFromQuery(t, "")).toEqual({});
    expect(valuesFromQuery(t, "?price=<script>")).toEqual({});
  });
});

describe("formattazione", () => {
  it("euro, segno meno tipografico, migliaia", () => {
    expect(eur(14)).toBe("€14");
    expect(eur(86.9565)).toBe("€86.96");
    expect(eur(1400)).toBe("€1,400");
    expect(eur(-400)).toBe("−€400");
    expect(signedPct(0)).toBe("±0.0%");
    expect(signedPct(-2.5)).toBe("−2.5%");
  });
});

// #FLOOR-65-0910 — questo file non esisteva, e la griglia dei floor era protetta
// solo da commenti. Uno di quei commenti («2. Bundesliga ... non deve mai
// diventare una fonte di pick abbassando il floor») è una PROIBIZIONE: qui
// diventa un test che la fa rispettare.
import { describe, it, expect } from "vitest";
import { surfaceFloorFor } from "./surfacing-gate";

const calcio = (lega: string) => surfaceFloorFor("football", lega);

describe("floor 65: i campionati entrati senza lab walk-forward", () => {
  // APPROVE di Andrea 10/09. Giustificazione AGGREGATA (prediction_log, 1.254
  // partite chiuse): banda 65-69 = 81,8% di hit rate, sopra la barra ~70%.
  const a65 = [
    "Championship", "League One", "League Two", "Scottish Premiership",
    "Ligue 2", "Segunda Division", "Eredivisie", "Primeira Liga",
    "Turkish Super Lig", "Super League Greece", "Liga Profesional",
    "Brasileirao", "Liga MX", "MLS",
  ];
  for (const lega of a65) {
    it(`${lega} → 65`, () => expect(calcio(lega)).toBe(65));
  }
});

describe("NON si abbassano: i cinque floor a 70 che sono una MISURA, non una prudenza", () => {
  // Se un giorno qualcuno (io compreso) prova a "sbloccare copertura"
  // abbassando anche questi, questo test glielo impedisce. I numeri accanto
  // sono dati LIVE di produzione, non backtest.
  const restano70: [string, string][] = [
    ["League of Ireland", "live 14,3% @60"],
    ["Chinese Super League", "live 14,3% @56"],
    ["Danish Superliga", "64,8% @56 e peggiora alzando il floor"],
    ["Ekstraklasa", "61,3% @56, sottile sopra"],
    ["2. Bundesliga", "sondata dal lab e SCARTATA: 64,3%, instabile per stagione"],
  ];
  for (const [lega, perche] of restano70) {
    it(`${lega} resta 70 — ${perche}`, () => expect(calcio(lega)).toBe(70));
  }
});

describe("il resto della griglia non si muove", () => {
  it("una lega non elencata resta sul floor di default", () => {
    expect(calcio("Premier League")).toBe(56);
    expect(calcio("Serie A")).toBe(56);
    expect(calcio("La Liga")).toBe(56);
  });

  it("«Bundesliga» NON prende il floor della «2. Bundesliga» (la trappola della sottostringa)", () => {
    // Il commento nel gate avverte che una sottostringa nuda "bundesliga"
    // catturerebbe anche BL1: qui si verifica che non succeda.
    expect(calcio("Bundesliga")).toBe(56);
    expect(calcio("2. Bundesliga")).toBe(70);
  });

  it("i floor da lab precedente restano quelli", () => {
    expect(calcio("Allsvenskan")).toBe(65);
    expect(calcio("Veikkausliiga")).toBe(65);
    expect(calcio("Eliteserien")).toBe(60);
    expect(calcio("Serie B")).toBe(65);
    expect(calcio("Austrian Bundesliga")).toBe(60);
    expect(calcio("Swiss Super League")).toBe(65);
    expect(calcio("Belgian Pro League")).toBe(65);
  });

  it("la Serie B non collide con la Serie A", () => {
    expect(calcio("Serie B")).toBe(65);
    expect(calcio("Serie A")).toBe(56);
  });
});

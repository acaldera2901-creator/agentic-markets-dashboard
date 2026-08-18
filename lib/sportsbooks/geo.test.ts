import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { geoAllowed, GEO_BLOCKED_COUNTRIES } from "./index";

// #GOLIVE-HIGH-D (audit go-live legale): le giurisdizioni dove promuovere operatori
// non licenziati è illecito autonomo (IT/DE/FR/NL/ES/BE, e CH dal 18/08) devono essere
// hard-bloccate dai link-book a prescindere dall'allowlist env.
describe("geoAllowed — hard-block giurisdizionale", () => {
  const prev = process.env.SPORTSBOOK_GEO_ALLOWLIST;
  afterEach(() => {
    if (prev === undefined) delete process.env.SPORTSBOOK_GEO_ALLOWLIST;
    else process.env.SPORTSBOOK_GEO_ALLOWLIST = prev;
  });

  const BLOCKED = ["IT", "DE", "FR", "NL", "ES", "BE", "CH"];

  it("il set contiene esattamente le geo previste", () => {
    expect([...GEO_BLOCKED_COUNTRIES].sort()).toEqual([...BLOCKED].sort());
  });

  // #CH01-P0-ADSPOLICY-0814 — la Svizzera non è un caso come gli altri e merita il
  // suo test: è la geo del test ads CH-01, quindi qualcuno potrebbe essere tentato di
  // riaprirla dalla env per far girare la campagna. Da qui non si riapre.
  it("CH resta bloccata anche con allowlist globale e anche se elencata", () => {
    process.env.SPORTSBOOK_GEO_ALLOWLIST = "*";
    expect(geoAllowed("CH")).toBe(false);
    process.env.SPORTSBOOK_GEO_ALLOWLIST = "CH,GB,NO";
    expect(geoAllowed("CH")).toBe(false);
    expect(geoAllowed("ch")).toBe(false);
    expect(geoAllowed(" CH ")).toBe(false);
    // le geo vicine non devono cadere nel blocco per errore
    expect(geoAllowed("GB")).toBe(true);
    expect(geoAllowed("NO")).toBe(true);
  });

  it("blocca tutte le geo UE anche con allowlist globale '*'", () => {
    process.env.SPORTSBOOK_GEO_ALLOWLIST = "*";
    for (const cc of BLOCKED) {
      expect(geoAllowed(cc)).toBe(false);
      expect(geoAllowed(cc.toLowerCase())).toBe(false); // case-insensitive
      expect(geoAllowed(` ${cc} `)).toBe(false); // trim
    }
    expect(geoAllowed("GB")).toBe(true); // geo non bloccata resta ammessa col '*'
  });

  it("blocca le geo UE anche se erroneamente incluse nell'allowlist", () => {
    process.env.SPORTSBOOK_GEO_ALLOWLIST = "IT,DE,FR,NL,ES,BE,GB";
    for (const cc of BLOCKED) expect(geoAllowed(cc)).toBe(false);
    expect(geoAllowed("GB")).toBe(true);
  });

  it("allowlist vuota → nessuna geo ammessa (default sicuro)", () => {
    process.env.SPORTSBOOK_GEO_ALLOWLIST = "";
    expect(geoAllowed("GB")).toBe(false);
    expect(geoAllowed("IT")).toBe(false);
  });
});

// #CH01-P0-ADSPOLICY-0814 — questo è un test strutturale, non di comportamento, e c'è
// per una ragione precisa: le due rotte FortunePlay hanno tenuto per mesi una COPIA
// locale del set con dentro solo "IT". Restavano quindi aperte a DE/FR/NL/ES/BE mentre
// il resto del codice le dichiarava bloccate, e togliere CH dall'allowlist env non le
// avrebbe toccate (quel rail non guarda l'allowlist). Un test sul comportamento delle
// rotte richiederebbe di mockare il feed BetConstruct; quello che serve difendere qui è
// più semplice — che la lista sia UNA. Se domani qualcuno rimette un set locale, questo
// test lo dice subito, con scritto il perché.
describe("le rotte FortunePlay non tengono una copia locale del hard-block", () => {
  const ROUTES = [
    "app/api/fortuneplay-odds/route.ts",
    "app/api/fortuneplay-match/route.ts",
  ];

  for (const rel of ROUTES) {
    it(`${rel} importa la costante condivisa e non ne dichiara una propria`, () => {
      // process.cwd() = radice del repo sotto vitest; import.meta.url qui non è
      // disponibile (il transform lo lascia undefined) e produce un ENOENT muto.
      const src = readFileSync(join(process.cwd(), rel), "utf8");
      expect(src).toMatch(/import\s*\{[^}]*GEO_BLOCKED_COUNTRIES[^}]*\}\s*from\s*["']@\/lib\/sportsbooks["']/);
      expect(src).not.toMatch(/const\s+GEO_BLOCKED_COUNTRIES\s*=/);
    });
  }
});

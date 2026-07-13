import { describe, it, expect, afterEach } from "vitest";
import { geoAllowed, GEO_BLOCKED_COUNTRIES } from "./index";

// #GOLIVE-HIGH-D (audit go-live legale): le giurisdizioni UE dove promuovere operatori
// non licenziati è illecito autonomo (IT/DE/FR/NL/ES/BE) devono essere hard-bloccate
// dai link-book a prescindere dall'allowlist env.
describe("geoAllowed — UE hard-block", () => {
  const prev = process.env.SPORTSBOOK_GEO_ALLOWLIST;
  afterEach(() => {
    if (prev === undefined) delete process.env.SPORTSBOOK_GEO_ALLOWLIST;
    else process.env.SPORTSBOOK_GEO_ALLOWLIST = prev;
  });

  const BLOCKED = ["IT", "DE", "FR", "NL", "ES", "BE"];

  it("il set contiene esattamente le geo UE previste", () => {
    expect([...GEO_BLOCKED_COUNTRIES].sort()).toEqual([...BLOCKED].sort());
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

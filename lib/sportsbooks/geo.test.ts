import { describe, it, expect, afterEach } from "vitest";
import { geoAllowed, GEO_BLOCKED_COUNTRIES } from "./index";

// #PRELAUNCH-AUDIT + #ITALIA-EU-PARERE (decisione Andrea 2026-07-10): i link-book
// sono ALLOWLIST-only (visibili solo dove il book è legalmente promuovibile) con
// hard-block IT/BE/NL a prescindere dall'allowlist env. Il wildcard "*" è rimosso:
// era una blocklist di fatto.
describe("geoAllowed — allowlist default-nascosto + hard-block IT/BE/NL", () => {
  const prev = process.env.SPORTSBOOK_GEO_ALLOWLIST;
  afterEach(() => {
    if (prev === undefined) delete process.env.SPORTSBOOK_GEO_ALLOWLIST;
    else process.env.SPORTSBOOK_GEO_ALLOWLIST = prev;
  });

  it("hard-block IT/BE/NL anche se erroneamente incluse nell'allowlist", () => {
    process.env.SPORTSBOOK_GEO_ALLOWLIST = "IT,BE,NL,DE";
    expect(geoAllowed("IT")).toBe(false);
    expect(geoAllowed("it")).toBe(false); // case-insensitive
    expect(geoAllowed(" IT ")).toBe(false); // trim
    expect(geoAllowed("BE")).toBe(false);
    expect(geoAllowed("NL")).toBe(false);
    expect(geoAllowed("DE")).toBe(true); // geo listata e non vietata → ammessa
  });

  it("wildcard '*' NON è più globale: trattato come lista vuota (default nascosto)", () => {
    process.env.SPORTSBOOK_GEO_ALLOWLIST = "*";
    expect(geoAllowed("DE")).toBe(false);
    expect(geoAllowed("MT")).toBe(false);
    expect(geoAllowed("IT")).toBe(false);
  });

  it("allowlist vuota o mancante → nessuna geo ammessa (default sicuro)", () => {
    process.env.SPORTSBOOK_GEO_ALLOWLIST = "";
    expect(geoAllowed("DE")).toBe(false);
    delete process.env.SPORTSBOOK_GEO_ALLOWLIST;
    expect(geoAllowed("DE")).toBe(false);
  });

  it("solo le geo esplicitamente listate sono ammesse (case/trim-insensitive)", () => {
    process.env.SPORTSBOOK_GEO_ALLOWLIST = "mt, CW";
    expect(geoAllowed("MT")).toBe(true);
    expect(geoAllowed("cw")).toBe(true);
    expect(geoAllowed(" mt ")).toBe(true);
    expect(geoAllowed("DE")).toBe(false); // non listata
    expect(geoAllowed(null)).toBe(false); // geo sconosciuta → nascosto
    expect(geoAllowed(undefined)).toBe(false);
    expect(geoAllowed("")).toBe(false);
  });

  it("il set hard-block resta allineato alla decisione (IT+BE+NL)", () => {
    expect([...GEO_BLOCKED_COUNTRIES].sort()).toEqual(["BE", "IT", "NL"]);
  });
});

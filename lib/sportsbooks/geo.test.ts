import { describe, it, expect, afterEach } from "vitest";
import { geoAllowed } from "./index";

// #PRELAUNCH-AUDIT: l'Italia (Decreto Dignità) deve essere hard-bloccata dai link-book
// a prescindere dall'allowlist env.
describe("geoAllowed — Italia hard-block", () => {
  const prev = process.env.SPORTSBOOK_GEO_ALLOWLIST;
  afterEach(() => {
    if (prev === undefined) delete process.env.SPORTSBOOK_GEO_ALLOWLIST;
    else process.env.SPORTSBOOK_GEO_ALLOWLIST = prev;
  });

  it("blocca IT anche con allowlist globale '*'", () => {
    process.env.SPORTSBOOK_GEO_ALLOWLIST = "*";
    expect(geoAllowed("IT")).toBe(false);
    expect(geoAllowed("it")).toBe(false); // case-insensitive
    expect(geoAllowed(" IT ")).toBe(false); // trim
    expect(geoAllowed("DE")).toBe(true); // altre geo restano ammesse col '*'
  });

  it("blocca IT anche se erroneamente inclusa nell'allowlist", () => {
    process.env.SPORTSBOOK_GEO_ALLOWLIST = "IT,DE";
    expect(geoAllowed("IT")).toBe(false);
    expect(geoAllowed("DE")).toBe(true);
  });

  it("allowlist vuota → nessuna geo ammessa (default sicuro)", () => {
    process.env.SPORTSBOOK_GEO_ALLOWLIST = "";
    expect(geoAllowed("DE")).toBe(false);
    expect(geoAllowed("IT")).toBe(false);
  });
});

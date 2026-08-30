import { describe, it, expect, afterEach } from "vitest";
import { geoAllowed, GEO_BLOCKED_COUNTRIES } from "./index";

describe("geoAllowed — apertura globale reversibile", () => {
  const previousAllowlist = process.env.SPORTSBOOK_GEO_ALLOWLIST;

  afterEach(() => {
    if (previousAllowlist === undefined) delete process.env.SPORTSBOOK_GEO_ALLOWLIST;
    else process.env.SPORTSBOOK_GEO_ALLOWLIST = previousAllowlist;
  });

  it("parte con una blocklist centrale vuota", () => {
    expect(GEO_BLOCKED_COUNTRIES.size).toBe(0);
  });

  it("con '*' ammette ogni paese e anche la geo ignota", () => {
    process.env.SPORTSBOOK_GEO_ALLOWLIST = "*";
    for (const country of ["IT", "DE", "FR", "NL", "ES", "BE", "GB", "US", null, undefined]) {
      expect(geoAllowed(country), String(country)).toBe(true);
    }
  });

  it("una futura blocklist continua a prevalere sulla wildcard", () => {
    process.env.SPORTSBOOK_GEO_ALLOWLIST = "*";
    GEO_BLOCKED_COUNTRIES.add("IT");
    try {
      expect(geoAllowed("IT")).toBe(false);
      expect(geoAllowed("US")).toBe(true);
    } finally {
      GEO_BLOCKED_COUNTRIES.delete("IT");
    }
  });

  it("con allowlist vuota non ammette alcun paese", () => {
    process.env.SPORTSBOOK_GEO_ALLOWLIST = "";
    expect(geoAllowed("IT")).toBe(false);
    expect(geoAllowed("US")).toBe(false);
  });

  it("con CSV ammette solo i paesi indicati", () => {
    process.env.SPORTSBOOK_GEO_ALLOWLIST = "CH, GB";
    expect(geoAllowed("ch")).toBe(true);
    expect(geoAllowed("GB")).toBe(true);
    expect(geoAllowed("US")).toBe(false);
  });
});

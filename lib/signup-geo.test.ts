// lib/signup-geo.test.ts (#SIGNUP-GEO-0814)
// Il caso che DEVE essere provato rompendolo è il default: env assente = gate
// inattivo (il merge non cambia il comportamento in prod finché Andrea non
// setta la lista) e, a gate attivo, tutto ciò che NON è in lista è negato —
// compreso il paese ignoto.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { signupGeoActive, signupCountryAllowed, resolveRequestCountry } from "./signup-geo";

const ENV = "SIGNUP_COUNTRY_ALLOWLIST";

beforeEach(() => vi.unstubAllEnvs());
afterEach(() => vi.unstubAllEnvs());

describe("signupCountryAllowed — env assente (gate inattivo)", () => {
  it("ammette tutto, paese ignoto compreso: il merge è un no-op", () => {
    vi.stubEnv(ENV, "");
    expect(signupGeoActive()).toBe(false);
    for (const c of ["CH", "IT", "US", "DE", null, undefined]) {
      expect(signupCountryAllowed(c), String(c)).toBe(true);
    }
  });
});

describe("signupCountryAllowed — lista di lancio {CH,UK,NO,SE,IT}", () => {
  beforeEach(() => vi.stubEnv(ENV, "CH,UK,NO,SE,IT"));

  it("ammette i cinque paesi decisi da Andrea", () => {
    for (const c of ["CH", "NO", "SE", "IT"]) {
      expect(signupCountryAllowed(c), c).toBe(true);
    }
  });

  it("UK in lista ammette GB (l'header Vercel usa il codice ISO GB, non UK)", () => {
    expect(signupCountryAllowed("GB")).toBe(true);
    expect(signupCountryAllowed("UK")).toBe(true);
  });

  it("nega i paesi fuori lista (chiuso di default)", () => {
    for (const c of ["US", "DE", "FR", "ES", "NL", "BE", "TW"]) {
      expect(signupCountryAllowed(c), c).toBe(false);
    }
  });

  it("nega il paese ignoto a gate attivo (header assente = default-chiuso)", () => {
    expect(signupCountryAllowed(null)).toBe(false);
    expect(signupCountryAllowed(undefined)).toBe(false);
    expect(signupCountryAllowed("")).toBe(false);
  });

  it("è case/spazi-insensitive su header e lista", () => {
    expect(signupCountryAllowed("ch")).toBe(true);
    expect(signupCountryAllowed(" it ")).toBe(true);
  });
});

describe("signupCountryAllowed — forme della env", () => {
  it("lista con spazi e minuscole funziona uguale", () => {
    vi.stubEnv(ENV, " ch , uk , no ");
    expect(signupCountryAllowed("CH")).toBe(true);
    expect(signupCountryAllowed("GB")).toBe(true);
    expect(signupCountryAllowed("SE")).toBe(false);
  });

  it("'*' = gate attivo ma tutto ammesso (kill-switch)", () => {
    vi.stubEnv(ENV, "*");
    expect(signupGeoActive()).toBe(true);
    expect(signupCountryAllowed("US")).toBe(true);
    expect(signupCountryAllowed(null)).toBe(true);
  });
});

describe("resolveRequestCountry", () => {
  it("legge x-vercel-ip-country, fallback cf-ipcountry, altrimenti null", () => {
    const mk = (h: Record<string, string>) => new Request("https://x.test", { headers: h });
    expect(resolveRequestCountry(mk({ "x-vercel-ip-country": "CH" }))).toBe("CH");
    expect(resolveRequestCountry(mk({ "cf-ipcountry": "NO" }))).toBe("NO");
    expect(
      resolveRequestCountry(mk({ "x-vercel-ip-country": "SE", "cf-ipcountry": "US" }))
    ).toBe("SE");
    expect(resolveRequestCountry(mk({}))).toBe(null);
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { withAffiliate } from "./affiliate";

// #ITALIA-EU-PARERE (decisione Andrea 2026-07-10): il bonus-CTA affiliato è
// pubblicità di scommesse → stessa allowlist geo dei link-book. Geo non ammessa
// o sconosciuta → la riga passa invariata (nessun campo `affiliate`).
describe("withAffiliate — gate geo allowlist sul bonus-CTA", () => {
  const saved: Record<string, string | undefined> = {};
  const KEYS = ["AFFILIATE_BOOKMAKER", "AFFILIATE_URL", "AFFILIATE_BONUS", "SPORTSBOOK_GEO_ALLOWLIST"];

  beforeEach(() => {
    for (const k of KEYS) saved[k] = process.env[k];
    process.env.AFFILIATE_BOOKMAKER = "FortunePlay";
    process.env.AFFILIATE_URL = "https://example.com/aff";
    process.env.AFFILIATE_BONUS = "100% welcome";
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("geo in allowlist → CTA attaccato", () => {
    process.env.SPORTSBOOK_GEO_ALLOWLIST = "MT,CW";
    const out = withAffiliate({ id: "x" }, "MT") as Record<string, unknown>;
    expect(out.affiliate).toMatchObject({ bookmaker: "FortunePlay", url: "https://example.com/aff" });
  });

  it("geo fuori allowlist → riga invariata", () => {
    process.env.SPORTSBOOK_GEO_ALLOWLIST = "MT,CW";
    const row = { id: "x" };
    expect(withAffiliate(row, "DE")).toEqual({ id: "x" });
  });

  it("hard-block IT/BE/NL anche se listate → mai CTA", () => {
    process.env.SPORTSBOOK_GEO_ALLOWLIST = "IT,BE,NL";
    expect((withAffiliate({ id: "x" }, "IT") as Record<string, unknown>).affiliate).toBeUndefined();
    expect((withAffiliate({ id: "x" }, "BE") as Record<string, unknown>).affiliate).toBeUndefined();
    expect((withAffiliate({ id: "x" }, "NL") as Record<string, unknown>).affiliate).toBeUndefined();
  });

  it("allowlist vuota, wildcard o geo sconosciuta → default nascosto", () => {
    process.env.SPORTSBOOK_GEO_ALLOWLIST = "";
    expect((withAffiliate({ id: "x" }, "MT") as Record<string, unknown>).affiliate).toBeUndefined();
    process.env.SPORTSBOOK_GEO_ALLOWLIST = "*";
    expect((withAffiliate({ id: "x" }, "MT") as Record<string, unknown>).affiliate).toBeUndefined();
    process.env.SPORTSBOOK_GEO_ALLOWLIST = "MT";
    expect((withAffiliate({ id: "x" }, null) as Record<string, unknown>).affiliate).toBeUndefined();
  });
});

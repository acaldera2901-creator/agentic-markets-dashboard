import { describe, it, expect } from "vitest";
import { CURRENT_CONSENT_VERSION } from "./legal-version";

describe("CURRENT_CONSENT_VERSION", () => {
  it("is a non-empty ISO-date-like version string (single source of truth)", () => {
    expect(typeof CURRENT_CONSENT_VERSION).toBe("string");
    expect(CURRENT_CONSENT_VERSION.length).toBeGreaterThan(0);
    expect(CURRENT_CONSENT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

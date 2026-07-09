import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { unsubToken, verifyUnsub } from "./crm-unsub";

describe("crm-unsub token (AES-256-GCM, fail-closed)", () => {
  const prev = process.env.CRM_UNSUB_SECRET;
  beforeAll(() => { process.env.CRM_UNSUB_SECRET = "test-secret-abc123"; });
  afterAll(() => {
    if (prev === undefined) delete process.env.CRM_UNSUB_SECRET;
    else process.env.CRM_UNSUB_SECRET = prev;
  });

  it("roundtrip: verifyUnsub(unsubToken(email)) === email", () => {
    const email = "user@example.com";
    expect(verifyUnsub(unsubToken(email))).toBe(email);
  });

  it("l'email NON è leggibile in chiaro dal token (cifrata)", () => {
    const email = "leak@example.com";
    const tok = unsubToken(email);
    expect(tok).not.toContain("leak");
    // base64url dell'email non deve comparire nel token
    expect(tok).not.toContain(Buffer.from(email).toString("base64url"));
  });

  it("token manomesso → rifiutato (null)", () => {
    const tok = unsubToken("user@example.com");
    const parts = tok.split(".");
    parts[1] = parts[1].slice(0, -2) + (parts[1].endsWith("AA") ? "BB" : "AA");
    expect(verifyUnsub(parts.join("."))).toBeNull();
  });

  it("formato errato → null", () => {
    expect(verifyUnsub("garbage")).toBeNull();
    expect(verifyUnsub("a.b")).toBeNull();
  });

  it("token firmato con altra chiave → rifiutato", () => {
    const tok = unsubToken("user@example.com");
    process.env.CRM_UNSUB_SECRET = "different-secret-xyz";
    expect(verifyUnsub(tok)).toBeNull();
    process.env.CRM_UNSUB_SECRET = "test-secret-abc123";
  });
});
